import { audioRecipe } from "../lib/audio";

test("all sound recipes keep safe gain and positive duration", () => {
  for (const name of ["heartbeat", "lock", "reply", "bloom"] as const) {
    const recipe = audioRecipe(name);
    expect(recipe.gain).toBeGreaterThan(0);
    expect(recipe.gain).toBeLessThanOrEqual(0.24);
    expect(recipe.duration).toBeGreaterThan(0);
    expect(recipe.frequency).toBeGreaterThan(0);
  }
});
