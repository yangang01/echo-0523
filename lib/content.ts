import type { ResponseType, SceneId } from "./experience";

export type EchoFragment = { id: string; text: string };
export type SignalChannelId = "little" | "rant" | "happy" | "praise";

export const sceneEchoes: Record<Exclude<SceneId, "signal">, EchoFragment[]> = {
  wake: [
    { id: "spark", text: "这片宇宙原本安静得没有方向，直到你的指尖落下来，第一束光才知道该往哪里亮。" },
    { id: "archive", text: "我把平时聊天时来不及认真说完的话，都藏进了这些星轨里。它们不是台词，是我一次次想起你时留下的回音。" },
    { id: "receiver", text: "所以小宝贝，你不是来旁观一场动画的。这里的光、心跳和坐标，从一开始就只认得你。" },
  ],
  jealousy: [
    { id: "praise", text: "别人夸你漂亮时，我明明知道这再正常不过，心里还是会轻轻酸一下。谁让我的小宝贝本来就那么容易被人看见。" },
    { id: "smile", text: "看到你对别人笑，我也会偷偷不开心，甚至幼稚地想：这个笑如果只朝着我就好了。" },
    { id: "meaning", text: "我不是想责怪你。那阵乱掉的心跳，只是在笨拙地承认：我太在意你，也太喜欢你看向我时的样子。" },
  ],
  confession: [
    { id: "year", text: "2026 年原本只是日历上的一串数字，后来因为你，它忽然有了清晰的坐标。" },
    { id: "month", text: "五月也不再只是普通月份。它装下了春天快结束时，我终于认真说出口的那份喜欢。" },
    { id: "day", text: "5 月 23 日，从那天开始，05:23 不只是时间，也成了我们之间一个不会认错的暗号。" },
    { id: "locked", text: "表白不是故事的结尾。它只是让后来每一次聊天、电话和并肩游戏，都有了一个可以回望的起点。" },
  ],
  privilege: [
    { id: "diary", text: "你在日记里说，特别喜欢被我偏爱的感觉。小宝贝，这句话我真的偷偷记了很久。" },
    { id: "remembered", text: "因为那不是一句听过就算的话。它让我知道，那些只对你多一点的耐心和在意，你都有好好收到。" },
    { id: "seen", text: "我喜欢你认真分享生活的样子，喜欢你开心地笑，也喜欢你气鼓鼓吐槽时依然可爱得让人没办法。" },
    { id: "action", text: "我的偏爱不需要说得很大。它可以是多问一句、多听一会儿、及时回你，也可以是吐槽频道里永远站你这边。" },
  ],
  game: [
    { id: "near", text: "上班间隙的时间总是很碎，可只要知道你上线了，我就会开始期待那一小段碰面的时间。" },
    { id: "sync", text: "有时候操作很顺，有时候一起手忙脚乱。输赢其实没那么重要，重要的是耳机里有你的声音。" },
    { id: "through", text: "一局结束，我们又回到各自的忙碌里。但普通的一天已经因为这段并肩，偷偷亮了一下。" },
    { id: "complete", text: "陪伴不一定需要盛大的安排。有时候就是再忙，也愿意给彼此留出一局游戏的时间。" },
  ],
  night: [
    { id: "third", text: "晚上躺在床上，我们会从白天发生的小事开始聊。说了什么当然重要，可听见你的声音更重要。" },
    { id: "two-thirds", text: "偶尔没有新话题，就讲一点有的没的；偶尔一起安静，也不会觉得非要找句话填满。" },
    { id: "connected", text: "明明已经该睡了，却总还想再说一句。不是故事没有讲完，只是有点舍不得让电话结束。" },
    { id: "frequency", text: "我喜欢的从来不是某个特别精彩的话题。我喜欢的是，电话另一端一直都是小宝贝。" },
  ],
  finale: [
    { id: "recap", text: "你的生活分享、午间游戏、睡前电话，还有那些突然想起就发来的小事，已经一点点组成了我们的日常。" },
    { id: "present", text: "所谓无时无刻的陪伴和回应，并不是一句很远的口号。它就是这些已经发生、现在仍被记得的小片段。" },
    { id: "echo", text: "小宝贝，你说的有的没的，在我这里都不是小事。因为是你说的，所以我想认真听完。" },
  ],
};

export type SignalChannel = {
  id: SignalChannelId;
  label: string;
  icon: string;
  responses: { type: ResponseType; label: string; text: string }[];
  echoes: EchoFragment[];
};

const response = (curious: string, compliment: string, ally: string): SignalChannel["responses"] => [
  { type: "curious", label: "认真追问", text: curious },
  { type: "compliment", label: "偏爱夸奖", text: compliment },
  { type: "ally", label: "站你这边", text: ally },
];

const channelEchoes: Record<SignalChannelId, EchoFragment[]> = {
  little: [
    { id: "curious", text: "然后呢？当时还有谁在，后来又发生了什么？我不想只接住结果，也想知道小宝贝最想讲的那个细节。" },
    { id: "compliment", text: "你认真把一件小事讲给我听的样子特别可爱。那些被你注意到的小瞬间，也会因为你的表达变得闪闪发光。" },
    { id: "ally", text: "小事当然也值得被听完。你慢慢说，我已经把注意力调到你的频道，不会用一句嗯嗯就匆匆带过。" },
    { id: "close", text: "它够不够重要，不由事情大小决定。只要是小宝贝想分享的，我就会想知道后续。" },
  ],
  rant: [
    { id: "curious", text: "最离谱的是哪一段？从头讲给我听。谁说了什么、你当时怎么想，我都想站在你的角度听明白。" },
    { id: "compliment", text: "就算被气得鼓鼓的，小宝贝也还是漂亮又可爱。不过先不急着哄，我要先陪你把这口气吐槽干净。" },
    { id: "ally", text: "吐槽频道已经全开。今天不用讲大道理，也不用马上释怀，我先坐到你这一边，陪你一起说它到底有多烦。" },
    { id: "close", text: "你不需要把情绪整理得很漂亮才来找我。乱一点也没关系，我会听懂你真正不高兴的地方。" },
  ],
  happy: [
    { id: "curious", text: "快告诉我，是什么让你开心成这样？从第一个让你想笑的瞬间开始讲，我想把这份快乐完整地接过来。" },
    { id: "compliment", text: "小宝贝一开心，整个人都会变得亮晶晶的。你笑起来那么漂亮，我隔着屏幕都很容易被感染。" },
    { id: "ally", text: "那必须把快乐放大十倍。今天不管是什么好消息，我都陪你多高兴一会儿，不让它轻轻过去。" },
    { id: "close", text: "我喜欢你第一时间想到要告诉我的感觉。你的开心到了我这里，会马上收到另一份开心作为回音。" },
  ],
  praise: [
    { id: "curious", text: "今天最想被夸的是哪一件？给我一点细节，我要认真找到它最值得骄傲的地方，不敷衍地夸。" },
    { id: "compliment", text: "漂亮、可爱、认真、闪闪发光，这些词放在你身上都不过分。而且我的夸奖会明目张胆地偏心。" },
    { id: "ally", text: "夸夸权限已经拉满。谁要是反驳，我就先把他移出频道；现在这里只保留小宝贝值得被喜欢的证据。" },
    { id: "close", text: "想被夸的时候就来找我，不用绕弯。你愿意把这一点小期待交给我，本身就很可爱。" },
  ],
};

export const signalChannels = [
  { id: "little", label: "发生了小事", icon: "✦", responses: response("然后呢？哪一个瞬间最想讲给我听？", "小宝贝认真分享生活的样子，真的特别可爱。", "小事也值得被听完，我已经坐好啦。"), echoes: channelEchoes.little },
  { id: "rant", label: "想吐槽一下", icon: "⌁", responses: response("最离谱的是哪一段？从头说，我认真听。", "就算气鼓鼓的，小宝贝也还是漂亮得过分。", "吐槽频道全开。今天我无条件加入你这队。"), echoes: channelEchoes.rant },
  { id: "happy", label: "今天超开心", icon: "↑", responses: response("快告诉我，是什么让你开心成这样？", "你一开心，整片宇宙都跟着变亮了。", "那必须把快乐放大十倍，我陪你一起高兴。"), echoes: channelEchoes.happy },
  { id: "praise", label: "想被夸夸", icon: "♡", responses: response("今天最值得被夸的是哪一件？我想知道细节。", "漂亮、可爱、闪闪发光——而且只对你偏心。", "夸夸权限已拉满，谁都不许反驳。"), echoes: channelEchoes.praise },
] satisfies SignalChannel[];

export const sceneCopy: Record<SceneId, { kicker: string; title: string; body: string }> = {
  wake: { kicker: "ACCESS 01", title: "只有小宝贝能进入", body: "有一个宇宙，沉睡到你触碰它的这一刻。" },
  jealousy: { kicker: "SIGNAL 02", title: "检测到一次心跳异常", body: "别人夸你漂亮，你对别人笑——我的心跳会偷偷乱掉。" },
  confession: { kicker: "COORDINATE 03", title: "把喜欢说出口的坐标", body: "转动星轨，让我们的宇宙回到正式启动的那一刻。" },
  privilege: { kicker: "PRIVILEGE 04", title: "最高偏爱权限", body: "你说，特别喜欢被我偏爱的感觉。那就把整片宇宙的例外都给你。" },
  signal: { kicker: "ECHO 05", title: "小宝贝，今天想说什么？", body: "你分享的有的没的，在这里都会立刻收到回音。" },
  game: { kicker: "CO-OP 06", title: "午间双人副本", body: "上班间隙的一局游戏不长，却足够让普通的一天突然发亮。" },
  night: { kicker: "FREQUENCY 07", title: "深夜同频", body: "电话里、枕头边，没有主题也没关系。因为是你说的，所以我想听完。" },
  finale: { kicker: "FOREVER ONLINE", title: "0523 回音星核", body: "每一次分享、每一句回应，都已经成为这颗星核的一部分。" },
};

export const finalCopy = {
  to: "小宝贝",
  from: "永远爱你的人",
  since: "2026.05.23",
  lines: ["你说的有的没的，在我这里都不是小事。", "因为是你说的，所以我想听完。"],
} as const;
