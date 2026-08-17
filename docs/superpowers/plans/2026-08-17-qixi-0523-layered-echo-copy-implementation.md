# 0523 Layered Echo Storytelling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the eight-scene Qixi H5 into a user-paced 7–9 minute experience with 3–4 progressively unlocked story fragments per scene.

**Architecture:** Keep long-form copy in `lib/content.ts`, interaction/review state in the existing experience reducer, and presentation in a focused `EchoTranscript` component. Existing scene interactions emit stable fragment IDs at their natural progress thresholds; `EchoExperience` resolves the active fragment set, and `ScenePanel` renders one readable fragment plus review markers without obscuring WebGL.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Vitest, Testing Library, CSS, existing Three.js scene system.

---

## File map

- Modify `lib/content.ts`: typed scene and channel fragment library.
- Modify `lib/experience.ts`: reveal/select/channel events and immutable transcript state.
- Create `components/experience/EchoTranscript.tsx`: one-fragment display and review controls.
- Modify `components/experience/ScenePanel.tsx`: place the transcript between lead copy and interaction.
- Modify `components/experience/EchoExperience.tsx`: resolve fragments and connect reducer state.
- Modify `components/experience/scenes.tsx`: emit reveal events from existing thresholds and gate the finale.
- Modify `components/experience/EchoCoreCanvas.tsx`: keep the finale core compact until the last echo opens the infinity sculpture.
- Modify `app/globals.css`: glass transcript layout, transitions, small-height and reduced-motion behavior.
- Modify `tests/content.test.ts`, `tests/experience.test.ts`, `tests/scenes.test.tsx`, `tests/experience-ui.test.tsx`: content, state, interaction, accessibility, and layout contract coverage.

### Task 1: Build the structured story library

**Files:**
- Modify: `lib/content.ts`
- Modify: `tests/content.test.ts`

- [ ] **Step 1: Write failing content coverage tests**

Add these imports and tests to `tests/content.test.ts`:

```ts
import { sceneEchoes, signalChannels } from "../lib/content";
import { sceneOrder } from "../lib/experience";

const hanCount = (text: string) => (text.match(/[\u3400-\u9fff]/g) ?? []).length;

test("every scene provides three or four stable echo fragments", () => {
  for (const scene of sceneOrder.filter((id) => id !== "signal")) {
    expect(sceneEchoes[scene]).toHaveLength(scene === "wake" || scene === "jealousy" || scene === "finale" ? 3 : 4);
    expect(new Set(sceneEchoes[scene].map((fragment) => fragment.id)).size).toBe(sceneEchoes[scene].length);
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
  for (const detail of ["小宝贝", "2026", "5月23日", "日记", "上班间隙", "打游戏", "床上", "吐槽"]) {
    expect(copy).toContain(detail);
  }
  for (const forbidden of ["学会信任", "保证永远", "一辈子不会", "未来一定"]) {
    expect(copy).not.toContain(forbidden);
  }
});
```

- [ ] **Step 2: Run the content tests and verify RED**

Run:

```bash
/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/content.test.ts
```

Expected: FAIL because `sceneEchoes` and `SignalChannel.echoes` do not exist.

- [ ] **Step 3: Add the exact story data model and copy**

In `lib/content.ts`, add:

```ts
export type EchoFragment = { id: string; text: string };

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
```

Extend `SignalChannel` with `echoes: EchoFragment[]`. Define `channelEchoes` immediately before `signalChannels`, then add these exact arrays to the four existing channel objects:

```ts
const channelEchoes: Record<string, EchoFragment[]> = {
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
```

Assign `echoes: channelEchoes.<id>` in every `signalChannels` entry.

- [ ] **Step 4: Run the content tests and adjust only copy length if required**

Run the Task 1 command. Expected: PASS. If a path is outside 900–1200 Han characters, expand or tighten that channel's four fragment texts without changing facts or adding promises.

- [ ] **Step 5: Commit the story library**

```bash
git add lib/content.ts tests/content.test.ts
git commit -m "feat: add layered echo story library"
```

### Task 2: Add immutable transcript state

**Files:**
- Modify: `lib/experience.ts`
- Modify: `tests/experience.test.ts`

- [ ] **Step 1: Write failing reducer tests**

```ts
test("reveals each echo once and selects an unlocked echo for review", () => {
  let state = createExperience("jealousy");
  state = reduceExperience(state, { type: "ECHO_REVEAL", scene: "jealousy", fragmentId: "praise" });
  state = reduceExperience(state, { type: "ECHO_REVEAL", scene: "jealousy", fragmentId: "praise" });
  state = reduceExperience(state, { type: "ECHO_REVEAL", scene: "jealousy", fragmentId: "smile" });
  expect(state.transcript.jealousy).toEqual({ unlocked: ["praise", "smile"], activeId: "smile" });

  state = reduceExperience(state, { type: "ECHO_SELECT", scene: "jealousy", fragmentId: "praise" });
  expect(state.transcript.jealousy.activeId).toBe("praise");
  state = reduceExperience(state, { type: "ECHO_SELECT", scene: "jealousy", fragmentId: "meaning" });
  expect(state.transcript.jealousy.activeId).toBe("praise");
});

test("stores the active daily channel and restart clears all echo state", () => {
  let state = createExperience("signal");
  state = reduceExperience(state, { type: "SIGNAL_CHANNEL_SET", channelId: "rant" });
  state = reduceExperience(state, { type: "ECHO_REVEAL", scene: "signal", fragmentId: "curious" });
  expect(state.signalChannelId).toBe("rant");
  expect(reduceExperience(state, { type: "RESTART" })).toEqual(createExperience());
});
```

- [ ] **Step 2: Verify RED**

Run the experience test file. Expected: TypeScript/test failure because the events and fields are absent.

- [ ] **Step 3: Extend the reducer**

Add these types and fields in `lib/experience.ts`:

```ts
export type TranscriptEntry = { unlocked: string[]; activeId: string | null };
export type TranscriptState = Record<SceneId, TranscriptEntry>;

const emptyTranscript = (): TranscriptState => Object.fromEntries(
  sceneOrder.map((scene) => [scene, { unlocked: [], activeId: null }]),
) as TranscriptState;
```

Add `transcript: TranscriptState` and `signalChannelId: string | null` to `ExperienceState`; initialize them in `createExperience`. Add events:

```ts
| { type: "ECHO_REVEAL"; scene: SceneId; fragmentId: string }
| { type: "ECHO_SELECT"; scene: SceneId; fragmentId: string }
| { type: "SIGNAL_CHANNEL_SET"; channelId: string }
```

Handle them before existing completion logic:

```ts
if (event.type === "SIGNAL_CHANNEL_SET") return { ...state, signalChannelId: event.channelId };
if (event.type === "ECHO_REVEAL") {
  const entry = state.transcript[event.scene];
  const unlocked = entry.unlocked.includes(event.fragmentId) ? entry.unlocked : [...entry.unlocked, event.fragmentId];
  return { ...state, transcript: { ...state.transcript, [event.scene]: { unlocked, activeId: event.fragmentId } } };
}
if (event.type === "ECHO_SELECT") {
  const entry = state.transcript[event.scene];
  if (!entry.unlocked.includes(event.fragmentId)) return state;
  return { ...state, transcript: { ...state.transcript, [event.scene]: { ...entry, activeId: event.fragmentId } } };
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run `tests/experience.test.ts`, then the full suite. Expected: PASS.

```bash
git add lib/experience.ts tests/experience.test.ts
git commit -m "feat: track layered echo reading state"
```

### Task 3: Create the reusable EchoTranscript

**Files:**
- Create: `components/experience/EchoTranscript.tsx`
- Create: `tests/echo-transcript.test.tsx`

- [ ] **Step 1: Write the failing component tests**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { EchoTranscript } from "../components/experience/EchoTranscript";

const fragments = [
  { id: "one", text: "第一段回音" },
  { id: "two", text: "第二段回音" },
  { id: "three", text: "第三段回音" },
];

test("shows only the active unlocked fragment and supports review", () => {
  const onSelect = vi.fn();
  render(<EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={onSelect} />);
  expect(screen.getByText("第二段回音")).toBeInTheDocument();
  expect(screen.queryByText("第三段回音")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "回看第 1 段" }));
  expect(onSelect).toHaveBeenCalledWith("one");
});

test("announces newly revealed copy politely", () => {
  render(<EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={() => {}} />);
  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
});
```

- [ ] **Step 2: Verify RED**

Run the new test file. Expected: FAIL because `EchoTranscript` does not exist.

- [ ] **Step 3: Create the component**

```tsx
"use client";

import type { EchoFragment } from "../../lib/content";

type Props = {
  fragments: EchoFragment[];
  unlocked: string[];
  activeId: string | null;
  onSelect: (fragmentId: string) => void;
};

export function EchoTranscript({ fragments, unlocked, activeId, onSelect }: Props) {
  const active = fragments.find((fragment) => fragment.id === activeId);
  if (!active) return <div className="echo-transcript echo-transcript-empty" aria-hidden="true" />;

  return (
    <div className="echo-transcript">
      <p key={active.id} className="echo-transcript-copy" role="status" aria-live="polite">{active.text}</p>
      <div className="echo-transcript-markers" aria-label="已解锁回音">
        {fragments.map((fragment, index) => {
          const available = unlocked.includes(fragment.id);
          return (
            <button
              key={fragment.id}
              type="button"
              disabled={!available}
              className={fragment.id === active.id ? "active" : ""}
              aria-label={available ? `回看第 ${index + 1} 段` : `第 ${index + 1} 段尚未解锁`}
              onClick={() => available && onSelect(fragment.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run the new test and full suite. Expected: PASS.

```bash
git add components/experience/EchoTranscript.tsx tests/echo-transcript.test.tsx
git commit -m "feat: add layered echo transcript"
```

### Task 4: Place the transcript in the experience shell

**Files:**
- Modify: `components/experience/ScenePanel.tsx`
- Modify: `components/experience/EchoExperience.tsx`
- Modify: `tests/experience-ui.test.tsx`

- [ ] **Step 1: Write a failing shell test**

Extend `tests/experience-ui.test.tsx`:

```tsx
test("revealed story copy appears inside the persistent scene panel", () => {
  render(<EchoExperience />);
  const wake = screen.getByRole("button", { name: "长按唤醒宇宙" });
  fireEvent.click(wake);
  expect(screen.getByRole("status")).toHaveTextContent("这片宇宙原本安静得没有方向");
});
```

- [ ] **Step 2: Verify RED**

Run `tests/experience-ui.test.tsx`. Expected: FAIL because scene reveal callbacks and transcript rendering are not connected.

- [ ] **Step 3: Extend ScenePanel props and markup**

Use this prop shape:

```ts
type ScenePanelProps = {
  scene: SceneId;
  children: ReactNode;
  fragments: EchoFragment[];
  unlocked: string[];
  activeId: string | null;
  onSelect: (fragmentId: string) => void;
};
```

Import `EchoFragment` from `../../lib/content` and `EchoTranscript` from `./EchoTranscript`. Render this exact element immediately after `.scene-body` and before `.scene-action`:

```tsx
<EchoTranscript fragments={fragments} unlocked={unlocked} activeId={activeId} onSelect={onSelect} />
```

- [ ] **Step 4: Resolve the active fragment set in EchoExperience**

Add these derived values and callbacks:

```tsx
const transcript = state.transcript[state.scene];
const fragments = state.scene === "signal"
  ? signalChannels.find((channel) => channel.id === state.signalChannelId)?.echoes ?? []
  : sceneEchoes[state.scene];
const reveal = useCallback((fragmentId: string) => {
  dispatch({ type: "ECHO_REVEAL", scene: state.scene, fragmentId });
}, [state.scene]);
const selectEcho = useCallback((fragmentId: string) => {
  dispatch({ type: "ECHO_SELECT", scene: state.scene, fragmentId });
}, [state.scene]);
```

Pass `onReveal: reveal` to every scene. Pass `onChannelSelected={(channelId) => dispatch({ type: "SIGNAL_CHANNEL_SET", channelId })}` to `SignalScene`. Pass `fragments`, `transcript.unlocked`, `transcript.activeId`, and `selectEcho` to `ScenePanel`.

- [ ] **Step 5: Verify the shell test is now ready for scene wiring**

Run the shell test. Expected: the transcript component and reducer compile, with the new interaction assertion remaining RED until Task 5 supplies the wake reveal callback. Do not commit this intentionally incomplete wiring yet; Task 5 commits the shell and scene changes together after the repository is green.

### Task 5: Connect all eight interactions to story thresholds

**Files:**
- Modify: `components/experience/scenes.tsx`
- Modify: `tests/scenes.test.tsx`

- [ ] **Step 1: Add failing interaction-to-copy tests**

Add focused tests for every threshold family:

```tsx
test("jealousy pulses reveal three ordered story fragments", () => {
  const onReveal = vi.fn();
  render(<JealousyScene onComplete={() => {}} onReveal={onReveal} />);
  const pulse = screen.getByRole("button", { name: "发送解码脉冲" });
  fireEvent.click(pulse);
  fireEvent.click(pulse);
  fireEvent.click(pulse);
  fireEvent.click(pulse);
  expect(onReveal.mock.calls.flat()).toEqual(["praise", "smile", "meaning"]);
});

test("date locks and privilege lights reveal their ordered fragments", () => {
  const confessionReveal = vi.fn();
  const { unmount } = render(<ConfessionScene onComplete={() => {}} onReveal={confessionReveal} />);
  fireEvent.click(screen.getByRole("button", { name: "锁定 2026" }));
  fireEvent.click(screen.getByRole("button", { name: "锁定 05" }));
  fireEvent.click(screen.getByRole("button", { name: "锁定 23" }));
  expect(confessionReveal.mock.calls.flat()).toEqual(["year", "month", "day", "locked"]);
  unmount();

  const privilegeReveal = vi.fn();
  render(<PrivilegeScene onComplete={() => {}} onReveal={privilegeReveal} />);
  const light = screen.getByRole("button", { name: "点亮偏爱星群" });
  fireEvent.click(light); fireEvent.click(light); fireEvent.click(light);
  expect(privilegeReveal.mock.calls.flat()).toEqual(["diary", "remembered", "seen", "action"]);
});

test("game, night, and finale reveal complete ordered stories", () => {
  const gameReveal = vi.fn();
  const game = render(<GameScene onComplete={() => {}} onReveal={gameReveal} />);
  fireEvent.click(screen.getByRole("button", { name: "靠近 · 1/3" }));
  fireEvent.click(screen.getByRole("button", { name: "同步 · 2/3" }));
  fireEvent.click(screen.getByRole("button", { name: "穿越 · 3/3" }));
  expect(gameReveal.mock.calls.flat()).toEqual(["near", "sync", "through", "complete"]);
  game.unmount();

  const nightReveal = vi.fn();
  const night = render(<NightScene onComplete={() => {}} onReveal={nightReveal} />);
  const frequency = screen.getByRole("button", { name: "按住连接深夜频率" });
  fireEvent.click(frequency); fireEvent.click(frequency); fireEvent.click(frequency);
  expect(nightReveal.mock.calls.flat()).toEqual(["third", "two-thirds", "connected", "frequency"]);
  night.unmount();

  const finaleReveal = vi.fn();
  render(<FinaleScene onComplete={() => {}} onReveal={finaleReveal} onRestart={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "读取回音 1 / 3" }));
  fireEvent.click(screen.getByRole("button", { name: "读取回音 2 / 3" }));
  fireEvent.click(screen.getByRole("button", { name: "展开无限回音" }));
  expect(finaleReveal.mock.calls.flat()).toEqual(["recap", "present", "echo"]);
});
```

- [ ] **Step 2: Verify RED**

Run `tests/scenes.test.tsx`. Expected: FAIL because `onReveal` is not part of scene props.

- [ ] **Step 3: Add a single reveal helper and wire thresholds**

Change `BasicProps` to:

```ts
type BasicProps = { onComplete: () => void; onReveal: (fragmentId: string) => void };
```

Update every existing direct scene render in `tests/scenes.test.tsx` to pass `onReveal={() => {}}`, except the new tests that pass spies. This keeps older interaction assertions focused on their original behavior.

In each component, call `onReveal` only when crossing a new step:

- Wake taps/hold nodes: `spark`, `archive`, `receiver`.
- Jealousy at values >=35, >=60, >=85: `praise`, `smile`, `meaning`.
- Confession button indices: `year`, `month`, `day`; when all are locked: `locked`.
- Privilege light counts 1–3: `diary`, `remembered`, `seen`; count 3 also reveals `action`.
- Signal selection calls `onChannelSelected(channelId)`; response buttons reveal their response type; third distinct response also reveals `close`.
- Game gates 1–3: `near`, `sync`, `through`; gate 3 also reveals `complete`.
- Night thresholds 33/66/100: `third`, `two-thirds`, `connected`; 100 also reveals `frequency`.

Use a `revealedRef` set in threshold-driven components so slider changes, effects, pointer events, and fallback taps cannot emit the same ID twice:

```ts
const revealedRef = useRef(new Set<string>());
const revealOnce = (id: string) => {
  if (revealedRef.current.has(id)) return;
  revealedRef.current.add(id);
  onReveal(id);
};
```

- [ ] **Step 4: Gate the finale with three user-controlled reveals**

Use this complete finale implementation. It keeps the clock running, reveals one fragment per press, and withholds the signature and replay controls until the third press:

```tsx
export function FinaleScene({ onComplete, onReveal, onRestart }: BasicProps & { onRestart: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const [step, setStep] = useState(0);
  const completed = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = useMemo(() => elapsedSinceConfession(now), [now]);
  const revealNext = () => {
    if (step >= 3) return;
    const ids = ["recap", "present", "echo"] as const;
    const next = step + 1;
    onReveal(ids[step]);
    setStep(next);
    if (next === 3 && !completed.current) {
      completed.current = true;
      onComplete();
    }
  };
  const labels = ["读取回音 1 / 3", "读取回音 2 / 3", "展开无限回音"];
  return (
    <div className="finale-copy">
      <div className="finale-coordinate" aria-hidden="true">05:23</div>
      {step < 3 ? <button className="finale-reveal" onClick={revealNext}>{labels[step]}</button> : null}
      {step === 3 ? <>
        <p className="final-line">{finalCopy.lines[0]}<br />{finalCopy.lines[1]}</p>
        <div className="love-clock"><span><b>{elapsed.days}</b>天</span><span><b>{elapsed.hours}</b>时</span><span><b>{elapsed.minutes}</b>分</span><span><b>{elapsed.seconds}</b>秒</span></div>
        <p className="signature">TO {finalCopy.to}<br />FROM {finalCopy.from}<br />SINCE {finalCopy.since}</p>
        <button className="replay-button" onClick={onRestart}>重新进入这片宇宙</button>
      </> : null}
    </div>
  );
}
```

- [ ] **Step 5: Verify GREEN and commit**

Before verification, gate the finale's WebGL expansion. Make these three exact edits in `EchoCoreCanvas.tsx`.

Change the props type to:

```tsx
type Props = { scene: SceneId; growth: Growth; finaleOpen: boolean };
```

Change the function declaration and its first three statements to:

```tsx
export function EchoCoreCanvas({ scene, growth, finaleOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderScene: SceneId = scene === "finale" && !finaleOpen ? "wake" : scene;
  const liveRef = useRef({ scene: renderScene, growth });
  liveRef.current = { scene: renderScene, growth };
```

Change the component's final return statement to:

```tsx
return <canvas ref={canvasRef} className="echo-canvas" data-sculpture={renderScene} aria-label="0523 回音星核动态视觉" />;
```

In `EchoExperience`, pass:

```tsx
const finaleOpen = state.transcript.finale.unlocked.includes("echo");
<EchoCoreCanvas scene={state.scene} growth={state.growth} finaleOpen={finaleOpen} />
```

Update `tests/echo-core.test.tsx` so every render supplies `finaleOpen`. Add this regression test:

```tsx
test("keeps the finale compact until the third echo opens infinity", () => {
  const growth = { filaments: 0, petals: 0, currents: 0 };
  const { rerender } = render(<EchoCoreCanvas scene="finale" growth={growth} finaleOpen={false} />);
  expect(screen.getByLabelText("0523 回音星核动态视觉")).toHaveAttribute("data-sculpture", "wake");
  rerender(<EchoCoreCanvas scene="finale" growth={growth} finaleOpen />);
  expect(screen.getByLabelText("0523 回音星核动态视觉")).toHaveAttribute("data-sculpture", "finale");
});
```

Then run `tests/scenes.test.tsx`, `tests/experience-ui.test.tsx`, `tests/echo-core.test.tsx`, and the full suite. Expected: PASS with no duplicate React update warning.

```bash
git add components/experience/scenes.tsx components/experience/ScenePanel.tsx components/experience/EchoExperience.tsx components/experience/EchoCoreCanvas.tsx tests/scenes.test.tsx tests/experience-ui.test.tsx tests/echo-core.test.tsx
git commit -m "feat: reveal story through scene interactions"
```

### Task 6: Style the transcript without covering the particle sculptures

**Files:**
- Modify: `app/globals.css`
- Modify: `tests/experience-ui.test.tsx`

- [ ] **Step 1: Add a failing class contract test**

```tsx
expect(document.querySelector(".echo-transcript")).toBeInTheDocument();
expect(document.querySelector(".echo-transcript-markers")).toBeInTheDocument();
```

- [ ] **Step 2: Verify RED before the component is connected**

Run the UI test and confirm the expected missing-class failure.

- [ ] **Step 3: Add the exact responsive styles**

```css
.echo-transcript { position:relative; width:min(430px,100%); min-height:92px; margin:14px auto 0; padding:15px 18px 12px; border:1px solid #7582aa4a; border-radius:18px; background:linear-gradient(135deg,#0b1020d9,#100b1bd1); box-shadow:0 18px 46px #0008,inset 0 0 28px #6deaff0b; backdrop-filter:blur(18px); overflow:hidden; }
.echo-transcript::before { content:""; position:absolute; inset:0; pointer-events:none; background:linear-gradient(105deg,transparent 25%,#76efff1d 48%,transparent 70%); transform:translateX(-120%); animation:echo-scan .55s ease-out; }
.echo-transcript-empty { visibility:hidden; min-height:0; height:0; margin:0; padding:0; border:0; }
.echo-transcript-copy { position:relative; z-index:1; min-height:3.3em; margin:0; color:#e8eaf6; font:400 12px/1.72 "PingFang SC","Noto Sans SC",sans-serif; letter-spacing:.035em; text-align:left; animation:echo-copy-in .48s cubic-bezier(.16,1,.3,1) both; }
.echo-transcript-markers { position:relative; z-index:2; display:flex; justify-content:center; gap:9px; margin-top:10px; }
.echo-transcript-markers button { width:22px; height:12px; min-height:12px; padding:0; border:0; background:transparent; cursor:pointer; }
.echo-transcript-markers button::before { content:""; display:block; width:100%; height:2px; border-radius:2px; background:#505875; transition:.25s; }
.echo-transcript-markers button:disabled::before { opacity:.24; }
.echo-transcript-markers button:not(:disabled)::before { background:#8c78d8; box-shadow:0 0 8px #8c78d888; }
.echo-transcript-markers button.active::before { background:var(--cyan); box-shadow:0 0 12px var(--cyan); transform:scaleX(1.18); }
@keyframes echo-scan { to { transform:translateX(120%); } }
@keyframes echo-copy-in { from { opacity:0; transform:translateY(8px); filter:blur(4px); } }
```

Add desktop alignment inside the existing `min-width:800px` media query:

```css
.echo-transcript { margin-left:0; }
```

Add small-height behavior inside `max-height:680px`:

```css
.echo-transcript { min-height:72px; max-height:108px; margin-top:8px; padding:10px 13px 8px; overflow-y:auto; }
.echo-transcript-copy { min-height:auto; font-size:11px; line-height:1.55; }
```

Inside `prefers-reduced-motion:reduce`, the existing universal animation rule remains; add:

```css
.echo-transcript::before { display:none; }
.echo-transcript-copy { opacity:1; transform:none; filter:none; }
```

- [ ] **Step 4: Run tests, build, and commit**

Run the full Vitest suite and production build. Expected: all tests PASS and build exits 0; the existing bundle-size advisory may remain.

```bash
git add app/globals.css tests/experience-ui.test.tsx
git commit -m "style: add cinematic echo transcript layer"
```

### Task 7: Full mobile walkthrough, regression verification, and private publish

**Files:**
- Modify only files required by defects found during verification.

- [ ] **Step 1: Run fresh automated verification**

```bash
/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run
/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/.pnpm/vinext@1.0.0-beta.2_@vitejs+plugin-react@6.0.2_vite@8.0.13_@types+node@22.19.19_esbuild_93f6fd6c708956198cb05a5cfe3fd3ab/node_modules/vinext/dist/cli.js build
git diff --check
```

Expected: zero failing tests, successful build, no whitespace errors.

- [ ] **Step 2: Walk through all eight scenes at 390×844**

Use the in-app Browser workflow. For every scene, verify:

- the first interaction reveals the first expected fragment;
- all fragments remain reviewable by their markers;
- the active fragment is 3–5 lines and does not cover the primary particle sculpture;
- fast repeated taps do not duplicate or skip fragments;
- “继续航行” appears only after the final fragment is unlocked;
- the finale requires three presses and ends with the front-facing infinity sculpture, clock, recipient, sender, and date.

Reset the temporary viewport override after the walkthrough.

- [ ] **Step 3: Fix only reproduced defects with a red-green test**

For each defect: add the smallest failing Vitest reproduction, run it to observe the expected failure, implement one correction, rerun the focused test, then rerun the full suite. Do not bundle unrelated polish.

- [ ] **Step 4: Commit verification fixes if any**

```bash
git add components/experience/EchoTranscript.tsx components/experience/scenes.tsx app/globals.css tests/echo-transcript.test.tsx tests/scenes.test.tsx tests/experience-ui.test.tsx
git commit -m "fix: polish layered echo reading flow"
```

Skip this commit when verification produced no source changes.

- [ ] **Step 5: Publish a new private Sites version**

Follow `sites:sites-hosting`: push the exact verified HEAD using a fresh short-lived repository credential, package the exact build with `scripts/package-site.sh`, save one version with the HEAD SHA, deploy using `deploy_private_site_version`, poll to `succeeded`, and open the returned production URL in Codex. Keep the site owner-only unless the user separately authorizes broader access.

- [ ] **Step 6: Final evidence report**

Report the production URL, exact passing test count, build result, and the eight-scene mobile walkthrough result. Do not claim completion if any required fragment path, mobile layout, or deployment check is still failing.
