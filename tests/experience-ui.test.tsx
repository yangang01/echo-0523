import { forwardRef, useImperativeHandle } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { EchoExperience } from "../components/experience/EchoExperience";
import { sceneTimelines } from "../lib/scene-timelines";

const audioStart = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
const audioProps = vi.hoisted(() => [] as Array<{
  enabled: boolean;
  paused: boolean;
  finale: boolean;
}>);

vi.mock("../components/experience/AudioEngine", () => ({
  AudioEngine: forwardRef(function MockAudioEngine(
    props: { enabled: boolean; paused: boolean; finale: boolean },
    ref,
  ) {
    audioProps.push(props);
    useImperativeHandle(ref, () => ({ requestStart: audioStart }));
    return null;
  }),
}));

let visibilityDescriptor: PropertyDescriptor | undefined;
let visibilityCaptured = false;

beforeEach(() => {
  audioStart.mockReset();
  audioStart.mockResolvedValue(false);
  audioProps.length = 0;
});

afterEach(() => {
  if (visibilityDescriptor) Object.defineProperty(document, "visibilityState", visibilityDescriptor);
  else delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
  visibilityDescriptor = undefined;
  visibilityCaptured = false;
  vi.restoreAllMocks();
  if (vi.isFakeTimers()) {
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});

function setVisibility(value: DocumentVisibilityState) {
  if (!visibilityCaptured) {
    visibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
    visibilityCaptured = true;
  }
  Object.defineProperty(document, "visibilityState", { configurable: true, value });
  fireEvent(document, new Event("visibilitychange"));
}

function pointer(target: Element, type: string, init: { pointerId: number; clientX?: number; clientY?: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    button: { value: 0 },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
    isPrimary: { value: true },
  });
  fireEvent(target, event);
}

function attractOpeningCores() {
  const gravity = document.querySelector(".gravity-intro")!;
  vi.spyOn(gravity, "getBoundingClientRect").mockReturnValue({ left: 10, top: 20, width: 400, height: 200 } as DOMRect);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  pointer(y, "pointerdown", { pointerId: 4, clientX: 70, clientY: 90 });
  pointer(y, "pointermove", { pointerId: 4, clientX: 266, clientY: 116 });
  pointer(y, "pointerup", { pointerId: 4, clientX: 266, clientY: 116 });
}

function swipeReadySurface() {
  const surface = screen.getByTestId("gesture-surface");
  pointer(surface, "pointerdown", { pointerId: 9, clientX: 190, clientY: 700 });
  act(() => vi.advanceTimersByTime(180));
  pointer(surface, "pointerup", { pointerId: 9, clientX: 185, clientY: 560 });
}

function finishWakePresentation() {
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.enterMs));
  attractOpeningCores();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.presentMs));
}

function waitForAutomaticAdvance(scene: keyof typeof sceneTimelines) {
  act(() => vi.advanceTimersByTime(12_000));
  act(() => vi.advanceTimersByTime(sceneTimelines[scene].exitMs));
}

function finishAutomaticScene(scene: "confession" | "privilege" | "game" | "night" | "finale") {
  act(() => vi.advanceTimersByTime(sceneTimelines[scene].enterMs));
  act(() => vi.advanceTimersByTime(sceneTimelines[scene].presentMs));
}

function enterSignalScene() {
  finishWakePresentation();
  waitForAutomaticAdvance("wake");

  act(() => vi.advanceTimersByTime(sceneTimelines.jealousy.enterMs));
  fireEvent.change(screen.getByRole("slider", { name: "滑动解码心跳" }), { target: { value: "100" } });
  act(() => vi.advanceTimersByTime(sceneTimelines.jealousy.presentMs));
  waitForAutomaticAdvance("jealousy");

  finishAutomaticScene("confession");
  waitForAutomaticAdvance("confession");
  finishAutomaticScene("privilege");
  waitForAutomaticAdvance("privilege");
  act(() => vi.advanceTimersByTime(sceneTimelines.signal.enterMs));
}

test("renders the persistent YU visual, current scene, progress, and sound control", () => {
  render(<EchoExperience />);
  expect(document.querySelector(".echo-canvas")).toBeInTheDocument();
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开启声音" })).toBeInTheDocument();
  expect(screen.getByText("只有小宝贝能进入")).toBeInTheDocument();
  expect(document.querySelector(".cinematic-plate")).toBeInTheDocument();
});

test("the first non-sound pointer interaction starts music and confirms ON", async () => {
  audioStart.mockResolvedValue(true);
  render(<EchoExperience />);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });

  fireEvent.pointerDown(y, { pointerId: 4, isPrimary: true, button: 0 });
  expect(audioStart).toHaveBeenCalledOnce();
  await screen.findByRole("button", { name: "关闭声音" });

  fireEvent.pointerDown(y, { pointerId: 5, isPrimary: true, button: 0 });
  expect(audioStart).toHaveBeenCalledOnce();
  expect(audioProps.at(-1)).toMatchObject({
    enabled: true,
    paused: false,
    finale: false,
  });
});

test("a click-only WebView interaction still unlocks the score once", async () => {
  audioStart.mockResolvedValue(true);
  render(<EchoExperience />);

  fireEvent.click(screen.getByRole("button", { name: "把 Y 靠近 U" }));

  expect(audioStart).toHaveBeenCalledOnce();
  await screen.findByRole("button", { name: "关闭声音" });
});

test("a blocked automatic start remains OFF and retries on the next gesture", async () => {
  audioStart.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<EchoExperience />);

  fireEvent.pointerDown(screen.getByRole("button", { name: "把 Y 靠近 U" }), {
    pointerId: 4,
    isPrimary: true,
    button: 0,
  });
  expect(await screen.findByRole("button", { name: "开启声音" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("group", { name: "电影场景手势控制" }), {
    key: "ArrowDown",
  });

  await screen.findByRole("button", { name: "关闭声音" });
  expect(audioStart).toHaveBeenCalledTimes(2);
});

test("the sound button follows explicit toggle semantics without auto double-toggle", async () => {
  audioStart.mockResolvedValue(true);
  render(<EchoExperience />);
  const sound = screen.getByRole("button", { name: "开启声音" });

  fireEvent.pointerDown(sound, { pointerId: 8, isPrimary: true, button: 0 });
  fireEvent.click(sound);
  await screen.findByRole("button", { name: "关闭声音" });
  expect(audioStart).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "关闭声音" }));
  expect(screen.getByRole("button", { name: "开启声音" })).toBeVisible();
  fireEvent.pointerDown(screen.getByRole("button", { name: "把 Y 靠近 U" }), {
    pointerId: 9,
    isPrimary: true,
    button: 0,
  });
  expect(audioStart).toHaveBeenCalledOnce();
});

test("has no long-press, repeated-click, or continue controls and advances exactly once after a ready swipe", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);

  expect(screen.queryByText(/长按 3 秒|继续航行|读取回音 1 \/ 3|按住连接深夜频率|发送解码脉冲/)).not.toBeInTheDocument();
  finishWakePresentation();
  expect(screen.getByText("向上划过星轨")).toBeInTheDocument();
  swipeReadySurface();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(10_000));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("reading pauses progression and release restarts the full twelve-second idle window", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  finishWakePresentation();
  const status = screen.getByRole("status");

  pointer(status, "pointerdown", { pointerId: 13, clientX: 120, clientY: 600 });
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  pointer(status, "pointerup", { pointerId: 13, clientX: 120, clientY: 600 });
  act(() => vi.advanceTimersByTime(11_999));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("sound focus pauses ready idle and blur restarts a full twelve seconds", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  finishWakePresentation();
  act(() => vi.advanceTimersByTime(11_900));

  const sound = screen.getByRole("button", { name: "开启声音" });
  fireEvent.focus(sound);
  fireEvent.focus(sound);
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();

  fireEvent.blur(sound);
  fireEvent.blur(sound);
  act(() => vi.advanceTimersByTime(11_999));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("a sound click resets ready idle even on devices that do not focus buttons", async () => {
  vi.useFakeTimers();
  audioStart.mockResolvedValue(true);
  render(<EchoExperience />);
  finishWakePresentation();
  act(() => vi.advanceTimersByTime(11_900));

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "开启声音" }));
    await Promise.resolve();
  });
  expect(screen.getByRole("button", { name: "关闭声音" })).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(11_999));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("a primary sound hold pauses at the final ready millisecond and release restarts twelve seconds", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  finishWakePresentation();
  act(() => vi.advanceTimersByTime(11_999));

  const sound = screen.getByRole("button", { name: "开启声音" });
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  Object.assign(sound, { setPointerCapture, releasePointerCapture, hasPointerCapture: () => true });
  pointer(sound, "pointerdown", { pointerId: 31 });
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();

  pointer(sound, "pointerup", { pointerId: 99 });
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();

  pointer(sound, "pointerup", { pointerId: 31 });
  expect(setPointerCapture).toHaveBeenCalledWith(31);
  expect(releasePointerCapture).toHaveBeenCalledWith(31);
  act(() => vi.advanceTimersByTime(11_999));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test.each([
  ["pointer cancellation", (sound: HTMLElement) => pointer(sound, "pointercancel", { pointerId: 32 })],
  ["lost pointer capture", (sound: HTMLElement) => pointer(sound, "lostpointercapture", { pointerId: 32 })],
  ["window blur", () => fireEvent(window, new Event("blur"))],
])("%s releases a held sound control and restarts ready idle", (_label, release) => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  finishWakePresentation();
  act(() => vi.advanceTimersByTime(11_999));

  const sound = screen.getByRole("button", { name: "开启声音" });
  Object.assign(sound, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: () => false });
  pointer(sound, "pointerdown", { pointerId: 32 });
  act(() => vi.advanceTimersByTime(20_000));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  release(sound);

  act(() => vi.advanceTimersByTime(11_999));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("sound pointer and focus ownership overlap without an early resume", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  finishWakePresentation();
  act(() => vi.advanceTimersByTime(11_999));

  const sound = screen.getByRole("button", { name: "开启声音" });
  Object.assign(sound, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: () => true });
  pointer(sound, "pointerdown", { pointerId: 33 });
  fireEvent.focus(sound);
  pointer(sound, "pointerup", { pointerId: 33 });
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();

  fireEvent.blur(sound);
  act(() => vi.advanceTimersByTime(11_999));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("unmount releases an owned sound pointer exactly once", () => {
  const view = render(<EchoExperience />);
  const sound = screen.getByRole("button", { name: "开启声音" });
  const releasePointerCapture = vi.fn();
  Object.assign(sound, { setPointerCapture: vi.fn(), releasePointerCapture, hasPointerCapture: () => true });

  pointer(sound, "pointerdown", { pointerId: 34 });
  view.unmount();

  expect(releasePointerCapture).toHaveBeenCalledOnce();
  expect(releasePointerCapture).toHaveBeenCalledWith(34);
});

test("visibility keeps the remaining ready idle time instead of restarting it", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  finishWakePresentation();
  act(() => vi.advanceTimersByTime(11_900));

  act(() => setVisibility("hidden"));
  expect(audioProps.at(-1)).toMatchObject({ paused: true });
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  act(() => setVisibility("visible"));
  act(() => vi.advanceTimersByTime(99));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("keyboard focus pauses ready idle and one navigation key advances exactly once", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  finishWakePresentation();
  act(() => vi.advanceTimersByTime(11_900));

  const surface = screen.getByTestId("gesture-surface");
  fireEvent.focus(surface);
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();

  fireEvent.keyDown(surface, { key: "ArrowDown" });
  fireEvent.keyUp(surface, { key: "ArrowDown" });
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("the YU visual node survives a real scene transition", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  const canvas = document.querySelector(".echo-canvas");
  finishWakePresentation();
  waitForAutomaticAdvance("wake");
  expect(document.querySelector(".echo-canvas")).toBe(canvas);
});

test("a signal choice can enter scene six immediately without waiting for its narration or idle timer", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  enterSignalScene();

  fireEvent.click(screen.getByRole("button", { name: "发生了小事" }));
  const advance = screen.getByRole("button", { name: "进入下一幕" });
  fireEvent.click(advance);
  fireEvent.click(advance);
  act(() => vi.advanceTimersByTime(sceneTimelines.signal.exitMs - 1));
  expect(screen.getByText("05 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByText("06 / 08")).toBeInTheDocument();
});

test("an upward drag that starts on the transcript reviews copy but never advances", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  finishWakePresentation();
  const status = screen.getByRole("status");

  pointer(status, "pointerdown", { pointerId: 21, clientX: 190, clientY: 700 });
  act(() => vi.advanceTimersByTime(120));
  pointer(status, "pointerup", { pointerId: 21, clientX: 185, clientY: 540 });
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();

  swipeReadySurface();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("visibility preserves the final millisecond of enter and exit choreography", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });

  act(() => vi.advanceTimersByTime(sceneTimelines.wake.enterMs - 1));
  expect(y).toBeDisabled();
  act(() => setVisibility("hidden"));
  act(() => vi.advanceTimersByTime(20_000));
  act(() => setVisibility("visible"));
  expect(y).toBeDisabled();
  act(() => vi.advanceTimersByTime(1));
  expect(y).toBeEnabled();

  attractOpeningCores();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.presentMs));
  swipeReadySurface();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs - 1));
  act(() => setVisibility("hidden"));
  act(() => vi.advanceTimersByTime(20_000));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  act(() => setVisibility("visible"));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("visibility pauses an active reveal and resumes from the exact remaining millisecond", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.enterMs));
  attractOpeningCores();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.reveals[0].at - 1));

  act(() => setVisibility("hidden"));
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  act(() => setVisibility("visible"));
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("status")).toHaveTextContent("这片宇宙原本安静得没有方向");
});

test("the finale stays on scene eight after completion and never arms swipe or idle advance", () => {
  vi.useFakeTimers();
  expect(document.visibilityState).toBe("visible");
  render(<EchoExperience />);
  finishWakePresentation();
  waitForAutomaticAdvance("wake");

  act(() => vi.advanceTimersByTime(sceneTimelines.jealousy.enterMs));
  fireEvent.change(screen.getByRole("slider", { name: "滑动解码心跳" }), { target: { value: "100" } });
  act(() => vi.advanceTimersByTime(sceneTimelines.jealousy.presentMs));
  waitForAutomaticAdvance("jealousy");

  finishAutomaticScene("confession");
  waitForAutomaticAdvance("confession");
  finishAutomaticScene("privilege");
  waitForAutomaticAdvance("privilege");

  act(() => vi.advanceTimersByTime(sceneTimelines.signal.enterMs));
  fireEvent.click(screen.getByRole("button", { name: "发生了小事" }));
  act(() => vi.advanceTimersByTime(sceneTimelines.signal.presentMs));
  waitForAutomaticAdvance("signal");

  finishAutomaticScene("game");
  waitForAutomaticAdvance("game");
  finishAutomaticScene("night");
  waitForAutomaticAdvance("night");
  finishAutomaticScene("finale");

  expect(screen.getByText("08 / 08")).toBeInTheDocument();
  expect(audioProps.at(-1)).toMatchObject({ finale: true });
  expect(screen.queryByText("向上划过星轨")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByText("08 / 08")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重新进入这片宇宙" })).toBeInTheDocument();
});
