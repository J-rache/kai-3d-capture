import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSyntheticFrame } from '../src/core/mesh-generator.mjs';
import { writeCaptureJob } from '../src/core/artifact-writer.mjs';
import { startKaiCaptureServer } from '../src/server/kai-capture-server.mjs';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'kai-3d-capture-'));
const frames = Array.from({ length: 8 }, (_, index) =>
  createSyntheticFrame({ width: 28, height: 28, phase: index / 8, name: `smoke-${index}` })
);

const direct = await writeCaptureJob({
  name: 'smoke-direct',
  mode: 'turntable',
  measurement: { axis: 'height', millimeters: 80 },
  quality: { widthSegments: 28, heightSegments: 28, depthMillimeters: 18 },
  frames
}, { workspace });

assert.equal(direct.ok, true);
assert.ok(direct.summary.vertices > 0);
assert.ok(direct.summary.faces > 0);
for (const file of Object.values(direct.exports)) {
  const stat = await fs.stat(file);
  assert.ok(stat.size > 50, `${file} should not be empty`);
}

const runtime = await startKaiCaptureServer({ port: 0, workspace });
try {
  const address = runtime.server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  const response = await fetch(`${base}/api/reconstruct`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'smoke-api',
      mode: 'relief',
      measurement: { axis: 'width', millimeters: 50 },
      quality: { widthSegments: 28, heightSegments: 28, depthMillimeters: 12 },
      frames: frames.slice(0, 1)
    })
  });
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.ok, true);
  assert.ok(json.exports.ply.endsWith('model.ply'));
} finally {
  await new Promise((resolve) => runtime.server.close(resolve));
}

console.log('Smoke passed.');
