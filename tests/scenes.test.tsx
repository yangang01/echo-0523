import { StrictMode, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";
import { signalChannels } from "../lib/content";
import { ConfessionScene, FinaleScene, GameScene, JealousyScene, NightScene, PrivilegeScene, resolveSignalCue, SignalScene, WakeScene } from "../components/experience/scenes";

const noop = () => undefined;
let visibilityDescriptor: PropertyDescriptor | undefined;

afterEach(() => {
  if (visibilityDescriptor) Object.defineProperty(document, "visibilityState", visibilityDescriptor);
  else delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
  visibilityDescriptor = undefined;
  vi.restoreAllMocks();
  if (vi.isFakeTimers()) {
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});

function setVisibility(value: DocumentVisibilityState) {
  visibilityDescriptor ??= Object.getOwnPropertyDescriptor(document, "visibilityState");
  Object.defineProperty(document, "visibilityState", { configurable: true, value });
}

function pointer(target: Element, type: string, init: { pointerId: number; button?: number; clientX?: number; clientY?: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    button: { value: init.button ?? 0 },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
    isPrimary: { value: true },
  });
  fireEvent(target, event);
}

function clickManualStep() {
  fireEvent.click(screen.getByRole("button", { name: /读取下一段|进入下一幕/ }));
}

test("wake attracts Y, then reveals each echo only after a manual step", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<WakeScene onComplete={onComplete} onReveal={onReveal} />);
  const root = document.querySelector(".gravity-intro")!;
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ left: 10, top: 20, width: 400, height: 200 } as DOMRect);
  const capture = vi.fn();
  const release = vi.fn();
  Object.assign(y, { setPointerCapture: capture, releasePointerCapture: release, hasPointerCapture: () => true });

  pointer(y, "pointerdown", { pointerId: 7 });
  pointer(y, "pointermove", { pointerId: 8, clientX: 266, clientY: 116 });
  expect(onReveal).not.toHaveBeenCalled();
  pointer(y, "pointermove", { pointerId: 7, clientX: 266, clientY: 116 });
  pointer(y, "pointerup", { pointerId: 7 });
  expect(capture).toHaveBeenCalledWith(7);
  expect(release).toHaveBeenCalledWith(7);
  expect(onComplete).not.toHaveBeenCalled();

  expect(screen.getByRole("button", { name: "读取下一段" })).toBeEnabled();
  act(() => vi.advanceTimersByTime(120_000));
  expect(onReveal).not.toHaveBeenCalled();
  clickManualStep();
  clickManualStep();
  clickManualStep();
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["spark", "archive", "receiver"]);
  expect(onComplete).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "进入下一幕" })).toBeEnabled();
  clickManualStep();
  expect(onComplete).toHaveBeenCalledOnce();
  expect(screen.getByText("拖动 Y，靠近 U")).toBeInTheDocument();
  expect(screen.queryByText(/长按 3 秒|继续触碰/)).not.toBeInTheDocument();
});

test("wake cancels unclaimed gestures and timers without leaking completion", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const first = render(<WakeScene onComplete={onComplete} onReveal={onReveal} />);
  const root = document.querySelector(".gravity-intro")!;
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 200, height: 100 } as DOMRect);
  const release = vi.fn();
  Object.assign(y, { setPointerCapture: vi.fn(), releasePointerCapture: release, hasPointerCapture: () => true });
  pointer(y, "pointerdown", { pointerId: 1 });
  pointer(y, "pointermove", { pointerId: 1, clientX: 0, clientY: 0 });
  pointer(y, "pointercancel", { pointerId: 1 });
  expect(root).toHaveStyle({ "--attraction": "0" });
  expect(release).toHaveBeenCalledWith(1);
  pointer(y, "pointerdown", { pointerId: 2 });
  pointer(y, "lostpointercapture", { pointerId: 2 });
  pointer(y, "pointerdown", { pointerId: 3 });
  fireEvent(window, new Event("blur"));
  pointer(y, "pointerdown", { pointerId: 4 });
  setVisibility("hidden");
  fireEvent(document, new Event("visibilitychange"));
  first.unmount();
  act(() => vi.advanceTimersByTime(10_000));
  expect(onReveal).not.toHaveBeenCalled();
  expect(onComplete).not.toHaveBeenCalled();
});

test("wake keyboard fallback enables manual reading and context menus stay local", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  render(<WakeScene onComplete={onComplete} onReveal={noop} />);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  const root = document.querySelector(".gravity-intro")!;
  fireEvent.keyDown(y, { key: "Enter" });
  clickManualStep();
  clickManualStep();
  clickManualStep();
  clickManualStep();
  expect(onComplete).toHaveBeenCalledOnce();
  expect(fireEvent.contextMenu(y)).toBe(false);
  expect(fireEvent.contextMenu(root)).toBe(true);
});

test("wake tap fallback unlocks manual reading when mobile drag events are unavailable", () => {
  const onComplete = vi.fn();
  render(<WakeScene onComplete={onComplete} onReveal={noop} />);
  fireEvent.click(screen.getByRole("button", { name: "把 Y 靠近 U" }));
  expect(screen.getByRole("button", { name: "读取下一段" })).toBeEnabled();
});

test("wake clears pointer ownership even when capture release throws", () => {
  vi.useFakeTimers();
  const onReveal = vi.fn();
  render(<WakeScene onComplete={noop} onReveal={onReveal} />);
  const root = document.querySelector(".gravity-intro")!;
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 200, height: 100 } as DOMRect);
  Object.assign(y, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: () => { throw new Error("capture vanished"); } });

  pointer(y, "pointerdown", { pointerId: 1 });
  expect(() => pointer(y, "pointercancel", { pointerId: 1 })).not.toThrow();
  pointer(y, "pointerdown", { pointerId: 2 });
  pointer(y, "pointermove", { pointerId: 2, clientX: 128, clientY: 48 });
  clickManualStep();
  expect(onReveal).toHaveBeenCalledWith("spark");
});

test("jealousy decodes once then waits for manual echo steps", () => {
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<JealousyScene onComplete={onComplete} onReveal={onReveal} />);
  fireEvent.change(screen.getByRole("slider", { name: "滑动解码心跳" }), { target: { value: "100" } });
  expect(onReveal).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "读取下一段" })).toBeEnabled();
  clickManualStep();
  clickManualStep();
  clickManualStep();
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["praise", "smile", "meaning"]);
  expect(onComplete).not.toHaveBeenCalled();
  clickManualStep();
  expect(onComplete).toHaveBeenCalledOnce();
});

test("jealousy disables its native range while inactive", () => {
  render(<JealousyScene active={false} onComplete={noop} onReveal={noop} />);
  expect(screen.getByRole("slider", { name: "滑动解码心跳" })).toBeDisabled();
});

const automaticScenes = [
  ["confession", ConfessionScene, ["year", "month", "day", "locked"]],
  ["privilege", PrivilegeScene, ["diary", "remembered", "seen", "action"]],
  ["game", GameScene, ["near", "sync", "through", "complete"]],
  ["night", NightScene, ["third", "two-thirds", "connected", "frequency"]],
] as const;

test.each(automaticScenes)("%s reveals ordered cues and completes only through manual steps", (_scene, Component, ids) => {
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { unmount } = render(<Component onComplete={onComplete} onReveal={onReveal} />);
  expect(screen.getByRole("button", { name: "读取下一段" })).toBeEnabled();
  for (let index = 0; index < ids.length; index += 1) clickManualStep();
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(ids);
  expect(onComplete).not.toHaveBeenCalled();
  clickManualStep();
  expect(onComplete).toHaveBeenCalledOnce();
  unmount();
});

test.each(automaticScenes)("%s disables manual steps while inactive and paused", (scene, Component) => {
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { rerender } = render(<Component onComplete={onComplete} onReveal={onReveal} />);
  expect(screen.getByRole("button", { name: "读取下一段" })).toBeEnabled();
  rerender(<Component active={false} onComplete={onComplete} onReveal={onReveal} />);
  expect(screen.getByRole("button", { name: "读取下一段" })).toBeDisabled();
  clickManualStep();
  expect(onReveal).not.toHaveBeenCalled();
  expect(onComplete).not.toHaveBeenCalled();
});

test("manual scenes do not duplicate callbacks in StrictMode", () => {
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<StrictMode><GameScene onComplete={onComplete} onReveal={onReveal} /></StrictMode>);
  clickManualStep();
  clickManualStep();
  clickManualStep();
  clickManualStep();
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["near", "sync", "through", "complete"]);
  clickManualStep();
  expect(onComplete).toHaveBeenCalledOnce();
});

test("manual scenes preserve their queue when reactivated", () => {
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { rerender } = render(<GameScene onComplete={onComplete} onReveal={onReveal} />);
  clickManualStep();
  rerender(<GameScene active={false} onComplete={onComplete} onReveal={onReveal} />);
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["near"]);
  rerender(<GameScene onComplete={onComplete} onReveal={onReveal} />);
  clickManualStep();
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["near", "sync"]);
});

test("signal locks one selected channel then reveals channel replies manually", () => {
  const onResponse = vi.fn();
  const onReveal = vi.fn();
  const onChannelSelected = vi.fn();
  const onComplete = vi.fn();
  render(<SignalScene onResponse={onResponse} onComplete={onComplete} onReveal={onReveal} onChannelSelected={onChannelSelected} />);
  expect(screen.getAllByRole("button")).toHaveLength(4);
  fireEvent.click(screen.getByRole("button", { name: "想吐槽一下" }));
  expect(onChannelSelected).toHaveBeenCalledOnce();
  expect(onChannelSelected).toHaveBeenCalledWith("rant");
  expect(screen.getByRole("button", { name: "读取下一段" })).toBeEnabled();
  expect(screen.getByText("频道已接通 · 想吐槽一下")).toBeInTheDocument();
  const responses = signalChannels.find((channel) => channel.id === "rant")!.responses;
  expect(screen.queryByText(responses[0].text)).not.toBeInTheDocument();
  clickManualStep();
  expect(screen.getByText(responses[0].text)).toBeInTheDocument();
  expect(document.querySelector(".response-live")).toHaveTextContent(responses[0].text);
  expect(screen.getByRole("status")).toHaveTextContent(responses[0].text);
  expect(screen.queryByText(responses[1].text)).not.toBeInTheDocument();
  clickManualStep();
  expect(screen.getByText(responses[1].text)).toBeInTheDocument();
  expect(document.querySelector(".response-live")).toHaveTextContent(responses[1].text);
  expect(screen.getByRole("status")).toHaveTextContent(responses[1].text);
  expect(screen.queryByText(responses[2].text)).not.toBeInTheDocument();
  clickManualStep();
  expect(screen.getByText(responses[2].text)).toBeInTheDocument();
  expect(document.querySelector(".response-live")).toHaveTextContent(responses[2].text);
  expect(screen.getByRole("status")).toHaveTextContent(responses[2].text);
  expect(onResponse.mock.calls.map(([type]) => type)).toEqual(["curious", "compliment", "ally"]);
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["curious", "compliment", "ally"]);
  clickManualStep();
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["curious", "compliment", "ally", "close"]);
  clickManualStep();
  expect(onComplete).toHaveBeenCalledOnce();
});

test("signal cue resolver ignores malformed response slots", () => {
  const channel = signalChannels[0];
  expect(resolveSignalCue({ at: 1, id: "$response:bad" }, channel)).toBeNull();
  expect(resolveSignalCue({ at: 1, id: "$response:9" }, channel)).toBeNull();
  expect(resolveSignalCue({ at: 1, id: "$response:1" }, channel)).toEqual({ at: 1, id: "compliment" });
});

test("signal disables choice and manual controls while inactive", () => {
  const onResponse = vi.fn();
  const props = { onResponse, onComplete: vi.fn(), onReveal: vi.fn(), onChannelSelected: vi.fn() };
  const { rerender } = render(<SignalScene {...props} active={false} />);
  expect(screen.getAllByRole("button")).toHaveLength(4);
  for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  rerender(<SignalScene {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "发生了小事" }));
  expect(screen.getByRole("button", { name: "读取下一段" })).toBeEnabled();
  rerender(<SignalScene {...props} active={false} />);
  expect(screen.getByRole("button", { name: "读取下一段" })).toBeDisabled();
  clickManualStep();
  expect(onResponse).not.toHaveBeenCalled();
});

test("finale keeps its relationship clock running while echo steps stay manual", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { rerender, unmount } = render(<FinaleScene onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);
  expect(document.querySelector(".finale-coordinate")).toHaveTextContent("05:23");
  const clock = document.querySelector(".love-clock")!;
  const beforeEcho = clock.textContent;
  expect(screen.queryByText("你说的有的没的，在我这里都不是小事。")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "读取下一段" })).toBeEnabled();
  act(() => vi.advanceTimersByTime(1000));
  expect(clock.textContent).not.toBe(beforeEcho);
  act(() => vi.advanceTimersByTime(120_000));
  expect(screen.queryByRole("button", { name: "重新进入这片宇宙" })).not.toBeInTheDocument();
  clickManualStep();
  clickManualStep();
  clickManualStep();
  clickManualStep();
  expect(document.querySelector(".final-line")).toHaveTextContent("你说的有的没的，在我这里都不是小事。");
  expect(screen.getByRole("button", { name: "重新进入这片宇宙" })).toBeInTheDocument();
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["recap", "present", "echo"]);
  expect(onComplete).toHaveBeenCalledOnce();
  rerender(<FinaleScene active={false} onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);
  const afterPresentation = clock.textContent;
  act(() => vi.advanceTimersByTime(1000));
  expect(clock.textContent).not.toBe(afterPresentation);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test("finale cleans its manual queue and clock when inactive", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { rerender, unmount } = render(<FinaleScene onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);
  rerender(<FinaleScene active={false} onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);
  unmount();
  expect(screen.queryByRole("button", { name: "读取下一段" })).not.toBeInTheDocument();
  expect(onReveal).not.toHaveBeenCalled();
  expect(onComplete).not.toHaveBeenCalled();
});

test("manual wake completion does not update its parent during render", () => {
  vi.useFakeTimers();
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  function Parent() {
    const [done, setDone] = useState(false);
    return done ? <p>完成</p> : <WakeScene onComplete={() => setDone(true)} onReveal={noop} />;
  }
  render(<Parent />);
  fireEvent.keyDown(screen.getByRole("button", { name: "把 Y 靠近 U" }), { key: " " });
  clickManualStep();
  clickManualStep();
  clickManualStep();
  clickManualStep();
  expect(screen.getByText("完成")).toBeInTheDocument();
  expect(error).not.toHaveBeenCalled();
});
