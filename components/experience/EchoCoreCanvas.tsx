"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Growth, SceneId } from "../../lib/experience";
import { createFrameTimer } from "../../lib/frame-timer";
import { scatterTargets, sceneParticleTargets, sceneRotationY, sceneSpinFactor } from "../../lib/particles";
import { initialQuality, particleBudget } from "../../lib/quality";

type Props = { scene: SceneId; growth: Growth; finaleOpen: boolean };

const vertexShader = `
  uniform float uTime;
  uniform float uMorph;
  uniform float uEnergy;
  uniform float uSpinFactor;
  uniform float uFilaments;
  uniform float uPetals;
  uniform float uCurrents;
  uniform vec2 uPointer;
  attribute vec3 aTarget;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float morph = smoothstep(0.0, 1.0, uMorph);
    vec3 p = mix(position, aTarget, morph);
    float pulse = sin(uTime * (1.0 + uEnergy) + aSeed * 18.0) * (0.026 + uEnergy * 0.035);
    p *= 1.0 + pulse;
    p.x += sin(p.y * 4.0 + uTime * 1.6 + aSeed) * 0.035 * (1.0 + uFilaments * .22);
    p.y += cos(p.x * 5.0 - uTime * 1.3) * 0.026 * (1.0 + uPetals * .18);
    float spin = (uCurrents * .08 + uTime * .035) * uSpinFactor;
    mat2 rotation = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
    p.xz = rotation * p.xz;
    vec2 delta = p.xy - uPointer * 1.8;
    p.xy += normalize(delta + .0001) * .08 / (1.0 + dot(delta, delta) * 8.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.7 + 4.2 * aSeed + uPetals * .55 + uEnergy * .6) * (7.0 / max(2.0, -mv.z));
    vColor = aColor;
    vAlpha = .32 + .68 * aSeed;
  }
`;

const sceneStyle: Record<SceneId, { tint: string; camera: number; core: number; glass: number; rings: number; infinity: number; energy: number }> = {
  wake: { tint: "#5beeff", camera: 6.5, core: .72, glass: .84, rings: .28, infinity: 0, energy: .18 },
  jealousy: { tint: "#ff3d88", camera: 6.1, core: .46, glass: .42, rings: .08, infinity: 0, energy: .95 },
  confession: { tint: "#72efff", camera: 6.8, core: .66, glass: .74, rings: 1, infinity: 0, energy: .44 },
  privilege: { tint: "#ff72d2", camera: 6.35, core: .54, glass: .68, rings: .2, infinity: 0, energy: .62 },
  signal: { tint: "#b385ff", camera: 6.6, core: .48, glass: .58, rings: .12, infinity: 0, energy: .72 },
  game: { tint: "#53f0ff", camera: 5.25, core: .28, glass: .24, rings: .05, infinity: 0, energy: 1 },
  night: { tint: "#8297ff", camera: 7.2, core: .38, glass: .38, rings: .06, infinity: 0, energy: .34 },
  finale: { tint: "#d89bff", camera: 7.35, core: .82, glass: .88, rings: .46, infinity: 1, energy: .68 },
};

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 center = gl_PointCoord - .5;
    float distanceToCenter = length(center);
    if (distanceToCenter > .5) discard;
    float glow = pow(1.0 - distanceToCenter * 2.0, 2.4);
    gl_FragColor = vec4(vColor * (1.15 + glow), glow * vAlpha);
  }
`;

export function EchoCoreCanvas({ scene, growth, finaleOpen }: Props) {
  const renderScene: SceneId = scene === "finale" && !finaleOpen ? "wake" : scene;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef({ scene: renderScene, growth });
  useEffect(() => { liveRef.current = { scene: renderScene, growth }; }, [growth, renderScene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof WebGLRenderingContext === "undefined") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const quality = initialQuality({ deviceMemory: nav.deviceMemory, cores: navigator.hardwareConcurrency, reducedMotion });
    const count = particleBudget[quality];
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === "high", alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === "high" ? 2 : 1.25));
    renderer.setClearColor(0x02030a, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    const world = new THREE.Scene();
    world.fog = new THREE.FogExp2(0x03040b, 0.065);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(0, 0, 7);

    const geometry = new THREE.BufferGeometry();
    const scattered = new Float32Array(scatterTargets(count));
    const target = new Float32Array(sceneParticleTargets("wake", count));
    const seeds = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color("#4ef2ff"), new THREE.Color("#8e63ff"), new THREE.Color("#ff4faf"), new THREE.Color("#ffd17a")];
    for (let i = 0; i < count; i += 1) {
      seeds[i] = ((i * 16807) % 2147483647) / 2147483647;
      const color = palette[i % palette.length].clone().lerp(palette[(i + 1) % palette.length], seeds[i]);
      colors.set([color.r, color.g, color.b], i * 3);
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(scattered, 3));
    geometry.setAttribute("aTarget", new THREE.BufferAttribute(target, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

    const uniforms = {
      uTime: { value: 0 }, uMorph: { value: 0 }, uEnergy: { value: sceneStyle.wake.energy }, uSpinFactor: { value: 1 },
      uFilaments: { value: 0 }, uPetals: { value: 0 }, uCurrents: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
    };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(geometry, material);
    world.add(particles);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.56, 5),
      new THREE.MeshPhysicalMaterial({ color: 0x8c5dff, emissive: 0x190a42, roughness: 0.08, metalness: 0.08, transmission: 0.78, thickness: 1.8, iridescence: 1, transparent: true, opacity: 0.82 }),
    );
    world.add(core);
    const rings = new THREE.Group();
    [0.92, 1.18, 1.48].forEach((radius, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.007 + index * 0.004, 10, 180), new THREE.MeshBasicMaterial({ color: [0x4ef2ff, 0xa86cff, 0xff5daf][index], transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
      ring.rotation.set(index * 0.78, index * 0.92, index * 0.36);
      rings.add(ring);
    });
    world.add(rings);
    const infinityRibbons = new THREE.Group();
    [0, 1, 2].forEach((strand) => {
      const points = Array.from({ length: 360 }, (_, index) => {
        const t = (index / 360) * Math.PI * 2;
        const offset = (strand - 1) * 0.09;
        return new THREE.Vector3(Math.sin(t) * (2.12 + offset), Math.sin(t) * Math.cos(t) * (1.18 + offset), Math.cos(t * 3 + strand) * 0.08 + offset);
      });
      const ribbon = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: [0x5ceeff, 0xbf6dff, 0xffcb82][strand], transparent: true, opacity: 0, blending: THREE.AdditiveBlending }),
      );
      infinityRibbons.add(ribbon);
    });
    world.add(infinityRibbons);
    world.add(new THREE.AmbientLight(0x6b75ff, 1.1));
    const light = new THREE.PointLight(0x63eeff, 18, 12);
    light.position.set(2, 2, 3);
    world.add(light);

    const composer = quality === "low" ? null : new EffectComposer(renderer);
    if (composer) {
      composer.addPass(new RenderPass(world, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), quality === "high" ? 1.35 : 0.9, 0.72, 0.12));
    }

    const pointer = new THREE.Vector2();
    const onPointer = (event: PointerEvent) => {
      pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    };
    const onTilt = (event: DeviceOrientationEvent) => {
      pointer.x = THREE.MathUtils.clamp((event.gamma ?? 0) / 35, -1, 1);
      pointer.y = THREE.MathUtils.clamp((event.beta ?? 0) / 55, -1, 1);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("deviceorientation", onTilt, { passive: true });

    const resize = () => {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      composer?.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const timer = createFrameTimer(performance.now());
    let frame = 0;
    let morph = 0;
    let activeScene: SceneId = "wake";
    const tint = new THREE.Color(sceneStyle.wake.tint);
    const desiredTint = new THREE.Color(sceneStyle.wake.tint);
    const render = () => {
      const { delta, elapsed } = timer.tick(performance.now());
      const current = liveRef.current;
      if (current.scene !== activeScene) {
        const source = geometry.getAttribute("position") as THREE.BufferAttribute;
        const destination = geometry.getAttribute("aTarget") as THREE.BufferAttribute;
        for (let index = 0; index < source.count; index += 1) {
          source.setXYZ(index,
            THREE.MathUtils.lerp(source.getX(index), destination.getX(index), morph),
            THREE.MathUtils.lerp(source.getY(index), destination.getY(index), morph),
            THREE.MathUtils.lerp(source.getZ(index), destination.getZ(index), morph),
          );
        }
        source.needsUpdate = true;
        destination.copyArray(sceneParticleTargets(current.scene, count));
        destination.needsUpdate = true;
        activeScene = current.scene;
        morph = 0;
      }
      const style = sceneStyle[current.scene];
      morph = Math.min(1, morph + delta * .62);
      uniforms.uTime.value = elapsed;
      uniforms.uMorph.value = morph;
      uniforms.uSpinFactor.value = sceneSpinFactor(current.scene);
      uniforms.uEnergy.value = THREE.MathUtils.lerp(uniforms.uEnergy.value, style.energy, delta * 2.4);
      uniforms.uFilaments.value = THREE.MathUtils.lerp(uniforms.uFilaments.value, current.growth.filaments, delta * 3);
      uniforms.uPetals.value = THREE.MathUtils.lerp(uniforms.uPetals.value, current.growth.petals, delta * 3);
      uniforms.uCurrents.value = THREE.MathUtils.lerp(uniforms.uCurrents.value, current.growth.currents, delta * 3);
      uniforms.uPointer.value.lerp(pointer, delta * 2.8);
      desiredTint.set(style.tint);
      tint.lerp(desiredTint, delta * 2.2);
      particles.rotation.y = sceneRotationY(current.scene, elapsed, pointer.x);
      particles.rotation.x = pointer.y * 0.08 + (current.scene === "game" ? .18 : 0);
      core.rotation.y = elapsed * 0.18;
      core.rotation.x = elapsed * 0.11;
      core.scale.setScalar(style.core + Math.sin(elapsed * 1.3) * 0.025);
      const coreMaterial = core.material as THREE.MeshPhysicalMaterial;
      coreMaterial.opacity = THREE.MathUtils.lerp(coreMaterial.opacity, style.glass, delta * 2.2);
      coreMaterial.color.lerp(tint, delta * 1.8);
      rings.children.forEach((object) => { ((object as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = style.rings * .58; });
      rings.rotation.y = -elapsed * 0.07;
      rings.rotation.z = elapsed * 0.035;
      infinityRibbons.visible = style.infinity > .01;
      infinityRibbons.children.forEach((object, index) => {
        ((object as THREE.Line).material as THREE.LineBasicMaterial).opacity = style.infinity * (.38 + index * .12);
      });
      infinityRibbons.rotation.y = pointer.x * .08;
      infinityRibbons.scale.setScalar(.94 + Math.sin(elapsed * .9) * .018);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, style.camera, delta * 1.5);
      if (composer) composer.render();
      else renderer.render(world, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      core.geometry.dispose();
      (core.material as THREE.Material).dispose();
      rings.traverse((object) => {
        if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
      });
      infinityRibbons.traverse((object) => {
        if (object instanceof THREE.Line) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
      });
      composer?.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="echo-canvas" data-sculpture={renderScene} aria-label="0523 回音星核动态视觉" />;
}
