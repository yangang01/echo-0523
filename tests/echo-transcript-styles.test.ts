import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

function nestedBlock(source: string, opener: string) {
  const start = source.indexOf(opener);
  if (start < 0) return "";
  const open = source.indexOf("{", start + opener.length);
  if (open < 0) return "";
  let depth = 1;
  for (let index = open + 1; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  return "";
}

function ruleFor(selector: string, source = css) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
}

function lastRuleFor(selector: string, source = css) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rules = [...source.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "gs"))];
  return rules.at(-1)?.[1] ?? "";
}

function mediaFor(condition: string) {
  return nestedBlock(css, `@media (${condition})`);
}

function keyframesFor(name: string) {
  return nestedBlock(css, `@keyframes ${name}`);
}

const sceneIds = ["wake", "jealousy", "confession", "privilege", "signal", "game", "night", "finale"] as const;

function expectDeclaration(rule: string, property: string, value: RegExp) {
  expect(rule, `missing ${property}`).toMatch(new RegExp(`${property}:\\s*${value.source}`));
}

function numericPxDeclaration(rule: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = rule.match(new RegExp(`(?:^|;)\\s*${escaped}:\\s*([\\d.]+)px(?:\\s*;|$)`))?.[1];
  return value === undefined ? null : Number(value);
}

test("renders the transcript as a compact cinematic glass panel", () => {
  const transcript = ruleFor(".echo-transcript");

  expect(transcript).toMatch(/width:\s*min\(430px,\s*100%\)/);
  expect(transcript).toMatch(/min-height:\s*92px/);
  expectDeclaration(transcript, "max-height", /none/);
  expect(transcript).toMatch(/backdrop-filter:\s*blur\(18px\)/);
  expect(transcript).toMatch(/background:\s*linear-gradient/);
  expect(transcript).toMatch(/overflow:\s*hidden/);
  expect(transcript).not.toMatch(/overflow(?:-y)?:\s*(?:auto|scroll)/);
});

test("animates the scan and copy while preserving marker states", () => {
  expect(ruleFor(".echo-transcript-reveal::before")).toMatch(/animation:\s*echo-scan/);
  expect(ruleFor(".echo-transcript-copy")).toMatch(/animation:\s*echo-copy-in/);
  expect(ruleFor(".echo-transcript-markers button.active::before")).toMatch(/box-shadow:/);
  expect(ruleFor(".echo-transcript-markers button:disabled")).toMatch(/cursor:\s*not-allowed/);
  expect(css).toMatch(/@keyframes\s+echo-scan/);
  expect(css).toMatch(/@keyframes\s+echo-copy-in/);
});

test("keeps transcript markers visually compact with unambiguous 44px touch targets", () => {
  const transcript = ruleFor(".echo-transcript");
  expectDeclaration(transcript, "--transcript-hit-target", /44px/);
  expectDeclaration(transcript, "--transcript-row-gap", /2px/);

  const markers = ruleFor(".echo-transcript-markers");
  expectDeclaration(markers, "gap", /4px/);
  expectDeclaration(markers, "margin-top", /var\(--transcript-row-gap\)/);

  const button = ruleFor(".echo-transcript-markers button");
  expectDeclaration(button, "width", /var\(--transcript-hit-target\)/);
  expectDeclaration(button, "height", /var\(--transcript-hit-target\)/);
  expectDeclaration(button, "position", /relative/);

  const dot = ruleFor(".echo-transcript-markers button::before");
  expectDeclaration(dot, "width", /7px/);
  expectDeclaration(dot, "height", /7px/);
  expectDeclaration(dot, "pointer-events", /none/);
  expect(button).not.toMatch(/margin:\s*[^;]*-/);
});

test("collapses an empty transcript and keeps desktop copy aligned", () => {
  const empty = ruleFor(".echo-transcript-empty");
  expect(empty).toMatch(/height:\s*0/);
  expect(empty).toMatch(/margin:\s*0/);
  expect(empty).toMatch(/padding:\s*0/);
  expect(empty).toMatch(/border:\s*0/);
  expect(empty).toMatch(/background:\s*none/);
  expect(empty).toMatch(/box-shadow:\s*none/);
  expect(empty).toMatch(/backdrop-filter:\s*none/);

  expectDeclaration(ruleFor(".echo-transcript", mediaFor("min-width:800px")), "margin-left", /0/);
});

test("uses one stage scroll owner on short phones while transcript expands to all copy and controls", () => {
  const shortPhone = mediaFor("max-height:680px");
  const transcript = ruleFor(".echo-transcript", shortPhone);
  expectDeclaration(transcript, "min-height", /72px/);
  expectDeclaration(transcript, "max-height", /none/);
  expectDeclaration(transcript, "margin-top", /8px/);
  expectDeclaration(transcript, "overflow", /hidden/);
  expect(transcript).not.toMatch(/overflow(?:-y)?:\s*(?:auto|scroll)/);

  const stage = ruleFor(".scene-stage", shortPhone);
  expectDeclaration(stage, "overflow-y", /auto/);
  expectDeclaration(ruleFor(".echo-transcript-copy", shortPhone), "font-size", /11px/);

  const empty = ruleFor(".echo-transcript-empty", shortPhone);
  for (const property of ["min-height", "height", "margin", "padding"]) {
    expectDeclaration(empty, property, /0/);
  }
  expect(shortPhone).not.toMatch(/\.scene-body\s*\{[^}]*display:\s*none/);
});

test("styles finale reveal controls as intentional pill buttons", () => {
  const finaleReveal = ruleFor(".finale-reveal");

  expect(finaleReveal).toMatch(/min-height:\s*44px/);
  expect(finaleReveal).toMatch(/border-radius:\s*999px/);
  expect(finaleReveal).toMatch(/background:/);
  expect(finaleReveal).toMatch(/cursor:\s*pointer/);
});

test("mobile cinematic shell uses dynamic viewport and safe areas", () => {
  const shell = ruleFor(".echo-experience");
  expectDeclaration(shell, "min-height", /100dvh/);
  expectDeclaration(shell, "padding-top", /env\(safe-area-inset-top\)/);
  expectDeclaration(shell, "padding-bottom", /env\(safe-area-inset-bottom\)/);

  const gestureSurface = ruleFor(".gesture-surface");
  expectDeclaration(gestureSurface, "position", /absolute/);
  expectDeclaration(gestureSurface, "inset", /0/);
  expectDeclaration(gestureSurface, "z-index", /4/);
});

test("sound control remains a 44px target through the short-screen cascade", () => {
  expectDeclaration(ruleFor(".sound-button"), "min-height", /44px/);
  const shortSound = ruleFor(".sound-button", mediaFor("max-height:680px"));
  expectDeclaration(shortSound, "min-height", /44px/);
  expect(shortSound).not.toMatch(/min-height:\s*(?:[0-3]\d|4[0-3])px/);
});

test("keeps the jealousy heartbeat range at least 44px tall on short phones", () => {
  const label = ruleFor(".signal-scrub label");
  const range = ruleFor('.signal-scrub input[type="range"]');

  expect(numericPxDeclaration(label, "min-height")).toBeGreaterThanOrEqual(44);
  expect(numericPxDeclaration(range, "height")).toBeGreaterThanOrEqual(44);
  expectDeclaration(range, "accent-color", /var\(--pink\)/);

  const shortPhone = mediaFor("max-height:680px");
  const shortTargetRules = [...shortPhone.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selectors]) =>
    selectors.split(",").some((selector) => /\.signal-scrub\b.*(?:label|input)/.test(selector.trim())),
  );
  for (const [, selectors, declarations] of shortTargetRules) {
    for (const match of declarations.matchAll(/(?:^|;)\s*((?:min-)?height):\s*([\d.]+)px(?:\s*;|$)/g)) {
      expect(Number(match[2]), `${selectors.trim()} ${match[1]} shrinks on short phones`).toBeGreaterThanOrEqual(44);
    }
  }
});

test("prevents short-screen stage anchoring from scrolling the header out of view", () => {
  expectDeclaration(ruleFor(".echo-experience"), "overflow", /clip/);
  expectDeclaration(ruleFor(".experience-header"), "top", /0/);
});

test("only the opening gravity control suppresses selection and touch callouts", () => {
  const gravity = ruleFor(".gravity-y");
  expectDeclaration(gravity, "touch-action", /none/);
  expectDeclaration(gravity, "user-select", /none/);
  expectDeclaration(gravity, "-webkit-user-select", /none/);
  expectDeclaration(gravity, "-webkit-touch-callout", /none/);

  const suppressionRules = [...css.matchAll(/([^{}@]+)\{([^{}]*(?:touch-action:\s*none|(?:-webkit-)?user-select:\s*none|-webkit-touch-callout:\s*none)[^{}]*)\}/g)];
  expect(suppressionRules.length).toBeGreaterThan(0);
  for (const [, selectors] of suppressionRules) {
    for (const selector of selectors.split(",").map((part) => part.trim())) {
      expect(selector, `unsafe interaction suppression on ${selector}`).toMatch(/^\.gravity-y(?:\b|:)/);
    }
  }
});

test("removes obsolete continue controls and renders a safe-area swipe cue", () => {
  expect(css).not.toMatch(/\.next-scene(?:\s|\{|:|\.)/);
  const cue = ruleFor(".swipe-cue");
  expectDeclaration(cue, "position", /fixed/);
  expectDeclaration(cue, "bottom", /calc\([^;]*env\(safe-area-inset-bottom\)/);
  expectDeclaration(cue, "pointer-events", /none/);
  expectDeclaration(cue, "animation", /swipe-breathe/);
});

test("gives all eight scenes distinct cinematic variables and semantic overlays", () => {
  const overlayAnimations = new Set<string>();

  for (const scene of sceneIds) {
    const envelope = ruleFor(`.scene-is-${scene}`);
    expectDeclaration(envelope, "--scene-accent", /#[0-9a-fA-F]{6}/);
    expectDeclaration(envelope, "--scene-bloom", /#[0-9a-fA-F]{8}/);
    expectDeclaration(envelope, "--scene-transcript-y", /-?[\d.]+px/);
    expectDeclaration(envelope, "--scene-energy", /[\d.]+/);

    const overlay = ruleFor(`.scene-is-${scene} .scene-action::before`);
    const animation = overlay.match(/animation:\s*([\w-]+)/)?.[1];
    expect(animation, `${scene} needs a semantic overlay animation`).toBeTruthy();
    overlayAnimations.add(animation!);
  }

  expect(overlayAnimations).toHaveLength(sceneIds.length);
  for (const animation of overlayAnimations) expect(css).toMatch(new RegExp(`@keyframes\\s+${animation}\\b`));
});

test("keeps bloom behind compact transcript content", () => {
  const transcript = ruleFor(".echo-transcript");
  expectDeclaration(transcript, "max-height", /none/);
  expectDeclaration(transcript, "isolation", /isolate/);
  expect(transcript).toMatch(/box-shadow:[^;]*var\(--scene-bloom\)/);

  const copy = ruleFor(".echo-transcript-copy");
  expectDeclaration(copy, "z-index", /1/);
});

test("reduced motion stops loops while retaining brief phase transitions and focus styles", () => {
  const reduced = mediaFor("prefers-reduced-motion:reduce");
  expectDeclaration(ruleFor(".swipe-cue", reduced), "animation", /none/);
  expectDeclaration(ruleFor(".scene-stage", reduced), "transition-duration", /\.4s/);
  expectDeclaration(ruleFor(".echo-transcript-copy", reduced), "animation", /echo-copy-in\s+\.4s/);
  expect(reduced).not.toMatch(/\.echo-transcript-markers button:focus-visible[^}]*transition:\s*none/);
  expect(reduced).not.toMatch(/\.replay-button:focus-visible[^}]*outline:\s*none/);
});

test("looped cinematic overlays stay on compositor-friendly transform and opacity", () => {
  const overlay = ruleFor(".scene-action::before");
  expectDeclaration(overlay, "will-change", /transform,\s*opacity/);
  expect(overlay).not.toMatch(/mix-blend-mode|filter/);

  const compositorAnimations = [
    "star-drift",
    "swipe-breathe",
    "wake-gravity-bridge",
    "jealousy-orbit-fracture",
    "confession-coordinate-lock",
    "privilege-petal-bloom",
    "signal-echo-return",
    "game-dual-tunnel",
    "night-frequency-merge",
    "finale-yu-seal",
    "finale-plate-breathe",
    "stream-cross",
    "gate-run",
  ];
  for (const animation of compositorAnimations) {
    const frames = keyframesFor(animation);
    expect(frames, `${animation} keyframes missing`).not.toBe("");
    expect(frames, `${animation} triggers mobile layout or repaint`).not.toMatch(
      /(?:^|[;{]\s*)(?:left|right|filter|background(?:-position|-size)?|box-shadow)\s*:/,
    );
    expect(frames, `${animation} needs compositor motion`).toMatch(/transform|opacity/);
  }
});

test("dual game streams cross from stable opposing anchors without layout animation", () => {
  const track = ruleFor(".dual-stream-gates .light-track");
  expectDeclaration(track, "--stream-travel", /min\(/);

  const beams = ruleFor(".dual-stream-gates .light-track::before,.dual-stream-gates .light-track::after");
  expectDeclaration(beams, "left", /10%/);
  expectDeclaration(beams, "will-change", /transform,\s*opacity/);

  const reverseBeam = lastRuleFor(".dual-stream-gates .light-track::after");
  expectDeclaration(reverseBeam, "left", /auto/);
  expectDeclaration(reverseBeam, "right", /10%/);
  expectDeclaration(reverseBeam, "--stream-direction", /-1/);

  const particles = ruleFor(".dual-stream-gates .light-track i");
  expectDeclaration(particles, "will-change", /transform,\s*opacity/);
  const reverseParticle = ruleFor(".dual-stream-gates .light-track i:nth-child(2)");
  expectDeclaration(reverseParticle, "--stream-direction", /-1/);

  for (const name of ["stream-cross", "gate-run"]) {
    expect(keyframesFor(name)).not.toMatch(/(?:^|[;{]\s*)(?:left|right|filter|background(?:-position|-size)?)\s*:/);
  }
});
