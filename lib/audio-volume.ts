export type AudioFrameClock = {
  now: () => number;
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
};

export type AudioVolumeFader = {
  to: (
    target: number,
    durationMs: number,
    onComplete?: () => void,
  ) => void;
  cancel: () => void;
};

const browserClock: AudioFrameClock = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function createAudioVolumeFader(
  audio: HTMLAudioElement,
  clock: AudioFrameClock = browserClock,
): AudioVolumeFader {
  let frame: number | null = null;
  let generation = 0;

  const cancel = () => {
    generation += 1;
    if (frame !== null) clock.cancel(frame);
    frame = null;
  };

  const to: AudioVolumeFader["to"] = (
    rawTarget,
    durationMs,
    onComplete,
  ) => {
    cancel();
    const token = generation;
    const target = clampVolume(rawTarget);
    const start = clampVolume(audio.volume);
    const duration = Math.max(0, durationMs);
    const startedAt = clock.now();

    if (duration === 0 || start === target) {
      audio.volume = target;
      onComplete?.();
      return;
    }

    const tick: FrameRequestCallback = () => {
      if (token !== generation) return;
      const progress = Math.min(
        1,
        Math.max(0, (clock.now() - startedAt) / duration),
      );
      audio.volume = start + (target - start) * progress;
      if (progress < 1) {
        frame = clock.request(tick);
        return;
      }
      frame = null;
      generation += 1;
      onComplete?.();
    };

    frame = clock.request(tick);
  };

  return { to, cancel };
}
