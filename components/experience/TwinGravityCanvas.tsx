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
import { initialQuality, qualityProfiles } from "../../lib/quality";
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

export function phaseTargetMode(phase: DirectorPhase): TargetMode {
  if (phase === "enter") return "entry";
  if (phase === "exit") return "exit";
  return "present";
}

export function motionEnvelope(cue: MotionCue, reducedMotion = false): MotionEnvelope {
  const envelope = motionEnvelopes[cue];
  if (!reducedMotion) return envelope;
  return { ...envelope, cameraZ: 6.9, cameraDrift: 0, shockwave: 0, spin: 0 };
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

function trailGeometry(side: -1 | 1) {
  const points = Array.from({ length: 96 }, (_, index) => {
    const t = index / 95;
    const angle = t * Math.PI * 2.4 + (side < 0 ? Math.PI : 0);
    const radius = 0.35 + t * 1.55;
    return new THREE.Vector3(side * 0.45 + Math.cos(angle) * radius, 0.18 + Math.sin(angle) * radius * 0.46, (t - 0.5) * side * 0.7);
  });
  return new THREE.BufferGeometry().setFromPoints(points);
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : 1.35));
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

      const initialAnchors = sceneGravityAnchors(liveRef.current.scene);
      const initialEnvelope = motionEnvelope(sceneTimelines[liveRef.current.scene].motion, reducedMotion);
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
        uSceneTint: { value: new THREE.Color(initialEnvelope.tint) },
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
        const geometry = trailGeometry(side);
        const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
        disposables.push(geometry, material);
        return new THREE.Line(geometry, material);
      };
      narrativeTrails.add(createTrail(-1, 0x50eeff), createTrail(1, 0xff58aa));
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
      yLight.position.copy(yCore.position).add(new THREE.Vector3(0, 0.8, 1.2));
      uLight.position.copy(uCore.position).add(new THREE.Vector3(0, 0.5, 1));
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
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("deviceorientation", onTilt, { passive: true });
      window.addEventListener("resize", resize);
      resize();

      const timer = createFrameTimer(performance.now());
      let activeScene = liveRef.current.scene;
      let activeMode = initialMode;
      let morph = 0;
      let shockwave = 0;
      let trailEnergy = initialEnvelope.trailEnergy;
      let energy = initialEnvelope.energy;
      let coreScale = initialEnvelope.coreScale;
      const targetY = new THREE.Vector3(...initialAnchors.y);
      const targetU = new THREE.Vector3(...initialAnchors.u);
      const desiredTint = new THREE.Color(initialEnvelope.tint);

      const renderFrame = () => {
        frame = null;
        if (disposed || document.hidden) return;
        const { delta, elapsed } = timer.tick(performance.now());
        const safeDelta = Math.min(delta, 1 / 20);
        const current = liveRef.current;
        const mode = phaseTargetMode(current.phase);
        if (current.scene !== activeScene || mode !== activeMode) {
          const positions = particleGeometry.getAttribute("position") as THREE.BufferAttribute;
          const destinations = particleGeometry.getAttribute("aTarget") as THREE.BufferAttribute;
          for (let index = 0; index < positions.count; index += 1) {
            positions.setXYZ(
              index,
              THREE.MathUtils.lerp(positions.getX(index), destinations.getX(index), morph),
              THREE.MathUtils.lerp(positions.getY(index), destinations.getY(index), morph),
              THREE.MathUtils.lerp(positions.getZ(index), destinations.getZ(index), morph),
            );
          }
          positions.needsUpdate = true;
          destinations.copyArray(sceneParticleTargets(current.scene, count, mode));
          destinations.needsUpdate = true;
          activeScene = current.scene;
          activeMode = mode;
          morph = 0;
        }

        const envelope = motionEnvelope(sceneTimelines[current.scene].motion, reducedMotion);
        const anchors = sceneGravityAnchors(current.scene);
        targetY.fromArray(anchors.y);
        targetU.fromArray(anchors.u);
        const morphRate = reducedMotion ? 2.5 : 1.35;
        morph = Math.min(1, morph + safeDelta * morphRate);
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
        desiredTint.set(envelope.tint);
        uniforms.uSceneTint.value.lerp(desiredTint, 1 - Math.exp(-2.4 * safeDelta));

        const gentlePulse = reducedMotion ? 0 : Math.sin(elapsed * 1.15) * 0.024;
        yCore.scale.setScalar(coreScale + gentlePulse);
        uCore.scale.setScalar(coreScale + gentlePulse * 0.82);
        yCore.rotation.y += safeDelta * envelope.spin;
        uCore.rotation.y -= safeDelta * envelope.spin * 0.88;
        yCore.rotation.x = reducedMotion ? 0 : Math.sin(elapsed * 0.3) * 0.08;
        uCore.rotation.x = reducedMotion ? 0 : Math.cos(elapsed * 0.27) * 0.08;
        yLight.position.copy(yCore.position).add(new THREE.Vector3(0, 0.8, 1.2));
        uLight.position.copy(uCore.position).add(new THREE.Vector3(0, 0.5, 1));

        narrativeTrails.children.forEach((child, index) => {
          const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
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
        if (bloomPass) bloomPass.strength = damp(bloomPass.strength, envelope.bloom * profile.bloomScale * (0.8 + energy * 0.2), 2.4, safeDelta);
        if (composer) composer.render();
        else renderer.render(world, camera);
        frame = requestAnimationFrame(renderFrame);
      };

      const startAnimation = () => {
        if (!disposed && !document.hidden && frame === null) frame = requestAnimationFrame(renderFrame);
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
      document.addEventListener("visibilitychange", onVisibility);
      startAnimation();

      return () => {
        mounted = false;
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("deviceorientation", onTilt);
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVisibility);
        disposeAll();
      };
    } catch {
      disposeAll();
      queueMicrotask(() => {
        if (mounted) setRendererFailed(true);
      });
      return () => {
        mounted = false;
        disposeAll();
      };
    }
  }, []);

  if (webglUnavailable || rendererFailed) return fallbackEmblem();
  return <canvas ref={canvasRef} className="echo-canvas" data-sculpture={scene} data-phase={phase} aria-label="Y 与 U 双星引力动态视觉" />;
}
