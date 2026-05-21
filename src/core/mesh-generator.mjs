export const MANIFEST_SCHEMA = 'kai-capture-manifest.v1';

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeName(value) {
  return String(value || 'capture')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'capture';
}

export function createSyntheticFrame(options = {}) {
  const width = options.width ?? 48;
  const height = options.height ?? 48;
  const name = options.name ?? 'synthetic';
  const phase = options.phase ?? 0;
  const heights = [];
  const colors = [];
  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const cx = u - 0.5;
      const cy = v - 0.5;
      const r = Math.sqrt(cx * cx + cy * cy);
      const wave = Math.sin((u + phase) * Math.PI * 2) * Math.cos(v * Math.PI);
      const h = clamp(1 - r * 1.6 + wave * 0.12);
      heights.push(h);
      colors.push(
        Math.round(70 + h * 150),
        Math.round(90 + u * 100),
        Math.round(120 + v * 80)
      );
    }
  }
  return { name, width, height, heights, colors };
}

export function validateFrame(frame) {
  if (!frame || typeof frame !== 'object') throw new Error('Frame must be an object.');
  if (!Number.isInteger(frame.width) || frame.width < 2) throw new Error(`Invalid frame width for ${frame.name || 'unnamed frame'}.`);
  if (!Number.isInteger(frame.height) || frame.height < 2) throw new Error(`Invalid frame height for ${frame.name || 'unnamed frame'}.`);
  const pixels = frame.width * frame.height;
  if (!Array.isArray(frame.heights) || frame.heights.length !== pixels) {
    throw new Error(`Frame ${frame.name || 'unnamed'} must include ${pixels} height samples.`);
  }
  if (!Array.isArray(frame.colors) || frame.colors.length !== pixels * 3) {
    throw new Error(`Frame ${frame.name || 'unnamed'} must include ${pixels * 3} color samples.`);
  }
}

export function normalizeJob(input = {}) {
  const frames = Array.isArray(input.frames) ? input.frames : [];
  if (frames.length === 0) throw new Error('At least one sampled frame is required.');
  for (const frame of frames) validateFrame(frame);

  const measurement = input.measurement || {};
  const millimeters = Number(measurement.millimeters || 100);
  if (!Number.isFinite(millimeters) || millimeters <= 0) {
    throw new Error('measurement.millimeters must be a positive number.');
  }

  const quality = input.quality || {};
  return {
    name: sanitizeName(input.name),
    mode: input.mode === 'turntable' ? 'turntable' : 'relief',
    measurement: {
      axis: ['width', 'height', 'depth'].includes(measurement.axis) ? measurement.axis : 'height',
      millimeters
    },
    quality: {
      widthSegments: Math.max(8, Math.min(128, Number(quality.widthSegments || frames[0].width || 48))),
      heightSegments: Math.max(8, Math.min(128, Number(quality.heightSegments || frames[0].height || 48))),
      depthMillimeters: Math.max(1, Math.min(500, Number(quality.depthMillimeters || millimeters * 0.22))),
      panelStride: Math.max(1, Math.min(8, Number(quality.panelStride || 1)))
    },
    frames
  };
}

function sampleFrame(frame, u, v) {
  const x = Math.max(0, Math.min(frame.width - 1, Math.round(u * (frame.width - 1))));
  const y = Math.max(0, Math.min(frame.height - 1, Math.round(v * (frame.height - 1))));
  const index = y * frame.width + x;
  return {
    height: clamp(Number(frame.heights[index]) || 0),
    color: [
      clamp((Number(frame.colors[index * 3]) || 0) / 255, 0, 1),
      clamp((Number(frame.colors[index * 3 + 1]) || 0) / 255, 0, 1),
      clamp((Number(frame.colors[index * 3 + 2]) || 0) / 255, 0, 1)
    ]
  };
}

function pushVertex(mesh, x, y, z, color) {
  mesh.vertices.push([x, y, z]);
  mesh.colors.push(color);
  return mesh.vertices.length - 1;
}

function addGridFaces(mesh, rowWidth, startIndex, rows, cols) {
  for (let y = 0; y < rows - 1; y += 1) {
    for (let x = 0; x < cols - 1; x += 1) {
      const a = startIndex + y * rowWidth + x;
      const b = startIndex + y * rowWidth + x + 1;
      const c = startIndex + (y + 1) * rowWidth + x;
      const d = startIndex + (y + 1) * rowWidth + x + 1;
      mesh.faces.push([a, c, b], [b, c, d]);
    }
  }
}

export function buildReliefMesh(jobInput) {
  const job = normalizeJob({ ...jobInput, mode: 'relief' });
  const frame = job.frames[0];
  const rows = job.quality.heightSegments;
  const cols = job.quality.widthSegments;
  const heightMm = job.measurement.axis === 'height' ? job.measurement.millimeters : 100;
  const widthMm = job.measurement.axis === 'width' ? job.measurement.millimeters : heightMm * (frame.width / frame.height);
  const depthMm = job.measurement.axis === 'depth' ? job.measurement.millimeters : job.quality.depthMillimeters;
  const mesh = {
    schema: 'kai-capture-mesh.v1',
    mode: 'relief',
    name: job.name,
    units: 'millimeters',
    vertices: [],
    colors: [],
    faces: [],
    sourceFrames: job.frames.map((item) => item.name || 'frame')
  };

  for (let y = 0; y < rows; y += 1) {
    const v = y / Math.max(1, rows - 1);
    for (let x = 0; x < cols; x += 1) {
      const u = x / Math.max(1, cols - 1);
      const sample = sampleFrame(frame, u, v);
      const px = (u - 0.5) * widthMm;
      const py = (0.5 - v) * heightMm;
      const pz = (sample.height - 0.5) * depthMm;
      pushVertex(mesh, px, py, pz, sample.color);
    }
  }
  addGridFaces(mesh, cols, 0, rows, cols);
  mesh.extents = computeExtents(mesh);
  return { job, mesh };
}

export function buildTurntableMesh(jobInput) {
  const job = normalizeJob({ ...jobInput, mode: 'turntable' });
  const rows = job.quality.heightSegments;
  const cols = job.quality.widthSegments;
  const frameCount = job.frames.length;
  const heightMm = job.measurement.axis === 'height' ? job.measurement.millimeters : 100;
  const widthMm = job.measurement.axis === 'width' ? job.measurement.millimeters : heightMm * (job.frames[0].width / job.frames[0].height);
  const depthMm = job.measurement.axis === 'depth' ? job.measurement.millimeters : job.quality.depthMillimeters;
  const radius = Math.max(widthMm, depthMm) * 0.32;
  const mesh = {
    schema: 'kai-capture-mesh.v1',
    mode: 'turntable',
    name: job.name,
    units: 'millimeters',
    vertices: [],
    colors: [],
    faces: [],
    sourceFrames: job.frames.map((item) => item.name || 'frame')
  };

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frame = job.frames[frameIndex];
    const angle = (Math.PI * 2 * frameIndex) / frameCount;
    const radial = [Math.cos(angle), 0, Math.sin(angle)];
    const tangent = [-Math.sin(angle), 0, Math.cos(angle)];
    const start = mesh.vertices.length;

    for (let y = 0; y < rows; y += 1) {
      const v = y / Math.max(1, rows - 1);
      for (let x = 0; x < cols; x += job.quality.panelStride) {
        const u = x / Math.max(1, cols - 1);
        const sample = sampleFrame(frame, u, v);
        const tangentOffset = (u - 0.5) * widthMm;
        const bulge = (sample.height - 0.45) * depthMm;
        const px = tangent[0] * tangentOffset + radial[0] * (radius + bulge);
        const py = (0.5 - v) * heightMm;
        const pz = tangent[2] * tangentOffset + radial[2] * (radius + bulge);
        pushVertex(mesh, px, py, pz, sample.color);
      }
    }

    const panelCols = Math.ceil(cols / job.quality.panelStride);
    addGridFaces(mesh, panelCols, start, rows, panelCols);
  }

  const panelCols = Math.ceil(cols / job.quality.panelStride);
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const nextFrame = (frameIndex + 1) % frameCount;
    const aStart = frameIndex * rows * panelCols;
    const bStart = nextFrame * rows * panelCols;
    const x = panelCols - 1;
    for (let y = 0; y < rows - 1; y += 1) {
      const a = aStart + y * panelCols + x;
      const b = aStart + (y + 1) * panelCols + x;
      const c = bStart + y * panelCols;
      const d = bStart + (y + 1) * panelCols;
      mesh.faces.push([a, b, c], [c, b, d]);
    }
  }

  mesh.extents = computeExtents(mesh);
  return { job, mesh };
}

export function buildMesh(jobInput) {
  return jobInput.mode === 'turntable' ? buildTurntableMesh(jobInput) : buildReliefMesh(jobInput);
}

export function computeExtents(mesh) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const vertex of mesh.vertices) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], vertex[axis]);
      max[axis] = Math.max(max[axis], vertex[axis]);
    }
  }
  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  };
}

export function createManifest(job, mesh, exports = {}) {
  return {
    schema: MANIFEST_SCHEMA,
    generatedAt: new Date().toISOString(),
    name: job.name,
    mode: mesh.mode,
    units: mesh.units,
    measurement: job.measurement,
    quality: job.quality,
    source: {
      frameCount: job.frames.length,
      frames: mesh.sourceFrames
    },
    model: {
      vertices: mesh.vertices.length,
      faces: mesh.faces.length,
      extents: mesh.extents
    },
    confidence: {
      geometry: mesh.mode === 'turntable' ? 'prototype-shell' : 'relief-reference',
      scale: 'known-measurement',
      metrology: false
    },
    exports,
    truthLimits: [
      'Common-camera reconstruction, not metrology-grade scanning.',
      'Use as Kai CAD reference geometry before rebuilding clean mechanical parts.',
      'Watertight repair may be needed before 3D printing.'
    ]
  };
}

