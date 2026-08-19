# Reader-Paced Scene Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every story fragment ten seconds of readable screen time and require an explicit click, swipe, or keyboard action before leaving a completed scene.

**Architecture:** `sceneTimelines` remains the immutable timing source. Automatic scenes—including jealousy after slider unlock—use `useAutomaticScene`; `Director` stops scheduling idle exits and accepts one explicit advance. `EchoExperience` exposes ready as a real button sharing the existing advance command with swipe and keyboard.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS, Vite/vinext, GitHub Pages.

---

## File map

- `lib/scene-timelines.ts`: exact reading cadence.
- `components/experience/scenes.tsx`: jealousy queue and signal feedback.
- `lib/director.ts`: explicit-only ready navigation.
- `components/experience/EchoExperience.tsx`: shared click/swipe/keyboard advance.
- `app/globals.css`: accessible mobile ready button.
- Related tests under `tests/` lock every behavior.

### Task 1: Establish the readable timeline contract

**Files:**
- Modify: `tests/scene-timelines.test.ts`
- Modify: `lib/scene-timelines.ts`

- [ ] **Step 1: Write the failing cadence test**

```ts
test("gives every fragment a ten-second reading window", () => {
  for (const timeline of Object.values(sceneTimelines)) {
    expect(timeline.reveals[0]?.at).toBe(1_200);
    const boundaries = [...timeline.reveals.map((cue) => cue.at), timeline.presentMs];
    for (let index = 1; index < boundaries.length; index += 1) {
      expect(boundaries[index] - boundaries[index - 1]).toBe(10_000);
    }
  }
});
```

Update the exact registry expectation: three-fragment scenes use 1,200/11,200/21,200 and `presentMs: 31_200`; four-fragment scenes add 31,200 and use `presentMs: 41_200`. Keep enter, exit, motion, transition, and IDs unchanged.

- [ ] **Step 2: Verify RED**

Run `$NODE node_modules/vitest/vitest.mjs run tests/scene-timelines.test.ts`. Expected: current reveal gaps fail the new contract.

- [ ] **Step 3: Implement the schedules**

Apply the three-fragment schedule to `wake`, `jealousy`, and `finale`; apply the four-fragment schedule to `confession`, `privilege`, `signal`, `game`, and `night`.

- [ ] **Step 4: Verify GREEN and commit**

Run the focused suite and `git diff --check`, then:

```bash
git add lib/scene-timelines.ts tests/scene-timelines.test.ts
git commit -m "fix: give every echo time to be read"
```

### Task 2: Queue jealousy copy and preserve signal feedback

**Files:**
- Modify: `tests/scenes.test.tsx`
- Modify: `components/experience/scenes.tsx`

- [ ] **Step 1: Write the failing jealousy sequence test**

```tsx
test("jealousy decodes once then narrates three echoes at reading pace", () => {
  vi.useFakeTimers();
  const onReveal = vi.fn();
  const onComplete = vi.fn();
  render(<JealousyScene onComplete={onComplete} onReveal={onReveal} />);
  fireEvent.change(screen.getByRole("slider", { name: "滑动解码心跳" }), {
    target: { value: "100" },
  });
  expect(onReveal).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1_200));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["praise"]);
  act(() => vi.advanceTimersByTime(10_000));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["praise", "smile"]);
  act(() => vi.advanceTimersByTime(10_000));
  expect(onReveal.mock.calls.map(([id]) => id)).toEqual(["praise", "smile", "meaning"]);
  expect(onComplete).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(10_000));
  expect(onComplete).toHaveBeenCalledOnce();
});
```

Strengthen the signal test: immediately after clicking `想吐槽一下`, assert `频道已接通 · 想吐槽一下`; then check replies at 1.2/11.2/21.2/31.2 seconds and completion at 41.2 seconds.

- [ ] **Step 2: Verify RED**

Run `$NODE node_modules/vitest/vitest.mjs run tests/scenes.test.tsx`. Expected: jealousy reveals three echoes immediately and old signal timing fails.

- [ ] **Step 3: Implement the minimal jealousy queue**

Remove threshold-based reveals and use:

```tsx
const decoded = value >= 92;
useAutomaticScene(
  sceneTimelines.jealousy.reveals,
  sceneTimelines.jealousy.presentMs,
  revealOnce,
  onComplete,
  active && decoded,
  paused,
);
```

Keep slider status/disable semantics and SignalScene's one-channel lock.

- [ ] **Step 4: Verify GREEN and commit**

Run the scenes suite, then:

```bash
git add components/experience/scenes.tsx tests/scenes.test.tsx
git commit -m "fix: pace interactive scene narration"
```

### Task 3: Make ready state explicit and clickable

**Files:**
- Modify: `tests/director.test.ts`
- Modify: `tests/experience-ui.test.tsx`
- Modify: `lib/director.ts`
- Modify: `components/experience/EchoExperience.tsx`

- [ ] **Step 1: Write failing director tests**

```ts
test("ready waits indefinitely for an explicit advance", () => {
  let state = createDirector("wake");
  state = reduceDirector(state, { type: "START_PRESENTATION", now: 700 });
  state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 31_900 });
  expect(state).toMatchObject({ phase: "ready", autoAdvanceAt: null });
  expect(reduceDirector(state, { type: "IDLE_EXPIRED", now: 999_999 })).toBe(state);
});
```

Add a second test: a `control-focus` pause cannot trap an explicit request, but a `hidden` pause still blocks it; repeated requests after exit are idempotent.

- [ ] **Step 2: Write failing integration tests**

```tsx
act(() => vi.advanceTimersByTime(sceneTimelines.wake.presentMs));
const next = screen.getByRole("button", { name: "点击或上划进入下一幕" });
act(() => vi.advanceTimersByTime(120_000));
expect(screen.getByText("01 / 08")).toBeInTheDocument();
fireEvent.click(next);
act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
expect(screen.getByText("02 / 08")).toBeInTheDocument();
```

Keep a separate swipe test, use the button for signal-to-game in the full journey, and assert finale never renders this button.

- [ ] **Step 3: Verify RED**

Run director and experience UI suites. Expected: ready arms a 12-second exit and the cue is not a button.

- [ ] **Step 4: Implement explicit-only ready**

`PRESENTATION_COMPLETE` must set `phase:"ready"`, `autoAdvanceAt:null`, `idleRemainingMs:null`, and `resetIdleOnResume:false`. `REQUEST_ADVANCE` leaves ready unless `hidden` is among pause reasons. Remove the `EchoExperience` idle-expiry scheduling effect.

Render:

```tsx
{director.phase === "ready" && next ? (
  <button type="button" className="swipe-cue" onClick={requestAdvance}>
    点击或上划进入下一幕
  </button>
) : null}
```

- [ ] **Step 5: Verify GREEN and commit**

Run director, experience UI, gesture surface, and scenes suites, then:

```bash
git add lib/director.ts components/experience/EchoExperience.tsx tests/director.test.ts tests/experience-ui.test.tsx
git commit -m "fix: let readers choose when scenes advance"
```

### Task 4: Style the ready button for mobile Safari

**Files:**
- Modify: `tests/echo-transcript-styles.test.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Write failing CSS contracts**

Assert `.swipe-cue` has `pointer-events:auto`, `min-height >= 44px`, `cursor:pointer`, and a focus-visible rule. Assert the short-screen rule preserves 44px and safe-area placement. Keep the reduced-motion `animation:none` assertion.

- [ ] **Step 2: Verify RED**

Run `$NODE node_modules/vitest/vitest.mjs run tests/echo-transcript-styles.test.ts`. Expected: current `pointer-events:none` and short-screen 32px fail.

- [ ] **Step 3: Implement accessible styling**

```css
.swipe-cue { min-height:44px; pointer-events:auto; cursor:pointer; }
.swipe-cue:hover,.swipe-cue:focus-visible {
  border-color:#eaffffb8;
  box-shadow:0 10px 34px #000b,0 0 30px var(--scene-bloom);
  outline:none;
}
@media (max-height:680px) { .swipe-cue { min-height:44px; } }
```

- [ ] **Step 4: Verify GREEN and commit**

Run focused and full tests, then:

```bash
git add app/globals.css tests/echo-transcript-styles.test.ts
git commit -m "fix: expose an accessible next-scene control"
```

### Task 5: Verify, publish, and inspect the public fix

**Files:** No production edits expected.

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

Expected: all exit 0; only the existing large-chunk advisory may remain.

- [ ] **Step 2: Perform mobile browser QA**

At 390×844 and 390×650 verify ten-second text gaps, no automatic ready exit after two minutes, a visible clickable safe-area button, immediate signal channel feedback, signal-to-game click, working swipe, and no finale next button.

- [ ] **Step 3: Push without force and wait for Pages**

```bash
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
git push origin feature/qixi-0523:main
gh run watch "$(gh run list --repo yangang01/qixi-0523-echo-core --workflow deploy-pages.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --repo yangang01/qixi-0523-echo-core --exit-status
```

- [ ] **Step 4: Verify public deployment**

Open `https://yangang01.github.io/qixi-0523-echo-core/` at mobile size and repeat the key navigation checks. Confirm remote `main` SHA equals local `HEAD` and the worktree is clean.
