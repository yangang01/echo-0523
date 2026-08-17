import type { ResponseType, SceneId } from "./experience";

export type SignalChannel = {
  id: string;
  label: string;
  icon: string;
  responses: { type: ResponseType; label: string; text: string }[];
};

const response = (curious: string, compliment: string, ally: string): SignalChannel["responses"] => [
  { type: "curious", label: "认真追问", text: curious },
  { type: "compliment", label: "偏爱夸奖", text: compliment },
  { type: "ally", label: "站你这边", text: ally },
];

export const signalChannels: SignalChannel[] = [
  { id: "little", label: "发生了小事", icon: "✦", responses: response("然后呢？哪一个瞬间最想讲给我听？", "小宝贝认真分享生活的样子，真的特别可爱。", "小事也值得被听完，我已经坐好啦。") },
  { id: "rant", label: "想吐槽一下", icon: "⌁", responses: response("最离谱的是哪一段？从头说，我认真听。", "就算气鼓鼓的，小宝贝也还是漂亮得过分。", "吐槽频道全开。今天我无条件加入你这队。") },
  { id: "happy", label: "今天超开心", icon: "↑", responses: response("快告诉我，是什么让你开心成这样？", "你一开心，整片宇宙都跟着变亮了。", "那必须把快乐放大十倍，我陪你一起高兴。") },
  { id: "praise", label: "想被夸夸", icon: "♡", responses: response("今天最值得被夸的是哪一件？我想知道细节。", "漂亮、可爱、闪闪发光——而且只对你偏心。", "夸夸权限已拉满，谁都不许反驳。") },
];

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
