import { finalCopy, signalChannels } from "../lib/content";

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
