import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

function ruleFor(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
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
  expect(ruleFor(".echo-transcript::before")).toMatch(/animation:\s*echo-scan/);
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

  expect(css).toMatch(/@media\s*\(min-width:\s*800px\)[\s\S]*?\.echo-transcript\s*\{[^}]*margin-left:\s*0/);
});

test("constrains the transcript on short phones and respects reduced motion", () => {
  expect(css).toMatch(
    /@media\s*\(max-height:\s*680px\)[\s\S]*?\.echo-transcript\s*\{[^}]*min-height:\s*72px[^}]*max-height:\s*108px[^}]*margin-top:\s*8px[^}]*overflow-y:\s*auto/,
  );
  expect(css).toMatch(/@media\s*\(max-height:\s*680px\)[\s\S]*?\.echo-transcript-copy\s*\{[^}]*font-size:\s*11px/);
  expect(css).toMatch(
    /@media\s*\(max-height:\s*680px\)[\s\S]*?\.echo-transcript-empty\s*\{[^}]*min-height:\s*0[^}]*height:\s*0[^}]*margin:\s*0[^}]*padding:\s*0/,
  );
  expect(css).toMatch(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.echo-transcript::before\s*\{[^}]*display:\s*none/,
  );
  expect(css).toMatch(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.echo-transcript-copy\s*\{[^}]*transform:\s*none/,
  );
  expect(css).toMatch(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.echo-transcript-markers button,\.finale-reveal\s*\{[^}]*transition:\s*none/,
  );
  expect(css).toMatch(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.echo-transcript-markers button:hover:not\(:disabled\),\.echo-transcript-markers button:focus-visible,\.finale-reveal:hover,\.finale-reveal:focus-visible\s*\{[^}]*transform:\s*none/,
  );
});

test("styles finale reveal controls as intentional pill buttons", () => {
  const finaleReveal = ruleFor(".finale-reveal");

  expect(finaleReveal).toMatch(/min-height:\s*44px/);
  expect(finaleReveal).toMatch(/border-radius:\s*999px/);
  expect(finaleReveal).toMatch(/background:/);
  expect(finaleReveal).toMatch(/cursor:\s*pointer/);
});
