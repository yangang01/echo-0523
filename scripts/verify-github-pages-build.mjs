import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";

const REPOSITORY_PREFIX = "/echo-0523/";

function requireFile(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }
}

function findAssetUrl(html, label, pattern) {
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`Missing ${label} URL in index.html`);
  }
  return match[1];
}

function verifyLinkedAsset(outputDirectory, label, url) {
  if (!url.startsWith(REPOSITORY_PREFIX)) {
    throw new Error(
      `${label} URL must use repository prefix ${REPOSITORY_PREFIX}: ${url}`,
    );
  }

  const relativePath = url
    .slice(REPOSITORY_PREFIX.length)
    .split(/[?#]/, 1)[0];
  const outputRoot = resolve(outputDirectory);
  const assetPath = resolve(outputRoot, relativePath);
  if (!assetPath.startsWith(`${outputRoot}${sep}`)) {
    throw new Error(`${label} URL escapes the build directory: ${url}`);
  }
  requireFile(assetPath, `${label} asset`);
}

export function verifyGithubPagesBuild(
  outputDirectory = resolve(process.cwd(), "dist-github-pages"),
) {
  const indexPath = resolve(outputDirectory, "index.html");
  requireFile(indexPath, "index.html");

  const html = readFileSync(indexPath, "utf8");
  const linkedAssets = [
    ["JavaScript", findAssetUrl(html, "JavaScript", /<script\b[^>]*\bsrc=["']([^"']+)["']/i)],
    ["stylesheet", findAssetUrl(html, "stylesheet", /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']([^"']+)["']/i)],
    ["favicon", findAssetUrl(html, "favicon", /<link\b(?=[^>]*\brel=["']icon["'])[^>]*\bhref=["']([^"']+)["']/i)],
  ];

  for (const [label, url] of linkedAssets) {
    verifyLinkedAsset(outputDirectory, label, url);
  }

  for (const asset of [
    "favicon.svg",
    "og.png",
    "audio/a-moment-apart.mp3",
  ]) {
    requireFile(resolve(outputDirectory, asset), asset);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    verifyGithubPagesBuild(
      process.argv[2] ? resolve(process.argv[2]) : undefined,
    );
    console.log("GitHub Pages build artifacts verified.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
