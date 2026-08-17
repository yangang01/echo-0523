import { createExperience, reduceExperience } from "../lib/experience";

test("advances only when the current scene completes", () => {
  const initial = createExperience();
  expect(reduceExperience(initial, { type: "NEXT" }).scene).toBe("wake");
  const ready = reduceExperience(initial, { type: "SCENE_COMPLETE", scene: "wake" });
  expect(reduceExperience(ready, { type: "NEXT" }).scene).toBe("jealousy");
});

test("maps response types to independent echo-core growth channels", () => {
  let state = createExperience("signal");
  state = reduceExperience(state, { type: "RESPONSE_SELECTED", response: "curious" });
  state = reduceExperience(state, { type: "RESPONSE_SELECTED", response: "compliment" });
  state = reduceExperience(state, { type: "RESPONSE_SELECTED", response: "ally" });
  expect(state.growth).toEqual({ filaments: 1, petals: 1, currents: 1 });
});

test("ignores completion events from a stale scene", () => {
  const state = createExperience("confession");
  expect(reduceExperience(state, { type: "SCENE_COMPLETE", scene: "wake" })).toEqual(state);
});

test("reveals each echo once and selects an unlocked echo for review", () => {
  let state = createExperience("jealousy");
  state = reduceExperience(state, { type: "ECHO_REVEAL", scene: "jealousy", fragmentId: "praise" });
  state = reduceExperience(state, { type: "ECHO_REVEAL", scene: "jealousy", fragmentId: "praise" });
  state = reduceExperience(state, { type: "ECHO_REVEAL", scene: "jealousy", fragmentId: "smile" });
  expect(state.transcript.jealousy).toEqual({ unlocked: ["praise", "smile"], activeId: "smile" });
  state = reduceExperience(state, { type: "ECHO_SELECT", scene: "jealousy", fragmentId: "praise" });
  expect(state.transcript.jealousy.activeId).toBe("praise");
  state = reduceExperience(state, { type: "ECHO_SELECT", scene: "jealousy", fragmentId: "meaning" });
  expect(state.transcript.jealousy.activeId).toBe("praise");
});

test("stores the active daily channel and restart clears all echo state", () => {
  let state = createExperience("signal");
  state = reduceExperience(state, { type: "SIGNAL_CHANNEL_SET", channelId: "rant" });
  state = reduceExperience(state, { type: "ECHO_REVEAL", scene: "signal", fragmentId: "curious" });
  expect(state.signalChannelId).toBe("rant");
  expect(reduceExperience(state, { type: "RESTART" })).toEqual(createExperience());
});
