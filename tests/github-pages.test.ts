import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("GitHub Pages static build", () => {
  it("provides a localized HTML shell for the static React entry point", () => {
    const html = readProjectFile("github-pages/index.html");

    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toMatch(/<meta name="viewport"[^>]*viewport-fit=cover/);
    expect(html).toMatch(/<meta name="theme-color" content="#[0-9a-fA-F]{6}"/);
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
    expect(html).toContain(
      '<link rel="icon" href="/qixi-0523-echo-core/favicon.svg"',
    );
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
});
