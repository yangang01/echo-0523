import { createDirector, reduceDirector } from "../lib/director";

test("starts in the enter phase with no pauses or scheduled advance", () => {
  expect(createDirector("wake")).toEqual({ scene: "wake", phase: "enter", paused: [], autoAdvanceAt: null, idleRemainingMs: null, resetIdleOnResume: false, advanceToken: 0 });
});

test("progresses from enter through presentation to ready without an automatic schedule", () => {
  let state = createDirector("wake");
  state = reduceDirector(state, { type: "START_PRESENTATION", now: 700 });
  expect(state.phase).toBe("present");
  state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 6100 });
  expect(state).toMatchObject({ phase: "ready", autoAdvanceAt: null, idleRemainingMs: null });
});

test("accepts one guarded advance request and ignores repeats after exit", () => {
  let state = createDirector("wake");
  state = reduceDirector(state, { type: "START_PRESENTATION", now: 0 });
  state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 1 });
  state = reduceDirector(state, { type: "REQUEST_ADVANCE", now: 2 });
  expect(state).toMatchObject({ phase: "exit", autoAdvanceAt: null, advanceToken: 1 });
  expect(reduceDirector(state, { type: "REQUEST_ADVANCE", now: 3 })).toBe(state);
});

test("ready remains manual across pause and resume", () => {
  let state = createDirector("wake");
  state = reduceDirector(state, { type: "START_PRESENTATION", now: 0 });
  state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 100 });
  state = reduceDirector(state, { type: "PAUSE", reason: "reading", now: 200 });
  expect(state.autoAdvanceAt).toBeNull();
  state = reduceDirector(state, { type: "RESUME", reason: "reading", now: 900 });
  expect(state).toMatchObject({ paused: [], autoAdvanceAt: null, idleRemainingMs: null });
});

test("manual ready waits until every pause reason resumes before accepting advance", () => {
  let state = createDirector("wake");
  state = reduceDirector(state, { type: "START_PRESENTATION", now: 0 });
  state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 100 });
  state = reduceDirector(state, { type: "PAUSE", reason: "reading", now: 200 });
  state = reduceDirector(state, { type: "PAUSE", reason: "hidden", now: 300 });
  state = reduceDirector(state, { type: "RESUME", reason: "reading", now: 500 });
  expect(state).toMatchObject({ paused: ["hidden"], autoAdvanceAt: null });
  expect(reduceDirector(state, { type: "REQUEST_ADVANCE", now: 600 })).toBe(state);
  state = reduceDirector(state, { type: "RESUME", reason: "hidden", now: 900 });
  expect(state.autoAdvanceAt).toBeNull();
  expect(reduceDirector(state, { type: "REQUEST_ADVANCE", now: 901 })).toMatchObject({ phase: "exit" });
});

test("idle expiry never advances a manually controlled scene", () => {
  const entering = createDirector("wake");
  expect(reduceDirector(entering, { type: "IDLE_EXPIRED", now: 100_000 })).toBe(entering);
  let state = reduceDirector(entering, { type: "START_PRESENTATION", now: 0 });
  state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 100 });
  expect(reduceDirector(state, { type: "IDLE_EXPIRED", now: 1_000_000 })).toBe(state);
});
