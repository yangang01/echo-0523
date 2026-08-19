import { createDirector, reduceDirector } from "../lib/director";

function readyDirector() {
  let state = createDirector("wake");
  state = reduceDirector(state, { type: "START_PRESENTATION", now: 700 });
  return reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 31_900 });
}

test("starts in the enter phase with no pauses or scheduled advance", () => {
  expect(createDirector("wake")).toEqual({
    scene: "wake",
    phase: "enter",
    paused: [],
    autoAdvanceAt: null,
    idleRemainingMs: null,
    resetIdleOnResume: false,
    advanceToken: 0,
  });
});

test("progresses from enter through presentation to an indefinitely ready state", () => {
  const state = readyDirector();

  expect(state).toEqual({
    scene: "wake",
    phase: "ready",
    paused: [],
    autoAdvanceAt: null,
    idleRemainingMs: null,
    resetIdleOnResume: false,
    advanceToken: 0,
  });
});

test("ready waits indefinitely for an explicit advance", () => {
  const state = readyDirector();

  expect(reduceDirector(state, { type: "IDLE_EXPIRED", now: 999_999 })).toBe(state);
});

test("accepts one explicit advance request and ignores repeats after exit", () => {
  const ready = readyDirector();
  const exiting = reduceDirector(ready, { type: "REQUEST_ADVANCE", now: 32_000 });

  expect(exiting).toMatchObject({ phase: "exit", autoAdvanceAt: null, advanceToken: 1 });
  expect(reduceDirector(exiting, { type: "REQUEST_ADVANCE", now: 32_001 })).toBe(exiting);
});

test("control focus and reading pauses cannot trap an explicit advance", () => {
  let state = readyDirector();
  state = reduceDirector(state, { type: "PAUSE", reason: "control-focus", now: 32_000 });
  state = reduceDirector(state, { type: "PAUSE", reason: "reading", now: 32_001 });

  expect(reduceDirector(state, { type: "REQUEST_ADVANCE", now: 32_002 })).toMatchObject({
    phase: "exit",
    advanceToken: 1,
  });
});

test("hidden pages block advance until they return to the foreground", () => {
  let state = readyDirector();
  state = reduceDirector(state, { type: "PAUSE", reason: "hidden", now: 32_000 });
  expect(reduceDirector(state, { type: "REQUEST_ADVANCE", now: 32_001 })).toBe(state);

  state = reduceDirector(state, { type: "RESUME", reason: "hidden", now: 40_000 });
  expect(state).toMatchObject({ paused: [], autoAdvanceAt: null, idleRemainingMs: null });
  expect(reduceDirector(state, { type: "REQUEST_ADVANCE", now: 40_001 })).toMatchObject({
    phase: "exit",
    advanceToken: 1,
  });
});

test("pause and resume never arm automatic ready navigation", () => {
  let state = readyDirector();
  state = reduceDirector(state, { type: "PAUSE", reason: "surface-focus", now: 32_000 });
  state = reduceDirector(state, { type: "RESUME", reason: "surface-focus", now: 50_000 });

  expect(state).toMatchObject({
    phase: "ready",
    paused: [],
    autoAdvanceAt: null,
    idleRemainingMs: null,
    resetIdleOnResume: false,
  });
});
