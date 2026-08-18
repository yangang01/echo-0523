import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EchoCoreCanvas } from "../components/experience/EchoCoreCanvas";
import {
  motionEnvelope,
  phaseTargetMode,
  TwinGravityCanvas,
} from "../components/experience/TwinGravityCanvas";
import type { MotionCue } from "../lib/scene-timelines";

const rendererState = vi.hoisted(() => ({ throws: false, constructs: 0, dispose: vi.fn() }));

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

      setPixelRatio() {}
      setClearColor() {}
      setSize() {}
      render() {}
      dispose() { rendererState.dispose(); }
      outputColorSpace = actual.SRGBColorSpace;
      toneMapping = actual.ACESFilmicToneMapping;
      toneMappingExposure = 1;
    },
  };
});

const growth = { filaments: 1, petals: 1, currents: 1 };
let priorWebGL: typeof globalThis.WebGLRenderingContext | undefined;

beforeEach(() => {
  priorWebGL = globalThis.WebGLRenderingContext;
  Object.defineProperty(globalThis, "WebGLRenderingContext", { configurable: true, value: class WebGLRenderingContext {} });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: true }),
  });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 17));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  rendererState.throws = false;
  rendererState.constructs = 0;
  rendererState.dispose.mockClear();
});

afterEach(() => {
  Object.defineProperty(globalThis, "WebGLRenderingContext", { configurable: true, value: priorWebGL });
  vi.unstubAllGlobals();
});

test("exposes one persistent labelled canvas", () => {
  const { rerender } = render(<EchoCoreCanvas scene="wake" growth={{ filaments: 0, petals: 0, currents: 0 }} finaleOpen={false} />);
  const canvas = document.querySelector('canvas[aria-label="0523 回音星核动态视觉"]');
  expect(canvas).toBeInTheDocument();
  expect(canvas).toHaveAttribute("data-sculpture", "wake");
  rerender(<EchoCoreCanvas scene="signal" growth={{ filaments: 1, petals: 1, currents: 1 }} finaleOpen={false} />);
  expect(document.querySelectorAll("canvas")).toHaveLength(1);
  expect(canvas).toHaveAttribute("data-sculpture", "signal");
});

test("keeps the finale sculpture dormant until the final echo opens", () => {
  const growth = { filaments: 1, petals: 1, currents: 1 };
  const { rerender } = render(<EchoCoreCanvas scene="finale" growth={growth} finaleOpen={false} />);
  const canvas = document.querySelector('canvas[aria-label="0523 回音星核动态视觉"]');

  expect(canvas).toHaveAttribute("data-sculpture", "wake");
  rerender(<EchoCoreCanvas scene="finale" growth={growth} finaleOpen />);
  expect(canvas).toHaveAttribute("data-sculpture", "finale");
});

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

test("twin-gravity source wires choreography, shader safety, visibility reset, and cleanup", () => {
  const source = readFileSync(resolve(process.cwd(), "components/experience/TwinGravityCanvas.tsx"), "utf8");

  for (const token of [
    "sceneGravityAnchors", "sceneParticleTargets", "sceneTimelines", "uPhase", "uGravityY", "uGravityU",
    "uShockwave", "uTrailEnergy", "document.hidden", "timer.reset(performance.now())", "removeEventListener(\"visibilitychange\"",
  ]) expect(source).toContain(token);
  expect(source).toMatch(/Math\.min\(delta,\s*1\s*\/\s*20\)/);
  expect(source).toContain("max(dot(toY, toY)");
  expect(source).toContain("max(dot(toU, toU)");
});
