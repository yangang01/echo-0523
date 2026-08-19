# A Moment Apart Background Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `A Moment Apart` as the automatically unlocked, smoothly mixed background score for the public Y/U Qixi experience.

**Architecture:** A persistent native `<audio>` element owns the MP3 and exposes a narrow imperative `requestStart()` API so playback begins inside the original user-gesture call stack. `EchoExperience` owns the confirmed sound state and one-shot auto-unlock policy, while the existing Web Audio cue engine remains in `AudioEngine` at reduced gain. A cancellable volume fader handles normal, finale, stop, and loop-boundary transitions without recreating the player between scenes.

**Tech Stack:** React 19, TypeScript, native HTMLMediaElement, Web Audio API, Vitest, Testing Library, Vite GitHub Pages build, vinext SSR build.

---

## File map

- Create `lib/audio-volume.ts`: allocation-free cancellable volume ramp helper.
- Create `tests/audio-volume.test.ts`: deterministic ramp/cancellation tests using fake animation frames.
- Modify `components/experience/AudioEngine.tsx`: persistent MP3 element, imperative playback request, looping, visibility pause/resume, and quieter scene cues.
- Modify `tests/audio-engine.test.tsx`: media/Web Audio lifecycle behavior.
- Modify `components/experience/EchoExperience.tsx`: first-interaction unlock and sound-button retry/disable semantics.
- Modify `tests/experience-ui.test.tsx`: realistic automatic-start and rejection tests.
- Create `public/audio/a-moment-apart.mp3`: normalized repository asset copied from the workspace root.
- Modify `scripts/verify-github-pages-build.mjs`: require the MP3 in Pages artifacts.
- Modify `tests/github-pages.test.ts`: asset verifier and public-file contracts.

---

### Task 1: Add the publishable audio asset and Pages contract

**Files:**
- Create: `public/audio/a-moment-apart.mp3`
- Modify: `scripts/verify-github-pages-build.mjs`
- Modify: `tests/github-pages.test.ts`

- [ ] **Step 1: Write failing asset and verifier tests**

Add to `tests/github-pages.test.ts`:

```ts
it("ships the normalized background score in the public tree", () => {
  const source = resolve(process.cwd(), "public/audio/a-moment-apart.mp3");
  expect(existsSync(source)).toBe(true);
  expect(readFileSync(source).byteLength).toBeGreaterThan(8_000_000);
  expect(readFileSync(source).byteLength).toBeLessThan(100_000_000);
});

it("rejects a Pages artifact without the background score", async () => {
  const directory = createTemporaryBuild();
  writeValidBuild(directory);
  const verifier = await loadBuildVerifier();
  expect(() => verifier.verifyGithubPagesBuild(directory)).toThrow(
    /Missing audio\/a-moment-apart\.mp3/,
  );
});
```

Update `writeValidBuild` only after observing RED; its final form must create the audio fixture:

```ts
mkdirSync(join(directory, "audio"), { recursive: true });
writeFileSync(join(directory, "audio/a-moment-apart.mp3"), "mp3");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
$NODE node_modules/vitest/vitest.mjs run tests/github-pages.test.ts
```

Expected: the public MP3 test fails because the normalized asset does not exist, and the missing-artifact test fails because the verifier does not require it.

- [ ] **Step 3: Copy the binary asset with an explicit path**

Run from the feature worktree:

```bash
mkdir -p public/audio
cp "/Users/yangang/Desktop/demo1/Odesza - A Moment Apart.mp3" "public/audio/a-moment-apart.mp3"
```

Confirm the copied file is byte-identical:

```bash
shasum -a 256 "/Users/yangang/Desktop/demo1/Odesza - A Moment Apart.mp3" "public/audio/a-moment-apart.mp3"
```

Expected: both hashes match and the copied file is about 9 MB, well below GitHub's 100 MB single-file limit.

- [ ] **Step 4: Require the MP3 in the artifact verifier**

Change the static asset loop in `scripts/verify-github-pages-build.mjs` to:

```js
for (const asset of [
  "favicon.svg",
  "og.png",
  "audio/a-moment-apart.mp3",
]) {
  requireFile(resolve(outputDirectory, asset), asset);
}
```

Then add the same explicit fixture setup to `writeValidBuild`:

```ts
mkdirSync(join(directory, "audio"), { recursive: true });
writeFileSync(join(directory, "audio/a-moment-apart.mp3"), "mp3");
```

- [ ] **Step 5: Run focused tests and a real Pages build**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/github-pages.test.ts
$NODE node_modules/vite/bin/vite.js build --config vite.github-pages.config.ts
$NODE scripts/verify-github-pages-build.mjs
```

Expected: focused tests pass, `dist-github-pages/audio/a-moment-apart.mp3` exists, and the verifier prints `GitHub Pages build artifacts verified.`

- [ ] **Step 6: Commit the asset boundary**

```bash
git add public/audio/a-moment-apart.mp3 scripts/verify-github-pages-build.mjs tests/github-pages.test.ts
git commit -m "feat: publish the A Moment Apart score"
```

---

### Task 2: Build a cancellable audio volume fader

**Files:**
- Create: `lib/audio-volume.ts`
- Create: `tests/audio-volume.test.ts`

- [ ] **Step 1: Write failing fader tests**

Create `tests/audio-volume.test.ts`:

```ts
import { test, expect, vi } from "vitest";
import { createAudioVolumeFader } from "../lib/audio-volume";

test("ramps from the current volume to the target and completes once", () => {
  let now = 0;
  let callback: FrameRequestCallback | undefined;
  const audio = { volume: 0 } as HTMLAudioElement;
  const complete = vi.fn();
  const fader = createAudioVolumeFader(audio, {
    now: () => now,
    request: (next) => { callback = next; return 1; },
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
  const cancel = vi.fn();
  const first = vi.fn();
  const audio = { volume: 0.1 } as HTMLAudioElement;
  const fader = createAudioVolumeFader(audio, {
    now: () => 0,
    request: (next) => { callback = next; return 7; },
    cancel,
  });

  fader.to(0.2, 1_000, first);
  fader.to(0, 400);
  expect(cancel).toHaveBeenCalledWith(7);
  expect(first).not.toHaveBeenCalled();
  callback?.(400);
  expect(audio.volume).toBe(0);
});

test("clamps targets to the HTML media volume range", () => {
  const audio = { volume: 0.5 } as HTMLAudioElement;
  const fader = createAudioVolumeFader(audio, {
    now: () => 0,
    request: (next) => { next(0); return 1; },
    cancel: vi.fn(),
  });
  fader.to(2, 0);
  expect(audio.volume).toBe(1);
  fader.to(-1, 0);
  expect(audio.volume).toBe(0);
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/audio-volume.test.ts
```

Expected: module resolution fails because `lib/audio-volume.ts` is absent.

- [ ] **Step 3: Implement the minimal fader**

Create `lib/audio-volume.ts`:

```ts
export type AudioFrameClock = {
  now: () => number;
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
};

export type AudioVolumeFader = {
  to: (target: number, durationMs: number, onComplete?: () => void) => void;
  cancel: () => void;
};

const browserClock: AudioFrameClock = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

export function createAudioVolumeFader(
  audio: HTMLAudioElement,
  clock: AudioFrameClock = browserClock,
): AudioVolumeFader {
  let frame: number | null = null;
  let completion: (() => void) | undefined;

  const cancel = () => {
    if (frame !== null) clock.cancel(frame);
    frame = null;
    completion = undefined;
  };

  const to = (rawTarget: number, durationMs: number, onComplete?: () => void) => {
    cancel();
    const target = Math.min(1, Math.max(0, rawTarget));
    const start = audio.volume;
    const startedAt = clock.now();
    completion = onComplete;
    if (durationMs <= 0 || start === target) {
      audio.volume = target;
      const done = completion;
      completion = undefined;
      done?.();
      return;
    }
    const tick: FrameRequestCallback = () => {
      const progress = Math.min(1, Math.max(0, (clock.now() - startedAt) / durationMs));
      audio.volume = start + (target - start) * progress;
      if (progress < 1) {
        frame = clock.request(tick);
        return;
      }
      frame = null;
      const done = completion;
      completion = undefined;
      done?.();
    };
    frame = clock.request(tick);
  };

  return { to, cancel };
}
```

- [ ] **Step 4: Run focused and full tests**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/audio-volume.test.ts
$NODE node_modules/vitest/vitest.mjs run
```

Expected: all tests pass with no timer or RAF leakage.

- [ ] **Step 5: Commit the fader**

```bash
git add lib/audio-volume.ts tests/audio-volume.test.ts
git commit -m "feat: add cancellable music fades"
```

---

### Task 3: Mix the persistent score with scene cues

**Files:**
- Modify: `components/experience/AudioEngine.tsx`
- Modify: `tests/audio-engine.test.tsx`

- [ ] **Step 1: Replace the AudioEngine test with failing media lifecycle cases**

Extend `tests/audio-engine.test.tsx` with a media mock and these behavioral tests:

```tsx
import { createRef } from "react";
import {
  AudioEngine,
  type AudioEngineHandle,
} from "../components/experience/AudioEngine";

test("starts the persistent score on command and keeps one media node", async () => {
  vi.stubGlobal("AudioContext", MockAudioContext);
  const onPlaybackChange = vi.fn();
  const ref = createRef<AudioEngineHandle>();
  const view = render(
    <AudioEngine ref={ref} enabled={false} paused={false} finale={false}
      cue="heartbeat" onPlaybackChange={onPlaybackChange} />,
  );
  const score = view.container.querySelector("audio")!;
  expect(score.getAttribute("src")).toBe("audio/a-moment-apart.mp3");
  await expect(ref.current?.requestStart()).resolves.toBe(true);
  expect(score.play).toHaveBeenCalledOnce();
  view.rerender(
    <AudioEngine ref={ref} enabled paused={false} finale cue="bloom"
      onPlaybackChange={onPlaybackChange} />,
  );
  expect(view.container.querySelector("audio")).toBe(score);
});

test("reports a blocked first play without enabling the sound field", async () => {
  media.play.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
  const ref = createRef<AudioEngineHandle>();
  render(<AudioEngine ref={ref} enabled={false} paused={false} finale={false}
    cue="heartbeat" onPlaybackChange={vi.fn()} />);
  await expect(ref.current?.requestStart()).resolves.toBe(false);
});

test("pauses in the background, resumes at the same time, and cleans up", async () => {
  const ref = createRef<AudioEngineHandle>();
  const view = render(<AudioEngine ref={ref} enabled paused={false} finale={false}
    cue="heartbeat" onPlaybackChange={vi.fn()} />);
  const score = view.container.querySelector("audio")!;
  score.currentTime = 73;
  view.rerender(<AudioEngine ref={ref} enabled paused finale={false}
    cue="heartbeat" onPlaybackChange={vi.fn()} />);
  expect(score.pause).toHaveBeenCalled();
  view.rerender(<AudioEngine ref={ref} enabled paused={false} finale={false}
    cue="reply" onPlaybackChange={vi.fn()} />);
  expect(score.currentTime).toBe(73);
  expect(score.play).toHaveBeenCalled();
  view.unmount();
  expect(score.pause).toHaveBeenCalled();
});

test("reduces synthesized cue gain to thirty five percent", () => {
  vi.stubGlobal("AudioContext", MockAudioContext);
  render(<AudioEngine enabled paused={false} finale={false} cue="heartbeat"
    onPlaybackChange={vi.fn()} />);
  expect(audio.peakGain.mock.calls[0][0]).toBeCloseTo(
    audioRecipe("heartbeat").gain * 0.35,
    5,
  );
});
```

The media mock must implement `play`, `pause`, mutable `volume`, `currentTime`, `duration`, and dispatchable `timeupdate`/`ended` events. The RAF mock must execute fade frames deterministically.

- [ ] **Step 2: Run the test and verify RED**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/audio-engine.test.tsx
```

Expected: missing `AudioEngineHandle`, `finale`, `onPlaybackChange`, media element, and cue-gain scaling failures.

- [ ] **Step 3: Implement the persistent media engine**

Refactor `AudioEngine.tsx` to this public contract:

```tsx
export type AudioEngineHandle = {
  requestStart: () => Promise<boolean>;
};

type Props = {
  enabled: boolean;
  paused: boolean;
  finale: boolean;
  cue: SoundName;
  onPlaybackChange: (playing: boolean) => void;
};

export const AudioEngine = forwardRef<AudioEngineHandle, Props>(function AudioEngine(
  { enabled, paused, finale, cue, onPlaybackChange },
  ref,
) {
  const musicRef = useRef<HTMLAudioElement>(null);
  const faderRef = useRef<AudioVolumeFader | null>(null);
  const pendingPlay = useRef<Promise<boolean> | null>(null);
  const targetVolume = finale ? 0.2 : 0.16;

  useImperativeHandle(ref, () => ({
    requestStart() {
      const music = musicRef.current;
      if (!music) return Promise.resolve(false);
      if (pendingPlay.current) return pendingPlay.current;
      music.volume = Math.min(music.volume, 0.001);
      const attempt = music.play()
        .then(() => true)
        .catch(() => false)
        .finally(() => { pendingPlay.current = null; });
      pendingPlay.current = attempt;
      return attempt;
    },
  }), []);

  return <audio
    ref={musicRef}
    src="audio/a-moment-apart.mp3"
    preload="auto"
    aria-hidden="true"
    tabIndex={-1}
    hidden
  />;
});
```

Add these concrete lifecycle branches around that contract:

- create one `AudioVolumeFader` per media node;
- after `enabled && !paused`, call `play()` if needed and ramp to `targetVolume` over 2,500 ms;
- when `enabled` becomes false, ramp to zero over 450 ms, then pause;
- when `paused` becomes true, cancel the ramp and pause immediately without changing `currentTime`;
- when visible again and enabled, resume and ramp from zero/current volume;
- when `finale` changes, ramp to `0.20` or `0.16` over 1,200 ms;
- on `timeupdate`, begin a guarded 700 ms fade when `duration - currentTime <= 0.8`;
- on `ended`, set `currentTime = 0`, call `play()`, clear the loop guard, and ramp back to the current target;
- catch every `play()` rejection and call `onPlaybackChange(false)`;
- on unmount, cancel ramps, remove listeners, pause media, and close the AudioContext;
- multiply the existing cue recipe peak gain by `0.35`.

- [ ] **Step 4: Run focused tests and fix only contract failures**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/audio-volume.test.ts tests/audio-engine.test.tsx
```

Expected: media identity, rejection, pause/resume, cleanup, finale volume, loop fade, and cue-gain tests all pass.

- [ ] **Step 5: Run full verification and commit**

```bash
$NODE node_modules/vitest/vitest.mjs run
$NODE node_modules/eslint/bin/eslint.js components/experience/AudioEngine.tsx lib/audio-volume.ts tests/audio-engine.test.tsx tests/audio-volume.test.ts
git diff --check
git add components/experience/AudioEngine.tsx tests/audio-engine.test.tsx
git commit -m "feat: mix the persistent cinematic score"
```

---

### Task 4: Auto-unlock music from the first interaction

**Files:**
- Modify: `components/experience/EchoExperience.tsx`
- Modify: `tests/experience-ui.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Add a hoisted imperative AudioEngine mock in `tests/experience-ui.test.tsx` that exposes a controllable `requestStart`. Add:

```tsx
test("the first non-sound pointer interaction starts music and confirms ON", async () => {
  audioStart.mockResolvedValueOnce(true);
  render(<EchoExperience />);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  fireEvent.pointerDown(y, { pointerId: 4, isPrimary: true, button: 0 });
  expect(audioStart).toHaveBeenCalledOnce();
  await screen.findByRole("button", { name: "关闭声音" });
  fireEvent.pointerDown(y, { pointerId: 5, isPrimary: true, button: 0 });
  expect(audioStart).toHaveBeenCalledOnce();
});

test("a blocked automatic start remains OFF and retries on the next gesture", async () => {
  audioStart.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<EchoExperience />);
  fireEvent.pointerDown(screen.getByRole("button", { name: "把 Y 靠近 U" }), {
    pointerId: 4, isPrimary: true, button: 0,
  });
  expect(await screen.findByRole("button", { name: "开启声音" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("group", { name: "电影场景手势控制" }), {
    key: "Enter",
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
  fireEvent.pointerDown(document.body, { pointerId: 9, isPrimary: true, button: 0 });
  expect(audioStart).toHaveBeenCalledOnce();
});
```

Also assert `finale={state.scene === "finale"}` and `paused={hidden}` reach the AudioEngine mock.

- [ ] **Step 2: Run integration tests and verify RED**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/experience-ui.test.tsx
```

Expected: no imperative engine ref, no root capture auto-unlock, and existing button state toggles before playback success.

- [ ] **Step 3: Implement synchronous gesture unlock**

In `EchoExperience.tsx`, add:

```tsx
const audioEngine = useRef<AudioEngineHandle>(null);
const autoStartPending = useRef(true);

const requestSound = useCallback((automatic: boolean) => {
  if (automatic && (!autoStartPending.current || sound)) return;
  const attempt = audioEngine.current?.requestStart();
  if (!attempt) return;
  void attempt.then((started) => {
    if (!started) return;
    autoStartPending.current = false;
    setSound(true);
  });
}, [sound]);

const autoUnlockPointer = useCallback((event: ReactPointerEvent<HTMLElement>) => {
  if (!event.isPrimary || event.button > 0) return;
  if ((event.target as Element).closest(".sound-button")) return;
  requestSound(true);
}, [requestSound]);

const autoUnlockKeyboard = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if ((event.target as Element).closest(".sound-button")) return;
  if (!["Enter", " ", "ArrowUp", "ArrowRight"].includes(event.key)) return;
  requestSound(true);
}, [requestSound]);
```

Attach the capture handlers to `<main>` so `requestStart()` executes synchronously inside the original event:

```tsx
<main
  className={`echo-experience scene-is-${state.scene}`}
  aria-label="0523 回音星核"
  onPointerDownCapture={autoUnlockPointer}
  onKeyDownCapture={autoUnlockKeyboard}
>
```

Replace the sound button's direct state inversion with explicit behavior:

```tsx
const toggleSound = useCallback(() => {
  autoStartPending.current = false;
  if (sound) {
    setSound(false);
  } else {
    requestSound(false);
  }
  noteControlInteraction();
}, [requestSound, sound]);
```

Render the engine with the persistent ref and finale volume state:

```tsx
<AudioEngine
  ref={audioEngine}
  enabled={sound}
  paused={hidden}
  finale={state.scene === "finale"}
  cue={cue}
  onPlaybackChange={(playing) => { if (!playing) setSound(false); }}
/>
```

- [ ] **Step 4: Run focused integration tests**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/experience-ui.test.tsx tests/audio-engine.test.tsx
```

Expected: automatic pointer/keyboard unlock, rejection retry, explicit sound toggle, READY pointer pause, and hidden-page behavior all pass.

- [ ] **Step 5: Run full verification and commit**

```bash
$NODE node_modules/vitest/vitest.mjs run
$NODE node_modules/eslint/bin/eslint.js .
$NODE node_modules/vite/bin/vite.js build --config vite.github-pages.config.ts
$NODE scripts/verify-github-pages-build.mjs
$NODE node_modules/vinext/dist/cli.js build
git diff --check
git add components/experience/EchoExperience.tsx tests/experience-ui.test.tsx
git commit -m "feat: unlock the score on first touch"
```

---

### Task 5: Final audio QA and public GitHub Pages release

**Files:**
- Modify only files already in this plan if QA reveals a defect.

- [ ] **Step 1: Run the fresh automated matrix**

```bash
$NODE node_modules/vitest/vitest.mjs run
$NODE node_modules/eslint/bin/eslint.js .
$NODE node_modules/vite/bin/vite.js build --config vite.github-pages.config.ts
$NODE scripts/verify-github-pages-build.mjs
$NODE node_modules/vinext/dist/cli.js build
git diff --check
git status --short --branch
```

Expected: all commands exit 0; the existing large Three.js chunk advisory may remain.

- [ ] **Step 2: Perform mobile audio behavior QA**

At 390×844 and 390×650 verify:

1. First Y pointerdown starts the MP3 and changes `声场 OFF` to `声场 ON` only after `play()` resolves.
2. The music fades to 16% without an audible jump.
3. Heartbeat/lock/reply/bloom cues remain audible but substantially quieter than the score.
4. Sound OFF fades and pauses; ON resumes at the same `currentTime`.
5. Backgrounding pauses and foregrounding resumes without restarting.
6. Finale ramps to 20%; replay returns to 16%.
7. Loop boundary does not produce an abrupt volume discontinuity.
8. A simulated rejected `play()` leaves the experience usable and the sound control retryable.

- [ ] **Step 3: Confirm repository asset and commit integrity**

```bash
git ls-files public/audio/a-moment-apart.mp3
git cat-file -s HEAD:public/audio/a-moment-apart.mp3
git log --oneline origin/main..HEAD
```

Expected: the MP3 is tracked, approximately 9 MB, and every audio task commit is present.

- [ ] **Step 4: Merge into main and push the authorized public release**

From the primary worktree:

```bash
git merge --ff-only feature/qixi-0523
git push origin main
```

Do not force-push. If `main` moved, fetch and rebase/merge only after inspecting the remote change.

- [ ] **Step 5: Watch Pages and verify live assets**

```bash
gh run list --workflow "Deploy GitHub Pages" --limit 1
gh run watch <run-id> --exit-status
curl -sSfI https://yangang01.github.io/qixi-0523-echo-core/
curl -sSfI https://yangang01.github.io/qixi-0523-echo-core/audio/a-moment-apart.mp3
```

Expected: workflow succeeds; page and MP3 return HTTPS 200; MP3 reports an audio-compatible content type and nonzero content length.
