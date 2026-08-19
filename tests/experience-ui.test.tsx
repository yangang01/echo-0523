import { forwardRef, useImperativeHandle } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { EchoExperience } from "../components/experience/EchoExperience";
import { sceneOrder, type SceneId } from "../lib/experience";
import { sceneTimelines } from "../lib/scene-timelines";

const audioStart = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
const audioProps = vi.hoisted(() => [] as Array<{ enabled: boolean; paused: boolean; finale: boolean }>);

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

beforeEach(() => {
  audioStart.mockReset();
  audioStart.mockResolvedValue(false);
  audioProps.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (vi.isFakeTimers()) {
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});

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

function enter(scene: SceneId) {
  act(() => vi.advanceTimersByTime(sceneTimelines[scene].enterMs));
}

function attractOpeningCores() {
  const gravity = document.querySelector(".gravity-intro")!;
  vi.spyOn(gravity, "getBoundingClientRect").mockReturnValue({ left: 10, top: 20, width: 400, height: 200 } as DOMRect);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  pointer(y, "pointerdown", { pointerId: 4, clientX: 70, clientY: 90 });
  pointer(y, "pointermove", { pointerId: 4, clientX: 266, clientY: 116 });
  pointer(y, "pointerup", { pointerId: 4, clientX: 266, clientY: 116 });
}

function transcript() {
  return screen.getByLabelText("回音正文，左右方向键切换");
}

function swipeText(direction: "left" | "right" = "left", pointerId = 40) {
  const live = transcript();
  const startX = direction === "left" ? 240 : 80;
  const endX = direction === "left" ? 80 : 240;
  pointer(live, "pointerdown", { pointerId, clientX: startX, clientY: 300 });
  pointer(live, "pointerup", { pointerId, clientX: endX, clientY: 304 });
}

function revealFirst(scene: SceneId) {
  enter(scene);
  if (scene === "wake") attractOpeningCores();
  if (scene === "jealousy") {
    fireEvent.change(screen.getByRole("slider", { name: "滑动解码心跳" }), { target: { value: "100" } });
  }
  if (scene === "signal") fireEvent.click(screen.getByRole("button", { name: "想吐槽一下" }));
}

function revealRemainingText(scene: SceneId) {
  const count = document.querySelectorAll(".echo-transcript-markers button").length;
  expect(count).toBeGreaterThan(0);
  for (let index = 1; index < count; index += 1) swipeText("left", 40 + index);
  if (scene === "finale") expect(screen.getByRole("button", { name: "重新进入这片宇宙" })).toBeInTheDocument();
  else expect(screen.getByRole("button", { name: "上划进入下一幕" })).toBeInTheDocument();
}

function advance(scene: Exclude<SceneId, "finale">, mode: "swipe" | "button" = "swipe") {
  if (mode === "button") {
    fireEvent.click(screen.getByRole("button", { name: "上划进入下一幕" }));
  } else {
    const surface = screen.getByTestId("gesture-surface");
    pointer(surface, "pointerdown", { pointerId: 90, clientX: 350, clientY: 720 });
    act(() => vi.advanceTimersByTime(180));
    pointer(surface, "pointerup", { pointerId: 90, clientX: 345, clientY: 570 });
  }
  act(() => vi.advanceTimersByTime(sceneTimelines[scene].exitMs));
}

function finishScene(scene: Exclude<SceneId, "finale">) {
  revealFirst(scene);
  revealRemainingText(scene);
  advance(scene);
}

test("renders the persistent YU visual, current scene, progress, and sound control", () => {
  render(<EchoExperience />);
  expect(document.querySelector(".echo-canvas")).toBeInTheDocument();
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开启声音" })).toBeInTheDocument();
  expect(screen.getByText("只有小宝贝能进入")).toBeInTheDocument();
});

test("the first non-sound interaction starts music once and explicit sound toggling still works", async () => {
  audioStart.mockResolvedValue(true);
  render(<EchoExperience />);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  fireEvent.pointerDown(y, { pointerId: 4, isPrimary: true, button: 0 });
  expect(audioStart).toHaveBeenCalledOnce();
  await screen.findByRole("button", { name: "关闭声音" });
  fireEvent.click(screen.getByRole("button", { name: "关闭声音" }));
  expect(screen.getByRole("button", { name: "开启声音" })).toBeVisible();
});

test("a click-only WebView can unlock music and a blocked start retries on keyboard input", async () => {
  audioStart.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<EchoExperience />);
  fireEvent.click(screen.getByRole("button", { name: "把 Y 靠近 U" }));
  expect(audioStart).toHaveBeenCalledOnce();
  await act(async () => Promise.resolve());
  fireEvent.keyDown(screen.getByRole("group", { name: "电影场景手势控制" }), { key: "ArrowLeft" });
  await screen.findByRole("button", { name: "关闭声音" });
  expect(audioStart).toHaveBeenCalledTimes(2);
});

test("time never changes text or scene; horizontal reading is reversible and the last text unlocks next", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  revealFirst("wake");
  const first = transcript().textContent;
  act(() => vi.advanceTimersByTime(120_000));
  expect(transcript()).toHaveTextContent(first!);
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "上划进入下一幕" })).not.toBeInTheDocument();

  swipeText("left");
  const second = transcript().textContent;
  expect(second).not.toBe(first);
  swipeText("right", 41);
  expect(transcript()).toHaveTextContent(first!);
  revealRemainingText("wake");
  advance("wake", "button");
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("vertical movement inside the transcript neither changes text nor advances the scene", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  revealFirst("wake");
  const first = transcript().textContent;
  const live = transcript();
  pointer(live, "pointerdown", { pointerId: 50, clientX: 140, clientY: 420 });
  pointer(live, "pointerup", { pointerId: 50, clientX: 144, clientY: 250 });
  expect(transcript()).toHaveTextContent(first!);
  expect(screen.queryByRole("button", { name: "上划进入下一幕" })).not.toBeInTheDocument();
});

test("all eight scenes stay manual, preserve special interactions, and finale ends with restart only", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  for (const scene of sceneOrder.slice(0, -1) as Exclude<SceneId, "finale">[]) {
    finishScene(scene);
    expect(screen.getByText(`${String(sceneOrder.indexOf(scene) + 2).padStart(2, "0")} / 08`)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
  }
  revealFirst("finale");
  expect(screen.queryByRole("button", { name: "重新进入这片宇宙" })).not.toBeInTheDocument();
  revealRemainingText("finale");
  expect(screen.queryByRole("button", { name: "上划进入下一幕" })).not.toBeInTheDocument();
  expect(screen.getByText("08 / 08")).toBeInTheDocument();
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
