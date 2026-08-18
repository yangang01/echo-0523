import { sceneTimelines } from "../lib/scene-timelines";
import { sceneEchoes, signalChannels } from "../lib/content";
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

test("binds non-signal timeline reveals to their content fragments", () => {
  for (const scene of sceneOrder.filter((scene) => scene !== "signal")) {
    const echoIds = new Set(sceneEchoes[scene].map((echo) => echo.id));
    for (const reveal of sceneTimelines[scene].reveals) {
      expect(echoIds.has(reveal.id)).toBe(true);
    }
  }
});

test("resolves signal semantic slots through every active channel", () => {
  const slots = sceneTimelines.signal.reveals;
  for (const channel of signalChannels) {
    const resolvedIds = slots.slice(0, 3).map((slot) => {
      const match = /^\$response:(\d+)$/.exec(slot.id);
      expect(match).not.toBeNull();
      return channel.echoes[Number(match![1])]?.id;
    });
    expect(resolvedIds).toEqual(["curious", "compliment", "ally"]);
    expect(slots[3].id).toBe("close");
    expect(channel.echoes.some((echo) => echo.id === slots[3].id)).toBe(true);
  }
});

test("prevents runtime mutation of timeline records and nested reveal cues", () => {
  const registry = sceneTimelines as unknown as { wake: { reveals: { id: string }[] } };
  const originalId = sceneTimelines.wake.reveals[0].id;
  try {
    registry.wake.reveals[0].id = "mutated";
  } catch {
    // A frozen object may reject assignment in strict mode.
  }
  expect(sceneTimelines.wake.reveals[0].id).toBe(originalId);
});
