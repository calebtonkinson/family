import { promises as fs } from 'node:fs';
import path from 'node:path';

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('Usage: node fix-esm-extensions.mjs <distDir> [distDir...]');
  process.exit(1);
}

const isRelativeSpecifier = (spec) => spec.startsWith('./') || spec.startsWith('../');
const hasExtension = (spec) => /\.(js|json|node)$/i.test(spec);

async function fileExists(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function dirExists(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function fixFile(filePath) {
  const original = await fs.readFile(filePath, 'utf8');
  let updated = original;

  const re = /(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g;
  const reBareImport = /(import\s+["'])(\.{1,2}\/[^"']+)(["'])/g;

  const replacer = async (match, p1, spec, p3) => {
    if (!isRelativeSpecifier(spec) || hasExtension(spec)) {
      return match;
    }

    const baseDir = path.dirname(filePath);
    const candidateFile = path.resolve(baseDir, `${spec}.js`);
    if (await fileExists(candidateFile)) {
      return `${p1}${spec}.js${p3}`;
    }

    const candidateDir = path.resolve(baseDir, spec);
    if (await dirExists(candidateDir)) {
      const indexFile = path.join(candidateDir, 'index.js');
      if (await fileExists(indexFile)) {
        return `${p1}${spec}/index.js${p3}`;
      }
    }

    return `${p1}${spec}.js${p3}`;
  };

  async function replaceAsync(text, regex) {
    const parts = [];
    let lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      parts.push(text.slice(lastIndex, match.index));
      parts.push(await replacer(...match));
      lastIndex = match.index + match[0].length;
    }
    parts.push(text.slice(lastIndex));
    return parts.join('');
  }

  updated = await replaceAsync(updated, re);
  updated = await replaceAsync(updated, reBareImport);

  if (updated !== original) {
    await fs.writeFile(filePath, updated, 'utf8');
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.js')) {
      await fixFile(fullPath);
    }
  }
}

for (const target of targets) {
  const abs = path.resolve(process.cwd(), target);
  await walk(abs);
}
