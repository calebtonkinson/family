import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const appsDir = path.join(repoRoot, "apps");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const IGNORED_DIRS = new Set(["node_modules", ".next", "dist", "coverage"]);

const appPackageNames = new Map([
  ["web", "@home/web"],
  ["server", "@home/server"],
]);

async function collectSourceFiles(targetDir) {
  const entries = await readdir(targetDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      files.push(...await collectSourceFiles(fullPath));
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function getImportSpecifiers(source) {
  const specifiers = [];
  for (const regex of [
    /from\s+["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const match of source.matchAll(regex)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function resolveRelativeImport(fromFile, specifier) {
  const base = path.dirname(fromFile);
  return path.normalize(path.resolve(base, specifier));
}

const appEntries = (await readdir(appsDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const violations = [];

for (const appName of appEntries) {
  const appRoot = path.join(appsDir, appName);
  const packageName = appPackageNames.get(appName);
  const otherPackages = [...appPackageNames.values()].filter((name) => name !== packageName);

  for (const filePath of await collectSourceFiles(appRoot)) {
    const source = await readFile(filePath, "utf8");
    const specifiers = getImportSpecifiers(source);

    for (const specifier of specifiers) {
      if (specifier.startsWith(".")) {
        const resolved = resolveRelativeImport(filePath, specifier);
        if (resolved.includes(`${path.sep}apps${path.sep}`) && !resolved.startsWith(appRoot)) {
          violations.push(`${path.relative(repoRoot, filePath)} -> ${specifier}`);
        }
        continue;
      }

      if (specifier.startsWith("apps/")) {
        violations.push(`${path.relative(repoRoot, filePath)} -> ${specifier}`);
        continue;
      }

      if (otherPackages.some((name) => specifier === name || specifier.startsWith(`${name}/`))) {
        violations.push(`${path.relative(repoRoot, filePath)} -> ${specifier}`);
      }
    }
  }
}

if (violations.length === 0) {
  console.log("Workspace boundary check passed.");
  process.exit(0);
}

console.error("Cross-app imports are not allowed:");
for (const violation of violations.sort()) {
  console.error(`- ${violation}`);
}
process.exit(1);
