import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

function ruleFor(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
}

const sceneIds = ["wake", "jealousy", "confession", "privilege", "signal", "game", "night", "finale"] as const;

function expectDeclaration(rule: string, property: string, value: RegExp) {
  expect(rule, `missing ${property}`).toMatch(new RegExp(`${property}:\\s*${value.source}`));
}

test("renders the transcript as a compact cinematic glass panel", () => {
  const transcript = ruleFor(".echo-transcript");

  expect(transcript).toMatch(/width:\s*min\(430px,\s*100%\)/);
  expect(transcript).toMatch(/min-height:\s*92px/);
  expect(transcript).toMatch(/backdrop-filter:\s*blur\(18px\)/);
  expect(transcript).toMatch(/background:\s*linear-gradient/);
  expect(transcript).toMatch(/overflow:\s*hidden/);
});

test("animates the scan and copy while preserving marker states", () => {
  expect(ruleFor(".echo-transcript-reveal::before")).toMatch(/animation:\s*echo-scan/);
  expect(ruleFor(".echo-transcript-copy")).toMatch(/animation:\s*echo-copy-in/);
  expect(ruleFor(".echo-transcript-markers button.active")).toMatch(/box-shadow:/);
  expect(ruleFor(".echo-transcript-markers button:disabled")).toMatch(/cursor:\s*not-allowed/);
  expect(css).toMatch(/@keyframes\s+echo-scan/);
  expect(css).toMatch(/@keyframes\s+echo-copy-in/);
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

  expect(css).toMatch(/@media\s*\(min-width:\s*800px\)[\s\S]*?\.echo-transcript\s*\{[^}]*margin-left:\s*0/);
});

test("constrains the transcript on short phones without hiding story copy", () => {
  expect(css).toMatch(
    /@media\s*\(max-height:\s*680px\)[\s\S]*?\.echo-transcript\s*\{[^}]*min-height:\s*72px[^}]*max-height:\s*108px[^}]*margin-top:\s*8px[^}]*overflow-y:\s*auto/,
  );
  expect(css).toMatch(/@media\s*\(max-height:\s*680px\)[\s\S]*?\.echo-transcript-copy\s*\{[^}]*font-size:\s*11px/);
  expect(css).toMatch(
    /@media\s*\(max-height:\s*680px\)[\s\S]*?\.echo-transcript-empty\s*\{[^}]*min-height:\s*0[^}]*height:\s*0[^}]*margin:\s*0[^}]*padding:\s*0/,
  );
  const shortPhone = css.slice(css.indexOf("@media (max-height:680px)"), css.indexOf("@media (prefers-reduced-motion:reduce)"));
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
  expectDeclaration(transcript, "max-height", /108px/);
  expectDeclaration(transcript, "isolation", /isolate/);
  expect(transcript).toMatch(/box-shadow:[^;]*var\(--scene-bloom\)/);

  const copy = ruleFor(".echo-transcript-copy");
  expectDeclaration(copy, "z-index", /1/);
});

test("reduced motion stops loops while retaining brief phase transitions and focus styles", () => {
  const reducedStart = css.indexOf("@media (prefers-reduced-motion:reduce)");
  expect(reducedStart).toBeGreaterThan(-1);
  const reduced = css.slice(reducedStart);
  expect(reduced).toMatch(/\.swipe-cue\s*\{[^}]*animation:\s*none/);
  expect(reduced).toMatch(/\.scene-stage\s*\{[^}]*transition-duration:\s*\.4s/);
  expect(reduced).toMatch(/\.echo-transcript-copy\s*\{[^}]*animation:\s*echo-copy-in\s+\.4s/);
  expect(reduced).not.toMatch(/\.echo-transcript-markers button:focus-visible[^}]*transition:\s*none/);
  expect(reduced).not.toMatch(/\.replay-button:focus-visible[^}]*outline:\s*none/);
});
