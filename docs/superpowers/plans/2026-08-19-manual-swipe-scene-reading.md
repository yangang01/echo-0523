# 全场景手动滑动阅读 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 保留场景特色互动，把八幕正文改成左右滑动或方向键手动翻阅，并且只在首次到达末段后允许点击或上划进入下一幕。

**Architecture:** `EchoTranscript` 成为正文导航的唯一入口，负责水平手势、键盘翻页、解锁下一段和末段通知。场景组件只负责在特色互动完成后揭示第一段；`DirectedScene` 在末段通知后进入无自动倒计时的 ready 状态，并复用现有上划退出转场。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、CSS、Vite。

---

### Task 1: 水平手势分类与字幕手动翻页

**Files:**
- Modify: `lib/gestures.ts`
- Modify: `tests/gestures.test.ts`
- Modify: `components/experience/EchoTranscript.tsx`
- Modify: `tests/echo-transcript.test.tsx`

- [x] **Step 1: 写水平手势与字幕翻页失败测试**

为 `classifyHorizontalSwipe` 锁定左、右、垂直和短距离行为；为 `EchoTranscript` 增加 `onReveal`、`onComplete`，验证左滑解锁下一段、右滑回看、方向键等价、边界不循环、末段只通知一次。

```tsx
pointer(status, "pointerdown", { pointerId: 4, clientX: 260, clientY: 300 });
pointer(status, "pointerup", { pointerId: 4, clientX: 120, clientY: 306 });
expect(onReveal).toHaveBeenCalledWith("two");

fireEvent.keyDown(status, { key: "ArrowLeft" });
expect(onSelect).toHaveBeenCalledWith("one");

pointer(status, "pointerdown", { pointerId: 5, clientX: 260, clientY: 300 });
pointer(status, "pointerup", { pointerId: 5, clientX: 120, clientY: 300 });
expect(onReveal).toHaveBeenLastCalledWith("three");
expect(onComplete).toHaveBeenCalledOnce();
```

- [x] **Step 2: 运行定向测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run tests/gestures.test.ts tests/echo-transcript.test.tsx`

Expected: FAIL，因为水平分类器和字幕导航回调尚不存在。

- [x] **Step 3: 实现水平分类与单步导航**

新增水平优势判定；字幕记录指针起点，在释放时只执行一次左/右导航。下一段未解锁时调用 `onReveal`，已解锁时调用 `onSelect`，首次到达末段调用 `onComplete`。

```ts
export function classifyHorizontalSwipe(start: TimedPoint, end: TimedPoint): "left" | "right" | "none" {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 42 || Math.abs(dx) <= Math.abs(dy) * 1.35) return "none";
  return dx < 0 ? "left" : "right";
}
```

- [x] **Step 4: 运行定向测试确认通过**

Run: `node node_modules/vitest/vitest.mjs run tests/gestures.test.ts tests/echo-transcript.test.tsx`

Expected: PASS。

### Task 2: 场景只揭示首段且永不定时完成

**Files:**
- Modify: `components/experience/scenes.tsx`
- Modify: `tests/scenes.test.tsx`

- [x] **Step 1: 把场景测试改成失败的手动阅读期望**

第一幕吸附、第二幕解码、第五幕选频道后应同步揭示首段；第三、四、六、七、八幕 active 后同步揭示首段。推进任意长的 fake timers 都不得揭示后续段落或调用 `onComplete`。

```tsx
render(<ConfessionScene onComplete={onComplete} onReveal={onReveal} />);
expect(onReveal).toHaveBeenCalledWith("year");
act(() => vi.advanceTimersByTime(120_000));
expect(onReveal).toHaveBeenCalledTimes(1);
expect(onComplete).not.toHaveBeenCalled();
```

- [x] **Step 2: 运行场景测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run tests/scenes.test.tsx`

Expected: FAIL，现有 `useAutomaticScene` 仍会按时间揭示和完成。

- [x] **Step 3: 删除正文自动时间线并保留特色互动**

用无定时器的 `useFirstReveal` 取代 `useAutomaticScene`。第一、二幕分别由吸附和解码状态启用；第五幕选择时揭示频道第一段；其余场景由 `active` 启用。第五幕回应面板根据父级 `activeId` 展示当前回应，不再自带提前跳幕按钮。

```ts
function useFirstReveal(fragmentId: string, onReveal: (id: string) => void, enabled: boolean) {
  const revealOnce = useRevealOnce(onReveal);
  useEffect(() => { if (enabled) revealOnce(fragmentId); }, [enabled, fragmentId, revealOnce]);
}
```

- [x] **Step 4: 运行场景测试确认通过**

Run: `node node_modules/vitest/vitest.mjs run tests/scenes.test.tsx`

Expected: PASS，且测试计时器中没有正文播放任务。

### Task 3: 末段完成导演与统一换幕入口

**Files:**
- Modify: `lib/director.ts`
- Modify: `tests/director.test.ts`
- Modify: `components/experience/ScenePanel.tsx`
- Modify: `components/experience/EchoExperience.tsx`
- Modify: `tests/experience-ui.test.tsx`

- [x] **Step 1: 写失败的导演与整合测试**

导演进入 ready 后等待任意时间都不退出；场景只在字幕到达末段后显示“上划进入下一幕”。末段前上划无效，末段后按钮与字幕外上划均只推进一次；终章无下一幕入口。

```tsx
act(() => vi.advanceTimersByTime(120_000));
expect(screen.getByText("01 / 08")).toBeInTheDocument();
swipeTranscriptLeft();
swipeTranscriptLeft();
expect(screen.getByRole("button", { name: "上划进入下一幕" })).toBeInTheDocument();
swipeReadySurface();
act(() => vi.advanceTimersByTime(sceneTimelines.wake.exitMs));
expect(screen.getByText("02 / 08")).toBeInTheDocument();
```

- [x] **Step 2: 运行导演和整合测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run tests/director.test.ts tests/experience-ui.test.tsx`

Expected: FAIL，当前导演仍设置 12 秒自动退出，字幕也不会通知完成。

- [x] **Step 3: 接入字幕完成并移除自动退出**

`PRESENTATION_COMPLETE` 只进入 ready，不设置 `autoAdvanceAt`；删除 DirectedScene 的 ready idle timeout。`ScenePanel` 把 `onReveal` 和 `onComplete` 传给字幕。`DirectedScene.reveal` 对第五幕三种回应保持一次性粒子增长；终章根据已解锁末段显示最终文案。

```ts
if (event.type === "PRESENTATION_COMPLETE") {
  return state.phase === "present" ? { ...state, phase: "ready", autoAdvanceAt: null, idleRemainingMs: null } : state;
}
```

- [x] **Step 4: 运行导演和整合测试确认通过**

Run: `node node_modules/vitest/vitest.mjs run tests/director.test.ts tests/experience-ui.test.tsx`

Expected: PASS。

### Task 4: 移动端样式、回归与部署验证

**Files:**
- Modify: `app/globals.css`
- Modify: `tests/echo-transcript-styles.test.ts`

- [x] **Step 1: 写失败的手势提示与按钮样式测试**

字幕声明水平触摸意图并保持 44px 标记点击区；统一 `.swipe-cue` 是可点击按钮、具有 44px 高度和焦点环，短屏不被安全区遮挡。

```ts
expectDeclaration(ruleFor(".echo-transcript"), "touch-action", /pan-y/);
expectDeclaration(ruleFor(".swipe-cue"), "min-height", /44px/);
expectDeclaration(ruleFor(".swipe-cue"), "pointer-events", /auto/);
```

- [x] **Step 2: 运行样式测试确认失败**

Run: `node node_modules/vitest/vitest.mjs run tests/echo-transcript-styles.test.ts`

Expected: FAIL，当前提示不可点击且字幕没有水平手势样式。

- [x] **Step 3: 实现统一字幕和换幕按钮样式**

为字幕添加水平滑动光标/触摸提示和切换方向动画；把 `.swipe-cue` 改为安全区内可点击的 44px 胶囊按钮，保留 reduced-motion 降级。

```css
.echo-transcript { touch-action:pan-y; }
.swipe-cue { min-height:44px; pointer-events:auto; cursor:pointer; }
.swipe-cue:focus-visible { outline:2px solid #eaffff; outline-offset:4px; }
```

- [x] **Step 4: 运行完整验证并提交推送**

Run: `node node_modules/vitest/vitest.mjs run`

Expected: 全部测试通过。

Run: `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next`

Expected: 退出码 0。

Run: `node node_modules/vite/bin/vite.js build --config vite.github-pages.config.ts && node scripts/verify-github-pages-build.mjs`

Expected: Pages 构建和产物验证通过。

Run: `git diff --check`

Expected: 无空白错误。

浏览器验证：在 390×844 和 390×650 下完成一幕特色互动、左右翻完正文、回看、按钮点击与字幕外上划。

```bash
git add docs/superpowers/plans/2026-08-19-manual-swipe-scene-reading.md lib/gestures.ts lib/director.ts components/experience/EchoTranscript.tsx components/experience/ScenePanel.tsx components/experience/scenes.tsx components/experience/EchoExperience.tsx app/globals.css tests/gestures.test.ts tests/director.test.ts tests/echo-transcript.test.tsx tests/scenes.test.tsx tests/experience-ui.test.tsx tests/echo-transcript-styles.test.ts
git commit -m "feat: make scene reading manually swipeable"
git push origin HEAD:main
```
