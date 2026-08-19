# 全场景手动阅读 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all eight scenes reveal copy and advance only after an explicit user action.

**Architecture:** Replace scene-level automatic reveal timers with a shared `useManualScene` queue. Each scene keeps its own prerequisite interaction, then renders the queue button; the existing director remains responsible only for the final scene exit after the last fragment is revealed.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS, Vite, GitHub Pages.

---

### Task 1: Add a manual scene queue contract

**Files:**
- Modify: `tests/scenes.test.tsx`
- Modify: `components/experience/scenes.tsx`

- [ ] **Step 1: Write the failing tests**

Replace automatic-timer assertions with explicit queue assertions: render each basic scene, click `读取下一段` once per cue, assert one ordered `onReveal` call per click, assert the button changes to `进入下一幕` after the final cue, and assert `onComplete` is still zero until that final button is clicked. Add inactive/paused cases asserting the manual button is disabled and callbacks do not fire.

- [ ] **Step 2: Verify RED**

Run `/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/scenes.test.tsx`. Expected: the new button is missing and the old timer-based expectations no longer describe the implementation.

- [ ] **Step 3: Implement the minimal queue**

Add `useManualScene(cues, onReveal, onComplete, enabled, paused)` returning `advance`, `canAdvance`, `isFinal`, and `nextLabel`. `advance` reveals only the cue at the current index; on the final explicit call it invokes `onComplete` once. Render the same `<button type="button" className="scene-step" disabled={!canAdvance} onClick={advance}>` from every scene after its scene-specific controls. Remove all `useAutomaticScene` calls and timer-based reveal/completion paths. Keep the finale relationship clock as its independent clock.

- [ ] **Step 4: Verify GREEN and commit**

Run the scenes suite, then `git diff --check`. Commit with `git add components/experience/scenes.tsx tests/scenes.test.tsx && git commit -m "feat: make every scene reader paced"`.

### Task 2: Update integration navigation for manual fragments

**Files:**
- Modify: `tests/experience-ui.test.tsx`
- Modify: `components/experience/EchoExperience.tsx` if the shared ready cue needs label synchronization

- [ ] **Step 1: Write failing integration tests**

Start the wake scene, complete Y/U, assert no status text appears before a manual click, click `读取下一段` three times and assert the three copy fragments arrive in order, then assert the final button is `进入下一幕` and the progress remains `01 / 08` until it is clicked. Add the same explicit step helper to the full journey and use it for signal, game, night, and finale. Assert waiting 120 seconds never reveals or exits anything.

- [ ] **Step 2: Verify RED**

Run `/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/experience-ui.test.tsx`. Expected: old timeline-driven helpers fail because no cue appears without a click.

- [ ] **Step 3: Implement integration wiring**

Keep `PRESENTATION_COMPLETE` and the existing ready-state “点击或上划进入下一幕” control unchanged for scene exits. Ensure the manual final cue calls completion, so the existing director enters ready only after the last text has visibly been revealed.

- [ ] **Step 4: Verify GREEN and commit**

Run experience UI, director, gesture surface, and scenes suites; then commit with `git add components/experience/EchoExperience.tsx tests/experience-ui.test.tsx && git commit -m "test: require explicit copy and scene advances"`.

### Task 3: Style and verify the manual control

**Files:**
- Modify: `tests/echo-transcript-styles.test.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing style contract**

Assert `.scene-step` has a 44px minimum target, readable label contrast, pointer cursor, focus-visible outline, and short-screen safe-area placement.

- [ ] **Step 2: Verify RED**

Run the styles suite and confirm the missing `.scene-step` declarations fail.

- [ ] **Step 3: Implement styles**

Add a compact pill button matching `.swipe-cue`, but place it inside the scene action so it remains adjacent to the copy and does not cover the mobile browser controls. Preserve reduced-motion behavior and 44px touch sizing at `max-height:680px`.

- [ ] **Step 4: Verify GREEN and commit**

Run focused styles tests, full Vitest, ESLint, Pages build and verifier; commit with `git add app/globals.css tests/echo-transcript-styles.test.ts && git commit -m "style: surface manual reading controls"`.

### Task 4: Publish and inspect

**Files:** None beyond the committed implementation.

- [ ] **Step 1: Run the complete matrix**

Run full Vitest, ESLint, Pages build/verifier, production build, `git diff --check`, and `git status --short --branch`.

- [ ] **Step 2: Perform mobile QA**

At 390×844 and 390×650 confirm every scene waits for explicit fragment clicks, no scene changes after two minutes, the final fragment stays visible, and the next-scene button is safe-area positioned.

- [ ] **Step 3: Publish without force**

Fetch `origin main`, verify it is an ancestor, push `feature/qixi-0523:main`, and wait for the Pages workflow.

- [ ] **Step 4: Verify the public URL**

Confirm the public URL returns HTTPS 200 and repeat the first-scene manual sequence against the deployed page.
