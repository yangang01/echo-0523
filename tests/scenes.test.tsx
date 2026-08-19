import { StrictMode } from "react";
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

test("wake attracts Y with its owner pointer and immediately reveals only the first echo", () => {
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
  expect(onReveal).toHaveBeenCalledWith("spark");
  expect(onComplete).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(120_000));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["spark"]);
  expect(onComplete).not.toHaveBeenCalled();
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

test("wake keyboard fallback reveals the first echo without arming a timer", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<WakeScene onComplete={onComplete} onReveal={onReveal} />);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  const root = document.querySelector(".gravity-intro")!;
  fireEvent.keyDown(y, { key: "Enter" });
  expect(onReveal).toHaveBeenCalledWith("spark");
  act(() => vi.advanceTimersByTime(120_000));
  expect(onReveal).toHaveBeenCalledOnce();
  expect(onComplete).not.toHaveBeenCalled();
  expect(fireEvent.contextMenu(y)).toBe(false);
  expect(fireEvent.contextMenu(root)).toBe(true);
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
  expect(onReveal).toHaveBeenCalledWith("spark");
});

test("jealousy decodes once then immediately reveals only its first echo", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<JealousyScene onComplete={onComplete} onReveal={onReveal} />);
  fireEvent.change(screen.getByRole("slider", { name: "滑动解码心跳" }), { target: { value: "100" } });
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["praise"]);
  act(() => vi.advanceTimersByTime(120_000));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["praise"]);
  expect(onComplete).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "发送解码脉冲" })).not.toBeInTheDocument();
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

test.each(automaticScenes)("%s reveals only its first cue and never advances on elapsed time", (scene, Component, ids) => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { unmount } = render(<Component onComplete={onComplete} onReveal={onReveal} />);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual([ids[0]]);
  act(() => vi.advanceTimersByTime(120_000));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual([ids[0]]);
  expect(onComplete).not.toHaveBeenCalled();
  unmount();
});

test.each(automaticScenes)("%s waits while inactive and reveals once when activated", (_scene, Component) => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { rerender } = render(<Component active={false} onComplete={onComplete} onReveal={onReveal} />);
  expect(onReveal).not.toHaveBeenCalled();
  rerender(<Component onComplete={onComplete} onReveal={onReveal} />);
  expect(onReveal).toHaveBeenCalledOnce();
  act(() => vi.advanceTimersByTime(120_000));
  expect(onReveal).toHaveBeenCalledOnce();
  expect(onComplete).not.toHaveBeenCalled();
});

test("manual scenes do not duplicate their first reveal in StrictMode", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<StrictMode><GameScene onComplete={onComplete} onReveal={onReveal} /></StrictMode>);
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["near"]);
  expect(onComplete).not.toHaveBeenCalled();
});

test("signal locks one selected channel, reveals its first reply, and never advances by time", () => {
  vi.useFakeTimers();
  const onReveal = vi.fn();
  const onChannelSelected = vi.fn();
  const onComplete = vi.fn();
  const view = render(<SignalScene activeId={null} onComplete={onComplete} onReveal={onReveal} onChannelSelected={onChannelSelected} />);
  expect(screen.getAllByRole("button")).toHaveLength(4);
  fireEvent.click(screen.getByRole("button", { name: "想吐槽一下" }));
  expect(onChannelSelected).toHaveBeenCalledOnce();
  expect(onChannelSelected).toHaveBeenCalledWith("rant");
  expect(screen.getByText("频道已接通 · 想吐槽一下")).toBeInTheDocument();
  const responses = signalChannels.find((channel) => channel.id === "rant")!.responses;
  view.rerender(<SignalScene activeId="curious" onComplete={onComplete} onReveal={onReveal} onChannelSelected={onChannelSelected} />);
  expect(screen.getByText(responses[0].text)).toBeInTheDocument();
  expect(onReveal).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "进入下一幕" })).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(120_000));
  expect(screen.getByText(responses[0].text)).toBeInTheDocument();
  expect(onReveal).toHaveBeenCalledOnce();
  expect(document.querySelector(".response-live")).toHaveTextContent(responses[0].text);
  expect(screen.getByRole("status")).toHaveTextContent(responses[0].text);
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["curious"]);
  expect(onComplete).not.toHaveBeenCalled();
});

test("signal cue resolver ignores malformed response slots", () => {
  const channel = signalChannels[0];
  expect(resolveSignalCue({ at: 1, id: "$response:bad" }, channel)).toBeNull();
  expect(resolveSignalCue({ at: 1, id: "$response:9" }, channel)).toBeNull();
  expect(resolveSignalCue({ at: 1, id: "$response:1" }, channel)).toEqual({ at: 1, id: "compliment" });
});

test("signal cleans timers and disables choice controls while inactive", () => {
  vi.useFakeTimers();
  const props = { activeId: null, onComplete: vi.fn(), onReveal: vi.fn(), onChannelSelected: vi.fn() };
  const { rerender } = render(<SignalScene {...props} active={false} />);
  expect(screen.getAllByRole("button")).toHaveLength(4);
  for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  rerender(<SignalScene {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "发生了小事" }));
  expect(props.onReveal).toHaveBeenCalledOnce();
  rerender(<SignalScene {...props} active={false} />);
  act(() => vi.advanceTimersByTime(120_000));
  expect(props.onReveal).toHaveBeenCalledOnce();
});

test("finale reveals only its first recap while its relationship clock keeps running", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { rerender, unmount } = render(<FinaleScene onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);
  expect(document.querySelector(".finale-coordinate")).toHaveTextContent("05:23");
  const clock = document.querySelector(".love-clock")!;
  const beforeEcho = clock.textContent;
  expect(screen.queryByText("你说的有的没的，在我这里都不是小事。")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "读取回音 1 / 3" })).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1000));
  expect(clock.textContent).not.toBe(beforeEcho);
  act(() => vi.advanceTimersByTime(120_000));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["recap"]);
  expect(screen.queryByRole("button", { name: "重新进入这片宇宙" })).not.toBeInTheDocument();
  expect(onComplete).not.toHaveBeenCalled();
  rerender(<FinaleScene active={false} onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);
  const afterPresentation = clock.textContent;
  act(() => vi.advanceTimersByTime(1000));
  expect(clock.textContent).not.toBe(afterPresentation);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test("finale waits to reveal while inactive and cleans its clock on unmount", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { rerender, unmount } = render(<FinaleScene active={false} onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);
  expect(onReveal).not.toHaveBeenCalled();
  rerender(<FinaleScene onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);
  expect(onReveal).toHaveBeenCalledWith("recap");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(onComplete).not.toHaveBeenCalled();
});
