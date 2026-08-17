import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { JealousyScene, NightScene, SignalScene, WakeScene } from "../components/experience/scenes";

test("wake requires a completed three-second hold before continuing", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  render(<WakeScene onComplete={onComplete} />);
  fireEvent.pointerDown(screen.getByRole("button", { name: "长按唤醒宇宙" }));
  act(() => vi.advanceTimersByTime(2999));
  expect(onComplete).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onComplete).toHaveBeenCalledOnce();
  vi.useRealTimers();
});

test("wake offers three-tap accessibility fallback", () => {
  const onComplete = vi.fn();
  render(<WakeScene onComplete={onComplete} />);
  const button = screen.getByRole("button", { name: "长按唤醒宇宙" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(onComplete).toHaveBeenCalledOnce();
});

test("signal selection returns three distinct response types", () => {
  const onResponse = vi.fn();
  render(<SignalScene onResponse={onResponse} onComplete={() => undefined} />);
  fireEvent.click(screen.getByRole("button", { name: "想吐槽一下" }));
  for (const label of ["认真追问", "偏爱夸奖", "站你这边"]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
  }
  expect(onResponse.mock.calls.map(([type]) => type).sort()).toEqual(["ally", "compliment", "curious"]);
});

test("jealousy scene supports four pulse taps as a mobile fallback", () => {
  const onComplete = vi.fn();
  render(<JealousyScene onComplete={onComplete} />);
  const pulse = screen.getByRole("button", { name: "发送解码脉冲" });
  for (let index = 0; index < 4; index += 1) fireEvent.click(pulse);
  expect(onComplete).toHaveBeenCalledOnce();
  expect(screen.getByText("在意")).toBeInTheDocument();
});

test("night scene supports three frequency taps as a mobile fallback", () => {
  const onComplete = vi.fn();
  render(<NightScene onComplete={onComplete} />);
  const link = screen.getByRole("button", { name: "按住连接深夜频率" });
  fireEvent.click(link);
  fireEvent.click(link);
  fireEvent.click(link);
  expect(onComplete).toHaveBeenCalledOnce();
});
