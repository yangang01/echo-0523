# Echo 0523 URL Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the free GitHub Pages project URL to `https://yangang01.github.io/echo-0523/` without breaking static assets, audio, tests, or deployment.

**Architecture:** Treat `/echo-0523/` as one invariant shared by the Vite Pages base, the artifact verifier, and Pages tests. Verify the code migration locally before renaming the GitHub repository, then update `origin`, push, and validate the new Pages deployment.

**Tech Stack:** Vite, TypeScript, Vitest, Node.js, GitHub CLI, GitHub Actions, GitHub Pages.

---

### Task 1: Lock the new Pages path in tests

**Files:**
- Modify: `tests/github-pages.test.ts`

- [ ] **Step 1: Change path expectations to the new slug**

Replace every expected `/qixi-0523-echo-core/` prefix with `/echo-0523/`, including generated script, stylesheet, and sample asset URLs.

```ts
const prefix = "/echo-0523/";
expect(config).toMatch(/base:\s*["']\/echo-0523\/["']/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node node_modules/vitest/vitest.mjs run tests/github-pages.test.ts`

Expected: FAIL because the Vite config and verifier still use `/qixi-0523-echo-core/`.

### Task 2: Migrate build and verification paths

**Files:**
- Modify: `vite.github-pages.config.ts`
- Modify: `scripts/verify-github-pages-build.mjs`
- Test: `tests/github-pages.test.ts`

- [ ] **Step 1: Change the Vite Pages base**

```ts
export default defineConfig({
  base: "/echo-0523/",
});
```

- [ ] **Step 2: Change the artifact verifier prefix**

```js
const REPOSITORY_PREFIX = "/echo-0523/";
```

- [ ] **Step 3: Run the focused test and verify GREEN**

Run: `node node_modules/vitest/vitest.mjs run tests/github-pages.test.ts`

Expected: PASS.

- [ ] **Step 4: Scan runtime files for the old path**

Run: `rg -n "qixi-0523-echo-core" vite.github-pages.config.ts scripts tests .github github-pages public`

Expected: no matches outside historical documentation.

### Task 3: Verify locally before external rename

**Files:**
- Modify: `docs/superpowers/plans/2026-08-19-echo-0523-url-rename.md`

- [ ] **Step 1: Run complete checks**

Run Vitest, ESLint, `vite build --config vite.github-pages.config.ts`, `scripts/verify-github-pages-build.mjs`, and `git diff --check` with the bundled Node runtime.

Expected: all commands exit zero and the built HTML references `/echo-0523/assets/`.

- [ ] **Step 2: Commit the path migration**

```bash
git add vite.github-pages.config.ts scripts/verify-github-pages-build.mjs tests/github-pages.test.ts docs/superpowers/plans/2026-08-19-echo-0523-url-rename.md
git commit -m "chore: rename pages path to echo 0523"
```

### Task 4: Rename repository and deploy

**Files:**
- Repository setting: `yangang01/qixi-0523-echo-core` → `yangang01/echo-0523`
- Git remote: `origin`

- [ ] **Step 1: Confirm the target name is available**

Run: `gh repo view yangang01/echo-0523 --json nameWithOwner`

Expected: repository not found before rename. If it exists, stop rather than overwrite or delete anything.

- [ ] **Step 2: Rename the repository**

Run: `gh api --method PATCH repos/yangang01/qixi-0523-echo-core -f name=echo-0523`

Expected: response reports `full_name` as `yangang01/echo-0523`.

- [ ] **Step 3: Update and verify the local remote**

Run: `git remote set-url origin https://github.com/yangang01/echo-0523.git`

Run: `git remote -v`

Expected: fetch and push both use the new repository URL.

- [ ] **Step 4: Push main and wait for Pages**

Run: `git push origin HEAD:main`, then wait for the `Deploy GitHub Pages` workflow to succeed for the new commit.

- [ ] **Step 5: Verify the new public URL**

Confirm `https://yangang01.github.io/echo-0523/` returns HTML referencing `/echo-0523/assets/`, the referenced JS/CSS return 200, the audio asset returns 200, and the repository `main` SHA matches the local commit.

- [ ] **Step 6: Verify repository and workspace state**

Run: `gh repo view yangang01/echo-0523 --json nameWithOwner,url` and `git status --short --branch`.

Expected: new repository identity, clean working tree, and branch aligned with `origin/main`.
