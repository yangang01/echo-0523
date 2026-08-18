import { sceneTimelines } from "../lib/scene-timelines";
import { sceneOrder } from "../lib/experience";

const expected = {
  wake: { enterMs: 700, presentMs: 5400, exitMs: 1800, motion: "attract", transition: "gravity-wave", reveals: [{ at: 900, id: "spark" }, { at: 2500, id: "archive" }, { at: 4100, id: "receiver" }] },
  jealousy: { enterMs: 650, presentMs: 5600, exitMs: 1750, motion: "disrupt", transition: "orbit-repair", reveals: [{ at: 1000, id: "praise" }, { at: 2700, id: "smile" }, { at: 4300, id: "meaning" }] },
  confession: { enterMs: 800, presentMs: 6200, exitMs: 2100, motion: "lock", transition: "coordinate-beam", reveals: [{ at: 900, id: "year" }, { at: 2400, id: "month" }, { at: 3600, id: "day" }, { at: 4900, id: "locked" }] },
  privilege: { enterMs: 720, presentMs: 6400, exitMs: 1900, motion: "orbit", transition: "petal-bloom", reveals: [{ at: 1000, id: "diary" }, { at: 2700, id: "remembered" }, { at: 4300, id: "seen" }, { at: 5400, id: "action" }] },
  signal: { enterMs: 680, presentMs: 7200, exitMs: 1850, motion: "reply", transition: "echo-return", reveals: [{ at: 1200, id: "$response:0" }, { at: 3100, id: "$response:1" }, { at: 5000, id: "$response:2" }, { at: 6300, id: "close" }] },
  game: { enterMs: 760, presentMs: 6500, exitMs: 1700, motion: "tunnel", transition: "dual-stream", reveals: [{ at: 900, id: "near" }, { at: 2700, id: "sync" }, { at: 4600, id: "through" }, { at: 5600, id: "complete" }] },
  night: { enterMs: 820, presentMs: 7600, exitMs: 2000, motion: "sync", transition: "wave-merge", reveals: [{ at: 1700, id: "third" }, { at: 4100, id: "two-thirds" }, { at: 6200, id: "connected" }, { at: 7000, id: "frequency" }] },
  finale: { enterMs: 900, presentMs: 7600, exitMs: 1800, motion: "infinity", transition: "yu-seal", reveals: [{ at: 1200, id: "recap" }, { at: 3700, id: "present" }, { at: 6100, id: "echo" }] },
} as const;

test("defines the complete deterministic timeline for every ordered scene", () => {
  expect(Object.keys(sceneTimelines)).toEqual(sceneOrder);
  for (const scene of sceneOrder) {
    const timeline = sceneTimelines[scene];
    expect(timeline).toEqual(expected[scene]);
    expect(timeline.enterMs).toBeGreaterThanOrEqual(500);
    expect(timeline.enterMs).toBeLessThanOrEqual(1000);
    expect(timeline.exitMs).toBeGreaterThanOrEqual(1600);
    expect(timeline.exitMs).toBeLessThanOrEqual(2200);
    expect(timeline.reveals.map((reveal) => reveal.at)).toEqual([...timeline.reveals.map((reveal) => reveal.at)].sort((a, b) => a - b));
    expect(timeline.presentMs).toBeGreaterThan(timeline.reveals.at(-1)!.at);
  }
});

test("gives every scene a unique motion and transition signature", () => {
  const signatures = sceneOrder.map((scene) => `${sceneTimelines[scene].motion}/${sceneTimelines[scene].transition}`);
  expect(new Set(signatures).size).toBe(sceneOrder.length);
});
