import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactDir = path.join(root, '.kai-3d-capture', 'ui-smoke');
await fs.mkdir(artifactDir, { recursive: true });

const app = await electron.launch({ args: ['.'], cwd: root });
try {
  const page = await app.firstWindow();
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`renderer:${message.type()}:${message.text()}`);
  });
  page.on('pageerror', (error) => console.error(`pageerror:${error.message}`));
  page.on('requestfailed', (request) => console.error(`requestfailed:${request.url()}:${request.failure()?.errorText}`));
  await page.waitForSelector('#viewer canvas', { timeout: 15000 });
  await page.waitForFunction(() => {
    const text = document.querySelector('#meshStats')?.textContent || '';
    return text.includes('vertices') && text.includes('faces');
  }, null, { timeout: 15000 });

  const screenshotPath = path.join(artifactDir, 'standalone-app.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const pixelStats = await page.$eval('#viewer canvas', (canvas) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const width = canvas.width;
    const height = canvas.height;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let nonZero = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] || pixels[index + 1] || pixels[index + 2]) nonZero += 1;
    }
    return { width, height, nonZero };
  });
  assert.ok(pixelStats.width > 200, 'canvas should have desktop width');
  assert.ok(pixelStats.height > 200, 'canvas should have desktop height');
  assert.ok(pixelStats.nonZero > 1000, 'WebGL canvas should contain nonblank pixels');
  const stats = await page.textContent('#meshStats');
  assert.match(stats, /vertices/);
  console.log(JSON.stringify({ ok: true, screenshotPath, pixelStats, stats }, null, 2));
} finally {
  await app.close();
}
