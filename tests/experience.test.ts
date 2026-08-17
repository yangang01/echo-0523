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
