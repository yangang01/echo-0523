"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Growth, SceneId } from "../../lib/experience";
import { createFrameTimer } from "../../lib/frame-timer";
import { echoCoreTargets, infinityTargets, scatterTargets } from "../../lib/particles";
import { initialQuality, particleBudget } from "../../lib/quality";

type Props = { scene: SceneId; growth: Growth };

const vertexShader = `
  uniform float uTime;
  uniform float uBirth;
  uniform float uFinale;
  uniform float uFilaments;
  uniform float uPetals;
  uniform float uCurrents;
  uniform vec2 uPointer;
  attribute vec3 aTarget;
  attribute vec3 aInfinity;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float easeBirth = smoothstep(0.0, 1.0, uBirth);
    vec3 p = mix(position, aTarget, easeBirth);
    p = mix(p, aInfinity, smoothstep(0.0, 1.0, uFinale));
    float pulse = sin(uTime * 1.15 + aSeed * 18.0) * 0.045;
    p *= 1.0 + pulse;
    p.x += sin(p.y * 4.0 + uTime * 1.6 + aSeed) * 0.035 * (1.0 + uFilaments * .22);
    p.y += cos(p.x * 5.0 - uTime * 1.3) * 0.026 * (1.0 + uPetals * .18);
    float spin = uCurrents * .08 + uTime * .035;
    mat2 rotation = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
    p.xz = rotation * p.xz;
    vec2 delta = p.xy - uPointer * 1.8;
    p.xy += normalize(delta + .0001) * .08 / (1.0 + dot(delta, delta) * 8.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = mix(2.0 + 4.0 * aSeed + uPetals * .55, 1.2 + 2.2 * aSeed, uFinale) * (7.0 / max(2.0, -mv.z));
    vColor = aColor;
    vAlpha = .32 + .68 * aSeed;
  }
`;

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

export function EchoCoreCanvas({ scene, growth }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef({ scene, growth });
  liveRef.current = { scene, growth };

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

    const world = new THREE.Scene();
    world.fog = new THREE.FogExp2(0x03040b, 0.065);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(0, 0, 7);

    const geometry = new THREE.BufferGeometry();
    const scattered = new Float32Array(scatterTargets(count));
    const target = new Float32Array(echoCoreTargets(count));
    const infinity = new Float32Array(infinityTargets(count));
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
    geometry.setAttribute("aInfinity", new THREE.BufferAttribute(infinity, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

    const uniforms = {
      uTime: { value: 0 }, uBirth: { value: 0 }, uFinale: { value: 0 },
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
    let birth = 0;
    let finale = 0;
    const render = () => {
      const { delta, elapsed } = timer.tick(performance.now());
      const current = liveRef.current;
      birth = THREE.MathUtils.lerp(birth, current.scene === "wake" ? 0.18 : 1, delta * 1.6);
      finale = THREE.MathUtils.lerp(finale, current.scene === "finale" ? 1 : 0, delta * 0.85);
      uniforms.uTime.value = elapsed;
      uniforms.uBirth.value = birth;
      uniforms.uFinale.value = finale;
      uniforms.uFilaments.value = THREE.MathUtils.lerp(uniforms.uFilaments.value, current.growth.filaments, delta * 3);
      uniforms.uPetals.value = THREE.MathUtils.lerp(uniforms.uPetals.value, current.growth.petals, delta * 3);
      uniforms.uCurrents.value = THREE.MathUtils.lerp(uniforms.uCurrents.value, current.growth.currents, delta * 3);
      uniforms.uPointer.value.lerp(pointer, delta * 2.8);
      particles.rotation.y = elapsed * 0.045 + pointer.x * 0.12;
      particles.rotation.x = pointer.y * 0.08;
      core.rotation.y = elapsed * 0.18;
      core.rotation.x = elapsed * 0.11;
      core.scale.setScalar(0.72 + birth * 0.28 + Math.sin(elapsed * 1.3) * 0.025);
      (core.material as THREE.MeshPhysicalMaterial).opacity = 0.82 - finale * 0.62;
      rings.rotation.y = -elapsed * 0.07;
      rings.rotation.z = elapsed * 0.035;
      composer ? composer.render() : renderer.render(world, camera);
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
      composer?.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="echo-canvas" aria-label="0523 回音星核动态视觉" />;
}
