import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist/generated/prisma');
const relativeSpecifier = /((?:import|export)[^'"\n]*from\s+['"]|import\s*\(\s*['"]|import\s+['"])(\.[^'"]+?)(['"])/g;

async function javascriptFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await javascriptFiles(full)));
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

for (const file of await javascriptFiles(root)) {
  const source = await readFile(file, 'utf8');
  const next = source.replace(relativeSpecifier, (match, prefix, specifier, quote) => {
    if (specifier.endsWith('.js')) return match;
    return `${prefix}${specifier}.js${quote}`;
  });
  if (next !== source) await writeFile(file, next);
}
