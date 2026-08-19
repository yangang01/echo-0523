import { expect, test, vi } from "vitest";
import { createAudioVolumeFader } from "../lib/audio-volume";

test("ramps from the current volume to the target and completes once", () => {
  let now = 0;
  let callback: FrameRequestCallback | undefined;
  const audio = { volume: 0 } as HTMLAudioElement;
  const complete = vi.fn();
  const fader = createAudioVolumeFader(audio, {
    now: () => now,
    request: (next) => {
      callback = next;
      return 1;
    },
    cancel: vi.fn(),
  });

  fader.to(0.16, 2_500, complete);
  now = 1_250;
  callback?.(now);
  expect(audio.volume).toBeCloseTo(0.08, 2);
  now = 2_500;
  callback?.(now);
  expect(audio.volume).toBeCloseTo(0.16, 3);
  expect(complete).toHaveBeenCalledOnce();
});

test("a new ramp cancels the old ramp without calling its completion", () => {
  let callback: FrameRequestCallback | undefined;
  let now = 0;
  const cancel = vi.fn();
  const first = vi.fn();
  const audio = { volume: 0.1 } as HTMLAudioElement;
  const fader = createAudioVolumeFader(audio, {
    now: () => now,
    request: (next) => {
      callback = next;
      return 7;
    },
    cancel,
  });

  fader.to(0.2, 1_000, first);
  fader.to(0, 400);
  expect(cancel).toHaveBeenCalledWith(7);
  expect(first).not.toHaveBeenCalled();
  now = 400;
  callback?.(now);
  expect(audio.volume).toBe(0);
});

test("clamps immediate targets to the HTML media volume range", () => {
  const audio = { volume: 0.5 } as HTMLAudioElement;
  const fader = createAudioVolumeFader(audio, {
    now: () => 0,
    request: vi.fn(() => 1),
    cancel: vi.fn(),
  });

  fader.to(2, 0);
  expect(audio.volume).toBe(1);
  fader.to(-1, 0);
  expect(audio.volume).toBe(0);
});

test("cancel prevents a queued frame from mutating the audio later", () => {
  let callback: FrameRequestCallback | undefined;
  let now = 0;
  const audio = { volume: 0.04 } as HTMLAudioElement;
  const fader = createAudioVolumeFader(audio, {
    now: () => now,
    request: (next) => {
      callback = next;
      return 3;
    },
    cancel: vi.fn(),
  });

  fader.to(0.16, 1_000);
  fader.cancel();
  now = 1_000;
  callback?.(now);
  expect(audio.volume).toBe(0.04);
});
