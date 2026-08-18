import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { EchoExperience } from "../components/experience/EchoExperience";

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

test("renders a persistent visual layer, current scene, progress, and sound control", () => {
  render(<EchoExperience />);
  expect(screen.getByLabelText("0523 回音星核动态视觉")).toBeInTheDocument();
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开启声音" })).toBeInTheDocument();
  expect(screen.getByText("只有小宝贝能进入")).toBeInTheDocument();
  expect(document.querySelector(".cinematic-plate")).toBeInTheDocument();
});

test("reveals the first wake echo inside the experience shell", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  const gravity = document.querySelector(".gravity-intro")!;
  vi.spyOn(gravity, "getBoundingClientRect").mockReturnValue({ left: 10, top: 20, width: 400, height: 200 } as DOMRect);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });

  pointer(y, "pointerdown", { pointerId: 1 });
  pointer(y, "pointermove", { pointerId: 1, clientX: 266, clientY: 116 });
  pointer(y, "pointerup", { pointerId: 1 });
  act(() => vi.advanceTimersByTime(900));

  expect(screen.getByRole("status")).toHaveTextContent("这片宇宙原本安静得没有方向");
  expect(screen.getByRole("button", { name: "回看第 1 段" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByLabelText("0523 回音星核动态视觉")).toBeInTheDocument();
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开启声音" })).toBeInTheDocument();
});
