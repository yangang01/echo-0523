import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ConfessionScene, FinaleScene, GameScene, JealousyScene, NightScene, PrivilegeScene, SignalScene, WakeScene } from "../components/experience/scenes";

const noop = () => undefined;

test("wake requires a completed three-second hold before continuing", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<WakeScene onComplete={onComplete} onReveal={onReveal} />);
  fireEvent.pointerDown(screen.getByRole("button", { name: "长按唤醒宇宙" }));
  act(() => vi.advanceTimersByTime(2999));
  expect(onComplete).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onComplete).toHaveBeenCalledOnce();
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["spark", "archive", "receiver"]);
  vi.useRealTimers();
});

test("wake offers three-tap accessibility fallback", () => {
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<WakeScene onComplete={onComplete} onReveal={onReveal} />);
  const button = screen.getByRole("button", { name: "长按唤醒宇宙" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(onComplete).toHaveBeenCalledOnce();
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["spark", "archive", "receiver"]);
});

test("signal selection returns three distinct response types", () => {
  const onResponse = vi.fn();
  const onReveal = vi.fn();
  const onChannelSelected = vi.fn();
  const onComplete = vi.fn();
  render(<SignalScene onResponse={onResponse} onComplete={onComplete} onReveal={onReveal} onChannelSelected={onChannelSelected} />);
  fireEvent.click(screen.getByRole("button", { name: "想吐槽一下" }));
  expect(onChannelSelected).toHaveBeenCalledWith("rant");
  for (const label of ["认真追问", "偏爱夸奖", "站你这边"]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
  }
  expect(onResponse.mock.calls.map(([type]) => type)).toEqual(["curious", "compliment", "ally"]);
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["curious", "compliment", "ally", "close"]);
  expect(onComplete).toHaveBeenCalledOnce();
});

test("jealousy scene supports four pulse taps as a mobile fallback", () => {
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<JealousyScene onComplete={onComplete} onReveal={onReveal} />);
  const pulse = screen.getByRole("button", { name: "发送解码脉冲" });
  for (let index = 0; index < 4; index += 1) fireEvent.click(pulse);
  expect(onComplete).toHaveBeenCalledOnce();
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["praise", "smile", "meaning"]);
  expect(screen.getByText("在意")).toBeInTheDocument();
});

test("night scene supports three frequency taps as a mobile fallback", () => {
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<NightScene onComplete={onComplete} onReveal={onReveal} />);
  const link = screen.getByRole("button", { name: "按住连接深夜频率" });
  fireEvent.click(link);
  fireEvent.click(link);
  fireEvent.click(link);
  expect(onComplete).toHaveBeenCalledOnce();
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["third", "two-thirds", "connected", "frequency"]);
});

test("confession reveals each coordinate and the locked echo", () => {
  const onReveal = vi.fn();
  const onComplete = vi.fn();
  render(<ConfessionScene onComplete={onComplete} onReveal={onReveal} />);

  for (const target of ["2026", "05", "23"]) fireEvent.click(screen.getByRole("button", { name: `锁定 ${target}` }));

  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["year", "month", "day", "locked"]);
  expect(onComplete).toHaveBeenCalledOnce();
});

test("confession gates later coordinates to preserve reveal order", () => {
  const onReveal = vi.fn();
  render(<ConfessionScene onComplete={noop} onReveal={onReveal} />);
  const month = screen.getByRole("button", { name: "锁定 05" });
  const day = screen.getByRole("button", { name: "锁定 23" });

  expect(month).toBeDisabled();
  expect(day).toBeDisabled();
  fireEvent.click(day);
  expect(onReveal).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "锁定 2026" }));
  expect(month).toBeEnabled();
  expect(day).toBeDisabled();
});

test("privilege reveals three lights and its completed action", () => {
  const onReveal = vi.fn();
  const onComplete = vi.fn();
  render(<PrivilegeScene onComplete={onComplete} onReveal={onReveal} />);
  const field = screen.getByRole("button", { name: "点亮偏爱星群" });

  fireEvent.click(field);
  fireEvent.click(field);
  fireEvent.click(field);

  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["diary", "remembered", "seen", "action"]);
  expect(onComplete).toHaveBeenCalledOnce();
});

test("game reveals each gate and completes on the third", () => {
  const onReveal = vi.fn();
  const onComplete = vi.fn();
  render(<GameScene onComplete={onComplete} onReveal={onReveal} />);

  fireEvent.click(screen.getByRole("button", { name: "靠近 · 1/3" }));
  fireEvent.click(screen.getByRole("button", { name: "同步 · 2/3" }));
  fireEvent.click(screen.getByRole("button", { name: "穿越 · 3/3" }));

  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["near", "sync", "through", "complete"]);
  expect(onComplete).toHaveBeenCalledOnce();
});

test("finale reveals three explicit steps before showing its ending", () => {
  const onReveal = vi.fn();
  const onComplete = vi.fn();
  render(<FinaleScene onComplete={onComplete} onReveal={onReveal} onRestart={noop} />);

  expect(screen.queryByText("你说的有的没的，在我这里都不是小事。")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "读取回音 1 / 3" }));
  fireEvent.click(screen.getByRole("button", { name: "读取回音 2 / 3" }));
  expect(onComplete).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "重新进入这片宇宙" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "展开无限回音" }));

  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["recap", "present", "echo"]);
  expect(onComplete).toHaveBeenCalledOnce();
  expect(document.querySelector(".final-line")).toHaveTextContent("你说的有的没的，在我这里都不是小事。");
  expect(screen.getByRole("button", { name: "重新进入这片宇宙" })).toBeInTheDocument();
});

test("tap fallbacks complete outside the child render phase", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  function Parent() {
    const [done, setDone] = useState(false);
    return done ? <p>完成</p> : <WakeScene onComplete={() => setDone(true)} onReveal={noop} />;
  }
  render(<Parent />);
  const wake = screen.getByRole("button", { name: "长按唤醒宇宙" });
  fireEvent.click(wake);
  fireEvent.click(wake);
  fireEvent.click(wake);
  expect(screen.getByText("完成")).toBeInTheDocument();
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});
