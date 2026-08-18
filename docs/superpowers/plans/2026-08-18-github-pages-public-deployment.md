# GitHub Pages Public Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing 0523 回音星核 experience from a new public GitHub repository through a public GitHub Pages URL without changing the existing Sites build.

**Architecture:** Add an isolated Vite client entry rooted at `github-pages/` that directly mounts the existing `EchoExperience` and imports the existing stylesheet. A separate Vite config emits static files with the repository subpath as `base`; a GitHub Actions workflow tests, builds, and deploys that directory through the official Pages artifact pipeline.

**Tech Stack:** React 19, Vite 8, TypeScript, Vitest, GitHub Actions, GitHub Pages, GitHub CLI

---

### Task 1: Add an isolated static GitHub Pages build

**Files:**
- Create: `github-pages/index.html`
- Create: `github-pages/main.tsx`
- Create: `vite.github-pages.config.ts`
- Create: `tests/github-pages.test.ts`

- [ ] **Step 1: Write the failing static-build contract test**

Create `tests/github-pages.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("GitHub Pages static build", () => {
  it("mounts the existing experience from a dedicated client entry", () => {
    const html = read("github-pages/index.html");
    const entry = read("github-pages/main.tsx");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('src="/main.tsx"');
    expect(entry).toContain('import { EchoExperience } from "../components/experience/EchoExperience"');
    expect(entry).toContain('import "../app/globals.css"');
    expect(entry).toContain('createRoot(document.getElementById("root")!)');
  });

  it("builds with the repository subpath and isolated output", () => {
    const config = read("vite.github-pages.config.ts");
    expect(config).toContain('base: "/qixi-0523-echo-core/"');
    expect(config).toContain('root: "github-pages"');
    expect(config).toContain('publicDir: "../public"');
    expect(config).toContain('outDir: "../dist-github-pages"');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/github-pages.test.ts
```

Expected: FAIL because the Pages entry and config do not exist.

- [ ] **Step 3: Add the static HTML entry**

Create `github-pages/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#02030a" />
    <meta name="description" content="给小宝贝的七夕粒子回音礼物" />
    <link rel="icon" href="/qixi-0523-echo-core/favicon.svg" />
    <title>0523 回音星核｜给小宝贝的七夕礼物</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Add the React mount entry**

Create `github-pages/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EchoExperience } from "../components/experience/EchoExperience";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><EchoExperience /></StrictMode>,
);
```

- [ ] **Step 5: Add the isolated Vite config**

Create `vite.github-pages.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/qixi-0523-echo-core/",
  root: "github-pages",
  publicDir: "../public",
  plugins: [react()],
  build: { outDir: "../dist-github-pages", emptyOutDir: true },
});
```

- [ ] **Step 6: Run focused tests and the static build**

```bash
/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/github-pages.test.ts
/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build --config vite.github-pages.config.ts
rg -n '/qixi-0523-echo-core/' dist-github-pages/index.html
test -f dist-github-pages/favicon.svg
```

Expected: tests PASS, static build succeeds, HTML uses the repository prefix, and the icon exists.

- [ ] **Step 7: Commit**

```bash
git add github-pages/index.html github-pages/main.tsx vite.github-pages.config.ts tests/github-pages.test.ts
git commit -m "feat: add static GitHub Pages build"
```

### Task 2: Add the automatic Pages workflow

**Files:**
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `tests/github-pages.test.ts`

- [ ] **Step 1: Add a failing workflow contract test**

Append inside the existing `describe` block:

```ts
it("deploys through the official Pages workflow", () => {
  const workflow = read(".github/workflows/deploy-pages.yml");
  expect(workflow).toContain("pages: write");
  expect(workflow).toContain("id-token: write");
  expect(workflow).toContain("pnpm exec vitest run");
  expect(workflow).toContain("pnpm exec vite build --config vite.github-pages.config.ts");
  expect(workflow).toContain("actions/upload-pages-artifact@v3");
  expect(workflow).toContain("path: dist-github-pages");
  expect(workflow).toContain("actions/deploy-pages@v4");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run the focused Vitest command from Task 1.

Expected: FAIL because `.github/workflows/deploy-pages.yml` does not exist.

- [ ] **Step 3: Add the workflow**

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec vitest run
      - run: pnpm exec vite build --config vite.github-pages.config.ts
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist-github-pages
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Run full verification**

```bash
/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run
/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next --ignore-pattern dist-github-pages
/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build --config vite.github-pages.config.ts
/Users/yangang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/.pnpm/vinext@1.0.0-beta.2_@vitejs+plugin-react@6.0.2_vite@8.0.13_@types+node@22.19.19_esbuild_93f6fd6c708956198cb05a5cfe3fd3ab/node_modules/vinext/dist/cli.js build
git diff --check
```

Expected: all tests and lint pass; both static Pages and Sites builds succeed; only the existing large-chunk advisory is allowed.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy-pages.yml tests/github-pages.test.ts
git commit -m "ci: deploy public GitHub Pages"
```

### Task 3: Create the public repository and publish Pages

**Files:**
- No source changes expected

- [ ] **Step 1: Confirm clean source**

```bash
git status --short
git rev-parse HEAD
```

Expected: clean status and one commit SHA.

- [ ] **Step 2: Create the public repository**

```bash
gh repo create yangang01/qixi-0523-echo-core --public --description "0523 回音星核｜给小宝贝的七夕粒子回音礼物" --source . --remote origin
```

Expected: the public repository is created and `origin` is configured.

- [ ] **Step 3: Enable workflow-based Pages**

```bash
gh api --method POST repos/yangang01/qixi-0523-echo-core/pages -f build_type=workflow
```

Expected: the Pages API returns the new site configuration.

- [ ] **Step 4: Push exact HEAD as `main`**

```bash
git push -u origin HEAD:main
```

Expected: the validated source reaches the public repository and starts the Pages workflow.

- [ ] **Step 5: Wait for deployment**

```bash
gh run list --repo yangang01/qixi-0523-echo-core --workflow deploy-pages.yml --limit 1
gh run watch --repo yangang01/qixi-0523-echo-core --exit-status
```

Expected: workflow succeeds.

- [ ] **Step 6: Verify both public links**

```bash
gh repo view yangang01/qixi-0523-echo-core --json name,url,visibility,defaultBranchRef
gh api repos/yangang01/qixi-0523-echo-core/pages
curl -sSf https://yangang01.github.io/qixi-0523-echo-core/
```

Expected: repository is PUBLIC with default branch `main`, Pages reports `built`, and the public URL returns HTML.

- [ ] **Step 7: Open and hand off**

Open the public Pages URL in Codex, then return:

- Repository: `https://github.com/yangang01/qixi-0523-echo-core`
- Public Page: `https://yangang01.github.io/qixi-0523-echo-core/`
