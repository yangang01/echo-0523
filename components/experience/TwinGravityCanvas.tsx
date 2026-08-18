"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { DirectorPhase } from "../../lib/director";
import type { Growth, SceneId } from "../../lib/experience";
import { createFrameTimer } from "../../lib/frame-timer";
import { sceneGravityAnchors, sceneParticleTargets, type TargetMode } from "../../lib/particles";
import { initialQuality, lowerQuality, qualityProfiles, type Quality } from "../../lib/quality";
import { sceneTimelines, type MotionCue } from "../../lib/scene-timelines";

type Props = { scene: SceneId; phase: DirectorPhase; growth: Growth };
type Disposable = { dispose: () => void };

export type MotionEnvelope = Readonly<{
  cameraZ: number;
  cameraDrift: number;
  shockwave: number;
  trailEnergy: number;
  bloom: number;
  energy: number;
  coreScale: number;
  spin: number;
  tint: string;
}>;

const motionEnvelopes = {
  attract: { cameraZ: 6.9, cameraDrift: 0.08, shockwave: 0.12, trailEnergy: 0.42, bloom: 0.92, energy: 0.3, coreScale: 0.86, spin: 0.12, tint: "#57ecff" },
  disrupt: { cameraZ: 6.05, cameraDrift: 0.19, shockwave: 0.72, trailEnergy: 0.92, bloom: 1.25, energy: 0.98, coreScale: 0.72, spin: 0.34, tint: "#ff438f" },
  lock: { cameraZ: 7.25, cameraDrift: 0.035, shockwave: 0.08, trailEnergy: 0.58, bloom: 1.04, energy: 0.5, coreScale: 0.94, spin: 0.07, tint: "#70eaff" },
  orbit: { cameraZ: 6.45, cameraDrift: 0.12, shockwave: 0.2, trailEnergy: 0.78, bloom: 1.16, energy: 0.68, coreScale: 0.82, spin: 0.2, tint: "#ff75d3" },
  reply: { cameraZ: 6.72, cameraDrift: 0.15, shockwave: 0.36, trailEnergy: 0.84, bloom: 1.08, energy: 0.75, coreScale: 0.77, spin: 0.16, tint: "#a476ff" },
  tunnel: { cameraZ: 5.45, cameraDrift: 0.24, shockwave: 0.54, trailEnergy: 1, bloom: 1.3, energy: 1, coreScale: 0.67, spin: 0.42, tint: "#50efff" },
  sync: { cameraZ: 7.55, cameraDrift: 0.025, shockwave: 0.04, trailEnergy: 0.52, bloom: 0.86, energy: 0.4, coreScale: 0.9, spin: 0.05, tint: "#849cff" },
  infinity: { cameraZ: 7.8, cameraDrift: 0.055, shockwave: 0.16, trailEnergy: 0.7, bloom: 1.36, energy: 0.82, coreScale: 1, spin: 0.09, tint: "#d8a0ff" },
} as const satisfies Readonly<Record<MotionCue, MotionEnvelope>>;

const reducedMotionEnvelopes = Object.fromEntries(
  (Object.keys(motionEnvelopes) as MotionCue[]).map((cue) => {
    const envelope = motionEnvelopes[cue];
    return [cue, Object.freeze({ ...envelope, cameraZ: 6.9, cameraDrift: 0, shockwave: 0, spin: 0 })];
  }),
) as Readonly<Record<MotionCue, MotionEnvelope>>;

export function phaseTargetMode(phase: DirectorPhase): TargetMode {
  if (phase === "enter") return "entry";
  if (phase === "exit") return "exit";
  return "present";
}

export function motionEnvelope(cue: MotionCue, reducedMotion = false): MotionEnvelope {
  return reducedMotion ? reducedMotionEnvelopes[cue] : motionEnvelopes[cue];
}

export type SceneVisualState = Readonly<{
  anchors: ReturnType<typeof sceneGravityAnchors>;
  motion: MotionCue;
  envelope: MotionEnvelope;
  tint: THREE.Color;
}>;

function createSceneVisualStates(reducedMotion: boolean): Readonly<Record<SceneId, SceneVisualState>> {
  return Object.fromEntries(
    (Object.keys(sceneTimelines) as SceneId[]).map((scene) => {
      const anchors = sceneGravityAnchors(scene);
      Object.freeze(anchors.y);
      Object.freeze(anchors.u);
      Object.freeze(anchors);
      const motion = sceneTimelines[scene].motion;
      const envelope = motionEnvelope(motion, reducedMotion);
      const tint = Object.freeze(new THREE.Color(envelope.tint)) as THREE.Color;
      return [scene, Object.freeze({ anchors, motion, envelope, tint })];
    }),
  ) as Readonly<Record<SceneId, SceneVisualState>>;
}

const standardSceneVisualStates = createSceneVisualStates(false);
const reducedSceneVisualStates = createSceneVisualStates(true);

export function sceneVisualState(scene: SceneId, reducedMotion = false): SceneVisualState {
  return (reducedMotion ? reducedSceneVisualStates : standardSceneVisualStates)[scene];
}

export function createQualityGovernor(initial: Quality, sustainedFrames = 12) {
  let current = initial;
  let pending: Quality | null = null;
  let slowFrames = 0;
  const threshold = Math.max(1, Math.floor(sustainedFrames));
  return {
    sample(delta: number): Quality | null {
      if (pending || current === "low") return null;
      slowFrames = delta >= 1 / 24 ? slowFrames + 1 : 0;
      if (slowFrames < threshold) return null;
      slowFrames = 0;
      const next = lowerQuality(current);
      if (next === current) return null;
      pending = next;
      return pending;
    },
    commit(): Quality {
      if (pending) current = pending;
      pending = null;
      return current;
    },
  };
}

export function morphProgress(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function bakeMorphPosition(
  source: readonly [number, number, number],
  target: readonly [number, number, number],
  morph: number,
): [number, number, number] {
  const progress = morphProgress(morph);
  return [
    THREE.MathUtils.lerp(source[0], target[0], progress),
    THREE.MathUtils.lerp(source[1], target[1], progress),
    THREE.MathUtils.lerp(source[2], target[2], progress),
  ];
}

export function bakeMorphCoordinates(current: Float32Array, target: Float32Array, morph: number): Float32Array {
  const progress = morphProgress(morph);
  const length = Math.min(current.length, target.length);
  for (let index = 0; index < length; index += 1) {
    current[index] = THREE.MathUtils.lerp(current[index], target[index], progress);
  }
  return current;
}

export function dampTrailPositions(current: Float32Array, target: Float32Array, alpha: number): Float32Array {
  const progress = THREE.MathUtils.clamp(alpha, 0, 1);
  const length = Math.min(current.length, target.length);
  for (let index = 0; index < length; index += 1) {
    current[index] = THREE.MathUtils.lerp(current[index], target[index], progress);
  }
  return current;
}

export function narrativeTrailTargets(cue: MotionCue, side: -1 | 1, count = 96): number[] {
  const size = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const values = new Array<number>(size * 3);
  for (let index = 0; index < size; index += 1) {
    const t = size <= 1 ? 0.5 : index / (size - 1);
    const angle = t * Math.PI * 2;
    let x: number;
    let y: number;
    let z: number;

    if (cue === "attract") {
      const spiral = angle * 2.4 + (side < 0 ? Math.PI : 0);
      const radius = 0.28 + t * 1.5;
      x = side * 0.45 + Math.cos(spiral) * radius;
      y = 0.18 + Math.sin(spiral) * radius * 0.46;
      z = (t - 0.5) * side * 0.72;
    } else if (cue === "disrupt") {
      const fracture = (index % 4 < 2 ? -1 : 1) * (0.12 + t * 0.18);
      x = side * (0.3 + t * 1.5) + fracture;
      y = Math.sin(angle * 4.5 + side) * (0.25 + t * 0.55) + fracture * side;
      z = Math.cos(angle * 6.5) * 0.38 + fracture;
    } else if (cue === "lock") {
      const ring = angle * 1.5;
      x = side * 0.72 + Math.cos(ring) * 0.64;
      y = Math.sin(ring) * 0.64;
      z = (t - 0.5) * 0.42 + side * 0.08;
    } else if (cue === "orbit") {
      const petal = 0.72 + Math.cos(angle * 5) * 0.3;
      x = side * 0.32 + Math.cos(angle) * petal;
      y = Math.sin(angle) * petal;
      z = Math.sin(angle * 5) * 0.24 * side;
    } else if (cue === "reply") {
      const branch = index % 3 - 1;
      x = side * (0.25 + t * 1.78);
      y = Math.sin(angle * 2.5 + side * 0.7) * (0.18 + t * 0.48) + branch * 0.08;
      z = branch * 0.22 + Math.cos(angle * 1.5) * 0.12;
    } else if (cue === "tunnel") {
      const helix = angle * 3.2 + side * Math.PI * 0.5;
      const radius = 0.86 - t * 0.32;
      x = side * 0.28 + Math.cos(helix) * radius;
      y = Math.sin(helix) * radius;
      z = (t - 0.5) * 3.2;
    } else if (cue === "sync") {
      x = (t - 0.5) * 3.3;
      y = side * 0.5 + Math.sin(angle * 2) * 0.11;
      z = side * 0.16 + Math.cos(angle * 2) * 0.07;
    } else if (side < 0) {
      if (t < 1 / 3) {
        const branch = t * 3;
        x = -1.25 + branch * 0.72;
        y = 1.1 - branch * 0.92;
      } else if (t < 2 / 3) {
        const branch = (t - 1 / 3) * 3;
        x = 0.62 - branch * 1.15;
        y = 1.1 - branch * 0.92;
      } else {
        const stem = (t - 2 / 3) * 3;
        x = -0.53;
        y = 0.18 - stem * 1.28;
      }
      z = Math.sin(angle * 2) * 0.08;
    } else {
      const bowl = Math.PI + t * Math.PI;
      x = 0.72 + Math.cos(bowl) * 0.72;
      y = 0.62 + Math.sin(bowl) * 1.55;
      z = Math.sin(angle * 2) * 0.08;
    }

    values[index * 3] = x;
    values[index * 3 + 1] = y;
    values[index * 3 + 2] = z;
  }
  return values;
}

const vertexShader = `
  uniform float uTime;
  uniform float uMorph;
  uniform float uEnergy;
  uniform float uPhase;
  uniform float uShockwave;
  uniform float uTrailEnergy;
  uniform float uFilaments;
  uniform float uPetals;
  uniform float uCurrents;
  uniform vec2 uPointer;
  uniform vec3 uGravityY;
  uniform vec3 uGravityU;
  uniform vec3 uSceneTint;
  attribute vec3 aTarget;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float morph = smoothstep(0.0, 1.0, uMorph);
    vec3 p = mix(position, aTarget, morph);
    vec3 toY = uGravityY - p;
    vec3 toU = uGravityU - p;
    float gravityPulse = 0.006 + uTrailEnergy * 0.008;
    p += toY * gravityPulse / max(dot(toY, toY), 0.12);
    p += toU * gravityPulse / max(dot(toU, toU), 0.12);
    float pulse = sin(uTime * (1.0 + uEnergy) + aSeed * 18.0) * (0.018 + uEnergy * 0.032);
    p *= 1.0 + pulse;
    p.x += sin(p.y * 4.0 + uTime * 1.4 + aSeed) * 0.024 * (1.0 + uFilaments * 0.18);
    p.y += cos(p.x * 5.0 - uTime * 1.15) * 0.02 * (1.0 + uPetals * 0.16);
    float radial = max(length(p.xy), 0.0001);
    p.z += sin(radial * 8.0 - uTime * 5.0 + aSeed * 2.0) * uShockwave * exp(-radial * 0.42) * 0.14;
    float spin = (uTime * 0.022 + uCurrents * 0.045) * (0.5 + uPhase * 0.18);
    mat2 rotation = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
    p.xz = rotation * p.xz;
    vec2 pointerDelta = p.xy - uPointer * 1.7;
    float pointerDistance = max(dot(pointerDelta, pointerDelta), 0.08);
    p.xy += pointerDelta * 0.018 / pointerDistance;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.6 + 4.0 * aSeed + uPetals * 0.48 + uEnergy * 0.55) * (7.0 / max(2.0, -mv.z));
    vColor = mix(aColor, uSceneTint, 0.15 + uEnergy * 0.1);
    vAlpha = 0.3 + 0.7 * aSeed;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float distanceToCenter = length(center);
    if (distanceToCenter > 0.5) discard;
    float glow = pow(1.0 - distanceToCenter * 2.0, 2.3);
    gl_FragColor = vec4(vColor * (1.12 + glow), glow * vAlpha);
  }
`;

function fallbackEmblem() {
  return (
    <svg role="img" aria-label="Y 融入 U 的双星星徽" viewBox="0 0 320 240" className="echo-canvas">
      <title>Y 融入 U 的双星星徽</title>
      <defs>
        <filter id="yu-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <path d="M72 44 L126 104 L126 184 M180 44 L126 104" fill="none" stroke="#52edff" strokeWidth="8" strokeLinecap="round" filter="url(#yu-glow)" />
      <path d="M184 62 V148 C184 196 264 196 264 148 V62" fill="none" stroke="#ff5daf" strokeWidth="8" strokeLinecap="round" filter="url(#yu-glow)" />
    </svg>
  );
}

function damp(current: number, target: number, lambda: number, delta: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * delta));
}

function ribbonGeometry(offset: number) {
  const points = Array.from({ length: 220 }, (_, index) => {
    const t = (index / 219) * Math.PI * 2;
    return new THREE.Vector3(Math.sin(t) * (2.05 + offset), Math.sin(t) * Math.cos(t) * (1.1 + offset * 0.5), Math.cos(t * 3) * 0.07 + offset * 0.35);
  });
  return new THREE.BufferGeometry().setFromPoints(points);
}

export function TwinGravityCanvas({ scene, phase, growth }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef({ scene, phase, growth });
  const [rendererFailed, setRendererFailed] = useState(false);
  const webglUnavailable = typeof WebGLRenderingContext === "undefined";

  useLayoutEffect(() => {
    liveRef.current = { scene, phase, growth };
  }, [growth, phase, scene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let mounted = true;
    let disposed = false;
    let frame: number | null = null;
    const disposables: Disposable[] = [];
    const listenerCleanups: Array<() => void> = [];
    let listenersCleaned = false;
    const registerListener = (
      target: Window | Document | HTMLCanvasElement,
      type: string,
      listener: EventListener,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, listener, options);
      listenerCleanups.push(() => target.removeEventListener(type, listener));
    };
    const cleanupListeners = () => {
      if (listenersCleaned) return;
      listenersCleaned = true;
      for (let index = listenerCleanups.length - 1; index >= 0; index -= 1) listenerCleanups[index]();
    };
    const disposeAll = () => {
      if (disposed) return;
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index].dispose();
    };

    try {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const nav = navigator as Navigator & { deviceMemory?: number };
      const quality = initialQuality({ deviceMemory: nav.deviceMemory, cores: navigator.hardwareConcurrency, reducedMotion });
      const profile = qualityProfiles[quality];
      const count = profile.particles;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === "high", alpha: true, powerPreference: "high-performance" });
      disposables.push(renderer);
      const pixelRatioFor = (tier: Quality) => Math.min(window.devicePixelRatio || 1, tier === "high" ? 2 : tier === "medium" ? 1.35 : 1);
      renderer.setPixelRatio(pixelRatioFor(quality));
      renderer.setClearColor(0x02030a, 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.14;

      const world = new THREE.Scene();
      world.fog = new THREE.FogExp2(0x03040b, 0.064);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
      camera.position.set(0, 0, 6.9);

      const initialMode = phaseTargetMode(liveRef.current.phase);
      const particleGeometry = new THREE.BufferGeometry();
      disposables.push(particleGeometry);
      const source = new Float32Array(sceneParticleTargets(liveRef.current.scene, count, "entry"));
      const target = new Float32Array(sceneParticleTargets(liveRef.current.scene, count, initialMode));
      const seeds = new Float32Array(count);
      const colors = new Float32Array(count * 3);
      const cyan = new THREE.Color("#50eeff");
      const violet = new THREE.Color("#966bff");
      const pink = new THREE.Color("#ff58aa");
      const palette = [cyan, violet, pink];
      for (let index = 0; index < count; index += 1) {
        const seed = ((index * 16807) % 2147483647) / 2147483647;
        seeds[index] = seed;
        const color = palette[index % palette.length].clone().lerp(palette[(index + 1) % palette.length], seed);
        colors.set([color.r, color.g, color.b], index * 3);
      }
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(source, 3));
      particleGeometry.setAttribute("aTarget", new THREE.BufferAttribute(target, 3));
      particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      particleGeometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
      particleGeometry.setDrawRange(0, profile.particles);

      const initialVisualState = sceneVisualState(liveRef.current.scene, reducedMotion);
      const initialAnchors = initialVisualState.anchors;
      const initialMotion = initialVisualState.motion;
      const initialEnvelope = initialVisualState.envelope;
      const uniforms = {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uEnergy: { value: initialEnvelope.energy },
        uPhase: { value: 0 },
        uShockwave: { value: 0 },
        uTrailEnergy: { value: initialEnvelope.trailEnergy },
        uFilaments: { value: 0 },
        uPetals: { value: 0 },
        uCurrents: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uGravityY: { value: new THREE.Vector3(...initialAnchors.y) },
        uGravityU: { value: new THREE.Vector3(...initialAnchors.u) },
        uSceneTint: { value: initialVisualState.tint.clone() },
      };
      const particleMaterial = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      disposables.push(particleMaterial);
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      world.add(particles);

      const createCore = (color: number, emissive: number) => {
        const geometry = new THREE.IcosahedronGeometry(0.48, profile.gravityCoreSegments);
        const material = new THREE.MeshPhysicalMaterial({
          color,
          emissive,
          emissiveIntensity: 1.4,
          roughness: 0.08,
          metalness: 0.06,
          transmission: 0.76,
          thickness: 1.5,
          iridescence: 1,
          transparent: true,
          opacity: 0.88,
        });
        disposables.push(geometry, material);
        return new THREE.Mesh(geometry, material);
      };
      const yCore = createCore(0x50eeff, 0x0b4e68);
      const uCore = createCore(0xff58aa, 0x661036);
      yCore.position.fromArray(initialAnchors.y);
      uCore.position.fromArray(initialAnchors.u);
      world.add(yCore, uCore);

      const narrativeTrails = new THREE.Group();
      const createTrail = (side: -1 | 1, color: number) => {
        const initialTargets = narrativeTrailTargets(initialMotion, side);
        const positions = new Float32Array(initialTargets);
        const geometry = new THREE.BufferGeometry();
        const positionAttribute = new THREE.BufferAttribute(positions, 3);
        geometry.setAttribute("position", positionAttribute);
        const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
        disposables.push(geometry, material);
        return {
          line: new THREE.Line(geometry, material),
          positionAttribute,
          positions,
          target: new Float32Array(initialTargets),
          side,
        };
      };
      const trailStates = [createTrail(-1, 0x50eeff), createTrail(1, 0xff58aa)];
      narrativeTrails.add(...trailStates.map(({ line }) => line));
      world.add(narrativeTrails);

      const infinityRibbons = new THREE.Group();
      [-0.1, 0, 0.1].forEach((offset, index) => {
        const geometry = ribbonGeometry(offset);
        const material = new THREE.LineBasicMaterial({
          color: [0x50eeff, 0xb477ff, 0xff58aa][index],
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        disposables.push(geometry, material);
        infinityRibbons.add(new THREE.LineLoop(geometry, material));
      });
      infinityRibbons.visible = false;
      world.add(infinityRibbons);

      world.add(new THREE.AmbientLight(0x707aff, 1.05));
      const yLight = new THREE.PointLight(0x50eeff, 15, 10);
      const uLight = new THREE.PointLight(0xff58aa, 14, 10);
      const yLightOffset = new THREE.Vector3(0, 0.8, 1.2);
      const uLightOffset = new THREE.Vector3(0, 0.5, 1);
      yLight.position.copy(yCore.position).add(yLightOffset);
      uLight.position.copy(uCore.position).add(uLightOffset);
      world.add(yLight, uLight);

      let composer: EffectComposer | null = null;
      let bloomPass: UnrealBloomPass | null = null;
      if (profile.bloomScale > 0) {
        composer = new EffectComposer(renderer);
        disposables.push(composer);
        composer.addPass(new RenderPass(world, camera));
        bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), initialEnvelope.bloom * profile.bloomScale, 0.68, 0.12);
        disposables.push(bloomPass);
        composer.addPass(bloomPass);
      }

      const pointer = new THREE.Vector2();
      const onPointer = (event: PointerEvent) => {
        pointer.set((event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1, -(event.clientY / Math.max(window.innerHeight, 1)) * 2 + 1);
      };
      const onTilt = (event: DeviceOrientationEvent) => {
        pointer.set(THREE.MathUtils.clamp((event.gamma ?? 0) / 38, -1, 1), THREE.MathUtils.clamp((event.beta ?? 0) / 58, -1, 1));
      };
      const resize = () => {
        const width = Math.max(1, canvas.clientWidth || window.innerWidth);
        const height = Math.max(1, canvas.clientHeight || window.innerHeight);
        renderer.setSize(width, height, false);
        composer?.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      const timer = createFrameTimer(performance.now());
      const qualityGovernor = createQualityGovernor(quality);
      let activeQuality = quality;
      let pendingQuality: Quality | null = null;
      let activeScene = liveRef.current.scene;
      let activeMode = initialMode;
      let activeTrailMotion = initialMotion;
      let activeVisualState = initialVisualState;
      let morph = 0;
      let shockwave = 0;
      let trailEnergy = initialEnvelope.trailEnergy;
      let energy = initialEnvelope.energy;
      let coreScale = initialEnvelope.coreScale;
      const targetY = new THREE.Vector3(...initialAnchors.y);
      const targetU = new THREE.Vector3(...initialAnchors.u);
      const desiredTint = initialVisualState.tint.clone();
      let contextLost = false;

      const renderFrame = () => {
        frame = null;
        if (disposed || document.hidden) return;
        const { delta, elapsed } = timer.tick(performance.now());
        const safeDelta = Math.min(delta, 1 / 20);
        pendingQuality ??= qualityGovernor.sample(delta);
        const current = liveRef.current;
        const mode = phaseTargetMode(current.phase);
        if (current.scene !== activeScene || mode !== activeMode) {
          const positions = particleGeometry.getAttribute("position") as THREE.BufferAttribute;
          const destinations = particleGeometry.getAttribute("aTarget") as THREE.BufferAttribute;
          bakeMorphCoordinates(positions.array as Float32Array, destinations.array as Float32Array, morph);
          positions.needsUpdate = true;
          destinations.copyArray(sceneParticleTargets(current.scene, count, mode));
          destinations.needsUpdate = true;
          if (current.scene !== activeScene) {
            activeVisualState = sceneVisualState(current.scene, reducedMotion);
            desiredTint.copy(activeVisualState.tint);
          }
          activeScene = current.scene;
          activeMode = mode;
          morph = 0;
        }

        const currentMotion = activeVisualState.motion;
        if (currentMotion !== activeTrailMotion) {
          trailStates.forEach((trail) => {
            trail.target.set(narrativeTrailTargets(currentMotion, trail.side));
          });
          activeTrailMotion = currentMotion;
        }

        const envelope = activeVisualState.envelope;
        const anchors = activeVisualState.anchors;
        targetY.fromArray(anchors.y);
        targetU.fromArray(anchors.u);
        const morphRate = reducedMotion ? 2.5 : 1.35;
        morph = Math.min(1, morph + safeDelta * morphRate);
        if (pendingQuality && morph >= 1) {
          activeQuality = pendingQuality;
          const activeProfile = qualityProfiles[activeQuality];
          particleGeometry.setDrawRange(0, Math.min(count, activeProfile.particles));
          const nextPixelRatio = pixelRatioFor(activeQuality);
          renderer.setPixelRatio(nextPixelRatio);
          composer?.setPixelRatio(nextPixelRatio);
          if (bloomPass) bloomPass.enabled = activeProfile.bloomScale > 0;
          resize();
          qualityGovernor.commit();
          pendingQuality = null;
        }
        shockwave = damp(shockwave, envelope.shockwave, 4.2, safeDelta);
        trailEnergy = damp(trailEnergy, envelope.trailEnergy, 3.2, safeDelta);
        energy = damp(energy, envelope.energy, 2.8, safeDelta);
        coreScale = damp(coreScale, envelope.coreScale, 2.5, safeDelta);
        yCore.position.lerp(targetY, 1 - Math.exp(-3.4 * safeDelta));
        uCore.position.lerp(targetU, 1 - Math.exp(-3.4 * safeDelta));

        uniforms.uTime.value = elapsed;
        uniforms.uMorph.value = morph;
        uniforms.uEnergy.value = energy;
        uniforms.uPhase.value = current.phase === "enter" ? 0 : current.phase === "present" ? 1 : current.phase === "ready" ? 2 : 3;
        uniforms.uShockwave.value = reducedMotion ? 0 : shockwave;
        uniforms.uTrailEnergy.value = trailEnergy;
        uniforms.uFilaments.value = damp(uniforms.uFilaments.value, current.growth.filaments, 3, safeDelta);
        uniforms.uPetals.value = damp(uniforms.uPetals.value, current.growth.petals, 3, safeDelta);
        uniforms.uCurrents.value = damp(uniforms.uCurrents.value, current.growth.currents, 3, safeDelta);
        uniforms.uPointer.value.lerp(pointer, 1 - Math.exp(-2.5 * safeDelta));
        uniforms.uGravityY.value.copy(yCore.position);
        uniforms.uGravityU.value.copy(uCore.position);
        uniforms.uSceneTint.value.lerp(desiredTint, 1 - Math.exp(-2.4 * safeDelta));

        const gentlePulse = reducedMotion ? 0 : Math.sin(elapsed * 1.15) * 0.024;
        yCore.scale.setScalar(coreScale + gentlePulse);
        uCore.scale.setScalar(coreScale + gentlePulse * 0.82);
        yCore.rotation.y += safeDelta * envelope.spin;
        uCore.rotation.y -= safeDelta * envelope.spin * 0.88;
        yCore.rotation.x = reducedMotion ? 0 : Math.sin(elapsed * 0.3) * 0.08;
        uCore.rotation.x = reducedMotion ? 0 : Math.cos(elapsed * 0.27) * 0.08;
        yLight.position.copy(yCore.position).add(yLightOffset);
        uLight.position.copy(uCore.position).add(uLightOffset);

        const trailDamping = 1 - Math.exp(-3.1 * safeDelta);
        trailStates.forEach((trail, index) => {
          dampTrailPositions(trail.positions, trail.target, trailDamping);
          trail.positionAttribute.needsUpdate = true;
          const material = trail.line.material as THREE.LineBasicMaterial;
          material.opacity = (0.2 + index * 0.08) * trailEnergy;
        });
        narrativeTrails.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 0.22) * 0.08 * trailEnergy;
        narrativeTrails.rotation.y = reducedMotion ? 0 : elapsed * envelope.spin * 0.12;
        infinityRibbons.visible = current.scene === "finale" && (current.phase === "present" || current.phase === "ready");
        infinityRibbons.children.forEach((child, index) => {
          ((child as THREE.Line).material as THREE.LineBasicMaterial).opacity = infinityRibbons.visible ? 0.32 + index * 0.11 : 0;
        });
        infinityRibbons.rotation.y = reducedMotion ? 0 : elapsed * 0.035;

        camera.position.z = damp(camera.position.z, envelope.cameraZ, 1.7, safeDelta);
        camera.position.x = reducedMotion ? 0 : damp(camera.position.x, pointer.x * 0.12 + Math.sin(elapsed * 0.16) * envelope.cameraDrift, 1.8, safeDelta);
        camera.position.y = reducedMotion ? 0 : damp(camera.position.y, pointer.y * 0.08 + Math.cos(elapsed * 0.13) * envelope.cameraDrift * 0.45, 1.8, safeDelta);
        camera.lookAt(0, 0, 0);
        if (bloomPass) {
          const bloomScale = qualityProfiles[activeQuality].bloomScale;
          bloomPass.strength = damp(bloomPass.strength, envelope.bloom * bloomScale * (0.8 + energy * 0.2), 2.4, safeDelta);
        }
        if (composer) composer.render();
        else renderer.render(world, camera);
        frame = requestAnimationFrame(renderFrame);
      };

      const startAnimation = () => {
        if (!disposed && !document.hidden && !contextLost && frame === null) frame = requestAnimationFrame(renderFrame);
      };
      const onVisibility = () => {
        if (document.hidden) {
          if (frame !== null) cancelAnimationFrame(frame);
          frame = null;
          return;
        }
        timer.reset(performance.now());
        startAnimation();
      };
      const onContextLost = (event: Event) => {
        event.preventDefault();
        contextLost = true;
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
      };
      const onContextRestored = () => {
        if (!contextLost) return;
        contextLost = false;
        timer.reset(performance.now());
        startAnimation();
      };
      registerListener(window, "pointermove", onPointer as EventListener, { passive: true });
      registerListener(window, "deviceorientation", onTilt as EventListener, { passive: true });
      registerListener(window, "resize", resize as EventListener);
      registerListener(document, "visibilitychange", onVisibility as EventListener);
      registerListener(canvas, "webglcontextlost", onContextLost as EventListener);
      registerListener(canvas, "webglcontextrestored", onContextRestored as EventListener);
      resize();
      startAnimation();

      return () => {
        mounted = false;
        cleanupListeners();
        disposeAll();
      };
    } catch {
      cleanupListeners();
      disposeAll();
      queueMicrotask(() => {
        if (mounted) setRendererFailed(true);
      });
      return () => {
        mounted = false;
        cleanupListeners();
        disposeAll();
      };
    }
  }, []);

  if (webglUnavailable || rendererFailed) return fallbackEmblem();
  return <canvas ref={canvasRef} className="echo-canvas" data-sculpture={scene} data-phase={phase} aria-label="Y 与 U 双星引力动态视觉" />;
}
