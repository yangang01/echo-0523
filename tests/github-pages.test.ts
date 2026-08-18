import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function readIndentedBlock(source: string, heading: string, indentation: number) {
  const prefix = " ".repeat(indentation);
  const headingStart = source.indexOf(`${prefix}${heading}:`);
  expect(headingStart, `${heading} block exists`).toBeGreaterThanOrEqual(0);

  const blockStart = source.indexOf("\n", headingStart) + 1;
  const remainingSource = source.slice(blockStart);
  const nextPeer = remainingSource.search(
    new RegExp(`^${prefix}\\S[^\\n]*:`, "m"),
  );

  return nextPeer === -1
    ? remainingSource
    : remainingSource.slice(0, nextPeer);
}

type WorkflowStep = {
  uses?: string;
  run?: string;
  with: Record<string, string>;
  [property: string]: string | Record<string, string> | undefined;
};

const pinnedActions = [
  { action: "actions/checkout", major: "v4" },
  { action: "pnpm/action-setup", major: "v4" },
  { action: "actions/setup-node", major: "v4" },
  { action: "actions/configure-pages", major: "v5" },
  { action: "actions/upload-pages-artifact", major: "v3" },
  { action: "actions/deploy-pages", major: "v4" },
] as const;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function actionName(reference: string | undefined) {
  return reference?.match(/^([^@]+)@/)?.[1];
}

function findActionStep(steps: WorkflowStep[], action: string) {
  return steps.find((step) => actionName(step.uses) === action);
}

function expectPinnedAction(
  steps: WorkflowStep[],
  action: string,
  major: string,
) {
  const step = findActionStep(steps, action);
  expect(step, `${action} step exists`).toBeDefined();
  expect(step?.uses).toMatch(
    new RegExp(`^${escapeRegex(action)}@[0-9a-f]{40} # ${major}$`),
  );
}

function createHardenedWorkflowFixture(workflow: string) {
  const dummySha = "a".repeat(40);
  let hardened = workflow.replace(
    "  cancel-in-progress: true",
    "  cancel-in-progress: false",
  );

  for (const { action, major } of pinnedActions) {
    hardened = hardened.replace(
      new RegExp(
        `${escapeRegex(action)}@(?:${major}|[0-9a-f]{40})(?: # ${major})?`,
      ),
      `${action}@${dummySha} # ${major}`,
    );
  }

  return hardened;
}

function fixtureAction(action: string, major: string) {
  return `${action}@${"a".repeat(40)} # ${major}`;
}

function readDeploySteps(deployJob: string) {
  const lines = deployJob.split("\n");
  const stepsHeading = lines.indexOf("    steps:");
  expect(stepsHeading, "deploy steps block exists").toBeGreaterThanOrEqual(0);

  const steps: WorkflowStep[] = [];
  let currentStep: WorkflowStep | undefined;
  let readingWith = false;

  for (const line of lines.slice(stepsHeading + 1)) {
    const stepStart = line.match(/^ {6}- (uses|run): (.+)$/);
    if (stepStart) {
      const [, kind, value] = stepStart;
      currentStep = { [kind]: value, with: {} };
      steps.push(currentStep);
      readingWith = false;
      continue;
    }

    if (!currentStep) continue;

    if (line === "        with:") {
      readingWith = true;
      continue;
    }

    const withProperty = line.match(/^ {10}([\w-]+): (.+)$/);
    if (readingWith && withProperty) {
      currentStep.with[withProperty[1]] = withProperty[2];
      continue;
    }

    const stepProperty = line.match(/^ {8}([\w-]+): (.+)$/);
    if (stepProperty) {
      currentStep[stepProperty[1]] = stepProperty[2];
      readingWith = false;
    }
  }

  return steps;
}

function expectDeployJobContract(workflow: string) {
  const jobs = readIndentedBlock(workflow, "jobs", 0);
  const deployJob = readIndentedBlock(jobs, "deploy", 2);

  expect(jobs).not.toMatch(/^ {2}(?!deploy:)\S[^\n]*:/m);
  expect(deployJob).toMatch(/^ {4}runs-on: ubuntu-latest$/m);
  expect(deployJob).toMatch(
    /^ {4}environment:\n {6}name: github-pages\n {6}url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}$/m,
  );
  expect(deployJob).not.toMatch(/^ {4}(?:if|continue-on-error):/m);

  const steps = readDeploySteps(deployJob);

  expect(
    steps.map((step) => actionName(step.uses) ?? `run: ${step.run}`),
  ).toEqual([
    "actions/checkout",
    "pnpm/action-setup",
    "actions/setup-node",
    "run: pnpm install --frozen-lockfile",
    "run: pnpm exec vitest run",
    "run: pnpm run build:pages",
    "run: pnpm run verify:pages",
    "actions/configure-pages",
    "actions/upload-pages-artifact",
    "actions/deploy-pages",
  ]);

  for (const { action, major } of pinnedActions) {
    expectPinnedAction(steps, action, major);
  }

  const pnpmSetup = findActionStep(steps, "pnpm/action-setup");
  const nodeSetup = findActionStep(steps, "actions/setup-node");
  const artifactUpload = findActionStep(
    steps,
    "actions/upload-pages-artifact",
  );
  const pagesDeployment = findActionStep(steps, "actions/deploy-pages");
  const artifactVerification = steps.find(
    (step) => step.run === "pnpm run verify:pages",
  );

  expect(pnpmSetup?.with).toEqual({ version: "10" });
  expect(nodeSetup?.with).toEqual({
    "node-version": "22",
    cache: "pnpm",
  });
  expect(artifactUpload?.with).toEqual({ path: "dist-github-pages" });
  expect(pagesDeployment?.id).toBe("deployment");
  expect(artifactVerification).not.toHaveProperty("if");
  expect(artifactVerification).not.toHaveProperty("continue-on-error");
}

const temporaryBuilds: string[] = [];

function createTemporaryBuild() {
  const directory = mkdtempSync(join(tmpdir(), "github-pages-build-"));
  temporaryBuilds.push(directory);
  return directory;
}

async function loadBuildVerifier() {
  const verifierPath = resolve(
    process.cwd(),
    "scripts/verify-github-pages-build.mjs",
  );
  expect(existsSync(verifierPath), "build verifier script exists").toBe(true);
  return import(/* @vite-ignore */ pathToFileURL(verifierPath).href);
}

function writeValidBuild(directory: string) {
  const prefix = "/qixi-0523-echo-core/";
  mkdirSync(join(directory, "assets"), { recursive: true });
  writeFileSync(
    join(directory, "index.html"),
    [
      `<link rel="icon" href="${prefix}favicon.svg">`,
      `<script type="module" src="${prefix}assets/app.js"></script>`,
      `<link rel="stylesheet" href="${prefix}assets/app.css">`,
    ].join("\n"),
  );
  writeFileSync(join(directory, "assets/app.js"), "");
  writeFileSync(join(directory, "assets/app.css"), "");
  writeFileSync(join(directory, "favicon.svg"), "<svg></svg>");
  writeFileSync(join(directory, "og.png"), "png");
}

afterEach(() => {
  for (const directory of temporaryBuilds.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("GitHub Pages static build", () => {
  it("defines a least-privilege GitHub Pages deployment workflow", () => {
    const workflowPath = ".github/workflows/deploy-pages.yml";
    expect(existsSync(resolve(process.cwd(), workflowPath))).toBe(true);
    const workflow = readProjectFile(workflowPath);
    const permissions = readIndentedBlock(workflow, "permissions", 0);
    const concurrency = readIndentedBlock(workflow, "concurrency", 0);
    const triggers = readIndentedBlock(workflow, "on", 0);

    expect(workflow).toMatch(/^name: Deploy GitHub Pages$/m);
    expect(triggers).toMatch(/^ {2}push:\n {4}branches:\n {6}- main$/m);
    expect(triggers).toMatch(/^ {2}workflow_dispatch:$/m);
    expect(permissions.trim().split("\n").map((line) => line.trim())).toEqual([
      "contents: read",
      "pages: write",
      "id-token: write",
    ]);
    expect(concurrency.trim().split("\n").map((line) => line.trim())).toEqual([
      "group: pages",
      "cancel-in-progress: false",
    ]);
  });

  it("tests, builds, verifies, and deploys the Pages artifact in one job", () => {
    const workflowPath = ".github/workflows/deploy-pages.yml";
    expect(existsSync(resolve(process.cwd(), workflowPath))).toBe(true);
    const workflow = readProjectFile(workflowPath);

    expectDeployJobContract(workflow);
  });

  it.each([
    {
      name: "pnpm version attached to setup-node",
      mutate: (workflow: string) =>
        workflow.replace(
          `      - uses: ${fixtureAction("pnpm/action-setup", "v4")}\n        with:\n          version: 10\n      - uses: ${fixtureAction("actions/setup-node", "v4")}\n        with:\n`,
          `      - uses: ${fixtureAction("pnpm/action-setup", "v4")}\n      - uses: ${fixtureAction("actions/setup-node", "v4")}\n        with:\n          version: 10\n`,
        ),
    },
    {
      name: "Node settings attached to pnpm setup",
      mutate: (workflow: string) =>
        workflow.replace(
          `      - uses: ${fixtureAction("pnpm/action-setup", "v4")}\n        with:\n          version: 10\n      - uses: ${fixtureAction("actions/setup-node", "v4")}\n        with:\n          node-version: 22\n          cache: pnpm\n`,
          `      - uses: ${fixtureAction("pnpm/action-setup", "v4")}\n        with:\n          version: 10\n          node-version: 22\n          cache: pnpm\n      - uses: ${fixtureAction("actions/setup-node", "v4")}\n`,
        ),
    },
    {
      name: "artifact path attached to deploy-pages",
      mutate: (workflow: string) =>
        workflow.replace(
          `      - uses: ${fixtureAction("actions/upload-pages-artifact", "v3")}\n        with:\n          path: dist-github-pages\n      - uses: ${fixtureAction("actions/deploy-pages", "v4")}\n        id: deployment\n`,
          `      - uses: ${fixtureAction("actions/upload-pages-artifact", "v3")}\n      - uses: ${fixtureAction("actions/deploy-pages", "v4")}\n        with:\n          path: dist-github-pages\n        id: deployment\n`,
        ),
    },
    {
      name: "deployment id attached to the upload step",
      mutate: (workflow: string) =>
        workflow.replace(
          `          path: dist-github-pages\n      - uses: ${fixtureAction("actions/deploy-pages", "v4")}\n        id: deployment\n`,
          `          path: dist-github-pages\n        id: deployment\n      - uses: ${fixtureAction("actions/deploy-pages", "v4")}\n`,
        ),
    },
    {
      name: "artifact verification explicitly skipped",
      mutate: (workflow: string) =>
        workflow.replace(
          "      - run: pnpm run verify:pages\n",
          "      - run: pnpm run verify:pages\n        if: false\n",
        ),
    },
    {
      name: "artifact verification allowed to fail",
      mutate: (workflow: string) =>
        workflow.replace(
          "      - run: pnpm run verify:pages\n",
          "      - run: pnpm run verify:pages\n        continue-on-error: true\n",
        ),
    },
  ])("rejects $name", ({ mutate }) => {
    const workflow = createHardenedWorkflowFixture(
      readProjectFile(".github/workflows/deploy-pages.yml"),
    );
    const mutatedWorkflow = mutate(workflow);

    expect(mutatedWorkflow).not.toBe(workflow);
    expect(() => expectDeployJobContract(mutatedWorkflow)).toThrow();
  });

  it.each(pinnedActions)("rejects a movable $action@$major tag", (pin) => {
    const workflow = readProjectFile(".github/workflows/deploy-pages.yml");
    const hardenedWorkflow = createHardenedWorkflowFixture(workflow);
    const dummySha = "a".repeat(40);
    const mutatedWorkflow = hardenedWorkflow.replace(
      `${pin.action}@${dummySha} # ${pin.major}`,
      `${pin.action}@${pin.major} # ${pin.major}`,
    );

    expect(() => expectDeployJobContract(hardenedWorkflow)).not.toThrow();
    expect(mutatedWorkflow).not.toBe(hardenedWorkflow);
    expect(() => expectDeployJobContract(mutatedWorkflow)).toThrow();
  });

  it("rejects a deploy job that is explicitly skipped", () => {
    const workflow = createHardenedWorkflowFixture(
      readProjectFile(".github/workflows/deploy-pages.yml"),
    );
    const mutatedWorkflow = workflow.replace(
      "  deploy:\n",
      "  deploy:\n    if: false\n",
    );

    expect(mutatedWorkflow).not.toBe(workflow);
    expect(() => expectDeployJobContract(mutatedWorkflow)).toThrow();
  });

  it("provides a localized HTML shell for the static React entry point", () => {
    const html = readProjectFile("github-pages/index.html");

    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toMatch(/<meta name="viewport"[^>]*viewport-fit=cover/);
    expect(html).toMatch(/<meta name="theme-color" content="#[0-9a-fA-F]{6}"/);
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
    expect(html).toContain('<link rel="icon" href="%BASE_URL%favicon.svg"');
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<script type="module" src="/main.tsx"></script>');
  });

  it("mounts the existing experience and global styles with createRoot", () => {
    const entry = readProjectFile("github-pages/main.tsx");

    expect(entry).toMatch(/import\s+\{\s*StrictMode\s*\}\s+from\s+["']react["']/);
    expect(entry).toMatch(/import\s+\{\s*createRoot\s*\}\s+from\s+["']react-dom\/client["']/);
    expect(entry).toMatch(/import\s+\{\s*EchoExperience\s*\}\s+from\s+["']\.\.\/components\/experience\/EchoExperience["']/);
    expect(entry).toMatch(/import\s+["']\.\.\/app\/globals\.css["']/);
    expect(entry).toMatch(/createRoot\([\s\S]*?root[\s\S]*?\)\.render\([\s\S]*?<StrictMode>[\s\S]*?<EchoExperience\s*\/>[\s\S]*?<\/StrictMode>/);
  });

  it("keeps the GitHub Pages Vite build isolated from the existing config", () => {
    const config = readProjectFile("vite.github-pages.config.ts");

    expect(config).toMatch(/import\s+react\s+from\s+["']@vitejs\/plugin-react["']/);
    expect(config).toMatch(/import\s+\{\s*defineConfig\s*\}\s+from\s+["']vite["']/);
    expect(config).toMatch(/plugins:\s*\[react\(\)\]/);
    expect(config).toMatch(/base:\s*["']\/qixi-0523-echo-core\/["']/);
    expect(config).toMatch(/root:\s*["']github-pages["']/);
    expect(config).toMatch(/publicDir:\s*["']\.\.\/public["']/);
    expect(config).toMatch(/outDir:\s*["']\.\.\/dist-github-pages["']/);
  });

  it("exposes reusable build and artifact verification commands", () => {
    const packageJson = JSON.parse(readProjectFile("package.json"));
    const gitignore = readProjectFile(".gitignore");
    const eslintConfig = readProjectFile("eslint.config.mjs");

    expect(packageJson.scripts["build:pages"]).toBe(
      "vite build --config vite.github-pages.config.ts",
    );
    expect(packageJson.scripts["verify:pages"]).toBe(
      "node scripts/verify-github-pages-build.mjs",
    );
    expect(gitignore).toMatch(/^\/dist-github-pages\/$/m);
    expect(eslintConfig).toMatch(/["']dist-github-pages\/\*\*["']/);
  });

  it("rejects a missing GitHub Pages build", async () => {
    const { verifyGithubPagesBuild } = await loadBuildVerifier();

    expect(() => verifyGithubPagesBuild(createTemporaryBuild())).toThrow(
      /index\.html/,
    );
  });

  it("rejects built asset URLs without the repository prefix", async () => {
    const { verifyGithubPagesBuild } = await loadBuildVerifier();
    const directory = createTemporaryBuild();
    writeValidBuild(directory);
    const htmlPath = join(directory, "index.html");
    writeFileSync(
      htmlPath,
      readFileSync(htmlPath, "utf8").replace(
        "/qixi-0523-echo-core/assets/app.js",
        "/assets/app.js",
      ),
    );

    expect(() => verifyGithubPagesBuild(directory)).toThrow(/repository prefix/);
  });

  it("accepts a complete build with repository-prefixed assets", async () => {
    const { verifyGithubPagesBuild } = await loadBuildVerifier();
    const directory = createTemporaryBuild();
    writeValidBuild(directory);

    expect(() => verifyGithubPagesBuild(directory)).not.toThrow();
  });
});
