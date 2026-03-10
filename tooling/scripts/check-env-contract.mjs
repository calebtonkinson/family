import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

const sourceRoots = [
  path.join(repoRoot, "apps"),
  path.join(repoRoot, "packages"),
];

const docFile = path.join(repoRoot, "docs", "architecture", "runtime-and-env.md");
const envExampleFiles = [
  path.join(repoRoot, "apps", "web", ".env.example"),
  path.join(repoRoot, "apps", "server", ".env.example"),
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const IGNORED_DIRS = new Set(["node_modules", ".next", "dist", "coverage"]);

async function collectFiles(targetDir) {
  const entries = await readdir(targetDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      files.push(...await collectFiles(fullPath));
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

const envNames = new Set();
for (const sourceRoot of sourceRoots) {
  for (const filePath of await collectFiles(sourceRoot)) {
    const source = await readFile(filePath, "utf8");

    for (const match of source.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      envNames.add(match[1]);
    }

    for (const match of source.matchAll(/process\.env\[(?:'|")([A-Z0-9_]+)(?:'|")\]/g)) {
      envNames.add(match[1]);
    }
  }
}

const docsText = await readFile(docFile, "utf8");
const exampleTexts = await Promise.all(envExampleFiles.map((filePath) => readFile(filePath, "utf8")));

const missingFromDocs = [...envNames].filter((name) => !docsText.includes(`\`${name}\``));
const missingFromExamples = [...envNames].filter((name) =>
  !exampleTexts.some((text) => new RegExp(`^${name}=`, "m").test(text)),
);

if (missingFromDocs.length === 0 && missingFromExamples.length === 0) {
  console.log("Environment contract check passed.");
  process.exit(0);
}

if (missingFromDocs.length > 0) {
  console.error("Env vars missing from docs/architecture/runtime-and-env.md:");
  for (const name of missingFromDocs.sort()) {
    console.error(`- ${name}`);
  }
}

if (missingFromExamples.length > 0) {
  console.error("Env vars missing from example env files:");
  for (const name of missingFromExamples.sort()) {
    console.error(`- ${name}`);
  }
}

process.exit(1);
