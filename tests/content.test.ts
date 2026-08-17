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
    "这片宇宙原本安静得没有方向，直到你的指尖落下来，第一束光才知道该往哪里亮。沉睡的粒子也像收到你的消息，一颗接一颗醒来。",
    "我把聊天时来不及认真说完的话，都藏进星轨里。它们不是漂亮台词，而是看见你消息、结束电话以后，仍留在心里的回音。",
    "所以小宝贝，你不是来旁观一场动画的。这里的光、心跳和坐标，从一开始就只认得你。你的触碰，把已经发生过的日常重新点亮。",
  ],
  jealousy: [
    "别人夸你漂亮时，我明明知道这再正常不过，心里还是会轻轻酸一下。谁让我的小宝贝本来就那么容易被人看见。",
    "看到你对别人笑，我也会偷偷不开心，甚至幼稚地想：这个笑如果只朝着我就好了。那点吃醋，把我的在意暴露得很彻底。",
    "我不是想责怪你，更不是要你收起笑容。乱掉的心跳只是在承认：我太在意你，也太喜欢你看向我时的样子，有一点酸，也有一点拿自己没办法。",
  ],
  confession: [
    "2026 年原本只是日历上的一串数字，后来因为你，它忽然有了清晰的坐标。那些普通日期从眼前掠过，只有这一天被心跳认真圈了起来。",
    "五月也不再只是普通月份。它装下了春天快结束时，我反复想过许多遍、最后终于认真说出口的那份喜欢，也装下了等待你听见时的紧张。",
    "5 月 23 日，从那天开始，05:23 不只是时间，也成了我们之间一个不会认错的暗号。再看到这四个数字，我想到的不是钟表，而是喜欢终于有了名字。",
    "表白不是故事的结尾。它只是让后来每一次聊天、每一通电话和每一局并肩游戏，都有了一个可以回望的起点。原来那些看似随意的日常，也在悄悄回应那天说出口的话。",
  ],
  privilege: [
    "你在日记里说，特别喜欢被我偏爱的感觉。小宝贝，这句话我真的偷偷记了很久。后来再想到偏爱，我脑海里先出现的就是你写下这句话时的认真。",
    "因为那不是一句听过就算的话。它让我知道，那些只对你多一点的耐心和在意，你都有好好收到。原来被你感受到，本身就是一件很让人心软的事。",
    "我喜欢你认真分享生活的样子，喜欢你开心地笑，也喜欢你气鼓鼓吐槽时依然可爱得让人没办法。连你说今天好累时的语气，我也想多听一会儿。",
    "我的偏爱不需要说得很大。它就在你分享一件小事时多问一句，在你情绪乱的时候多听一会儿，在看见消息后认真回你，也在吐槽时先陪你把委屈说清楚。",
  ],
  game: [
    "上班间隙的时间总是很碎，可只要知道你上线了，我就开始期待那一小段碰面的时间。午休本来只是普通的暂停键，因为你在，忽然像藏了一份小小奖励。",
    "有时候操作很顺，有时候一起手忙脚乱，还会为一个失误笑半天。输赢其实没那么重要，重要的是耳机里有你的声音，忙碌中间也有一段只属于我们的同频。",
    "一局结束，我们又回到各自的忙碌里，聊天框暂时安静，手边的工作还在继续。但普通的一天已经因为这段并肩偷偷亮了一下，连下午都变得没那么漫长。",
    "陪伴不一定需要盛大的安排。它也可以是午间刚好留出来的一局游戏，是上线后听见彼此声音的那几分钟。时间不长，却真实地落在今天，成为可以记住的小片段。",
  ],
  night: [
    "晚上躺在床上，我们会从白天发生的小事开始聊。谁说了什么、遇见什么、哪一刻突然想笑，都能慢慢讲出来。说了什么当然重要，可听见你的声音更重要。",
    "偶尔没有新话题，就讲一点有的没的，从一件小事绕到另一件小事；偶尔一起安静，也不会觉得非要找句话填满。那种松弛的空白，也是我们聊天的一部分。",
    "明明已经该睡了，却总还想再说一句。可能是补充一个刚想起来的细节，也可能只是再听听你的声音。不是故事没有讲完，只是那一刻有点舍不得让电话结束。",
    "我喜欢的从来不是某个特别精彩的话题。我喜欢的是，电话另一端就是小宝贝。你随口讲的日常、突然冒出的想法，甚至困得含糊的语气，都让普通夜晚有了自己的频率。",
  ],
  finale: [
    "你的生活分享、午间游戏、睡前电话，还有那些突然想起就发来的小事，已经一点点组成了我们的日常。没有排练，却很像我们。",
    "所谓无时无刻的陪伴和回应，并不是一句很远的口号。它就是这些已经发生、现在仍被记得的小片段：问清你话里的细节，夸你可爱漂亮，也陪你把不开心吐槽干净。",
    "小宝贝，你说的有的没的，在我这里都不是小事。因为是你说的，所以我想认真听完。此刻这颗星核收拢的，也正是我们一次次聊天、一次次回应留下来的光。",
  ],
} as const;

const expectedChannelEchoTexts = {
  little: [
    "然后呢？当时还有谁在，后来又发生了什么？我不想只接住结果，也想知道小宝贝最想讲的那个细节。哪怕只是路上遇见的小插曲，你注意到的地方也值得慢慢说。",
    "你认真把一件小事讲给我听的样子特别可爱。那些被你注意到的小瞬间，也会因为你的表达变得闪闪发光。我喜欢看你把普通一天讲出只属于你的语气。",
    "小事当然也值得被听完。你慢慢说，我已经把注意力调到你的频道，不会用一句嗯嗯就匆匆带过。你在意的转折和情绪，我都想跟上。",
    "它够不够重要，不由事情大小决定。只要是小宝贝想分享的，我就想知道后续，也想听你说完以后那一点被接住的轻松。",
  ],
  rant: [
    "最离谱的是哪一段？从头讲给我听。谁说了什么、你当时怎么想，我都想站在你的角度听明白。先把事情还原清楚，再一起找到最让人生气的那一点。",
    "就算被气得鼓鼓的，小宝贝也还是漂亮又可爱。不过先不急着哄，我要先陪你把这口气吐槽干净。可爱不等于不能生气，你的不高兴也值得认真对待。",
    "吐槽频道已经全开。今天不用讲大道理，也不用马上释怀，我先坐到你这一边，陪你一起说它到底有多烦。那些忍住没说的话，在这里可以一股脑倒出来。",
    "你不需要把情绪整理得很漂亮才来找我。乱一点也没关系，我就顺着你说的细节，认真听懂真正让你不高兴的地方。",
  ],
  happy: [
    "快告诉我，是什么让你开心成这样？从第一个让你想笑的瞬间开始讲，我想把这份快乐完整地接过来，连当时的小表情也想在脑海里拼出来。",
    "小宝贝一开心，整个人都会变得亮晶晶的。你笑起来那么漂亮，我隔着屏幕都很容易被感染，看到你的消息也会跟着弯起嘴角。",
    "那必须把快乐放大十倍。今天不管是什么好消息，我都陪你多高兴一会儿。再讲一遍最开心的部分，让这份好心情多停留几分钟。",
    "我喜欢你第一时间想到要告诉我的感觉。你的开心到了我这里，马上收到另一份开心作为回音。屏幕两边一起笑，就是这条消息最好看的后续。",
  ],
  praise: [
    "今天最想被夸的是哪一件？给我一点细节，我要认真找到它最值得骄傲的地方，不敷衍地夸。是完成了一件难事，还是今天的你格外漂亮？",
    "漂亮、可爱、认真、闪闪发光，这些词放在你身上都不过分。而且我的夸奖明目张胆地偏心，因为我看到的不只结果，还有你认真投入时的样子。",
    "夸夸权限已经拉满。谁要是反驳，我就先把他移出频道；现在这里只保留小宝贝值得被喜欢的证据，每一条都写着具体理由。",
    "想被夸的时候不用绕弯。你愿意把这一点小期待告诉我，本身就很可爱。此刻想听哪一种夸奖，也可以直接点名。",
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

test("each possible reading path contains 1400 to 1700 Chinese characters", () => {
  const fixed = sceneOrder
    .filter((scene) => scene !== "signal")
    .flatMap((scene) => sceneEchoes[scene])
    .map((fragment) => fragment.text)
    .join("");
  for (const channel of signalChannels) {
    const total = hanCount(fixed + channel.echoes.map((fragment) => fragment.text).join(""));
    expect(total).toBeGreaterThanOrEqual(1400);
    expect(total).toBeLessThanOrEqual(1700);
  }
  expect(
    Object.fromEntries(
      signalChannels.map((channel) => [channel.id, hanCount(fixed + channel.echoes.map((fragment) => fragment.text).join(""))]),
    ),
  ).toEqual({ little: 1692, rant: 1690, happy: 1681, praise: 1669 });
});

test("expanded copy stays grounded in confirmed details and avoids promises", () => {
  const copy = JSON.stringify({ sceneEchoes, signalChannels });
  const compactCopy = copy.replace(/\s/g, "");
  for (const detail of ["小宝贝", "2026", "5月23日", "日记", "上班间隙", "床上", "吐槽"]) {
    expect(compactCopy).toContain(detail);
  }
  expect(copy).toMatch(/并肩游戏|一局游戏/);
  for (const forbidden of ["学会信任", "保证永远", "一辈子不会", "未来一定", "永远站你这边", "永远会", "一直都会"]) {
    expect(copy).not.toContain(forbidden);
  }
});
