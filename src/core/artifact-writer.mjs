import fs from 'node:fs/promises';
import path from 'node:path';
import { buildMesh, createManifest, sanitizeName } from './mesh-generator.mjs';
import { exportBundle } from './exporters.mjs';

export async function writeCaptureJob(jobInput, options = {}) {
  const workspace = path.resolve(options.workspace || path.join(process.cwd(), '.kai-3d-capture', 'jobs'));
  const { job, mesh } = buildMesh(jobInput);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jobId = `${stamp}-${sanitizeName(job.name)}`;
  const jobDir = path.join(workspace, jobId);
  await fs.mkdir(jobDir, { recursive: true });

  const exportPaths = {
    ply: path.join(jobDir, 'model.ply'),
    obj: path.join(jobDir, 'model.obj'),
    stl: path.join(jobDir, 'model.stl'),
    mesh: path.join(jobDir, 'mesh.json'),
    manifest: path.join(jobDir, 'manifest.json')
  };
  const manifest = createManifest(job, mesh, exportPaths);
  const bundle = exportBundle(job, mesh, manifest);
  await Promise.all([
    fs.writeFile(exportPaths.ply, bundle.ply, 'utf8'),
    fs.writeFile(exportPaths.obj, bundle.obj, 'utf8'),
    fs.writeFile(exportPaths.stl, bundle.stl, 'utf8'),
    fs.writeFile(exportPaths.mesh, bundle.mesh, 'utf8'),
    fs.writeFile(exportPaths.manifest, bundle.manifest, 'utf8')
  ]);

  return {
    ok: true,
    jobId,
    jobDir,
    manifestPath: exportPaths.manifest,
    exports: exportPaths,
    summary: {
      mode: mesh.mode,
      vertices: mesh.vertices.length,
      faces: mesh.faces.length,
      extents: mesh.extents
    }
  };
}

