import { createRef } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  AudioEngine,
  type AudioEngineHandle,
} from "../components/experience/AudioEngine";
import { audioRecipe } from "../lib/audio";

const audio = vi.hoisted(() => ({
  close: vi.fn(),
  resume: vi.fn(),
  suspend: vi.fn(),
  oscillatorStart: vi.fn(),
  oscillatorStop: vi.fn(),
  gainRamp: vi.fn(),
  contexts: 0,
  currentTime: 0,
}));

const media = vi.hoisted(() => ({
  play: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  pause: vi.fn(),
}));

class MockAudioContext {
  currentTime = audio.currentTime;
  destination = {};
  constructor() { audio.contexts += 1; }
  resume = audio.resume;
  suspend = audio.suspend;
  close = audio.close;
  createOscillator() {
    return {
      type: "sine",
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn((node: unknown) => node),
      start: audio.oscillatorStart,
      stop: audio.oscillatorStop,
    };
  }
  createGain() {
    const node = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: audio.gainRamp,
      },
      connect: vi.fn(),
    };
    node.connect.mockReturnValue(node);
    return node;
  }
}

let rafNow = 0;
let rafId = 0;
let frames = new Map<number, FrameRequestCallback>();

function runFramesAt(time: number) {
  rafNow = time;
  const queued = [...frames.entries()];
  frames.clear();
  for (const [, callback] of queued) callback(time);
}

beforeEach(() => {
  frames = new Map();
  rafNow = 0;
  rafId = 0;
  vi.stubGlobal("AudioContext", MockAudioContext);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(media.play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(media.pause);
  vi.spyOn(performance, "now").mockImplementation(() => rafNow);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++rafId;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  audio.contexts = 0;
  audio.currentTime = 0;
  media.play.mockImplementation(() => Promise.resolve());
});

test("starts the persistent score on command and keeps one media node", async () => {
  const onPlaybackChange = vi.fn();
  const ref = createRef<AudioEngineHandle>();
  const view = render(
    <AudioEngine ref={ref} enabled={false} paused={false} finale={false}
      cue="heartbeat" onPlaybackChange={onPlaybackChange} />,
  );
  const score = view.container.querySelector("audio");

  expect(score).not.toBeNull();
  expect(score).toHaveAttribute("src", "audio/a-moment-apart.mp3");
  await expect(ref.current?.requestStart()).resolves.toBe(true);
  expect(media.play).toHaveBeenCalledOnce();
  view.rerender(
    <AudioEngine ref={ref} enabled paused={false} finale cue="bloom"
      onPlaybackChange={onPlaybackChange} />,
  );
  expect(view.container.querySelector("audio")).toBe(score);
});

test("reports a blocked first play without enabling the sound field", async () => {
  media.play.mockRejectedValueOnce(
    new DOMException("blocked", "NotAllowedError"),
  );
  const ref = createRef<AudioEngineHandle>();
  render(
    <AudioEngine ref={ref} enabled={false} paused={false} finale={false}
      cue="heartbeat" onPlaybackChange={vi.fn()} />,
  );
  await expect(ref.current?.requestStart()).resolves.toBe(false);
});

test("fades to normal and finale volumes without replacing the score", async () => {
  const ref = createRef<AudioEngineHandle>();
  const view = render(
    <AudioEngine ref={ref} enabled paused={false} finale={false}
      cue="heartbeat" onPlaybackChange={vi.fn()} />,
  );
  const score = view.container.querySelector("audio")!;

  await act(async () => { await Promise.resolve(); });
  act(() => runFramesAt(2_500));
  expect(score.volume).toBeCloseTo(0.16, 3);
  view.rerender(
    <AudioEngine ref={ref} enabled paused={false} finale
      cue="bloom" onPlaybackChange={vi.fn()} />,
  );
  act(() => runFramesAt(3_700));
  expect(score.volume).toBeCloseTo(0.2, 3);
  expect(view.container.querySelector("audio")).toBe(score);
});

test("pauses while hidden, resumes at the same time, and cleans up", async () => {
  const ref = createRef<AudioEngineHandle>();
  const onPlaybackChange = vi.fn();
  const view = render(
    <AudioEngine ref={ref} enabled paused={false} finale={false}
      cue="heartbeat" onPlaybackChange={onPlaybackChange} />,
  );
  const score = view.container.querySelector("audio")!;
  score.currentTime = 73;

  view.rerender(
    <AudioEngine ref={ref} enabled paused finale={false}
      cue="heartbeat" onPlaybackChange={onPlaybackChange} />,
  );
  expect(media.pause).toHaveBeenCalled();
  view.rerender(
    <AudioEngine ref={ref} enabled paused={false} finale={false}
      cue="reply" onPlaybackChange={onPlaybackChange} />,
  );
  await act(async () => { await Promise.resolve(); });
  expect(score.currentTime).toBe(73);
  expect(media.play).toHaveBeenCalled();

  view.unmount();
  expect(media.pause).toHaveBeenCalled();
  expect(audio.close).toHaveBeenCalledTimes(audio.contexts);
  expect(frames.size).toBe(0);
});

test("fades out before restarting at the loop boundary", async () => {
  const ref = createRef<AudioEngineHandle>();
  const view = render(
    <AudioEngine ref={ref} enabled paused={false} finale={false}
      cue="heartbeat" onPlaybackChange={vi.fn()} />,
  );
  const score = view.container.querySelector("audio")!;
  Object.defineProperty(score, "duration", {
    configurable: true,
    value: 100,
  });
  score.currentTime = 99.3;
  score.volume = 0.16;

  fireEvent.timeUpdate(score);
  act(() => runFramesAt(700));
  expect(score.volume).toBe(0);
  fireEvent.ended(score);
  await act(async () => { await Promise.resolve(); });
  expect(score.currentTime).toBe(0);
  expect(media.play).toHaveBeenCalled();
  act(() => runFramesAt(3_200));
  expect(score.volume).toBeCloseTo(0.16, 3);
});

test("keeps scene cues at thirty five percent of their recipe gain", () => {
  render(
    <AudioEngine enabled paused={false} finale={false} cue="heartbeat"
      onPlaybackChange={vi.fn()} />,
  );
  expect(audio.gainRamp.mock.calls[0][0]).toBeCloseTo(
    audioRecipe("heartbeat").gain * 0.35,
    5,
  );
  expect(audio.oscillatorStart).toHaveBeenCalledOnce();
  expect(audio.oscillatorStop).toHaveBeenCalledOnce();
});
