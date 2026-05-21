# Truth Limits

Kai 3D Capture v0.1 produces useful common-camera meshes, not inspection-grade scans.

## Accurate Claims

- It can extract frames from ordinary videos.
- It can sample images into reconstruction grids.
- It can create scaled mesh artifacts from a known measurement.
- It can export PLY, OBJ, STL, and manifest JSON.
- It can act as a local Kai Browser worker.
- It can be packaged as a Windows desktop app.

## Not Claimed

- No 0.015 mm metrology.
- No guaranteed watertight mechanical part.
- No automatic CAD solids from arbitrary video yet.
- No bundled COLMAP, Meshroom, Blender, NeRF, or Gaussian Splatting engine in v0.1.

## Next Engine Layer

The correct next layer is adapter-based:

- COLMAP/OpenMVS for photogrammetry.
- Meshroom/AliceVision for guided image pipelines.
- DUSt3R/MASt3R/VGGT-style reconstruction for fewer images.
- Nerfstudio or Gaussian Splatting for photoreal scenes.
- CadQuery/OpenCascade/FreeCAD for clean CAD primitives.

## Test Runner Note

On the current Windows Node `v24.11.1` runtime, opening and closing the local HTTP server inside `node --test` triggered a native assertion in Node's callback scope. The server contract is therefore verified by `scripts/smoke.mjs`, which starts the API, calls `/health`, posts `/api/reconstruct`, checks output artifacts, and closes the server outside the built-in test runner.
