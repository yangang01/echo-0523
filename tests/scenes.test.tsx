import { StrictMode, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";
import { sceneTimelines } from "../lib/scene-timelines";
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

test("wake attracts Y with its owner pointer and only then starts the cinematic timeline", () => {
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

  act(() => vi.advanceTimersByTime(sceneTimelines.wake.reveals[0].at));
  expect(onReveal).toHaveBeenCalledWith("spark");
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.reveals[1].at - sceneTimelines.wake.reveals[0].at));
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.reveals[2].at - sceneTimelines.wake.reveals[1].at));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["spark", "archive", "receiver"]);
  expect(onComplete).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.presentMs - sceneTimelines.wake.reveals[2].at));
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

test("wake keyboard fallback begins the same timeline and context menus stay local", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  render(<WakeScene onComplete={onComplete} onReveal={noop} />);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  const root = document.querySelector(".gravity-intro")!;
  fireEvent.keyDown(y, { key: "Enter" });
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.presentMs));
  expect(onComplete).toHaveBeenCalledOnce();
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
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.reveals[0].at));
  expect(onReveal).toHaveBeenCalledWith("spark");
});

test("jealousy decodes continuous range input without a pulse control", () => {
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<JealousyScene onComplete={onComplete} onReveal={onReveal} />);
  fireEvent.change(screen.getByRole("slider", { name: "滑动解码心跳" }), { target: { value: "100" } });
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["praise", "smile", "meaning"]);
  expect(onComplete).toHaveBeenCalledOnce();
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

test.each(automaticScenes)("%s automatically reveals ordered cues and completes once", (scene, Component, ids) => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { unmount } = render(<Component onComplete={onComplete} onReveal={onReveal} />);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  act(() => vi.advanceTimersByTime(sceneTimelines[scene].presentMs));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(ids);
  expect(onComplete).toHaveBeenCalledOnce();
  unmount();
});

test.each(automaticScenes)("%s cleans automatic timers on inactive rerender and unmount", (scene, Component) => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { rerender, unmount } = render(<Component onComplete={onComplete} onReveal={onReveal} />);
  rerender(<Component active={false} onComplete={onComplete} onReveal={onReveal} />);
  unmount();
  act(() => vi.advanceTimersByTime(sceneTimelines[scene].presentMs + 1));
  expect(onReveal).not.toHaveBeenCalled();
  expect(onComplete).not.toHaveBeenCalled();
});

test("automatic scenes do not duplicate timers in StrictMode", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<StrictMode><GameScene onComplete={onComplete} onReveal={onReveal} /></StrictMode>);
  act(() => vi.advanceTimersByTime(sceneTimelines.game.presentMs));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["near", "sync", "through", "complete"]);
  expect(onComplete).toHaveBeenCalledOnce();
});

test("automatic scenes restart pending timers from zero after reactivation without duplicate callbacks", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { rerender } = render(<GameScene onComplete={onComplete} onReveal={onReveal} />);
  act(() => vi.advanceTimersByTime(sceneTimelines.game.reveals[0].at));
  rerender(<GameScene active={false} onComplete={onComplete} onReveal={onReveal} />);
  act(() => vi.advanceTimersByTime(sceneTimelines.game.presentMs));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["near"]);
  rerender(<GameScene onComplete={onComplete} onReveal={onReveal} />);
  act(() => vi.advanceTimersByTime(sceneTimelines.game.reveals[1].at - 1));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["near"]);
  act(() => vi.advanceTimersByTime(1));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["near", "sync"]);
  act(() => vi.advanceTimersByTime(sceneTimelines.game.presentMs - sceneTimelines.game.reveals[1].at));
  expect(onComplete).toHaveBeenCalledOnce();
});

test("automatic scenes preserve remaining cue and completion time across repeated suspension", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const view = render(<GameScene onComplete={onComplete} onReveal={onReveal} />);

  act(() => vi.advanceTimersByTime(sceneTimelines.game.reveals[0].at - 1));
  view.rerender(<GameScene paused onComplete={onComplete} onReveal={onReveal} />);
  act(() => vi.advanceTimersByTime(30_000));
  expect(onReveal).not.toHaveBeenCalled();
  view.rerender(<GameScene onComplete={onComplete} onReveal={onReveal} />);
  act(() => vi.advanceTimersByTime(1));
  expect(onReveal).toHaveBeenCalledWith("near");

  act(() => vi.advanceTimersByTime(500));
  view.rerender(<GameScene paused onComplete={onComplete} onReveal={onReveal} />);
  act(() => vi.advanceTimersByTime(10_000));
  view.rerender(<GameScene onComplete={onComplete} onReveal={onReveal} />);
  act(() => vi.advanceTimersByTime(sceneTimelines.game.presentMs - sceneTimelines.game.reveals[0].at - 500));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["near", "sync", "through", "complete"]);
  expect(onComplete).toHaveBeenCalledOnce();
});

test("signal locks one selected channel then schedules channel-derived replies", () => {
  vi.useFakeTimers();
  const onResponse = vi.fn();
  const onReveal = vi.fn();
  const onChannelSelected = vi.fn();
  const onComplete = vi.fn();
  render(<SignalScene onResponse={onResponse} onComplete={onComplete} onReveal={onReveal} onChannelSelected={onChannelSelected} />);
  expect(screen.getAllByRole("button")).toHaveLength(4);
  fireEvent.click(screen.getByRole("button", { name: "想吐槽一下" }));
  expect(onChannelSelected).toHaveBeenCalledOnce();
  expect(onChannelSelected).toHaveBeenCalledWith("rant");
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  const responses = signalChannels.find((channel) => channel.id === "rant")!.responses;
  expect(screen.queryByText(responses[0].text)).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1200));
  expect(screen.getByText(responses[0].text)).toBeInTheDocument();
  expect(document.querySelector(".response-live")).toHaveTextContent(responses[0].text);
  expect(screen.getByRole("status")).toHaveTextContent(responses[0].text);
  expect(screen.queryByText(responses[1].text)).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1900));
  expect(screen.getByText(responses[1].text)).toBeInTheDocument();
  expect(document.querySelector(".response-live")).toHaveTextContent(responses[1].text);
  expect(screen.getByRole("status")).toHaveTextContent(responses[1].text);
  expect(screen.queryByText(responses[2].text)).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1900));
  expect(screen.getByText(responses[2].text)).toBeInTheDocument();
  expect(document.querySelector(".response-live")).toHaveTextContent(responses[2].text);
  expect(screen.getByRole("status")).toHaveTextContent(responses[2].text);
  expect(onResponse.mock.calls.map(([type]) => type)).toEqual(["curious", "compliment", "ally"]);
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["curious", "compliment", "ally"]);
  act(() => vi.advanceTimersByTime(1300));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["curious", "compliment", "ally", "close"]);
  expect(onComplete).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(900));
  expect(onComplete).toHaveBeenCalledOnce();
});

test("signal cue resolver ignores malformed response slots", () => {
  const channel = signalChannels[0];
  expect(resolveSignalCue({ at: 1, id: "$response:bad" }, channel)).toBeNull();
  expect(resolveSignalCue({ at: 1, id: "$response:9" }, channel)).toBeNull();
  expect(resolveSignalCue({ at: 1, id: "$response:1" }, channel)).toEqual({ at: 1, id: "compliment" });
});

test("signal cleans timers and disables choice controls while inactive", () => {
  vi.useFakeTimers();
  const onResponse = vi.fn();
  const props = { onResponse, onComplete: vi.fn(), onReveal: vi.fn(), onChannelSelected: vi.fn() };
  const { rerender } = render(<SignalScene {...props} active={false} />);
  expect(screen.getAllByRole("button")).toHaveLength(4);
  for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  rerender(<SignalScene {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "发生了小事" }));
  rerender(<SignalScene {...props} active={false} />);
  act(() => vi.advanceTimersByTime(sceneTimelines.signal.presentMs));
  expect(onResponse).not.toHaveBeenCalled();
});

test("finale keeps its relationship clock running from entry until unmount", () => {
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
  act(() => vi.advanceTimersByTime(sceneTimelines.finale.reveals[2].at - 1001));
  expect(screen.queryByRole("button", { name: "重新进入这片宇宙" })).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(document.querySelector(".final-line")).toHaveTextContent("你说的有的没的，在我这里都不是小事。");
  expect(screen.getByRole("button", { name: "重新进入这片宇宙" })).toBeInTheDocument();
  expect(onComplete).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(sceneTimelines.finale.presentMs - sceneTimelines.finale.reveals[2].at));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["recap", "present", "echo"]);
  expect(onComplete).toHaveBeenCalledOnce();
  rerender(<FinaleScene active={false} onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);
  const afterPresentation = clock.textContent;
  act(() => vi.advanceTimersByTime(1000));
  expect(clock.textContent).not.toBe(afterPresentation);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test("finale cleans its automatic recap and clock timers when inactive", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  const { rerender, unmount } = render(<FinaleScene onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);
  rerender(<FinaleScene active={false} onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);
  unmount();
  act(() => vi.advanceTimersByTime(sceneTimelines.finale.presentMs + 1));
  expect(onReveal).not.toHaveBeenCalled();
  expect(onComplete).not.toHaveBeenCalled();
});

test("automatic wake completion does not update its parent during render", () => {
  vi.useFakeTimers();
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  function Parent() {
    const [done, setDone] = useState(false);
    return done ? <p>完成</p> : <WakeScene onComplete={() => setDone(true)} onReveal={noop} />;
  }
  render(<Parent />);
  fireEvent.keyDown(screen.getByRole("button", { name: "把 Y 靠近 U" }), { key: " " });
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.presentMs));
  expect(screen.getByText("完成")).toBeInTheDocument();
  expect(error).not.toHaveBeenCalled();
});
