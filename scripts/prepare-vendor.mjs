import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = path.join(root, 'app', 'vendor');
await fs.mkdir(vendorDir, { recursive: true });
const files = ['three.module.js', 'three.core.js'];
for (const file of files) {
  const source = path.join(root, 'node_modules', 'three', 'build', file);
  const target = path.join(vendorDir, file);
  await fs.copyFile(source, target);
  console.log(`Prepared vendor file: ${target}`);
}
