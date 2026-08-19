import { sceneTimelines } from "../lib/scene-timelines";
import { sceneEchoes, signalChannels } from "../lib/content";
import { sceneOrder } from "../lib/experience";

const expected = {
  wake: { enterMs: 700, presentMs: 31_200, exitMs: 1800, motion: "attract", transition: "gravity-wave", reveals: [{ at: 1200, id: "spark" }, { at: 11_200, id: "archive" }, { at: 21_200, id: "receiver" }] },
  jealousy: { enterMs: 650, presentMs: 31_200, exitMs: 1750, motion: "disrupt", transition: "orbit-repair", reveals: [{ at: 1200, id: "praise" }, { at: 11_200, id: "smile" }, { at: 21_200, id: "meaning" }] },
  confession: { enterMs: 800, presentMs: 41_200, exitMs: 2100, motion: "lock", transition: "coordinate-beam", reveals: [{ at: 1200, id: "year" }, { at: 11_200, id: "month" }, { at: 21_200, id: "day" }, { at: 31_200, id: "locked" }] },
  privilege: { enterMs: 720, presentMs: 41_200, exitMs: 1900, motion: "orbit", transition: "petal-bloom", reveals: [{ at: 1200, id: "diary" }, { at: 11_200, id: "remembered" }, { at: 21_200, id: "seen" }, { at: 31_200, id: "action" }] },
  signal: { enterMs: 680, presentMs: 41_200, exitMs: 1850, motion: "reply", transition: "echo-return", reveals: [{ at: 1200, id: "$response:0" }, { at: 11_200, id: "$response:1" }, { at: 21_200, id: "$response:2" }, { at: 31_200, id: "close" }] },
  game: { enterMs: 760, presentMs: 41_200, exitMs: 1700, motion: "tunnel", transition: "dual-stream", reveals: [{ at: 1200, id: "near" }, { at: 11_200, id: "sync" }, { at: 21_200, id: "through" }, { at: 31_200, id: "complete" }] },
  night: { enterMs: 820, presentMs: 41_200, exitMs: 2000, motion: "sync", transition: "wave-merge", reveals: [{ at: 1200, id: "third" }, { at: 11_200, id: "two-thirds" }, { at: 21_200, id: "connected" }, { at: 31_200, id: "frequency" }] },
  finale: { enterMs: 900, presentMs: 31_200, exitMs: 1800, motion: "infinity", transition: "yu-seal", reveals: [{ at: 1200, id: "recap" }, { at: 11_200, id: "present" }, { at: 21_200, id: "echo" }] },
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

test("gives every fragment a ten-second reading window", () => {
  for (const timeline of Object.values(sceneTimelines)) {
    expect(timeline.reveals[0]?.at).toBe(1_200);
    const boundaries = [
      ...timeline.reveals.map((cue) => cue.at),
      timeline.presentMs,
    ];
    for (let index = 1; index < boundaries.length; index += 1) {
      expect(boundaries[index] - boundaries[index - 1]).toBe(10_000);
    }
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
