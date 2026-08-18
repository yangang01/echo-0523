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
