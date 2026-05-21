import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMesh, createManifest, createSyntheticFrame } from '../src/core/mesh-generator.mjs';
import { exportObj, exportPly, exportStl } from '../src/core/exporters.mjs';

test('buildMesh creates relief mesh with scaled dimensions', () => {
  const frame = createSyntheticFrame({ width: 16, height: 16 });
  const { job, mesh } = buildMesh({
    name: 'unit-relief',
    mode: 'relief',
    measurement: { axis: 'height', millimeters: 80 },
    quality: { widthSegments: 16, heightSegments: 16, depthMillimeters: 10 },
    frames: [frame]
  });
  assert.equal(job.mode, 'relief');
  assert.equal(mesh.vertices.length, 256);
  assert.equal(mesh.faces.length, 450);
  assert.ok(Math.abs(mesh.extents.size[1] - 80) < 0.001);
});

test('buildMesh creates turntable shell and export text formats', () => {
  const frames = Array.from({ length: 6 }, (_, index) => createSyntheticFrame({ width: 14, height: 14, phase: index / 6 }));
  const { job, mesh } = buildMesh({
    name: 'unit-turntable',
    mode: 'turntable',
    measurement: { axis: 'height', millimeters: 90 },
    quality: { widthSegments: 14, heightSegments: 14, depthMillimeters: 20 },
    frames
  });
  const manifest = createManifest(job, mesh, {});
  assert.equal(mesh.mode, 'turntable');
  assert.ok(mesh.vertices.length > 500);
  assert.ok(mesh.faces.length > 900);
  assert.equal(manifest.schema, 'kai-capture-manifest.v1');
  assert.ok(exportPly(mesh).startsWith('ply'));
  assert.ok(exportObj(mesh).includes('Kai 3D Capture OBJ'));
  assert.ok(exportStl(mesh).startsWith('solid'));
});

