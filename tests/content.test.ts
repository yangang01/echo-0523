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

const expectedSceneEchoTexts = {
  wake: [
    "这片宇宙原本安静得没有方向，直到你的指尖落下来，第一束光才知道该往哪里亮。",
    "我把平时聊天时来不及认真说完的话，都藏进了这些星轨里。它们不是台词，是我一次次想起你时留下的回音。",
    "所以小宝贝，你不是来旁观一场动画的。这里的光、心跳和坐标，从一开始就只认得你。",
  ],
  jealousy: [
    "别人夸你漂亮时，我明明知道这再正常不过，心里还是会轻轻酸一下。谁让我的小宝贝本来就那么容易被人看见。",
    "看到你对别人笑，我也会偷偷不开心，甚至幼稚地想：这个笑如果只朝着我就好了。",
    "我不是想责怪你。那阵乱掉的心跳，只是在笨拙地承认：我太在意你，也太喜欢你看向我时的样子。",
  ],
  confession: [
    "2026 年原本只是日历上的一串数字，后来因为你，它忽然有了清晰的坐标。",
    "五月也不再只是普通月份。它装下了春天快结束时，我终于认真说出口的那份喜欢。",
    "5 月 23 日，从那天开始，05:23 不只是时间，也成了我们之间一个不会认错的暗号。",
    "表白不是故事的结尾。它只是让后来每一次聊天、电话和并肩游戏，都有了一个可以回望的起点。",
  ],
  privilege: [
    "你在日记里说，特别喜欢被我偏爱的感觉。小宝贝，这句话我真的偷偷记了很久。",
    "因为那不是一句听过就算的话。它让我知道，那些只对你多一点的耐心和在意，你都有好好收到。",
    "我喜欢你认真分享生活的样子，喜欢你开心地笑，也喜欢你气鼓鼓吐槽时依然可爱得让人没办法。",
    "我的偏爱不需要说得很大。它可以是多问一句、多听一会儿、及时回你，也可以是吐槽频道里永远站你这边。",
  ],
  game: [
    "上班间隙的时间总是很碎，可只要知道你上线了，我就会开始期待那一小段碰面的时间。",
    "有时候操作很顺，有时候一起手忙脚乱。输赢其实没那么重要，重要的是耳机里有你的声音。",
    "一局结束，我们又回到各自的忙碌里。但普通的一天已经因为这段并肩，偷偷亮了一下。",
    "陪伴不一定需要盛大的安排。有时候就是再忙，也愿意给彼此留出一局游戏的时间。",
  ],
  night: [
    "晚上躺在床上，我们会从白天发生的小事开始聊。说了什么当然重要，可听见你的声音更重要。",
    "偶尔没有新话题，就讲一点有的没的；偶尔一起安静，也不会觉得非要找句话填满。",
    "明明已经该睡了，却总还想再说一句。不是故事没有讲完，只是有点舍不得让电话结束。",
    "我喜欢的从来不是某个特别精彩的话题。我喜欢的是，电话另一端一直都是小宝贝。",
  ],
  finale: [
    "你的生活分享、午间游戏、睡前电话，还有那些突然想起就发来的小事，已经一点点组成了我们的日常。",
    "所谓无时无刻的陪伴和回应，并不是一句很远的口号。它就是这些已经发生、现在仍被记得的小片段。",
    "小宝贝，你说的有的没的，在我这里都不是小事。因为是你说的，所以我想认真听完。",
  ],
} as const;

const expectedChannelEchoTexts = {
  little: [
    "然后呢？当时还有谁在，后来又发生了什么？我不想只接住结果，也想知道小宝贝最想讲的那个细节。",
    "你认真把一件小事讲给我听的样子特别可爱。那些被你注意到的小瞬间，也会因为你的表达变得闪闪发光。",
    "小事当然也值得被听完。你慢慢说，我已经把注意力调到你的频道，不会用一句嗯嗯就匆匆带过。",
    "它够不够重要，不由事情大小决定。只要是小宝贝想分享的，我就会想知道后续。",
  ],
  rant: [
    "最离谱的是哪一段？从头讲给我听。谁说了什么、你当时怎么想，我都想站在你的角度听明白。",
    "就算被气得鼓鼓的，小宝贝也还是漂亮又可爱。不过先不急着哄，我要先陪你把这口气吐槽干净。",
    "吐槽频道已经全开。今天不用讲大道理，也不用马上释怀，我先坐到你这一边，陪你一起说它到底有多烦。",
    "你不需要把情绪整理得很漂亮才来找我。乱一点也没关系，我会听懂你真正不高兴的地方。",
  ],
  happy: [
    "快告诉我，是什么让你开心成这样？从第一个让你想笑的瞬间开始讲，我想把这份快乐完整地接过来。",
    "小宝贝一开心，整个人都会变得亮晶晶的。你笑起来那么漂亮，我隔着屏幕都很容易被感染。",
    "那必须把快乐放大十倍。今天不管是什么好消息，我都陪你多高兴一会儿，不让它轻轻过去。",
    "我喜欢你第一时间想到要告诉我的感觉。你的开心到了我这里，会马上收到另一份开心作为回音。",
  ],
  praise: [
    "今天最想被夸的是哪一件？给我一点细节，我要认真找到它最值得骄傲的地方，不敷衍地夸。",
    "漂亮、可爱、认真、闪闪发光，这些词放在你身上都不过分。而且我的夸奖会明目张胆地偏心。",
    "夸夸权限已经拉满。谁要是反驳，我就先把他移出频道；现在这里只保留小宝贝值得被喜欢的证据。",
    "想被夸的时候就来找我，不用绕弯。你愿意把这一点小期待交给我，本身就很可爱。",
  ],
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
    expect(sceneEchoes[scene].map((fragment) => fragment.text)).toEqual(expectedSceneEchoTexts[scene]);
    expect(ids.every((id) => id.trim().length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sceneEchoes[scene].every((fragment) => fragment.text.trim().length > 0)).toBe(true);
  }
});

test("every daily channel has four distinct layered replies", () => {
  expect(signalChannels).toHaveLength(4);
  const allEchoTexts: string[] = [];
  for (const channel of signalChannels) {
    expect(channel.echoes).toHaveLength(4);
    expect(channel.echoes.map((item) => item.id)).toEqual(["curious", "compliment", "ally", "close"]);
    const texts = channel.echoes.map((item) => item.text);
    expect(texts).toEqual(expectedChannelEchoTexts[channel.id]);
    expect(texts.every((text) => text.trim().length > 0)).toBe(true);
    expect(new Set(texts).size).toBe(texts.length);
    allEchoTexts.push(...texts);
  }
  expect(new Set(allEchoTexts).size).toBe(allEchoTexts.length);
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
