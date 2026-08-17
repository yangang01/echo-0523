# 0523 回音星核七夕 H5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a mobile-first, 7–9 minute interactive Qixi H5 whose original WebGL “0523 Echo Core” grows in response to the visitor’s choices.

**Architecture:** Use the Sites vinext starter as a single-route React app. Keep deterministic story/state, response content, time calculations, particle geometry, and quality selection in pure TypeScript modules with test-first coverage; keep Three.js rendering, audio, pointer/tilt input, and scene UI in focused client components. The experience controller emits typed events to a persistent WebGL canvas so scene transitions never recreate the renderer.

**Tech Stack:** React, TypeScript, vinext/Vite Sites starter, Three.js with custom GLSL shaders and EffectComposer bloom, Web Audio API, Vitest, Testing Library, CSS.

---

## File map

- `app/layout.tsx` — title, description, viewport, theme, and social metadata.
- `app/page.tsx` — one-route entry that renders the experience.
- `app/globals.css` — full-screen responsive styling and motion/quality variants.
- `components/experience/EchoExperience.tsx` — top-level controller and progress.
- `components/experience/EchoCoreCanvas.tsx` — persistent Three.js renderer and shader uniforms.
- `components/experience/ScenePanel.tsx` — accessible scene copy, prompts, buttons, and progress.
- `components/experience/AudioEngine.tsx` — user-activated synthesized audio and mute control.
- `components/experience/scenes.tsx` — the eight scene-specific interactions.
- `lib/experience.ts` — scene state machine, typed events, and growth state.
- `lib/content.ts` — all final Chinese copy and deterministic response trees.
- `lib/relationship-time.ts` — live elapsed-time calculation from 2026-05-23.
- `lib/quality.ts` — capability and sustained-frame-rate quality selection.
- `lib/particles.ts` — deterministic particle targets for `05:23`, echo core, and infinity ring.
- `lib/audio.ts` — pure frequency/envelope recipes used by Web Audio.
- `tests/*.test.ts(x)` — unit and component behavior tests.
- `public/og.png` — site-specific generated social card after the visual direction is stable.

## Task 1: Initialize the Sites app and testing harness

**Files:**
- Create through initializer: `.openai/hosting.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `package.json`
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/smoke.test.tsx`

- [ ] **Step 1: Run the Sites initializer in the worktree**

Run:

```bash
/Users/yangang/.codex/plugins/cache/openai-bundled/sites/0.1.34/scripts/init-site.sh "$PWD"
```

Expected: exit 0, a vinext project, `.openai/hosting.json`, and installed dependencies.

- [ ] **Step 2: Start the retained development server and open its printed Local URL once**

Run:

```bash
npm run dev
```

Expected: Vite prints one healthy Local URL. Keep this process alive through implementation and hosting.

- [ ] **Step 3: Install rendering and test dependencies**

Run:

```bash
npm install three
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @types/three
```

Expected: dependencies are added without replacing the starter package manager or lockfile.

- [ ] **Step 4: Write the failing starter replacement test**

Create `tests/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import Page from '../app/page';

test('renders the 0523 experience entry instead of the starter preview', () => {
  render(<Page />);
  expect(screen.getByRole('main', { name: '0523 回音星核' })).toBeInTheDocument();
  expect(screen.queryByText(/loading preview/i)).not.toBeInTheDocument();
});
```

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'] },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run"
```

- [ ] **Step 5: Run the test and verify RED**

Run: `npm test -- tests/smoke.test.tsx`

Expected: FAIL because `app/page.tsx` still renders the Sites starter.

- [ ] **Step 6: Replace the starter with the minimal accessible entry**

Replace `app/page.tsx` with:

```tsx
export default function Page() {
  return <main aria-label="0523 回音星核" />;
}
```

Remove `app/_sites-preview` and its import. Remove `react-loading-skeleton` if unused, then refresh the lockfile with `npm install`.

- [ ] **Step 7: Run the test and verify GREEN**

Run: `npm test -- tests/smoke.test.tsx`

Expected: 1 test passes.

- [ ] **Step 8: Commit**

```bash
git add app package.json package-lock.json vitest.config.ts tests .openai/hosting.json
git commit -m "chore: initialize 0523 experience"
```

## Task 2: Build the deterministic experience state machine

**Files:**
- Create: `lib/experience.ts`
- Create: `tests/experience.test.ts`

- [ ] **Step 1: Write failing transition and growth tests**

Create `tests/experience.test.ts`:

```ts
import { createExperience, reduceExperience } from '../lib/experience';

test('advances only when the current scene completes', () => {
  const initial = createExperience();
  expect(reduceExperience(initial, { type: 'NEXT' }).scene).toBe('wake');
  const ready = reduceExperience(initial, { type: 'SCENE_COMPLETE', scene: 'wake' });
  expect(reduceExperience(ready, { type: 'NEXT' }).scene).toBe('jealousy');
});

test('maps response types to independent echo-core growth channels', () => {
  let state = createExperience('signal');
  state = reduceExperience(state, { type: 'RESPONSE_SELECTED', response: 'curious' });
  state = reduceExperience(state, { type: 'RESPONSE_SELECTED', response: 'compliment' });
  state = reduceExperience(state, { type: 'RESPONSE_SELECTED', response: 'ally' });
  expect(state.growth).toEqual({ filaments: 1, petals: 1, currents: 1 });
});

test('ignores completion events from a stale scene', () => {
  const state = createExperience('confession');
  expect(reduceExperience(state, { type: 'SCENE_COMPLETE', scene: 'wake' })).toEqual(state);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- tests/experience.test.ts`

Expected: FAIL because `lib/experience.ts` does not exist.

- [ ] **Step 3: Implement the state machine**

Create `lib/experience.ts`:

```ts
export const sceneOrder = [
  'wake', 'jealousy', 'confession', 'privilege',
  'signal', 'game', 'night', 'finale',
] as const;

export type SceneId = (typeof sceneOrder)[number];
export type ResponseType = 'curious' | 'compliment' | 'ally';
export type Growth = { filaments: number; petals: number; currents: number };
export type ExperienceState = {
  scene: SceneId;
  completed: SceneId[];
  growth: Growth;
  soundEnabled: boolean;
};
export type ExperienceEvent =
  | { type: 'SCENE_COMPLETE'; scene: SceneId }
  | { type: 'NEXT' }
  | { type: 'RESPONSE_SELECTED'; response: ResponseType }
  | { type: 'SOUND_SET'; enabled: boolean }
  | { type: 'RESTART' };

export function createExperience(scene: SceneId = 'wake'): ExperienceState {
  return { scene, completed: [], growth: { filaments: 0, petals: 0, currents: 0 }, soundEnabled: false };
}

export function reduceExperience(state: ExperienceState, event: ExperienceEvent): ExperienceState {
  if (event.type === 'RESTART') return createExperience();
  if (event.type === 'SOUND_SET') return { ...state, soundEnabled: event.enabled };
  if (event.type === 'SCENE_COMPLETE') {
    if (event.scene !== state.scene || state.completed.includes(event.scene)) return state;
    return { ...state, completed: [...state.completed, event.scene] };
  }
  if (event.type === 'NEXT') {
    if (!state.completed.includes(state.scene)) return state;
    const index = sceneOrder.indexOf(state.scene);
    return { ...state, scene: sceneOrder[Math.min(index + 1, sceneOrder.length - 1)] };
  }
  const key = event.response === 'curious' ? 'filaments' : event.response === 'compliment' ? 'petals' : 'currents';
  return { ...state, growth: { ...state.growth, [key]: state.growth[key] + 1 } };
}
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `npm test -- tests/experience.test.ts`

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/experience.ts tests/experience.test.ts
git commit -m "feat: add deterministic experience state"
```

## Task 3: Add final content and live relationship time

**Files:**
- Create: `lib/content.ts`
- Create: `lib/relationship-time.ts`
- Create: `tests/content.test.ts`
- Create: `tests/relationship-time.test.ts`

- [ ] **Step 1: Write failing content and time tests**

Create `tests/content.test.ts`:

```ts
import { signalChannels, finalCopy } from '../lib/content';

test('every signal channel contains all three forms of being heard', () => {
  for (const channel of signalChannels) {
    expect(channel.responses.map((item) => item.type).sort()).toEqual(['ally', 'compliment', 'curious']);
  }
});

test('final copy uses confirmed names and avoids promises', () => {
  expect(finalCopy.to).toBe('小宝贝');
  expect(finalCopy.from).toBe('永远爱你的人');
  expect(finalCopy.lines.join('')).not.toMatch(/永远保证|以后一定|承诺/);
});
```

Create `tests/relationship-time.test.ts`:

```ts
import { elapsedSinceConfession } from '../lib/relationship-time';

test('calculates elapsed units from 2026-05-23 in Asia/Shanghai', () => {
  expect(elapsedSinceConfession(new Date('2026-05-24T00:00:00+08:00'))).toEqual({
    days: 1, hours: 0, minutes: 0, seconds: 0,
  });
});

test('clamps dates before the confession to zero', () => {
  expect(elapsedSinceConfession(new Date('2026-05-01T00:00:00+08:00'))).toEqual({
    days: 0, hours: 0, minutes: 0, seconds: 0,
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/content.test.ts tests/relationship-time.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement exact copy and time calculation**

Create `lib/content.ts` with four channels named `发生了小事`, `想吐槽一下`, `今天超开心`, and `想被夸夸`. Each channel must contain exactly one `curious`, one `compliment`, and one `ally` response. Use these confirmed lines for the final object:

```ts
export const finalCopy = {
  to: '小宝贝',
  from: '永远爱你的人',
  since: '2026.05.23',
  lines: ['你说的有的没的，在我这里都不是小事。', '因为是你说的，所以我想听完。'],
} as const;
```

Create `lib/relationship-time.ts`:

```ts
const CONFESSION_MS = new Date('2026-05-23T00:00:00+08:00').getTime();

export function elapsedSinceConfession(now = new Date()) {
  let remaining = Math.max(0, now.getTime() - CONFESSION_MS);
  const days = Math.floor(remaining / 86_400_000);
  remaining -= days * 86_400_000;
  const hours = Math.floor(remaining / 3_600_000);
  remaining -= hours * 3_600_000;
  const minutes = Math.floor(remaining / 60_000);
  remaining -= minutes * 60_000;
  return { days, hours, minutes, seconds: Math.floor(remaining / 1_000) };
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- tests/content.test.ts tests/relationship-time.test.ts`

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/content.ts lib/relationship-time.ts tests/content.test.ts tests/relationship-time.test.ts
git commit -m "feat: add personal story content and live time"
```

## Task 4: Add deterministic particle targets and quality tiers

**Files:**
- Create: `lib/particles.ts`
- Create: `lib/quality.ts`
- Create: `tests/particles.test.ts`
- Create: `tests/quality.test.ts`

- [ ] **Step 1: Write failing deterministic geometry tests**

Create tests that assert:

```ts
import { echoCoreTargets, infinityTargets } from '../lib/particles';
import { initialQuality, lowerQuality } from '../lib/quality';

test('particle targets are deterministic and finite', () => {
  expect(echoCoreTargets(512, 523)).toEqual(echoCoreTargets(512, 523));
  expect(echoCoreTargets(512, 523)).toHaveLength(1536);
  expect(echoCoreTargets(512, 523).every(Number.isFinite)).toBe(true);
});

test('infinity targets contain one xyz triplet per particle', () => {
  expect(infinityTargets(100)).toHaveLength(300);
});

test('quality selects conservatively and steps down without underflow', () => {
  expect(initialQuality({ deviceMemory: 2, cores: 2, reducedMotion: false })).toBe('low');
  expect(lowerQuality('high')).toBe('medium');
  expect(lowerQuality('low')).toBe('low');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/particles.test.ts tests/quality.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement seeded target generation and tier selection**

Implement `echoCoreTargets(count, seed)` with a seeded xorshift generator, a rose-like spherical deformation, and exactly three finite coordinates per particle. Implement `infinityTargets(count)` from the Gerono lemniscate `x = sin(t)`, `y = sin(t) * cos(t)`, with a small deterministic depth ripple. Export these tier budgets from `lib/quality.ts`:

```ts
export type Quality = 'high' | 'medium' | 'low';
export const particleBudget = { high: 48000, medium: 24000, low: 9000 } as const;

export function initialQuality(input: { deviceMemory?: number; cores?: number; reducedMotion: boolean }): Quality {
  if (input.reducedMotion || (input.deviceMemory ?? 4) <= 2 || (input.cores ?? 4) <= 2) return 'low';
  if ((input.deviceMemory ?? 4) <= 4 || (input.cores ?? 4) <= 4) return 'medium';
  return 'high';
}

export function lowerQuality(value: Quality): Quality {
  return value === 'high' ? 'medium' : 'low';
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- tests/particles.test.ts tests/quality.test.ts`

Expected: all geometry and quality tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/particles.ts lib/quality.ts tests/particles.test.ts tests/quality.test.ts
git commit -m "feat: add echo-core particle geometry"
```

## Task 5: Build the persistent WebGL Echo Core

**Files:**
- Create: `components/experience/EchoCoreCanvas.tsx`
- Create: `tests/echo-core.test.tsx`

- [ ] **Step 1: Write the failing lifecycle test**

Stub only the browser WebGL boundary and assert the public component behavior:

```tsx
import { render } from '@testing-library/react';
import { EchoCoreCanvas } from '../components/experience/EchoCoreCanvas';

test('exposes one persistent labelled canvas', () => {
  const { rerender } = render(<EchoCoreCanvas scene="wake" growth={{ filaments: 0, petals: 0, currents: 0 }} />);
  const canvas = document.querySelector('canvas[aria-label="0523 回音星核动态视觉"]');
  expect(canvas).toBeInTheDocument();
  rerender(<EchoCoreCanvas scene="signal" growth={{ filaments: 1, petals: 1, currents: 1 }} />);
  expect(document.querySelectorAll('canvas')).toHaveLength(1);
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm test -- tests/echo-core.test.tsx`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement the canvas and renderer**

Implement one canvas ref, create `THREE.WebGLRenderer` once, and keep `uSceneProgress`, `uFilaments`, `uPetals`, `uCurrents`, `uPointer`, `uTilt`, and `uTime` uniforms. Use `BufferGeometry` target attributes from `lib/particles.ts`; the vertex shader must morph positions, apply pointer repulsion, add curl-like time displacement, and calculate point size by camera depth. Use additive translucent particles plus a separate `MeshPhysicalMaterial` core. On high and medium tiers add `EffectComposer` with `UnrealBloomPass`; on low tier render directly. Dispose geometry, materials, passes, renderer, listeners, and animation frame on unmount.

- [ ] **Step 4: Run test and verify GREEN**

Run: `npm test -- tests/echo-core.test.tsx`

Expected: one persistent canvas test passes.

- [ ] **Step 5: Verify visual behavior in the retained preview**

Expected: black space has real depth; pointer movement disturbs particles; changing growth props visibly changes three independent structures; resizing does not stretch the canvas.

- [ ] **Step 6: Commit**

```bash
git add components/experience/EchoCoreCanvas.tsx tests/echo-core.test.tsx
git commit -m "feat: render the interactive 0523 echo core"
```

## Task 6: Build the eight accessible interactive scenes

**Files:**
- Create: `components/experience/ScenePanel.tsx`
- Create: `components/experience/scenes.tsx`
- Create: `tests/scenes.test.tsx`

- [ ] **Step 1: Write failing behavior tests for key scenes**

Test the public scene contract:

```tsx
test('wake requires a completed three-second hold before continuing', () => {
  const onComplete = vi.fn();
  render(<WakeScene onComplete={onComplete} />);
  fireEvent.pointerDown(screen.getByRole('button', { name: '长按唤醒宇宙' }));
  vi.advanceTimersByTime(2999);
  expect(onComplete).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onComplete).toHaveBeenCalledOnce();
});

test('signal selection returns three distinct response types', async () => {
  const onResponse = vi.fn();
  render(<SignalScene onResponse={onResponse} onComplete={() => undefined} />);
  fireEvent.click(screen.getByRole('button', { name: '想吐槽一下' }));
  for (const label of ['认真追问', '偏爱夸奖', '站你这边']) {
    fireEvent.click(screen.getByRole('button', { name: label }));
  }
  expect(onResponse.mock.calls.map(([type]) => type).sort()).toEqual(['ally', 'compliment', 'curious']);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/scenes.test.tsx`

Expected: FAIL because the scene exports are missing.

- [ ] **Step 3: Implement all eight scene exports**

Implement `WakeScene`, `JealousyScene`, `ConfessionScene`, `PrivilegeScene`, `SignalScene`, `GameScene`, `NightScene`, and `FinaleScene` with one `onComplete` callback each. Add scene-specific contracts:

- Wake: pointer hold with cancellation on pointer-up/leave.
- Jealousy: horizontal scrub removes red noise and reveals `在意`.
- Confession: three rotary controls snap to `2026`, `05`, `23`.
- Privilege: three touches light the field and reveal the diary line.
- Signal: channel choice followed by the three response styles.
- Game: drag two light points through three gates, with immediate local reset on collision.
- Night: a sustained hold stabilizes two waveforms.
- Finale: live elapsed time, replay action, and supported-canvas save action.

Every scene must use actual confirmed copy from `lib/content.ts`, visible instructions, `aria-live` feedback, keyboard equivalents, and a clearly labelled retry where failure is possible.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- tests/scenes.test.tsx`

Expected: all scene behavior tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/experience/ScenePanel.tsx components/experience/scenes.tsx tests/scenes.test.tsx
git commit -m "feat: add eight interactive story scenes"
```

## Task 7: Add user-activated synthesized sound

**Files:**
- Create: `lib/audio.ts`
- Create: `components/experience/AudioEngine.tsx`
- Create: `tests/audio.test.ts`

- [ ] **Step 1: Write failing recipe tests**

```ts
import { audioRecipe } from '../lib/audio';

test('all sound recipes keep safe gain and positive duration', () => {
  for (const name of ['heartbeat', 'lock', 'reply', 'bloom'] as const) {
    const recipe = audioRecipe(name);
    expect(recipe.gain).toBeGreaterThan(0);
    expect(recipe.gain).toBeLessThanOrEqual(0.24);
    expect(recipe.duration).toBeGreaterThan(0);
    expect(recipe.frequency).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm test -- tests/audio.test.ts`

Expected: FAIL because `lib/audio.ts` is missing.

- [ ] **Step 3: Implement safe recipes and the engine**

Define exact recipes for `heartbeat`, `lock`, `reply`, and `bloom`, all at or below gain `0.24`. `AudioEngine` must create or resume `AudioContext` only after the user presses a labelled sound toggle. Schedule oscillators and filtered noise from recipes, suspend when the document becomes hidden, resume only if still enabled, and close/disconnect everything on unmount.

- [ ] **Step 4: Run test and verify GREEN**

Run: `npm test -- tests/audio.test.ts`

Expected: all recipe tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/audio.ts components/experience/AudioEngine.tsx tests/audio.test.ts
git commit -m "feat: add spatial synthesized audio"
```

## Task 8: Compose the complete experience and responsive art direction

**Files:**
- Create: `components/experience/EchoExperience.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `tests/experience-ui.test.tsx`

- [ ] **Step 1: Write the failing integration test**

```tsx
import { render, screen } from '@testing-library/react';
import { EchoExperience } from '../components/experience/EchoExperience';

test('renders a persistent visual layer, current scene, progress, and sound control', () => {
  render(<EchoExperience />);
  expect(screen.getByLabelText('0523 回音星核动态视觉')).toBeInTheDocument();
  expect(screen.getByText('01 / 08')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '开启声音' })).toBeInTheDocument();
  expect(screen.getByText('只有小宝贝能进入')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm test -- tests/experience-ui.test.tsx`

Expected: FAIL because `EchoExperience` is missing.

- [ ] **Step 3: Compose state, canvas, scenes, audio, and progress**

Use `useReducer(reduceExperience, undefined, createExperience)`. Keep `EchoCoreCanvas` mounted outside the keyed scene container. Dispatch `SCENE_COMPLETE` only from the active scene, enable the next control only after completion, and dispatch `RESPONSE_SELECTED` immediately from SignalScene. Add pointer and orientation listeners at the controller boundary and pass normalized values to the canvas.

- [ ] **Step 4: Apply mobile-first art direction**

In `app/globals.css`, implement:

- a true black full-viewport canvas using `100dvh` with safe-area padding;
- restrained white typography and cyan/purple/gold accents;
- UI occupying no more than the lower 32% during visual peaks;
- translucent controls with minimum 44px touch targets;
- scene enter/exit masks without generic card layouts;
- landscape and desktop adaptations;
- `prefers-reduced-motion` rules that remove large translation and flashing;
- `.quality-low` rules that disable expensive blur and glass effects.

- [ ] **Step 5: Update final metadata**

Use title `0523 回音星核｜给小宝贝的七夕礼物` and a concise description about a universe that responds to everything she wants to share. Remove starter metadata and `codex-preview` markers.

- [ ] **Step 6: Run integration and full tests**

Run: `npm test`

Expected: all tests pass with no warnings.

- [ ] **Step 7: Commit**

```bash
git add app components/experience tests/experience-ui.test.tsx
git commit -m "feat: compose the complete qixi experience"
```

## Task 9: Add and validate the social preview

**Files:**
- Create: `public/og.png`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Freeze the social-card brief**

Brief: 1200×630 landscape, near-black space, the finished translucent cyan-purple-gold Echo Core centered, a restrained `05·23` motif, title `0523 回音星核`, small line `给小宝贝的七夕礼物`, no roses, milk tea, stock hearts, browser chrome, or invented text.

- [ ] **Step 2: Generate exactly one cohesive card with ImageGen**

Inspect the output at original resolution. Retry once only if the required text is wrong or unusable.

- [ ] **Step 3: Save the accepted card and wire metadata**

Save as `public/og.png`. Build absolute Open Graph and X image URLs from the incoming request host. If no generated card passes text validation, omit the image metadata rather than shipping a generic fallback.

- [ ] **Step 4: Commit**

```bash
git add public/og.png app/layout.tsx
git commit -m "feat: add 0523 social preview"
```

## Task 10: Build, browser-test, optimize, and publish

**Files:**
- Modify only files required by failures found during verification.

- [ ] **Step 1: Run the production build**

Run: `npm run build`

Expected: exit 0 with Cloudflare Worker-compatible ESM output.

- [ ] **Step 2: Complete an explicit mobile browser QA pass**

Because the user explicitly requires reference-level visual quality, use the in-app browser to test the retained Local URL at a narrow mobile viewport. Complete all eight scenes once. Verify depth, morphing, pointer disturbance, response-driven growth, sound opt-in, progress, elapsed time, replay, and finale. Inspect at least one high-quality and one forced low-quality run.

- [ ] **Step 3: Measure and tune sustained rendering**

Record a rolling 120-frame average. If average frame time remains above 24ms for two windows, call `lowerQuality` once per window until stable. Confirm page backgrounding stops animation and audio.

- [ ] **Step 4: Re-run all automated verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass; build exits 0; no warnings from leaked listeners, WebGL resources, state updates, or missing metadata.

- [ ] **Step 5: Commit verification fixes**

```bash
git add app components lib tests public package.json package-lock.json
git commit -m "fix: polish and verify the 0523 experience"
```

- [ ] **Step 6: Publish with Sites hosting**

Follow the `sites-hosting` skill, return the deployed private URL as the primary deliverable, then stop the retained development server.

## Self-review result

- Spec coverage: all eleven design sections map to Tasks 2–10; the eight scenes map explicitly to Task 6.
- Placeholder scan: no deferred implementation placeholders are present.
- Type consistency: `SceneId`, `ResponseType`, `Growth`, `ExperienceState`, and event names are defined once in Task 2 and reused consistently.
- Scope: one single-route site with no persistence, accounts, uploads, external connectors, or personal-data collection.
