# Y × U Gravity Cinematic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the click-heavy eight-scene H5 flow with a mobile-safe cinematic experience driven by Y/U gravity choreography, semantic gestures, continuous WebGL transitions, and reader-controlled swipe/idle progression.

**Architecture:** Add a deterministic scene director that owns phase timing and auto-advance, a gesture surface that converts pointer/wheel/keyboard input into semantic events, and a persistent twin-gravity WebGL world that consumes scene cues without remounting. Existing content, transcript, growth, relationship clock, and scene order remain authoritative; scene components become lightweight semantic controls or visual status views.

**Tech Stack:** React 19, TypeScript 5.9, Three.js 0.185, GLSL, Vitest 4, Testing Library, CSS, Vite/vinext static GitHub Pages build.

---

## File map

**Create**

- `lib/director.ts` — phase reducer, per-scene durations, pause accounting, and advance gates.
- `lib/gestures.ts` — pure drag attraction and directional swipe classification.
- `lib/scene-timelines.ts` — deterministic fragment reveal times and visual cues for all eight scenes.
- `components/experience/GestureSurface.tsx` — Pointer Events, wheel, and keyboard adapter that emits semantic gestures.
- `components/experience/TwinGravityCanvas.tsx` — persistent Y/U cores, narrative trails, particles, camera choreography, reduced-motion and SVG fallback.
- `tests/director.test.ts` — phase, pause, and auto-advance contracts.
- `tests/gestures.test.ts` — distance, direction, velocity, cancellation, and threshold contracts.
- `tests/scene-timelines.test.ts` — eight-scene timeline uniqueness and completeness.
- `tests/gesture-surface.test.tsx` — browser-real pointer, wheel, and keyboard sequences.

**Modify**

- `lib/experience.ts` — add guarded scene advance and restart-compatible director events without changing canonical scene order.
- `lib/particles.ts` — generate persistent Y/U anchor targets and compatible exit/entry targets.
- `components/experience/EchoExperience.tsx` — integrate the director, semantic gestures, continuous canvas, pause reasons, and remove `继续航行`.
- `components/experience/scenes.tsx` — remove hold/tap counters; retain only opening attraction, jealousy scrub, one channel choice, automatic status views, and replay.
- `components/experience/ScenePanel.tsx` — expose reading/focus pause callbacks and current-fragment-only layout.
- `components/experience/EchoTranscript.tsx` — pause while reading/reviewing and retain the stable live region.
- `components/experience/AudioEngine.tsx` — pause/resume with document visibility and accept director cues.
- `components/experience/EchoCoreCanvas.tsx` — remove after all imports/tests migrate to `TwinGravityCanvas`.
- `app/globals.css` — dynamic viewport, safe areas, gesture surfaces, Y/U overlays, swipe affordance, cinematic panels, reduced motion, and fallback styling.
- `tests/experience.test.ts` — guarded advance/restart regression.
- `tests/scenes.test.tsx` — replace hold and repeated-click tests with semantic interaction and automatic reveal tests.
- `tests/experience-ui.test.tsx` — integration coverage for no long-press copy, no continue button, pause/auto-advance, and single-canvas persistence.
- `tests/particles.test.ts` — Y/U anchors, compatible transitions, and unique scene signatures.
- `tests/echo-core.test.tsx` — persistent twin canvas and fallback/reduced-motion contracts.
- `tests/echo-transcript.test.tsx` — reading pause callbacks and stable live-region behavior.
- `tests/echo-transcript-styles.test.ts` — compact current-fragment panel and safe-area layout contracts.

## Standard verification commands

Use the bundled Node runtime because the shell-managed Node version may be older than the repository's `>=22.13.0` requirement.

```bash
NODE=/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE node_modules/vitest/vitest.mjs run
$NODE node_modules/eslint/bin/eslint.js .
$NODE node_modules/vite/bin/vite.js build --config vite.github-pages.config.ts
$NODE scripts/verify-github-pages-build.mjs
$NODE node_modules/vinext/dist/cli/index.js build
git diff --check
```

Expected final result: all Vitest files pass, ESLint exits 0, both builds exit 0, Pages artifacts verify, and `git diff --check` prints nothing.

---

### Task 1: Deterministic cinematic director

**Files:**
- Create: `lib/director.ts`
- Create: `lib/scene-timelines.ts`
- Create: `tests/director.test.ts`
- Create: `tests/scene-timelines.test.ts`
- Modify: `lib/experience.ts`
- Modify: `tests/experience.test.ts`

- [ ] **Step 1: Write failing director tests**

Add tests that define the four phases, the 12-second ready timeout, pause reset behavior, and one-scene-only advance:

```ts
import { describe, expect, test } from "vitest";
import { createDirector, reduceDirector } from "../lib/director";

describe("cinematic director", () => {
  test("moves enter → present → ready → exit and emits one advance token", () => {
    let state = createDirector("wake");
    state = reduceDirector(state, { type: "START_PRESENTATION", now: 1600 });
    expect(state.phase).toBe("present");
    state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 6400 });
    expect(state.phase).toBe("ready");
    expect(state.autoAdvanceAt).toBe(18_400);
    state = reduceDirector(state, { type: "REQUEST_ADVANCE", now: 6500 });
    expect(state).toMatchObject({ phase: "exit", advanceToken: 1 });
    expect(reduceDirector(state, { type: "REQUEST_ADVANCE", now: 6600 })).toEqual(state);
  });

  test("reading pauses auto advance and resumes with a fresh twelve seconds", () => {
    let state = reduceDirector(createDirector("night"), { type: "PRESENTATION_COMPLETE", now: 1000 });
    state = reduceDirector(state, { type: "PAUSE", reason: "reading", now: 8000 });
    expect(state.autoAdvanceAt).toBeNull();
    state = reduceDirector(state, { type: "RESUME", reason: "reading", now: 30_000 });
    expect(state.autoAdvanceAt).toBe(42_000);
  });

  test("ignores timer expiry while paused or outside ready", () => {
    const paused = reduceDirector(
      reduceDirector(createDirector("game"), { type: "PRESENTATION_COMPLETE", now: 0 }),
      { type: "PAUSE", reason: "hidden", now: 1000 },
    );
    expect(reduceDirector(paused, { type: "IDLE_EXPIRED", now: 99_000 })).toEqual(paused);
  });
});
```

Add `tests/scene-timelines.test.ts` to require every scene to have ordered reveal cues, a presentation end, and a distinct transition signature:

```ts
import { expect, test } from "vitest";
import { sceneOrder } from "../lib/experience";
import { sceneTimelines } from "../lib/scene-timelines";

test("all eight scenes have ordered, distinct cinematic timelines", () => {
  const signatures = sceneOrder.map((scene) => {
    const timeline = sceneTimelines[scene];
    expect(timeline.enterMs).toBeGreaterThanOrEqual(500);
    expect(timeline.enterMs).toBeLessThanOrEqual(1000);
    expect(timeline.reveals.length).toBeGreaterThanOrEqual(3);
    expect(timeline.reveals.map((cue) => cue.at)).toEqual(
      [...timeline.reveals.map((cue) => cue.at)].sort((a, b) => a - b),
    );
    expect(timeline.presentMs).toBeGreaterThan(timeline.reveals.at(-1)!.at);
    expect(timeline.exitMs).toBeGreaterThanOrEqual(1600);
    expect(timeline.exitMs).toBeLessThanOrEqual(2200);
    return `${timeline.motion}:${timeline.transition}`;
  });
  expect(new Set(signatures).size).toBe(sceneOrder.length);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
$NODE node_modules/vitest/vitest.mjs run tests/director.test.ts tests/scene-timelines.test.ts tests/experience.test.ts
```

Expected: new tests fail because `lib/director.ts` and `lib/scene-timelines.ts` do not exist.

- [ ] **Step 3: Implement the director types and reducer**

Create `lib/director.ts` with an explicit, side-effect-free reducer:

```ts
import type { SceneId } from "./experience";

export type DirectorPhase = "enter" | "present" | "ready" | "exit";
export type PauseReason = "reading" | "focus" | "hidden";
export type DirectorState = {
  scene: SceneId;
  phase: DirectorPhase;
  paused: PauseReason[];
  autoAdvanceAt: number | null;
  advanceToken: number;
};
export type DirectorEvent =
  | { type: "START_PRESENTATION"; now: number }
  | { type: "PRESENTATION_COMPLETE"; now: number }
  | { type: "PAUSE"; reason: PauseReason; now: number }
  | { type: "RESUME"; reason: PauseReason; now: number }
  | { type: "REQUEST_ADVANCE"; now: number }
  | { type: "IDLE_EXPIRED"; now: number };

export const READY_IDLE_MS = 12_000;

export function createDirector(scene: SceneId): DirectorState {
  return { scene, phase: "enter", paused: [], autoAdvanceAt: null, advanceToken: 0 };
}

export function reduceDirector(state: DirectorState, event: DirectorEvent): DirectorState {
  if (event.type === "START_PRESENTATION" && state.phase === "enter") {
    return { ...state, phase: "present" };
  }
  if (event.type === "PRESENTATION_COMPLETE" && state.phase !== "exit") {
    return {
      ...state,
      phase: "ready",
      autoAdvanceAt: state.paused.length ? null : event.now + READY_IDLE_MS,
    };
  }
  if (event.type === "PAUSE") {
    if (state.paused.includes(event.reason)) return state;
    return { ...state, paused: [...state.paused, event.reason], autoAdvanceAt: null };
  }
  if (event.type === "RESUME") {
    const paused = state.paused.filter((reason) => reason !== event.reason);
    if (paused.length === state.paused.length) return state;
    return {
      ...state,
      paused,
      autoAdvanceAt: state.phase === "ready" && paused.length === 0 ? event.now + READY_IDLE_MS : null,
    };
  }
  const requestsAdvance = event.type === "REQUEST_ADVANCE"
    || (event.type === "IDLE_EXPIRED" && state.autoAdvanceAt !== null && event.now >= state.autoAdvanceAt);
  if (!requestsAdvance || state.phase !== "ready" || state.paused.length) return state;
  return { ...state, phase: "exit", autoAdvanceAt: null, advanceToken: state.advanceToken + 1 };
}
```

- [ ] **Step 4: Define all scene timelines**

Create `lib/scene-timelines.ts`. Fragment IDs must match `lib/content.ts`; signal uses the selected channel's fragment IDs at runtime, so its fixed cues are semantic slots:

```ts
import type { SceneId } from "./experience";

export type MotionCue = "attract" | "disrupt" | "lock" | "orbit" | "reply" | "tunnel" | "sync" | "infinity";
export type SceneTimeline = {
  enterMs: number;
  presentMs: number;
  exitMs: number;
  motion: MotionCue;
  transition: string;
  reveals: { at: number; id: string }[];
};

export const sceneTimelines: Record<SceneId, SceneTimeline> = {
  wake: { enterMs: 700, presentMs: 5400, exitMs: 1800, motion: "attract", transition: "gravity-wave", reveals: [{ at: 900, id: "spark" }, { at: 2500, id: "archive" }, { at: 4100, id: "receiver" }] },
  jealousy: { enterMs: 650, presentMs: 5600, exitMs: 1750, motion: "disrupt", transition: "orbit-repair", reveals: [{ at: 1000, id: "praise" }, { at: 2700, id: "smile" }, { at: 4300, id: "meaning" }] },
  confession: { enterMs: 800, presentMs: 6200, exitMs: 2100, motion: "lock", transition: "coordinate-beam", reveals: [{ at: 900, id: "year" }, { at: 2400, id: "month" }, { at: 3600, id: "day" }, { at: 4900, id: "locked" }] },
  privilege: { enterMs: 720, presentMs: 6400, exitMs: 1900, motion: "orbit", transition: "petal-bloom", reveals: [{ at: 1000, id: "diary" }, { at: 2700, id: "remembered" }, { at: 4300, id: "seen" }, { at: 5400, id: "action" }] },
  signal: { enterMs: 680, presentMs: 7200, exitMs: 1850, motion: "reply", transition: "echo-return", reveals: [{ at: 1200, id: "$response:0" }, { at: 3100, id: "$response:1" }, { at: 5000, id: "$response:2" }, { at: 6300, id: "close" }] },
  game: { enterMs: 760, presentMs: 6500, exitMs: 1700, motion: "tunnel", transition: "dual-stream", reveals: [{ at: 900, id: "near" }, { at: 2700, id: "sync" }, { at: 4600, id: "through" }, { at: 5600, id: "complete" }] },
  night: { enterMs: 820, presentMs: 7600, exitMs: 2000, motion: "sync", transition: "wave-merge", reveals: [{ at: 1700, id: "third" }, { at: 4100, id: "two-thirds" }, { at: 6200, id: "connected" }, { at: 7000, id: "frequency" }] },
  finale: { enterMs: 900, presentMs: 7600, exitMs: 1800, motion: "infinity", transition: "yu-seal", reveals: [{ at: 1200, id: "recap" }, { at: 3700, id: "present" }, { at: 6100, id: "echo" }] },
};
```

- [ ] **Step 5: Guard canonical scene advance**

Extend `ExperienceEvent` with `{ type: "ADVANCE_TO"; from: SceneId; to: SceneId }` and handle it only when `from` is the current completed scene and `to` is exactly the next entry in `sceneOrder`. Keep `NEXT` temporarily for compatibility during migration, then remove it in Task 6.

Add this regression to `tests/experience.test.ts`:

```ts
test("guarded advance cannot skip or advance from a stale scene", () => {
  const wake = reduceExperience(createExperience(), { type: "SCENE_COMPLETE", scene: "wake" });
  expect(reduceExperience(wake, { type: "ADVANCE_TO", from: "wake", to: "confession" })).toEqual(wake);
  const jealousy = reduceExperience(wake, { type: "ADVANCE_TO", from: "wake", to: "jealousy" });
  expect(jealousy.scene).toBe("jealousy");
  expect(reduceExperience(jealousy, { type: "ADVANCE_TO", from: "wake", to: "jealousy" })).toEqual(jealousy);
});
```

- [ ] **Step 6: Run focused and full tests**

Run the focused command from Step 2, then `$NODE node_modules/vitest/vitest.mjs run`.

Expected: all existing and new tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/director.ts lib/scene-timelines.ts lib/experience.ts tests/director.test.ts tests/scene-timelines.test.ts tests/experience.test.ts
git commit -m "feat: add cinematic scene director"
```

---

### Task 2: Semantic gesture layer

**Files:**
- Create: `lib/gestures.ts`
- Create: `components/experience/GestureSurface.tsx`
- Create: `tests/gestures.test.ts`
- Create: `tests/gesture-surface.test.tsx`

- [ ] **Step 1: Write failing pure gesture tests**

```ts
import { expect, test } from "vitest";
import { attractionProgress, classifySwipe } from "../lib/gestures";

test("attraction snaps inside a forgiving radius", () => {
  expect(attractionProgress({ x: 20, y: 20 }, { x: 120, y: 80 }, 36)).toEqual({ progress: 0, attracted: false });
  expect(attractionProgress({ x: 101, y: 68 }, { x: 120, y: 80 }, 36).attracted).toBe(true);
});

test("only a dominant upward gesture advances", () => {
  expect(classifySwipe({ x: 180, y: 620, at: 0 }, { x: 168, y: 500, at: 420 })).toBe("up");
  expect(classifySwipe({ x: 180, y: 620, at: 0 }, { x: 250, y: 580, at: 420 })).toBe("none");
  expect(classifySwipe({ x: 180, y: 620, at: 0 }, { x: 175, y: 590, at: 900 })).toBe("none");
});
```

- [ ] **Step 2: Run tests and confirm RED**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/gestures.test.ts tests/gesture-surface.test.tsx
```

Expected: both tests fail because the gesture modules do not exist.

- [ ] **Step 3: Implement pure gesture math**

Create `lib/gestures.ts`:

```ts
export type Point = { x: number; y: number };
export type TimedPoint = Point & { at: number };

export function attractionProgress(point: Point, target: Point, radius: number) {
  const distance = Math.hypot(point.x - target.x, point.y - target.y);
  const attracted = distance <= radius;
  const progress = attracted ? 1 : Math.max(0, 1 - (distance - radius) / Math.max(radius * 2, 1));
  return { progress, attracted };
}

export function classifySwipe(start: TimedPoint, end: TimedPoint): "up" | "none" {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const duration = Math.max(1, end.at - start.at);
  const speed = -dy / duration;
  const dominant = -dy > Math.abs(dx) * 1.35;
  return dominant && (-dy >= 72 || (speed >= 0.45 && -dy >= 42)) ? "up" : "none";
}
```

- [ ] **Step 4: Implement `GestureSurface` with pointer capture cleanup**

The component must emit semantics, never mutate scene state:

```tsx
"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { classifySwipe, type TimedPoint } from "../../lib/gestures";

type Props = {
  enabled: boolean;
  onAdvance: () => void;
  onPause: (paused: boolean) => void;
  children: ReactNode;
};

export function GestureSurface({ enabled, onAdvance, onPause, children }: Props) {
  const start = useRef<TimedPoint | null>(null);
  const onPauseRef = useRef(onPause);
  useEffect(() => { onPauseRef.current = onPause; }, [onPause]);
  const release = useCallback(() => { start.current = null; onPauseRef.current(false); }, []);

  useEffect(() => {
    const hidden = () => { if (document.hidden) release(); };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [release]);

  return <div
    className="gesture-surface"
    onPointerDown={(event) => {
      start.current = { x: event.clientX, y: event.clientY, at: performance.now() };
      onPause(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }}
    onPointerUp={(event) => {
      const initial = start.current;
      if (initial && enabled && classifySwipe(initial, { x: event.clientX, y: event.clientY, at: performance.now() }) === "up") onAdvance();
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      release();
    }}
    onPointerCancel={release}
    onWheel={(event) => { if (enabled && event.deltaY > 36) onAdvance(); }}
    onKeyDown={(event) => {
      if (enabled && ["ArrowDown", "PageDown", " "].includes(event.key)) { event.preventDefault(); onAdvance(); }
    }}
  >{children}</div>;
}
```

- [ ] **Step 5: Add browser-real sequence tests**

In `tests/gesture-surface.test.tsx`, polyfill pointer capture and test down → move/up, cancel, wheel, keyboard, and disabled state:

```tsx
test("one upward pointer sequence emits one advance and releases reading pause", () => {
  const onAdvance = vi.fn();
  const onPause = vi.fn();
  render(<GestureSurface enabled onAdvance={onAdvance} onPause={onPause}><span>内容</span></GestureSurface>);
  const surface = screen.getByText("内容").parentElement!;
  fireEvent.pointerDown(surface, { pointerId: 7, clientX: 180, clientY: 620 });
  fireEvent.pointerUp(surface, { pointerId: 7, clientX: 172, clientY: 500 });
  expect(onAdvance).toHaveBeenCalledOnce();
  expect(onPause.mock.calls).toEqual([[true], [false]]);
});
```

Add a second test asserting `pointerCancel` emits no advance, a horizontal gesture emits no advance, and two `wheel` events while `enabled={false}` emit none.

- [ ] **Step 6: Run focused/full tests and commit**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/gestures.test.ts tests/gesture-surface.test.tsx
$NODE node_modules/vitest/vitest.mjs run
git add lib/gestures.ts components/experience/GestureSurface.tsx tests/gestures.test.ts tests/gesture-surface.test.tsx
git commit -m "feat: add semantic cinematic gestures"
```

---

### Task 3: Replace hold and repeated-click scenes with semantic/automatic scenes

**Files:**
- Modify: `components/experience/scenes.tsx`
- Modify: `tests/scenes.test.tsx`
- Modify: `lib/content.ts` only if an aria label or non-letter visual status needs copy; do not rewrite approved story text.

- [ ] **Step 1: Replace obsolete tests with failing behavior contracts**

Delete tests that require a three-second hold, three-tap fallback, pulse button, three coordinate clicks, three privilege clicks, three game clicks, night hold/taps, and three finale reveal clicks. Add tests for the approved semantics:

```tsx
test("wake attracts Y to U with a forgiving drag and never renders long-press copy", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const onReveal = vi.fn();
  render(<WakeScene onComplete={onComplete} onReveal={onReveal} />);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  expect(screen.queryByText(/长按|触碰三次/)).not.toBeInTheDocument();
  fireEvent.pointerDown(y, { pointerId: 1, clientX: 70, clientY: 90 });
  fireEvent.pointerMove(y, { pointerId: 1, clientX: 184, clientY: 154 });
  fireEvent.pointerUp(y, { pointerId: 1, clientX: 184, clientY: 154 });
  expect(onComplete).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.presentMs));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["spark", "archive", "receiver"]);
  expect(onComplete).toHaveBeenCalledOnce();
});

test("wake cancel and unmount never attract or leak pointer state", () => {
  const onComplete = vi.fn();
  const view = render(<WakeScene onComplete={onComplete} onReveal={noop} />);
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  fireEvent.pointerDown(y, { pointerId: 3, clientX: 70, clientY: 90 });
  fireEvent.pointerCancel(y, { pointerId: 3 });
  view.unmount();
  expect(onComplete).not.toHaveBeenCalled();
});

test("jealousy completes with one continuous range gesture and no pulse button", () => {
  const onComplete = vi.fn();
  render(<JealousyScene onComplete={onComplete} onReveal={noop} />);
  fireEvent.change(screen.getByRole("slider", { name: "滑动解码心跳" }), { target: { value: "100" } });
  expect(screen.queryByRole("button", { name: /脉冲/ })).not.toBeInTheDocument();
  expect(onComplete).toHaveBeenCalledOnce();
});

test("signal requires one channel choice and then presents responses automatically", () => {
  vi.useFakeTimers();
  const onResponse = vi.fn();
  const onComplete = vi.fn();
  render(<SignalScene onResponse={onResponse} onComplete={onComplete} onReveal={noop} onChannelSelected={noop} />);
  fireEvent.click(screen.getByRole("button", { name: "想吐槽一下" }));
  act(() => vi.advanceTimersByTime(sceneTimelines.signal.presentMs));
  expect(onResponse.mock.calls.map(([type]) => type)).toEqual(["curious", "compliment", "ally"]);
  expect(onComplete).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "认真追问" })).not.toBeInTheDocument();
});
```

Add automatic-scene tests using fake timers for confession, privilege, game, night, and finale. Each test must assert ordered `onReveal` calls, one `onComplete`, absence of former step buttons, and timer cleanup on unmount.

```tsx
test.each([
  ["confession", ConfessionScene, ["year", "month", "day", "locked"]],
  ["privilege", PrivilegeScene, ["diary", "remembered", "seen", "action"]],
  ["game", GameScene, ["near", "sync", "through", "complete"]],
  ["night", NightScene, ["third", "two-thirds", "connected", "frequency"]],
] as const)("%s presents its complete reveal sequence automatically", (scene, Component, ids) => {
  vi.useFakeTimers();
  const onReveal = vi.fn();
  const onComplete = vi.fn();
  const view = render(<Component onReveal={onReveal} onComplete={onComplete} />);
  act(() => vi.advanceTimersByTime(sceneTimelines[scene].presentMs));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(ids);
  expect(onComplete).toHaveBeenCalledOnce();
  view.unmount();
  act(() => vi.runOnlyPendingTimers());
  expect(onComplete).toHaveBeenCalledOnce();
});

test("finale opens itself automatically and keeps only the explicit replay decision", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  render(<FinaleScene onComplete={onComplete} onReveal={noop} onRestart={noop} />);
  expect(screen.queryByText(finalCopy.lines[0])).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(sceneTimelines.finale.presentMs));
  expect(screen.getByText(finalCopy.lines[0])).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重新进入这片宇宙" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /读取回音|展开无限回音/ })).not.toBeInTheDocument();
  expect(onComplete).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run `tests/scenes.test.tsx` and confirm RED**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/scenes.test.tsx
```

Expected: tests fail because old controls and hold/tap behavior still exist.

- [ ] **Step 3: Add a reusable automatic reveal hook**

Inside `components/experience/scenes.tsx`, add a hook that schedules cues and cleans them on unmount:

Extend `BasicProps` with `active?: boolean`. Every scene destructures it as `active = true` so focused component tests remain concise; `EchoExperience` passes `active={director.phase === "present"}` so automatic timers and semantic controls cannot start during `ENTER`.

```tsx
function useAutomaticScene(
  cues: { at: number; id: string }[],
  totalMs: number,
  onReveal: (id: string) => void,
  onComplete: () => void,
  enabled = true,
) {
  const revealOnce = useRevealOnce(onReveal);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    if (!enabled) return;
    const timers = cues.map((cue) => setTimeout(() => revealOnce(cue.id), cue.at));
    timers.push(setTimeout(() => completeRef.current(), totalMs));
    return () => timers.forEach(clearTimeout);
  }, [cues, enabled, revealOnce, totalMs]);
}
```

Export frozen cue arrays or read them from `sceneTimelines` so the effect does not restart due to a new array on each render.

- [ ] **Step 4: Implement the Y-to-U attraction control**

Replace `WakeScene` with a semantic drag target. Use `attractionProgress` and pointer capture. The button is the Y core; U is a decorative target with `aria-hidden`:

```tsx
export function WakeScene({ onComplete, onReveal, active = true }: BasicProps) {
  const [progress, setProgress] = useState(0);
  const [attracted, setAttracted] = useState(false);
  const dragging = useRef(false);
  const finish = () => {
    if (attracted) return;
    setAttracted(true);
  };
  useAutomaticScene(
    sceneTimelines.wake.reveals,
    sceneTimelines.wake.presentMs,
    onReveal,
    onComplete,
    active && attracted,
  );
  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    const box = event.currentTarget.parentElement!.getBoundingClientRect();
    const result = attractionProgress(
      { x: event.clientX - box.left, y: event.clientY - box.top },
      { x: box.width * .64, y: box.height * .48 },
      Math.max(34, box.width * .1),
    );
    setProgress(result.progress);
    if (result.attracted) finish();
  };
  return <div className="gravity-intro" style={{ "--attraction": progress } as React.CSSProperties}>
    <button
      className="gravity-y"
      aria-label="把 Y 靠近 U"
      disabled={!active || attracted}
      onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); }}
      onPointerMove={move}
      onPointerUp={(event) => { dragging.current = false; event.currentTarget.releasePointerCapture?.(event.pointerId); }}
      onPointerCancel={() => { dragging.current = false; setProgress(0); }}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") finish(); }}
    >Y</button>
    <span className="gravity-u" aria-hidden="true">U</span>
    <p>拖动 Y，靠近 U</p>
  </div>;
}
```

Add `onContextMenu={(event) => event.preventDefault()}` only to `.gravity-y`; do not apply context-menu suppression to the root or transcript.

- [ ] **Step 5: Implement continuous jealousy and automatic scenes**

- Keep the native range input for jealousy and remove `.decode-pulse`.
- For confession, privilege, game, night, and finale, call `useAutomaticScene` with their `sceneTimelines` cues and render status-only structures such as `.coordinate-lock-auto`, `.privilege-bloom`, `.dual-stream-gates`, `.frequency-link-auto`, and `.finale-copy`.
- SignalScene keeps the four channel buttons. After one choice, schedule the three response types at 1200, 3100, and 5000 ms, reveal `close` at 6300 ms, and complete at `sceneTimelines.signal.presentMs` (7200 ms). Derive response IDs from the chosen channel in the existing order; do not hard-code text.
- Finale renders the relationship clock from entry, reveals the final copy when the `echo` cue fires, and keeps only the replay button.

Use the following automatic status contract in each component:

```tsx
const timeline = sceneTimelines.night;
useAutomaticScene(timeline.reveals, timeline.presentMs, onReveal, onComplete);
return <div className="frequency-link-auto" role="img" aria-label="Y 与 U 的深夜频率正在自动同频">
  <span className="frequency-line" />
  <b>我们正在同频</b>
</div>;
```

- [ ] **Step 6: Run scenes/full tests and commit**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/scenes.test.tsx
$NODE node_modules/vitest/vitest.mjs run
git add components/experience/scenes.tsx tests/scenes.test.tsx lib/content.ts
git commit -m "feat: replace repeated clicks with cinematic scenes"
```

Only include `lib/content.ts` in the commit if it actually changed.

---

### Task 4: Twin-gravity target math and transition compatibility

**Files:**
- Modify: `lib/particles.ts`
- Modify: `tests/particles.test.ts`

- [ ] **Step 1: Write failing Y/U target tests**

Add tests that require persistent anchors, readable hidden-letter geometry, and compatible adjacent transitions:

```ts
import { sceneOrder } from "../lib/experience";
import { sceneGravityAnchors, sceneParticleTargets, transitionParticleTargets } from "../lib/particles";

test("every scene retains distinct Y and U gravity anchors", () => {
  for (const scene of sceneOrder) {
    const anchors = sceneGravityAnchors(scene);
    expect(anchors.y).not.toEqual(anchors.u);
    expect(Math.hypot(anchors.y[0] - anchors.u[0], anchors.y[1] - anchors.u[1])).toBeGreaterThan(.25);
  }
});

test("adjacent transition output is the next scene input source", () => {
  for (let index = 0; index < sceneOrder.length - 1; index += 1) {
    const from = sceneOrder[index];
    const to = sceneOrder[index + 1];
    const bridge = transitionParticleTargets(from, to, 256);
    expect(bridge.exit).toHaveLength(768);
    expect(bridge.entry).toHaveLength(768);
    expect(bridge.entry).toEqual(sceneParticleTargets(to, 256, "entry"));
  }
});

test("finale resolves the hidden Y into the U silhouette", () => {
  const points = sceneParticleTargets("finale", 2048);
  const leftTop = points.filter((_, index) => index % 3 === 0 && points[index + 1] > .5).length;
  expect(leftTop).toBeGreaterThan(80);
});
```

- [ ] **Step 2: Run particles tests and confirm RED**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/particles.test.ts
```

Expected: missing exports and unsupported third argument fail.

- [ ] **Step 3: Add gravity anchors and transition modes**

Extend `sceneParticleTargets(scene, count, mode = "present")` where mode is `"entry" | "present" | "exit"`. Keep seeded deterministic output. Add:

```ts
export type Vec3Tuple = [number, number, number];
export type TargetMode = "entry" | "present" | "exit";

const gravityAnchors: Record<SceneId, { y: Vec3Tuple; u: Vec3Tuple }> = {
  wake: { y: [-1.35, .72, .15], u: [.72, .12, 0] },
  jealousy: { y: [-.98, .42, .24], u: [.74, .12, -.08] },
  confession: { y: [-.62, .55, .08], u: [.58, .1, -.05] },
  privilege: { y: [-.35, .35, .08], u: [.32, .08, 0] },
  signal: { y: [-.72, .18, .15], u: [.72, .18, -.12] },
  game: { y: [-.46, .08, .3], u: [.46, .08, -.3] },
  night: { y: [-.3, .14, .1], u: [.3, .14, -.1] },
  finale: { y: [-.12, .2, .04], u: [.12, .08, -.04] },
};

export function sceneGravityAnchors(scene: SceneId) { return gravityAnchors[scene]; }

export function transitionParticleTargets(from: SceneId, to: SceneId, count: number) {
  return { exit: sceneParticleTargets(from, count, "exit"), entry: sceneParticleTargets(to, count, "entry") };
}
```

For each scene, use mode to contract/extend its present geometry rather than scattering it. For example, confession entry is the jealousy repair ring, confession present is three coordinate rings, and confession exit collapses those rings onto the privilege orbit axis. Finale must sample an implicit Y path inside a U-shaped path rather than reusing the old infinity target as the particle target; infinity remains a separate ribbon revealed after the Y/U seal.

- [ ] **Step 4: Verify deterministic signatures and commit**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/particles.test.ts tests/scene-timelines.test.ts
$NODE node_modules/vitest/vitest.mjs run
git add lib/particles.ts tests/particles.test.ts
git commit -m "feat: sculpt persistent YU gravity targets"
```

---

### Task 5: Persistent twin-gravity WebGL world

**Files:**
- Create: `components/experience/TwinGravityCanvas.tsx`
- Modify: `tests/echo-core.test.tsx`
- Modify: `lib/quality.ts`
- Modify: `tests/quality.test.ts`
- Modify: `lib/frame-timer.ts`
- Modify: `tests/frame-timer.test.ts`

- [ ] **Step 1: Write failing persistent-canvas and fallback tests**

Update `tests/echo-core.test.tsx` to import `TwinGravityCanvas` and test:

```tsx
test("keeps one canvas while scene cues change", () => {
  const view = render(<TwinGravityCanvas scene="wake" phase="present" growth={growth} />);
  const canvas = screen.getByLabelText("Y 与 U 双星引力动态视觉");
  view.rerender(<TwinGravityCanvas scene="jealousy" phase="exit" growth={growth} />);
  expect(screen.getByLabelText("Y 与 U 双星引力动态视觉")).toBe(canvas);
  expect(canvas).toHaveAttribute("data-sculpture", "jealousy");
  expect(canvas).toHaveAttribute("data-phase", "exit");
});

test("renders an accessible SVG seal when WebGL is unavailable", () => {
  vi.stubGlobal("WebGLRenderingContext", undefined);
  render(<TwinGravityCanvas scene="finale" phase="present" growth={growth} />);
  expect(screen.getByRole("img", { name: "Y 融入 U 的双星星徽" })).toBeInTheDocument();
  expect(document.querySelector("canvas")).not.toBeInTheDocument();
});
```

Add a quality test asserting that every tier retains `gravityCoreSegments > 0`, while particle and bloom budgets decrease:

```ts
test("all quality tiers retain YU cores while expensive effects scale down", () => {
  expect(qualityProfiles.high.particles).toBeGreaterThan(qualityProfiles.medium.particles);
  expect(qualityProfiles.medium.particles).toBeGreaterThan(qualityProfiles.low.particles);
  expect(qualityProfiles.high.bloomScale).toBeGreaterThan(qualityProfiles.medium.bloomScale);
  expect(qualityProfiles.low.bloomScale).toBe(0);
  for (const profile of Object.values(qualityProfiles)) expect(profile.gravityCoreSegments).toBeGreaterThan(0);
});
```

Add a frame-timer reset regression:

```ts
test("reset discards hidden wall time without resetting animation elapsed time", () => {
  const timer = createFrameTimer(0);
  timer.tick(16);
  timer.reset(60_000);
  const resumed = timer.tick(60_016);
  expect(resumed.delta).toBeCloseTo(.016, 3);
  expect(resumed.elapsed).toBeCloseTo(.032, 3);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/echo-core.test.tsx tests/quality.test.ts
```

Expected: missing `TwinGravityCanvas` and quality field failures.

- [ ] **Step 3: Build the persistent world from the existing renderer**

Copy renderer/composer lifecycle patterns from `EchoCoreCanvas.tsx` into `TwinGravityCanvas.tsx`, then change the public API:

```ts
type Props = {
  scene: SceneId;
  phase: DirectorPhase;
  growth: Growth;
};
```

Create distinct world objects once inside the mount effect:

```ts
const yCore = createGravityCore("#55efff");
const uCore = createGravityCore("#ff63ad");
const narrativeTrails = createNarrativeTrails();
const particles = new THREE.Points(particleGeometry, particleMaterial);
const infinityRibbons = createInfinityRibbons();
world.add(yCore, uCore, narrativeTrails, particles, infinityRibbons);
```

`createGravityCore` must use low-vertex geometry independent of the particle budget:

```ts
function createGravityCore(color: string) {
  return new THREE.Mesh(
    new THREE.IcosahedronGeometry(.12, 3),
    new THREE.MeshPhysicalMaterial({
      color, emissive: color, emissiveIntensity: 1.4, roughness: .08,
      transmission: .72, thickness: 1.1, transparent: true, opacity: .94,
    }),
  );
}
```

Replace the separate particle-only quality constant with a profile while retaining a derived `particleBudget` export for compatibility:

```ts
export const qualityProfiles = {
  high: { particles: 32000, bloomScale: 1, gravityCoreSegments: 3 },
  medium: { particles: 18000, bloomScale: .72, gravityCoreSegments: 3 },
  low: { particles: 7000, bloomScale: 0, gravityCoreSegments: 2 },
} as const;
export const particleBudget = {
  high: qualityProfiles.high.particles,
  medium: qualityProfiles.medium.particles,
  low: qualityProfiles.low.particles,
} as const;
```

The render loop must read `{ scene, phase, growth }` from one live ref, move cores toward `sceneGravityAnchors(scene)`, and use `transitionParticleTargets` only when scene/phase changes. Never recreate the renderer, composer, world, camera, cores, or particle material on prop changes.

- [ ] **Step 4: Add director-grade shader and camera cues**

Add uniforms `uPhase`, `uGravityY`, `uGravityU`, `uShockwave`, and `uTrailEnergy`. In the vertex shader, bend particles toward the two anchors and add a bounded shockwave during enter/exit:

```glsl
vec3 yDelta = uGravityY - p;
vec3 uDelta = uGravityU - p;
float yPull = .018 / (.12 + dot(yDelta, yDelta));
float uPull = .018 / (.12 + dot(uDelta, uDelta));
p += normalize(yDelta) * yPull + normalize(uDelta) * uPull;
float wave = sin(length(p.xy) * 9.0 - uTime * 5.0) * uShockwave;
p.z += wave * .08;
```

Map each timeline motion cue to camera, trail, bloom, and shockwave targets. Clamp delta-based interpolation to prevent a background-tab resume jump:

```ts
const safeDelta = Math.min(delta, 1 / 20);
camera.position.z = THREE.MathUtils.damp(camera.position.z, target.cameraZ, 3.2, safeDelta);
uniforms.uShockwave.value = THREE.MathUtils.damp(uniforms.uShockwave.value, target.shockwave, 4.5, safeDelta);
```

The “炫酷” quality bar is choreography, not raw particle count: each scene must have a unique camera curve, trail topology, morph signature, and color-energy envelope while Y/U remain continuously identifiable.

- [ ] **Step 5: Implement reduced motion, SVG fallback, visibility pause, and disposal**

- If `prefers-reduced-motion` is true, keep camera position nearly fixed, set shockwave/rapid-spin targets to zero, and use 300–500 ms damped morphs.
- If WebGL is unavailable or renderer construction throws, render an inline `<svg role="img" aria-label="Y 融入 U 的双星星徽">` with cyan Y and pink U paths.
- Extend `createFrameTimer` with `reset(nowMs: number) { previous = nowMs; }` without resetting accumulated elapsed animation time.
- Stop requesting frames while `document.hidden`; on visibility restore call `timer.reset(performance.now())` before restarting.
- Dispose both core geometries/materials, every trail/ribbon geometry/material, composer, and renderer on unmount.

- [ ] **Step 6: Run focused/full tests and commit**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/echo-core.test.tsx tests/particles.test.ts tests/quality.test.ts tests/frame-timer.test.ts
$NODE node_modules/vitest/vitest.mjs run
git add components/experience/TwinGravityCanvas.tsx lib/quality.ts lib/frame-timer.ts tests/echo-core.test.tsx tests/quality.test.ts tests/frame-timer.test.ts
git commit -m "feat: render persistent YU gravity world"
```

---

### Task 6: Integrate director, gestures, transcript pause, and automatic progression

**Files:**
- Modify: `components/experience/EchoExperience.tsx`
- Modify: `components/experience/ScenePanel.tsx`
- Modify: `components/experience/EchoTranscript.tsx`
- Modify: `components/experience/AudioEngine.tsx`
- Modify: `lib/experience.ts`
- Modify: `tests/experience-ui.test.tsx`
- Modify: `tests/echo-transcript.test.tsx`
- Delete: `components/experience/EchoCoreCanvas.tsx` after its final import migrates.

- [ ] **Step 1: Write failing shell integration tests**

Use fake timers and realistic events in `tests/experience-ui.test.tsx`:

```tsx
function attractOpeningCores() {
  const y = screen.getByRole("button", { name: "把 Y 靠近 U" });
  fireEvent.pointerDown(y, { pointerId: 4, clientX: 70, clientY: 90 });
  fireEvent.pointerMove(y, { pointerId: 4, clientX: 184, clientY: 154 });
  fireEvent.pointerUp(y, { pointerId: 4, clientX: 184, clientY: 154 });
}

function swipeReadySurface() {
  const surface = screen.getByTestId("gesture-surface");
  fireEvent.pointerDown(surface, { pointerId: 9, clientX: 190, clientY: 700 });
  fireEvent.pointerUp(surface, { pointerId: 9, clientX: 185, clientY: 560 });
}

function finishWakePresentation() {
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.enterMs));
  attractOpeningCores();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.presentMs));
}

test("has no long-press or continue controls and advances once after ready swipe", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  expect(screen.queryByText(/长按 3 秒|继续航行|读取回音 1 \/ 3|按住连接深夜频率/)).not.toBeInTheDocument();
  finishWakePresentation();
  swipeReadySurface();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("reading pauses and restarts the full idle window", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  finishWakePresentation();
  fireEvent.pointerDown(screen.getByRole("status"));
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  fireEvent.pointerUp(screen.getByRole("status"));
  act(() => vi.advanceTimersByTime(11_999));
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1 + sceneTimelines.wake.exitMs));
  expect(screen.getByText("02 / 08")).toBeInTheDocument();
});

test("the canvas node survives a real scene transition", () => {
  vi.useFakeTimers();
  render(<EchoExperience />);
  const canvas = screen.getByLabelText("Y 与 U 双星引力动态视觉");
  finishWakePresentation();
  swipeReadySurface();
  act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
  expect(screen.getByLabelText("Y 与 U 双星引力动态视觉")).toBe(canvas);
});
```

- [ ] **Step 2: Run integration tests and confirm RED**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/experience-ui.test.tsx tests/echo-transcript.test.tsx
```

Expected: old long-press and continue controls remain, pause callbacks are absent, and director progression is not integrated.

- [ ] **Step 3: Implement director scheduling in `EchoExperience`**

Create director state with `useReducer(reduceDirector, state.scene, createDirector)` and reset it only after a guarded scene advance. Use stable refs for timers and callbacks. Required orchestration:

```tsx
const timeline = sceneTimelines[state.scene];
const [director, sendDirector] = useReducer(reduceDirector, state.scene, createDirector);

useEffect(() => {
  if (director.phase !== "enter") return;
  const timer = setTimeout(
    () => sendDirector({ type: "START_PRESENTATION", now: performance.now() }),
    timeline.enterMs,
  );
  return () => clearTimeout(timer);
}, [director.phase, timeline.enterMs]);

const requestAdvance = useCallback(() => {
  sendDirector({ type: "REQUEST_ADVANCE", now: performance.now() });
}, []);

useEffect(() => {
  if (director.phase !== "exit") return;
  const index = sceneOrder.indexOf(state.scene);
  const next = sceneOrder[index + 1];
  if (!next) return;
  const timer = setTimeout(() => dispatch({ type: "ADVANCE_TO", from: state.scene, to: next }), timeline.exitMs);
  return () => clearTimeout(timer);
}, [director.advanceToken, director.phase, state.scene, timeline.exitMs]);

useEffect(() => {
  if (director.phase !== "ready" || director.autoAdvanceAt === null) return;
  const delay = Math.max(0, director.autoAdvanceAt - performance.now());
  const timer = setTimeout(() => sendDirector({ type: "IDLE_EXPIRED", now: performance.now() }), delay);
  return () => clearTimeout(timer);
}, [director.autoAdvanceAt, director.phase]);
```

Place the reducer and its timers in a local `DirectedScene` component keyed by `state.scene`; pass it the current scene, current experience state, dispatch callback, and sound state explicitly. The key deliberately resets phase/timers for the new scene. Render `TwinGravityCanvas` as its sibling in `EchoExperience`, without a key, so the canvas and WebGL world never remount.

Pass `active={director.phase === "present"}` to the current scene component. The opening Y control, jealousy slider, and signal channel buttons are disabled outside `present`; automatic scenes start their reveal timers only when this flag becomes true.

- [ ] **Step 4: Integrate reading pause and semantic gesture surface**

Wrap the UI layer, not the canvas, in `GestureSurface`. Pass `enabled={director.phase === "ready"}` and dispatch reading pause/resume events. `ScenePanel` and `EchoTranscript` receive `onReadingChange(paused)` and call it on pointer/focus entry/exit around transcript review.

Preserve the stable status live region:

```tsx
<div
  className="echo-transcript-live"
  role="status"
  aria-live="polite"
  onPointerDown={() => onReadingChange(true)}
  onPointerUp={() => onReadingChange(false)}
  onFocusCapture={() => onReadingChange(true)}
  onBlurCapture={() => onReadingChange(false)}
>
  {active ? <div key={active.id} className="echo-transcript-reveal">{active.copy}</div> : null}
</div>
```

Render a `.swipe-cue` only in ready, with text `向上划过星轨`. Remove `.next-scene` entirely.

- [ ] **Step 5: Resolve scene completion and automatic reveal ownership**

Avoid duplicate timers: scene components own their internal reveal sequence and call `onComplete`; `EchoExperience` responds by dispatching `SCENE_COMPLETE` and `PRESENTATION_COMPLETE` once. The director owns only entry/ready/exit/idle timing. Scene timeline cue values remain shared between tests, visuals, and components.

For signal, keep `RESPONSE_SELECTED` updates when each automatic response cue fires so growth data remains personalized. For finale, `echo` reveal opens final copy and canvas seal before `SCENE_COMPLETE` moves the director to ready; there is no auto-advance after finale.

- [ ] **Step 6: Pause audio/director on page visibility**

Add a visibility listener in `EchoExperience` that emits `PAUSE hidden` and `RESUME hidden`. Extend `AudioEngine` with `paused`:

```tsx
export function AudioEngine({ enabled, paused, cue }: { enabled: boolean; paused: boolean; cue: SoundName }) {
  // existing cue synthesis
  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    if (paused) void context.suspend();
    else if (enabled) void context.resume();
  }, [enabled, paused]);
  return null;
}
```

- [ ] **Step 7: Remove compatibility `NEXT` and old canvas**

After all call sites use guarded `ADVANCE_TO`, remove `NEXT` from `ExperienceEvent` and its reducer branch. Delete `EchoCoreCanvas.tsx` after `EchoExperience` and tests import `TwinGravityCanvas`.

- [ ] **Step 8: Run integration/full tests and commit**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/experience-ui.test.tsx tests/echo-transcript.test.tsx tests/experience.test.ts
$NODE node_modules/vitest/vitest.mjs run
git add components/experience/EchoExperience.tsx components/experience/ScenePanel.tsx components/experience/EchoTranscript.tsx components/experience/AudioEngine.tsx components/experience/EchoCoreCanvas.tsx lib/experience.ts tests/experience-ui.test.tsx tests/echo-transcript.test.tsx
git commit -m "feat: direct the continuous YU experience"
```

---

### Task 7: Cinematic mobile layout and motion polish

**Files:**
- Modify: `app/globals.css`
- Modify: `tests/echo-transcript-styles.test.ts`

- [ ] **Step 1: Add failing CSS contract tests**

Extend the style test to require dynamic viewport/safe areas, local-only selection suppression, no obsolete control classes in the rendered UI, compact transcript, swipe cue, and reduced-motion overrides:

```ts
test("mobile cinematic shell uses dynamic viewport and safe areas", () => {
  expect(css).toMatch(/\.echo-experience\s*\{[^}]*min-height:\s*100dvh/s);
  expect(css).toMatch(/padding-top:\s*env\(safe-area-inset-top\)/);
  expect(css).toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom\)/);
});

test("only the opening gravity control suppresses selection and touch actions", () => {
  const gravityRule = css.match(/\.gravity-y\s*\{([^}]*)\}/s)?.[1] ?? "";
  expect(gravityRule).toMatch(/touch-action:\s*none/);
  expect(gravityRule).toMatch(/user-select:\s*none/);
  const rootRule = css.match(/\.echo-experience\s*\{([^}]*)\}/s)?.[1] ?? "";
  expect(rootRule).not.toMatch(/user-select:\s*none/);
});

test("reduced motion disables camera-like UI travel and preserves visibility", () => {
  const reduced = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}\s*$/)?.[1] ?? "";
  expect(reduced).toMatch(/\.swipe-cue[^}]*animation:\s*none/);
  expect(reduced).toMatch(/\.scene-stage[^}]*transition-duration:\s*\.4s/);
});
```

Keep the obsolete-copy assertions in `tests/experience-ui.test.tsx`, where the actual H5 client experience renders. Do not add them to `tests/rendered-html.test.mjs`; that file verifies the unrelated Sites preview skeleton.

- [ ] **Step 2: Run CSS/render tests and confirm RED**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/echo-transcript-styles.test.ts
```

Expected: missing dynamic viewport, gesture, swipe cue, and reduced-motion declarations fail.

- [ ] **Step 3: Implement the mobile shell and safe areas**

Add or update these core rules, then integrate them with the existing visual palette:

```css
.echo-experience {
  position: relative;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  background: #02030a;
}
.gesture-surface { position: absolute; inset: 0; z-index: 4; }
.gravity-y {
  min-width: 52px; min-height: 52px;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.echo-transcript { min-height: 72px; max-height: 108px; }
.swipe-cue {
  position: fixed;
  left: 50%; bottom: calc(12px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  pointer-events: none;
  animation: swipe-breathe 1.8s ease-in-out infinite;
}
```

Do not set `touch-action: none`, `user-select: none`, or `-webkit-touch-callout: none` on `.echo-experience`, `.gesture-surface`, `.scene-panel`, or transcript containers.

- [ ] **Step 4: Add scene-specific cinematic envelopes**

Create CSS custom properties on `.scene-is-*` for accent, bloom haze, transcript position, and trail energy. Add unique DOM overlay animations for each semantic status view, while Three.js remains the primary visual:

```css
.scene-is-jealousy { --scene-accent:#ff4f9b; --scene-energy:.95; }
.scene-is-confession { --scene-accent:#69efff; --scene-energy:.58; }
.scene-is-privilege { --scene-accent:#ff79d1; --scene-energy:.68; }
.scene-is-night { --scene-accent:#8399ff; --scene-energy:.36; }
.scene-is-finale { --scene-accent:#e0a2ff; --scene-energy:.82; }
```

Keep text contrast readable. The most intense bloom must occur behind, not over, the active transcript.

- [ ] **Step 5: Add reduced-motion and short-screen rules**

At `max-height: 680px`, compress headers, title spacing, transcript height, and bottom cue without hiding story text. Under reduced motion, disable looped DOM movement, retain 300–500 ms opacity/scale transitions, and keep focus styles unchanged.

- [ ] **Step 6: Run focused/full/build checks and commit**

```bash
$NODE node_modules/vitest/vitest.mjs run tests/echo-transcript-styles.test.ts
$NODE node_modules/vitest/vitest.mjs run
$NODE node_modules/eslint/bin/eslint.js .
git add app/globals.css tests/echo-transcript-styles.test.ts
git commit -m "feat: polish the cinematic mobile composition"
```

---

### Task 8: Full verification, mobile visual gate, and public Pages readiness

**Files:**
- Modify only if verification finds a defect in files already in this plan.
- Do not add unrelated refactors or new story content.

- [ ] **Step 1: Run the complete automated verification matrix**

```bash
$NODE node_modules/vitest/vitest.mjs run
$NODE node_modules/eslint/bin/eslint.js .
$NODE node_modules/vite/bin/vite.js build --config vite.github-pages.config.ts
$NODE scripts/verify-github-pages-build.mjs
$NODE node_modules/vinext/dist/cli/index.js build
git diff --check
git status --short --branch
```

Expected: all commands exit 0. The existing Vite chunk-size advisory may remain, but no test, lint, build, artifact, or diff failure is acceptable.

- [ ] **Step 2: Perform the 390 × 844 mobile walkthrough**

Run the static Vite build locally and inspect all eight scenes at 390 × 844 CSS pixels. Record pass/fail for:

1. No context menu, selection handles, or copy overlay during opening drag and cancel.
2. Y/U remain readable in high, medium, and forced low quality.
3. Scene title, active transcript, main visual, progress rail, and swipe cue fit above browser bottom chrome.
4. Swipe advances exactly one scene; touching/reviewing copy blocks the 12-second timeout.
5. Eight transitions are visually distinct and continuous, not full-page fade replacements.
6. Background/foreground restores without skipped scenes or a visual time jump.
7. Reduced motion retains the entire story and final Y/U seal.
8. Finale shows `05:23`, “小宝贝”, “永远爱你的人”, relationship clock, and replay.

- [ ] **Step 3: Fix only observed defects with a red regression first**

For every defect, add the smallest focused failing test before the fix, run it to confirm RED, implement the fix, and rerun focused plus full verification. Do not accept a visual-only fix without at least a DOM/style/behavior contract when the defect is automatable.

- [ ] **Step 4: Final commit if verification produced fixes**

```bash
git add app/globals.css components/experience/AudioEngine.tsx components/experience/EchoExperience.tsx components/experience/EchoTranscript.tsx components/experience/GestureSurface.tsx components/experience/ScenePanel.tsx components/experience/TwinGravityCanvas.tsx components/experience/scenes.tsx lib/director.ts lib/experience.ts lib/frame-timer.ts lib/gestures.ts lib/particles.ts lib/quality.ts lib/scene-timelines.ts tests/director.test.ts tests/echo-core.test.tsx tests/echo-transcript-styles.test.ts tests/echo-transcript.test.tsx tests/experience-ui.test.tsx tests/experience.test.ts tests/frame-timer.test.ts tests/gesture-surface.test.tsx tests/gestures.test.ts tests/particles.test.ts tests/quality.test.ts tests/scene-timelines.test.ts tests/scenes.test.tsx
git commit -m "fix: harden the YU cinematic experience"
```

If Step 3 found no defects, do not create an empty commit.

- [ ] **Step 5: Prepare public deployment handoff**

Confirm the worktree is clean and HEAD contains every task commit. Report the exact commit SHA, verification results, and the 390 × 844 walkthrough outcome. Push to `origin/main` only after the user confirms the updated live public Pages release; then watch the Pages workflow and verify the live HTML, JS, CSS, favicon, and `og.png` return HTTPS 200.
