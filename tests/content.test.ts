import { finalCopy, sceneEchoes, signalChannels } from "../lib/content";
import { sceneOrder } from "../lib/experience";

const hanCount = (text: string) => (text.match(/[\u3400-\u9fff]/g) ?? []).length;

const expectedSceneEchoIds = {
  wake: ["spark", "archive", "receiver"],
  jealousy: ["praise", "smile", "meaning"],
  confession: ["year", "month", "day", "locked"],
  privilege: ["diary", "remembered", "seen", "action"],
  game: ["near", "sync", "through", "complete"],
  night: ["third", "two-thirds", "connected", "frequency"],
  finale: ["recap", "present", "echo"],
} as const;

test("every signal channel contains all three forms of being heard", () => {
  for (const channel of signalChannels) {
    expect(channel.responses.map((item) => item.type).sort()).toEqual(["ally", "compliment", "curious"]);
  }
});

test("final copy uses confirmed names and avoids promises", () => {
  expect(finalCopy.to).toBe("小宝贝");
  expect(finalCopy.from).toBe("永远爱你的人");
  expect(finalCopy.lines.join("")).not.toMatch(/永远保证|以后一定|承诺/);
});

test("every scene provides three or four stable echo fragments", () => {
  for (const scene of sceneOrder.filter((id) => id !== "signal")) {
    const ids = sceneEchoes[scene].map((fragment) => fragment.id);
    expect(ids).toEqual(expectedSceneEchoIds[scene]);
    expect(ids.every((id) => id.trim().length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sceneEchoes[scene].every((fragment) => fragment.text.trim().length > 0)).toBe(true);
  }
});

test("every daily channel has four distinct layered replies", () => {
  expect(signalChannels).toHaveLength(4);
  for (const channel of signalChannels) {
    expect(channel.echoes).toHaveLength(4);
    expect(channel.echoes.map((item) => item.id)).toEqual(["curious", "compliment", "ally", "close"]);
  }
});

test("each possible reading path contains 900 to 1200 Chinese characters", () => {
  const fixed = sceneOrder
    .filter((scene) => scene !== "signal")
    .flatMap((scene) => sceneEchoes[scene])
    .map((fragment) => fragment.text)
    .join("");
  for (const channel of signalChannels) {
    const total = hanCount(fixed + channel.echoes.map((fragment) => fragment.text).join(""));
    expect(total).toBeGreaterThanOrEqual(900);
    expect(total).toBeLessThanOrEqual(1200);
  }
});

test("expanded copy stays grounded in confirmed details and avoids promises", () => {
  const copy = JSON.stringify({ sceneEchoes, signalChannels });
  const compactCopy = copy.replace(/\s/g, "");
  for (const detail of ["小宝贝", "2026", "5月23日", "日记", "上班间隙", "床上", "吐槽"]) {
    expect(compactCopy).toContain(detail);
  }
  expect(copy).toMatch(/并肩游戏|一局游戏/);
  for (const forbidden of ["学会信任", "保证永远", "一辈子不会", "未来一定"]) {
    expect(copy).not.toContain(forbidden);
  }
});
