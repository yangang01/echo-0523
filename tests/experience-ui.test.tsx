import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { EchoExperience } from "../components/experience/EchoExperience";
import { sceneTimelines } from "../lib/scene-timelines";

let visibilityDescriptor: PropertyDescriptor | undefined;
let visibilityCaptured = false;

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

function advanceFrom(scene: keyof typeof sceneTimelines) {
  swipeReadySurface();
  act(() => vi.advanceTimersByTime(sceneTimelines[scene].exitMs));
}

function finishAutomaticScene(scene: "confession" | "privilege" | "game" | "night" | "finale") {
  act(() => vi.advanceTimersByTime(sceneTimelines[scene].enterMs));
  act(() => vi.advanceTimersByTime(sceneTimelines[scene].presentMs));
}

test("renders the persistent YU visual, current scene, progress, and sound control", () => {
  render(<EchoExperience />);
  expect(document.querySelector(".echo-canvas")).toBeInTheDocument();
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开启声音" })).toBeInTheDocument();
  expect(screen.getByText("只有小宝贝能进入")).toBeInTheDocument();
  expect(document.querySelector(".cinematic-plate")).toBeInTheDocument();
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

test("the YU visual node survives a real scene transition", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  const canvas = document.querySelector(".echo-canvas");
  finishWakePresentation();
  advanceFrom("wake");
  expect(document.querySelector(".echo-canvas")).toBe(canvas);
});

test("visibility pauses an active reveal and resumes it from a fresh timing window", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.enterMs));
  attractOpeningCores();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.reveals[0].at - 1));

  act(() => setVisibility("hidden"));
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  act(() => setVisibility("visible"));
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.reveals[0].at - 1));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("status")).toHaveTextContent("这片宇宙原本安静得没有方向");
});

test("the finale stays on scene eight after completion and never arms swipe or idle advance", () => {
  vi.useFakeTimers();
  expect(document.visibilityState).toBe("visible");
  render(<EchoExperience />);
  finishWakePresentation();
  advanceFrom("wake");

  act(() => vi.advanceTimersByTime(sceneTimelines.jealousy.enterMs));
  fireEvent.change(screen.getByRole("slider", { name: "滑动解码心跳" }), { target: { value: "100" } });
  advanceFrom("jealousy");

  finishAutomaticScene("confession");
  advanceFrom("confession");
  finishAutomaticScene("privilege");
  advanceFrom("privilege");

  act(() => vi.advanceTimersByTime(sceneTimelines.signal.enterMs));
  fireEvent.click(screen.getByRole("button", { name: "发生了小事" }));
  act(() => vi.advanceTimersByTime(sceneTimelines.signal.presentMs));
  advanceFrom("signal");

  finishAutomaticScene("game");
  advanceFrom("game");
  finishAutomaticScene("night");
  advanceFrom("night");
  finishAutomaticScene("finale");

  expect(screen.getByText("08 / 08")).toBeInTheDocument();
  expect(screen.queryByText("向上划过星轨")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByText("08 / 08")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重新进入这片宇宙" })).toBeInTheDocument();
});
