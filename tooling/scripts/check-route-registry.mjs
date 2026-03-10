import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const routesDir = path.join(repoRoot, "apps", "server", "src", "routes");
const appFile = path.join(repoRoot, "apps", "server", "src", "app.ts");

const routeFiles = (await readdir(routesDir))
  .filter((entry) => entry.endsWith(".ts"))
  .sort();

const routerNames = [];
for (const routeFile of routeFiles) {
  const fullPath = path.join(routesDir, routeFile);
  const source = await readFile(fullPath, "utf8");
  const match = source.match(/export const (\w+) = new OpenAPIHono/);
  if (match) {
    routerNames.push(match[1]);
  }
}

const appSource = await readFile(appFile, "utf8");
const mountedRouters = new Set(
  [...appSource.matchAll(/\.route\(\s*["'`][^"'`]+["'`]\s*,\s*(\w+)\s*\)/g)].map(
    (match) => match[1],
  ),
);

const missing = routerNames.filter((name) => !mountedRouters.has(name));
const extra = [...mountedRouters].filter((name) => !routerNames.includes(name));

if (missing.length === 0 && extra.length === 0) {
  console.log("Route registry check passed.");
  process.exit(0);
}

if (missing.length > 0) {
  console.error("Missing mounted routers:", missing.join(", "));
}

if (extra.length > 0) {
  console.error("Mounted routers without matching route files:", extra.join(", "));
}

process.exit(1);
