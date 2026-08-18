import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as THREE from "three";
import {
  bakeMorphCoordinates,
  bakeMorphPosition,
  createQualityGovernor,
  dampTrailPositions,
  motionEnvelope,
  morphProgress,
  narrativeTrailTargets,
  phaseTargetMode,
  sceneVisualState,
  TwinGravityCanvas,
} from "../components/experience/TwinGravityCanvas";
import type { MotionCue } from "../lib/scene-timelines";
import { sceneParticleTargets } from "../lib/particles";

const rendererState = vi.hoisted(() => ({
  throws: false,
  setSizeThrows: false,
  constructs: 0,
  renderCount: 0,
  world: null as unknown,
  dispose: vi.fn(),
  pixelRatios: [] as number[],
}));
const rafState = { now: 0, nextId: 1, callbacks: new Map<number, FrameRequestCallback>() };
const postprocessState = vi.hoisted(() => ({ composerPixelRatios: [] as number[], composerDispose: 0, bloomDispose: 0 }));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: class WebGLRenderer {
      domElement: HTMLCanvasElement;

      constructor({ canvas }: { canvas: HTMLCanvasElement }) {
        if (rendererState.throws) throw new Error("no renderer");
        rendererState.constructs += 1;
        this.domElement = canvas;
      }

      setPixelRatio(value: number) { rendererState.pixelRatios.push(value); }
      setClearColor() {}
      setSize() {
        if (rendererState.setSizeThrows) throw new Error("resize failed");
      }
      render(world: unknown) {
        rendererState.world = world;
        rendererState.renderCount += 1;
      }
      dispose() { rendererState.dispose(); }
      outputColorSpace = actual.SRGBColorSpace;
      toneMapping = actual.ACESFilmicToneMapping;
      toneMappingExposure = 1;
    },
  };
});

vi.mock("three/examples/jsm/postprocessing/RenderPass.js", () => ({
  RenderPass: class RenderPass {
    constructor(public scene: unknown, public camera: unknown) {}
  },
}));

vi.mock("three/examples/jsm/postprocessing/UnrealBloomPass.js", () => ({
  UnrealBloomPass: class UnrealBloomPass {
    strength: number;
    enabled = true;
    constructor(_size: unknown, strength: number) { this.strength = strength; }
    dispose() { postprocessState.bloomDispose += 1; }
  },
}));

vi.mock("three/examples/jsm/postprocessing/EffectComposer.js", () => ({
  EffectComposer: class EffectComposer {
    passes: Array<{ scene?: unknown; camera?: unknown }> = [];
    constructor(private renderer: { render: (scene: unknown, camera: unknown) => void }) {}
    addPass(pass: { scene?: unknown; camera?: unknown }) { this.passes.push(pass); }
    setSize() {}
    setPixelRatio(value: number) { postprocessState.composerPixelRatios.push(value); }
    render() {
      const pass = this.passes.find(({ scene }) => scene);
      if (pass) this.renderer.render(pass.scene, pass.camera);
    }
    dispose() { postprocessState.composerDispose += 1; }
  },
}));

const growth = { filaments: 1, petals: 1, currents: 1 };
let priorWebGL: typeof globalThis.WebGLRenderingContext | undefined;

beforeEach(() => {
  priorWebGL = globalThis.WebGLRenderingContext;
  Object.defineProperty(globalThis, "WebGLRenderingContext", { configurable: true, value: class WebGLRenderingContext {} });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: true }),
  });
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  rafState.now = 0;
  rafState.nextId = 1;
  rafState.callbacks.clear();
  vi.spyOn(performance, "now").mockImplementation(() => rafState.now);
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    const id = rafState.nextId;
    rafState.nextId += 1;
    rafState.callbacks.set(id, callback);
    return id;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => { rafState.callbacks.delete(id); }));
  rendererState.throws = false;
  rendererState.setSizeThrows = false;
  rendererState.constructs = 0;
  rendererState.renderCount = 0;
  rendererState.world = null;
  rendererState.pixelRatios.length = 0;
  rendererState.dispose.mockClear();
  postprocessState.composerPixelRatios.length = 0;
  postprocessState.composerDispose = 0;
  postprocessState.bloomDispose = 0;
});

afterEach(() => {
  Object.defineProperty(globalThis, "WebGLRenderingContext", { configurable: true, value: priorWebGL });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function runFrame(deltaMs = 16) {
  const next = rafState.callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
  if (!next) throw new Error("No animation frame is scheduled");
  rafState.callbacks.delete(next[0]);
  rafState.now += deltaMs;
  act(() => next[1](rafState.now));
}

function particleState() {
  const world = rendererState.world as { children: Array<{ type: string; geometry: { drawRange: { count: number }; getAttribute: (name: string) => { array: Float32Array } }; material: { uniforms: Record<string, { value: number }> } }> };
  return world.children.find(({ type }) => type === "Points")!;
}

function useHighQuality() {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: false }) });
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
  Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 8 });
  Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 8 });
}

test("keeps one twin-gravity canvas and world identity across prop changes", () => {
  const { rerender } = render(<TwinGravityCanvas scene="wake" phase="present" growth={growth} />);
  const canvas = document.querySelector('canvas[aria-label="Y 与 U 双星引力动态视觉"]');

  expect(canvas).toHaveClass("echo-canvas");
  expect(canvas).toHaveAttribute("data-sculpture", "wake");
  expect(canvas).toHaveAttribute("data-phase", "present");
  rerender(<TwinGravityCanvas scene="jealousy" phase="exit" growth={growth} />);

  expect(document.querySelectorAll("canvas")).toHaveLength(1);
  expect(document.querySelector("canvas")).toBe(canvas);
  expect(canvas).toHaveAttribute("data-sculpture", "jealousy");
  expect(canvas).toHaveAttribute("data-phase", "exit");
  expect(rendererState.constructs).toBe(1);
});

test("renders an accessible YU emblem when WebGL is unavailable", () => {
  Object.defineProperty(globalThis, "WebGLRenderingContext", { configurable: true, value: undefined });
  render(<TwinGravityCanvas scene="wake" phase="enter" growth={growth} />);

  expect(document.querySelector("canvas")).not.toBeInTheDocument();
  expect(document.querySelector('[role="img"][aria-label="Y 融入 U 的双星星徽"]')).toBeInTheDocument();
});

test("falls back safely when renderer construction throws", async () => {
  rendererState.throws = true;
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(<TwinGravityCanvas scene="wake" phase="enter" growth={growth} />);

  await waitFor(() => expect(document.querySelector("canvas")).not.toBeInTheDocument());
  expect(document.querySelector('[role="img"][aria-label="Y 融入 U 的双星星徽"]')).toBeInTheDocument();
  view.unmount();
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
});

test("maps phases to stable particle target modes", () => {
  expect(phaseTargetMode("enter")).toBe("entry");
  expect(phaseTargetMode("present")).toBe("present");
  expect(phaseTargetMode("ready")).toBe("present");
  expect(phaseTargetMode("exit")).toBe("exit");
});

test("uses the shader smoothstep curve when baking an interrupted particle morph", () => {
  expect([0, 0.25, 0.5, 0.75, 1].map(morphProgress)).toEqual([0, 0.15625, 0.5, 0.84375, 1]);
  expect(morphProgress(0.25)).not.toBe(0.25);
  expect(bakeMorphPosition([0, 10, 20], [8, 18, 28], 0.25)).toEqual([1.25, 11.25, 21.25]);
});

test("bakes interrupted particle buffers in place with one eased scalar", () => {
  const source = new Float32Array([0, 10, 20, -8, 2, 6]);
  const target = new Float32Array([8, 18, 28, 0, 10, 14]);

  expect(bakeMorphCoordinates(source, target, 0.25)).toBe(source);
  expect(Array.from(source)).toEqual([1.25, 11.25, 21.25, -6.75, 3.25, 7.25]);
});

test("reuses cached scene anchors and envelopes without repeated objects", () => {
  const wake = sceneVisualState("wake", true);

  expect(sceneVisualState("wake", true)).toBe(wake);
  expect(sceneVisualState("wake", true).anchors).toBe(wake.anchors);
  expect(sceneVisualState("wake", true).envelope).toBe(wake.envelope);
  expect(wake.tint).toBeDefined();
  expect(sceneVisualState("wake", true).tint).toBe(wake.tint);
  expect(sceneVisualState("wake", false)).not.toBe(wake);
  expect(sceneVisualState("jealousy", true)).not.toBe(wake);
});

test("generates deterministic finite and distinct trail topology for every cue and side", () => {
  const cues: MotionCue[] = ["attract", "disrupt", "lock", "orbit", "reply", "tunnel", "sync", "infinity"];

  for (const side of [-1, 1] as const) {
    const targets = cues.map((cue) => narrativeTrailTargets(cue, side, 24));
    targets.forEach((target, index) => {
      expect(target).toHaveLength(24 * 3);
      expect(target.every(Number.isFinite)).toBe(true);
      expect(target).toEqual(narrativeTrailTargets(cues[index], side, 24));
    });
    expect(new Set(targets.map((target) => JSON.stringify(target))).size).toBe(cues.length);
  }
  expect(narrativeTrailTargets("attract", -1)).toHaveLength(96 * 3);
  expect(narrativeTrailTargets("attract", -1)).not.toEqual(narrativeTrailTargets("attract", 1));
});

test("damps persistent trail positions in place without recreating their storage", () => {
  const positions = new Float32Array([0, 10, -2]);
  const target = new Float32Array([10, 0, 2]);

  expect(dampTrailPositions(positions, target, 0.25)).toBe(positions);
  expect(Array.from(positions)).toEqual([2.5, 7.5, -1]);
});

test("defines a distinct envelope for every closed motion cue", () => {
  const cues: MotionCue[] = ["attract", "disrupt", "lock", "orbit", "reply", "tunnel", "sync", "infinity"];
  const envelopes = cues.map((cue) => motionEnvelope(cue));

  expect(new Set(envelopes.map((envelope) => JSON.stringify(envelope))).size).toBe(cues.length);
  envelopes.forEach((envelope) => {
    expect(envelope.cameraZ).toBeGreaterThan(0);
    expect(envelope.coreScale).toBeGreaterThan(0);
    expect(envelope.trailEnergy).toBeGreaterThanOrEqual(0);
  });
});

test("reduced motion removes shocks and fixes the camera envelope", () => {
  const cues: MotionCue[] = ["attract", "disrupt", "lock", "orbit", "reply", "tunnel", "sync", "infinity"];
  const envelopes = cues.map((cue) => motionEnvelope(cue, true));

  expect(envelopes.every(({ shockwave }) => shockwave === 0)).toBe(true);
  expect(new Set(envelopes.map(({ cameraZ }) => cameraZ)).size).toBe(1);
});

test("twin-gravity source wires choreography and shader safety", () => {
  const source = readFileSync(resolve(process.cwd(), "components/experience/TwinGravityCanvas.tsx"), "utf8");

  for (const token of [
    "sceneGravityAnchors", "sceneParticleTargets", "sceneTimelines", "uPhase", "uGravityY", "uGravityU",
    "uShockwave", "uTrailEnergy",
  ]) expect(source).toContain(token);
  expect(source).toMatch(/Math\.min\(delta,\s*1\s*\/\s*20\)/);
  expect(source).toContain("max(dot(toY, toY)");
  expect(source).toContain("max(dot(toU, toU)");
  expect(source).toContain("narrativeTrailTargets(currentMotion");
});

test("pauses RAF while hidden and resumes with hidden time discarded", () => {
  render(<TwinGravityCanvas scene="wake" phase="present" growth={growth} />);
  runFrame();
  expect(particleState().material.uniforms.uTime.value).toBeCloseTo(0.016);

  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(cancelAnimationFrame).toHaveBeenCalled();
  expect(rafState.callbacks.size).toBe(0);

  rafState.now = 60_000;
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(rafState.callbacks.size).toBe(1);
  runFrame();
  expect(particleState().material.uniforms.uTime.value).toBeCloseTo(0.032);
});

test("updates particle targets from live scene props without replacing the canvas", () => {
  const view = render(<TwinGravityCanvas scene="wake" phase="present" growth={growth} />);
  const canvas = document.querySelector("canvas");
  runFrame();

  view.rerender(<TwinGravityCanvas scene="jealousy" phase="exit" growth={growth} />);
  runFrame();
  const target = particleState().geometry.getAttribute("aTarget").array;
  const expected = new Float32Array(sceneParticleTargets("jealousy", 7000, "exit"));
  expect(Array.from(target.slice(0, 12))).toEqual(Array.from(expected.slice(0, 12)));
  expect(document.querySelector("canvas")).toBe(canvas);
  expect(rendererState.constructs).toBe(1);
});

test("normal unmount cancels animation, disposes, and removes every listener", () => {
  useHighQuality();
  const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
  const materialDispose = vi.spyOn(THREE.Material.prototype, "dispose");
  const windowRemove = vi.spyOn(window, "removeEventListener");
  const documentRemove = vi.spyOn(document, "removeEventListener");
  const view = render(<TwinGravityCanvas scene="wake" phase="present" growth={growth} />);
  const canvas = document.querySelector("canvas")!;
  const canvasRemove = vi.spyOn(canvas, "removeEventListener");

  view.unmount();
  expect(cancelAnimationFrame).toHaveBeenCalled();
  expect(rendererState.dispose).toHaveBeenCalledTimes(1);
  expect(geometryDispose).toHaveBeenCalledTimes(8);
  expect(materialDispose).toHaveBeenCalledTimes(8);
  expect(postprocessState.composerDispose).toBe(1);
  expect(postprocessState.bloomDispose).toBe(1);
  expect(windowRemove).toHaveBeenCalledWith("pointermove", expect.any(Function));
  expect(windowRemove).toHaveBeenCalledWith("deviceorientation", expect.any(Function));
  expect(windowRemove).toHaveBeenCalledWith("resize", expect.any(Function));
  expect(documentRemove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  expect(canvasRemove).toHaveBeenCalledWith("webglcontextlost", expect.any(Function));
  expect(canvasRemove).toHaveBeenCalledWith("webglcontextrestored", expect.any(Function));
});

test("context loss stops rendering and recovery resumes the same world once", () => {
  render(<TwinGravityCanvas scene="wake" phase="present" growth={growth} />);
  const canvas = document.querySelector("canvas")!;
  const lost = new Event("webglcontextlost", { cancelable: true });

  act(() => canvas.dispatchEvent(lost));
  expect(lost.defaultPrevented).toBe(true);
  expect(rafState.callbacks.size).toBe(0);
  expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);

  rafState.now = 30_000;
  act(() => canvas.dispatchEvent(new Event("webglcontextrestored")));
  expect(rafState.callbacks.size).toBe(1);
  expect(rendererState.constructs).toBe(1);
  runFrame();
  expect(particleState().material.uniforms.uTime.value).toBeCloseTo(0.016);
});

test("quality governor ignores isolated slow frames and requests one sustained downgrade", () => {
  const governor = createQualityGovernor("high", 3);

  expect(governor.sample(0.05)).toBeNull();
  expect(governor.sample(0.016)).toBeNull();
  expect(governor.sample(0.05)).toBeNull();
  expect(governor.sample(0.05)).toBeNull();
  expect(governor.sample(0.05)).toBe("medium");
  expect(governor.sample(0.05)).toBeNull();
  expect(governor.commit()).toBe("medium");
});

test("sustained slow frames downgrade in place only after the active morph stabilizes", () => {
  useHighQuality();
  const view = render(<TwinGravityCanvas scene="wake" phase="present" growth={growth} />);
  const canvas = document.querySelector("canvas");
  runFrame();
  view.rerender(<TwinGravityCanvas scene="jealousy" phase="exit" growth={growth} />);
  runFrame();
  const particles = particleState();
  const targetAttribute = particles.geometry.getAttribute("aTarget");
  const morphValues = [particles.material.uniforms.uMorph.value];

  for (let index = 0; index < 12; index += 1) {
    runFrame(50);
    morphValues.push(particles.material.uniforms.uMorph.value);
  }
  expect(particles.geometry.drawRange.count).toBe(32000);
  expect(morphValues.at(-1)).toBeLessThan(1);

  for (let index = 0; index < 4; index += 1) {
    runFrame(50);
    morphValues.push(particles.material.uniforms.uMorph.value);
  }
  expect(particles.geometry.drawRange.count).toBe(18000);
  expect(particles.geometry.getAttribute("aTarget")).toBe(targetAttribute);
  expect(morphValues.every((value, index) => index === 0 || value >= morphValues[index - 1])).toBe(true);
  expect(document.querySelector("canvas")).toBe(canvas);
  expect(rendererState.constructs).toBe(1);
  expect(rendererState.pixelRatios).toContain(1.35);
  expect(postprocessState.composerPixelRatios).toEqual([1.35]);

  for (let index = 0; index < 12; index += 1) runFrame(50);
  expect(particles.geometry.drawRange.count).toBe(7000);
  expect(postprocessState.composerPixelRatios).toEqual([1.35, 1]);
  expect(document.querySelector("canvas")).toBe(canvas);
  expect(rendererState.constructs).toBe(1);
});

test("one slow frame does not downgrade the active world", () => {
  useHighQuality();
  render(<TwinGravityCanvas scene="wake" phase="present" growth={growth} />);
  runFrame(50);
  for (let index = 0; index < 12; index += 1) runFrame(16);

  expect(particleState().geometry.drawRange.count).toBe(32000);
  expect(rendererState.constructs).toBe(1);
});

test("cleans every registered listener when initialization fails after registration", async () => {
  rendererState.setSizeThrows = true;
  const windowRemove = vi.spyOn(window, "removeEventListener");
  const documentRemove = vi.spyOn(document, "removeEventListener");
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(<TwinGravityCanvas scene="wake" phase="present" growth={growth} />);

  await waitFor(() => expect(document.querySelector('[role="img"][aria-label="Y 融入 U 的双星星徽"]')).toBeInTheDocument());
  expect(windowRemove).toHaveBeenCalledWith("pointermove", expect.any(Function));
  expect(windowRemove).toHaveBeenCalledWith("deviceorientation", expect.any(Function));
  expect(windowRemove).toHaveBeenCalledWith("resize", expect.any(Function));
  expect(documentRemove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

  view.unmount();
  const immediateUnmount = render(<TwinGravityCanvas scene="wake" phase="present" growth={growth} />);
  immediateUnmount.unmount();
  await act(async () => { await Promise.resolve(); });
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
  windowRemove.mockRestore();
  documentRemove.mockRestore();
});
