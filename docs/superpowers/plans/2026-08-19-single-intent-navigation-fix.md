# Single-Intent Navigation Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first explicit scene-advance intent work despite stale focus pauses, and make the first fifth-scene channel tap show its response during entry.

**Architecture:** Keep all existing gesture and scene components. Tighten the director reducer so explicit navigation is blocked only while hidden, then give `SignalScene` a separate interaction-enabled flag that covers both entry and presentation without making other scenes reveal early.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite.

---

### Task 1: One explicit intent exits a ready scene

**Files:**
- Modify: `tests/director.test.ts`
- Modify: `tests/experience-ui.test.tsx`
- Modify: `lib/director.ts`

- [ ] **Step 1: Write failing reducer and UI tests**

Add a reducer case proving `REQUEST_ADVANCE` exits `ready` while transient `reading`, `gesture`, and focus pauses remain, but stays `ready` when `hidden` remains. Add an experience test that focuses the final transcript, then verifies one button click and one outside upward swipe each remove the advance button immediately.

```ts
state = reduceDirector(state, { type: "PAUSE", reason: "reading", now: 2 });
expect(reduceDirector(state, { type: "REQUEST_ADVANCE", now: 3 }).phase).toBe("exit");
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node node_modules/vitest/vitest.mjs run tests/director.test.ts tests/experience-ui.test.tsx`

Expected: FAIL because `beginExit` currently rejects every non-empty pause list.

- [ ] **Step 3: Implement the minimal reducer change**

Change `beginExit` to reject only non-ready states or a pause list containing `hidden`.

```ts
if (state.phase !== "ready" || state.paused.includes("hidden")) return state;
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same Vitest command. Expected: PASS.

### Task 2: Fifth-scene first tap responds during entry

**Files:**
- Modify: `tests/director.test.ts`
- Modify: `tests/experience-ui.test.tsx`
- Modify: `components/experience/EchoExperience.tsx`
- Modify: `lib/director.ts`

- [ ] **Step 1: Write failing entry-interaction tests**

Navigate to scene five without advancing its `enterMs`, click one visible channel once, and assert that the channel label, first transcript, and response text appear. Swipe to the last text before entry completion and assert the unified advance button appears.

```ts
fireEvent.click(screen.getByRole("button", { name: "发生了小事" }));
expect(screen.getByText("频道已接通 · 发生了小事")).toBeInTheDocument();
expect(screen.getByText(/然后呢/)).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node node_modules/vitest/vitest.mjs run tests/director.test.ts tests/experience-ui.test.tsx`

Expected: FAIL because signal choices receive `active={false}` during entry and completion is ignored outside `present`.

- [ ] **Step 3: Implement the minimal signal-entry path**

Pass `active={director.phase === "enter" || director.phase === "present"}` only to `SignalScene`, keep `paused={hidden || director.phase === "exit"}`, and let `PRESENTATION_COMPLETE` transition either `enter` or `present` to `ready`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same Vitest command. Expected: PASS.

### Task 3: Regression, mobile verification, and deployment

**Files:**
- Modify: `docs/superpowers/plans/2026-08-19-single-intent-navigation-fix.md`

- [ ] **Step 1: Run complete verification**

Run Vitest, ESLint, GitHub Pages build, Pages artifact verification, and `git diff --check`. Expected: all exit zero.

- [ ] **Step 2: Verify the mobile interaction**

At 390×844, focus the final transcript and confirm one button click and one upward swipe start exit. Enter scene five and confirm one immediate choice reveals the transcript and response.

- [ ] **Step 3: Commit and push**

```bash
git add lib/director.ts components/experience/EchoExperience.tsx tests/director.test.ts tests/experience-ui.test.tsx docs/superpowers/plans/2026-08-19-single-intent-navigation-fix.md
git commit -m "fix: honor first scene navigation intent"
git push origin HEAD:main
```

- [ ] **Step 4: Confirm deployment**

Wait for the Pages workflow to succeed and verify the deployed asset hashes and `main` SHA match the new commit.
