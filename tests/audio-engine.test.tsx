import { render } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";
import { AudioEngine } from "../components/experience/AudioEngine";

const audio = vi.hoisted(() => ({
  close: vi.fn(),
  resume: vi.fn(),
  suspend: vi.fn(),
  oscillatorStart: vi.fn(),
  oscillatorStop: vi.fn(),
  contexts: 0,
  currentTime: 0,
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
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn((node: unknown) => node),
      start: audio.oscillatorStart,
      stop: audio.oscillatorStop,
    };
  }
  createGain() {
    const node = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    node.connect.mockReturnValue(node);
    return node;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  audio.contexts = 0;
  audio.currentTime = 0;
});

test("synthesizes cues, suspends while hidden, resumes when visible, and closes on cleanup", () => {
  vi.stubGlobal("AudioContext", MockAudioContext);
  const view = render(<AudioEngine enabled paused={false} cue="heartbeat" />);

  expect(audio.contexts).toBe(1);
  expect(audio.resume).toHaveBeenCalled();
  expect(audio.oscillatorStart).toHaveBeenCalledOnce();
  expect(audio.oscillatorStop).toHaveBeenCalledOnce();

  view.rerender(<AudioEngine enabled paused cue="heartbeat" />);
  expect(audio.suspend).toHaveBeenCalled();
  view.rerender(<AudioEngine enabled paused={false} cue="reply" />);
  expect(audio.resume).toHaveBeenCalled();
  expect(audio.oscillatorStart).toHaveBeenCalledTimes(2);

  view.unmount();
  expect(audio.close).toHaveBeenCalledOnce();
});
