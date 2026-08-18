import { READY_IDLE_MS, createDirector, reduceDirector } from "../lib/director";

test("starts in the enter phase with no pauses or scheduled advance", () => {
  expect(createDirector("wake")).toEqual({
    scene: "wake",
    phase: "enter",
    paused: [],
    autoAdvanceAt: null,
    advanceToken: 0,
  });
});

test("progresses from enter through presentation to a ready idle schedule", () => {
  let state = createDirector("wake");
  state = reduceDirector(state, { type: "START_PRESENTATION", now: 700 });
  expect(state.phase).toBe("present");

  state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 6100 });
  expect(state).toEqual({
    scene: "wake",
    phase: "ready",
    paused: [],
    autoAdvanceAt: 6100 + READY_IDLE_MS,
    advanceToken: 0,
  });
});

test("accepts one guarded advance request and ignores repeats after exit", () => {
  let state = createDirector("wake");
  state = reduceDirector(state, { type: "START_PRESENTATION", now: 0 });
  state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 1 });
  state = reduceDirector(state, { type: "REQUEST_ADVANCE", now: 2 });
  expect(state).toMatchObject({ phase: "exit", autoAdvanceAt: null, advanceToken: 1 });
  expect(reduceDirector(state, { type: "REQUEST_ADVANCE", now: 3 })).toBe(state);
});

test("resuming the final ready pause resets the complete twelve-second idle window", () => {
  let state = createDirector("wake");
  state = reduceDirector(state, { type: "START_PRESENTATION", now: 0 });
  state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 100 });
  state = reduceDirector(state, { type: "PAUSE", reason: "reading", now: 200 });
  expect(state.autoAdvanceAt).toBeNull();
  expect(reduceDirector(state, { type: "PAUSE", reason: "reading", now: 300 })).toBe(state);

  state = reduceDirector(state, { type: "RESUME", reason: "reading", now: 900 });
  expect(state).toMatchObject({ paused: [], autoAdvanceAt: 900 + READY_IDLE_MS });
  expect(reduceDirector(state, { type: "RESUME", reason: "reading", now: 901 })).toBe(state);
});

test("restarts idle only after every concurrent pause reason has resumed", () => {
  let state = createDirector("wake");
  state = reduceDirector(state, { type: "START_PRESENTATION", now: 0 });
  state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 100 });
  state = reduceDirector(state, { type: "PAUSE", reason: "reading", now: 200 });
  state = reduceDirector(state, { type: "PAUSE", reason: "hidden", now: 300 });
  expect(reduceDirector(state, { type: "PAUSE", reason: "hidden", now: 400 })).toBe(state);

  state = reduceDirector(state, { type: "RESUME", reason: "reading", now: 500 });
  expect(state).toMatchObject({ paused: ["hidden"], autoAdvanceAt: null });
  state = reduceDirector(state, { type: "RESUME", reason: "hidden", now: 900 });
  expect(state.autoAdvanceAt).toBe(900 + READY_IDLE_MS);
  expect(reduceDirector(state, { type: "RESUME", reason: "hidden", now: 1000 })).toBe(state);
});

test("ignores idle expiry while paused, before schedule, or outside ready", () => {
  const entering = createDirector("wake");
  expect(reduceDirector(entering, { type: "IDLE_EXPIRED", now: 100_000 })).toBe(entering);

  let state = reduceDirector(entering, { type: "START_PRESENTATION", now: 0 });
  state = reduceDirector(state, { type: "PRESENTATION_COMPLETE", now: 100 });
  const scheduledAt = state.autoAdvanceAt!;
  state = reduceDirector(state, { type: "PAUSE", reason: "hidden", now: 200 });
  expect(reduceDirector(state, { type: "IDLE_EXPIRED", now: scheduledAt })).toBe(state);

  state = reduceDirector(state, { type: "RESUME", reason: "hidden", now: 500 });
  expect(reduceDirector(state, { type: "IDLE_EXPIRED", now: state.autoAdvanceAt! - 1 })).toBe(state);
  expect(reduceDirector(state, { type: "IDLE_EXPIRED", now: state.autoAdvanceAt! })).toMatchObject({
    phase: "exit",
    advanceToken: 1,
  });
});
