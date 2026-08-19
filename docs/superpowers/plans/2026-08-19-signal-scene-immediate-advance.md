# 第五幕即时反馈与可跳过 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让第五幕频道选择立即显示第一条回应和“进入下一幕”按钮，并允许用户不等待完整自动时间线就进入第六幕。

**Architecture:** `SignalScene` 继续负责频道选择和回应时间线，但新增一个显式的 `onAdvance` 边界。选择处理器同步发送第一条回应；推进按钮由父级把当前演出标记完成后复用现有导演退出流程，因此转场、幂等和计时器清理仍由既有状态机负责。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、CSS。

---

### Task 1: SignalScene 即时反馈与显式推进

**Files:**
- Modify: `tests/scenes.test.tsx`
- Modify: `components/experience/scenes.tsx`

- [x] **Step 1: 写出失败的组件测试**

在第五幕测试中传入 `onAdvance` spy，并把选择后的断言改为：第一条回应同步可见、推进按钮存在；连续点击推进按钮仍只回调一次。保留后续时间线断言，证明第一条定时 cue 不会重复回应。

```tsx
const onAdvance = vi.fn();
render(<SignalScene ... onAdvance={onAdvance} />);
fireEvent.click(screen.getByRole("button", { name: "想吐槽一下" }));
expect(screen.getByText(responses[0].text)).toBeInTheDocument();
const advance = screen.getByRole("button", { name: "进入下一幕" });
fireEvent.click(advance);
fireEvent.click(advance);
expect(onAdvance).toHaveBeenCalledOnce();
act(() => vi.advanceTimersByTime(1_200));
expect(onResponse).toHaveBeenCalledTimes(1);
```

- [x] **Step 2: 运行测试并确认按预期失败**

Run: `npm test -- tests/scenes.test.tsx`

Expected: FAIL，因为 `SignalScene` 尚不接受 `onAdvance`，也不会同步显示第一条回应或渲染推进按钮。

- [x] **Step 3: 实现最小组件行为**

为 `SignalScene` 增加 `onAdvance`，用 ref 保证按钮推进幂等；选择频道时先解析时间线第一条 cue 并调用现有 `handleCue`，然后设置频道；反馈面板内渲染真实按钮。

```tsx
export function SignalScene({ ..., onAdvance, ... }: BasicProps & {
  onResponse: (type: ResponseType) => void;
  onChannelSelected: (channelId: SignalChannelId) => void;
  onAdvance: () => void;
}) {
  const advanced = useRef(false);
  // ...
  const firstCue = resolveSignalCue(sceneTimelines.signal.reveals[0], item);
  if (firstCue) handleCue(firstCue.id);
  setChannelId(item.id);
  // ...
  <button className="signal-advance" disabled={!active || paused} onClick={() => {
    if (advanced.current) return;
    advanced.current = true;
    onAdvance();
  }}>进入下一幕</button>
}
```

- [x] **Step 4: 运行组件测试并确认通过**

Run: `npm test -- tests/scenes.test.tsx`

Expected: PASS，且第五幕第一条回应只记录一次。

### Task 2: 接入导演退出流程并验证无需等待

**Files:**
- Modify: `tests/experience-ui.test.tsx`
- Modify: `components/experience/EchoExperience.tsx`

- [x] **Step 1: 写出失败的集成测试**

新增辅助步骤进入第五幕，选择频道后立即点击按钮，只推进既有 `signal.exitMs`，断言进度变成 `06 / 08`；再推进 60 秒仍停留第六幕，证明没有重复推进。

```tsx
fireEvent.click(screen.getByRole("button", { name: "发生了小事" }));
fireEvent.click(screen.getByRole("button", { name: "进入下一幕" }));
act(() => vi.advanceTimersByTime(sceneTimelines.signal.exitMs));
expect(screen.getByText("06 / 08")).toBeInTheDocument();
act(() => vi.advanceTimersByTime(60_000));
expect(screen.getByText("06 / 08")).toBeInTheDocument();
```

- [x] **Step 2: 运行集成测试并确认按预期失败**

Run: `npm test -- tests/experience-ui.test.tsx`

Expected: FAIL，因为父级尚未向第五幕提供显式推进回调。

- [x] **Step 3: 接入现有导演状态机**

在 `DirectedScene` 的 signal 分支传入一个回调，顺序调用现有 `complete()` 和 `requestAdvance()`。React reducer 会依次把 `present` 变为 `ready` 再变为 `exit`，退出计时器沿用当前 `signal.exitMs`。

```tsx
case "signal": return <SignalScene
  {...props}
  onResponse={...}
  onChannelSelected={...}
  onAdvance={() => {
    complete();
    requestAdvance();
  }}
/>;
```

- [x] **Step 4: 运行集成测试并确认通过**

Run: `npm test -- tests/experience-ui.test.tsx`

Expected: PASS，第五幕无需等待 41.2 秒或 12 秒即可进入第六幕。

### Task 3: 移动端按钮样式与完整验证

**Files:**
- Modify: `tests/echo-transcript-styles.test.ts`
- Modify: `app/globals.css`

- [x] **Step 1: 写出失败的样式测试**

断言 `.signal-advance` 最小高度至少 44px、具有按钮焦点样式，并在短屏媒体查询中保持可见尺寸。

```ts
const advance = ruleFor(".signal-advance");
expectDeclaration(advance, "min-height", /44px/);
expectDeclaration(ruleFor(".signal-advance:focus-visible"), "outline", /2px/);
```

- [x] **Step 2: 运行样式测试并确认按预期失败**

Run: `npm test -- tests/echo-transcript-styles.test.ts`

Expected: FAIL，因为 `.signal-advance` 样式尚不存在。

- [x] **Step 3: 添加聚焦的响应式样式**

让回应面板维持单列信息布局，推进按钮具有 44px 点击区、清晰焦点环和安全区友好的正常文档流位置；短屏不缩小点击区。

```css
.signal-advance { grid-column:1/-1; min-height:44px; ... }
.signal-advance:focus-visible { outline:2px solid #eaffff; outline-offset:4px; ... }
```

- [x] **Step 4: 运行样式测试并确认通过**

Run: `npm test -- tests/echo-transcript-styles.test.ts`

Expected: PASS。

- [x] **Step 5: 运行完整验证**

Run: `npm test`

Expected: 全部测试通过。

Run: `npm run lint`

Expected: 退出码 0，无 lint error。

Run: `npm run build:pages && npm run verify:pages`

Expected: GitHub Pages 构建成功且部署产物校验通过。

- [x] **Step 6: 检查差异并提交**

Run: `git diff --check && git status --short`

Expected: 无空白错误；只包含计划内文件。

```bash
git add docs/superpowers/plans/2026-08-19-signal-scene-immediate-advance.md tests/scenes.test.tsx tests/experience-ui.test.tsx tests/echo-transcript-styles.test.ts components/experience/scenes.tsx components/experience/EchoExperience.tsx app/globals.css
git commit -m "fix: let signal choices advance immediately"
```
