import * as THREE from './vendor/three.module.js';
import { buildMesh, createManifest, createSyntheticFrame } from '../src/core/mesh-generator.mjs';
import { exportBundle } from '../src/core/exporters.mjs';

const state = {
  files: [],
  frames: [],
  job: null,
  mesh: null,
  manifest: null,
  bundle: null,
  scene: null,
  camera: null,
  renderer: null,
  meshObject: null,
  drag: null
};

const $ = (id) => document.getElementById(id);

function setStatus(text) {
  $('statusText').textContent = text;
}

function readSettings() {
  const grid = Number($('gridInput').value || 56);
  return {
    name: state.files[0]?.name?.replace(/\.[^.]+$/, '') || 'kai-capture',
    mode: $('modeInput').value,
    measurement: {
      axis: $('axisInput').value,
      millimeters: Number($('mmInput').value || 120)
    },
    quality: {
      widthSegments: grid,
      heightSegments: grid,
      depthMillimeters: Number($('depthInput').value || 28)
    },
    frames: state.frames
  };
}

function initViewer() {
  const host = $('viewer');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101316);
  const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 5000);
  camera.position.set(0, 80, 260);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 1.8);
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(120, 180, 150);
  scene.add(ambient, key, new THREE.GridHelper(240, 24, 0x38515a, 0x222a30));

  state.scene = scene;
  state.camera = camera;
  state.renderer = renderer;

  renderer.domElement.addEventListener('pointerdown', (event) => {
    state.drag = { x: event.clientX, y: event.clientY };
  });
  window.addEventListener('pointerup', () => {
    state.drag = null;
  });
  window.addEventListener('pointermove', (event) => {
    if (!state.drag || !state.meshObject) return;
    const dx = event.clientX - state.drag.x;
    const dy = event.clientY - state.drag.y;
    state.meshObject.rotation.y += dx * 0.01;
    state.meshObject.rotation.x += dy * 0.01;
    state.drag = { x: event.clientX, y: event.clientY };
  });
  window.addEventListener('resize', resizeViewer);
  animate();
}

function resizeViewer() {
  const host = $('viewer');
  if (!state.renderer || !state.camera) return;
  state.camera.aspect = host.clientWidth / host.clientHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(host.clientWidth, host.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  if (state.meshObject && !state.drag) {
    state.meshObject.rotation.y += 0.003;
  }
  state.renderer.render(state.scene, state.camera);
}

function meshToThree(mesh) {
  const positions = [];
  const colors = [];
  for (const face of mesh.faces) {
    for (const index of face) {
      const vertex = mesh.vertices[index];
      const color = mesh.colors[index] || [0.8, 0.8, 0.8];
      positions.push(vertex[0], vertex[1], vertex[2]);
      colors.push(color[0], color[1], color[2]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.05,
    side: THREE.DoubleSide
  });
  return new THREE.Mesh(geometry, material);
}

function showMesh(mesh) {
  if (state.meshObject) {
    state.scene.remove(state.meshObject);
    state.meshObject.geometry.dispose();
    state.meshObject.material.dispose();
  }
  state.meshObject = meshToThree(mesh);
  state.scene.add(state.meshObject);
  const size = mesh.extents.size;
  $('meshStats').textContent = `${mesh.vertices.length} vertices, ${mesh.faces.length} faces, ${size.map((n) => n.toFixed(1)).join(' x ')} mm`;
}

async function loadMediaFiles(files) {
  state.files = [...files];
  state.frames = [];
  const images = state.files.filter((file) => file.type.startsWith('image/'));
  const videos = state.files.filter((file) => file.type.startsWith('video/'));
  const grid = Number($('gridInput').value || 56);
  const frameCount = Number($('frameCountInput').value || 24);

  setStatus('Sampling media...');
  if (videos.length > 0) {
    state.frames = await sampleVideoFile(videos[0], { width: grid, height: grid, frameCount });
  } else {
    const selected = images.slice(0, Math.max(1, frameCount));
    for (let index = 0; index < selected.length; index += 1) {
      state.frames.push(await sampleImageFile(selected[index], { width: grid, height: grid, name: `image-${String(index).padStart(3, '0')}` }));
    }
  }
  renderFrames();
  setStatus(`Sampled ${state.frames.length} frame(s).`);
}

async function sampleVideoFile(file, options) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.src = url;
  await once(video, 'loadedmetadata');
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
  const frames = [];
  for (let index = 0; index < options.frameCount; index += 1) {
    video.currentTime = duration * (index + 0.5) / options.frameCount;
    await once(video, 'seeked');
    frames.push(sampleCanvasSource(video, {
      width: options.width,
      height: options.height,
      name: `video-${String(index).padStart(3, '0')}`
    }));
  }
  URL.revokeObjectURL(url);
  return frames;
}

async function sampleImageFile(file, options) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await once(image, 'load');
  const frame = sampleCanvasSource(image, options);
  URL.revokeObjectURL(url);
  return frame;
}

function sampleCanvasSource(source, options) {
  const canvas = document.createElement('canvas');
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0, options.width, options.height);
  const data = context.getImageData(0, 0, options.width, options.height).data;
  const heights = [];
  const colors = [];
  for (let index = 0; index < options.width * options.height; index += 1) {
    const r = data[index * 4];
    const g = data[index * 4 + 1];
    const b = data[index * 4 + 2];
    const a = data[index * 4 + 3] / 255;
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const contrast = Math.abs(r - b) / 255 * 0.08;
    heights.push(Math.max(0, Math.min(1, luma * a + contrast)));
    colors.push(r, g, b);
  }
  return { name: options.name || 'frame', width: options.width, height: options.height, heights, colors };
}

function frameToCanvas(frame) {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext('2d');
  const image = context.createImageData(frame.width, frame.height);
  for (let index = 0; index < frame.width * frame.height; index += 1) {
    image.data[index * 4] = frame.colors[index * 3];
    image.data[index * 4 + 1] = frame.colors[index * 3 + 1];
    image.data[index * 4 + 2] = frame.colors[index * 3 + 2];
    image.data[index * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function renderFrames() {
  const strip = $('frameStrip');
  strip.innerHTML = '';
  for (const frame of state.frames.slice(0, 48)) {
    strip.appendChild(frameToCanvas(frame));
  }
}

function buildCurrentMesh() {
  if (state.frames.length === 0) throw new Error('Import media or run Demo first.');
  const jobInput = readSettings();
  const { job, mesh } = buildMesh(jobInput);
  const manifest = createManifest(job, mesh, {});
  const bundle = exportBundle(job, mesh, manifest);
  state.job = job;
  state.mesh = mesh;
  state.manifest = manifest;
  state.bundle = bundle;
  showMesh(mesh);
  renderExports();
  $('exportButton').disabled = false;
  setStatus(`Built ${mesh.mode} mesh from ${state.frames.length} sampled frame(s).`);
}

function renderExports() {
  $('exportList').innerHTML = [
    ['model.ply', `${state.bundle?.ply?.length || 0} bytes`],
    ['model.obj', `${state.bundle?.obj?.length || 0} bytes`],
    ['model.stl', `${state.bundle?.stl?.length || 0} bytes`],
    ['manifest.json', `${state.bundle?.manifest?.length || 0} bytes`]
  ].map(([name, detail]) => `<div><strong>${name}</strong><br>${detail}</div>`).join('');
}

async function exportCurrentMesh() {
  if (!state.bundle || !state.job) return;
  const files = {
    'model.ply': state.bundle.ply,
    'model.obj': state.bundle.obj,
    'model.stl': state.bundle.stl,
    'manifest.json': state.bundle.manifest,
    'mesh.json': state.bundle.mesh
  };
  if (window.kai3d?.saveBundle) {
    const result = await window.kai3d.saveBundle({ defaultName: state.job.name, files });
    if (result.ok) setStatus(`Exported to ${result.targetDir}`);
    return;
  }
  for (const [name, content] of Object.entries(files)) {
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

function loadDemo() {
  const mode = $('modeInput').value;
  const count = mode === 'relief' ? 1 : Number($('frameCountInput').value || 24);
  state.files = [];
  state.frames = Array.from({ length: count }, (_, index) =>
    createSyntheticFrame({ width: Number($('gridInput').value || 56), height: Number($('gridInput').value || 56), phase: index / count, name: `demo-${index}` })
  );
  renderFrames();
  buildCurrentMesh();
}

function once(target, eventName) {
  return new Promise((resolve, reject) => {
    target.addEventListener(eventName, resolve, { once: true });
    target.addEventListener('error', () => reject(new Error(`Failed to load ${eventName} target.`)), { once: true });
  });
}

$('mediaInput').addEventListener('change', async (event) => {
  try {
    await loadMediaFiles(event.target.files);
  } catch (error) {
    setStatus(error.message);
  }
});

$('buildButton').addEventListener('click', () => {
  try {
    buildCurrentMesh();
  } catch (error) {
    setStatus(error.message);
  }
});

$('exportButton').addEventListener('click', () => {
  exportCurrentMesh().catch((error) => setStatus(error.message));
});

$('demoButton').addEventListener('click', () => {
  try {
    loadDemo();
  } catch (error) {
    setStatus(error.message);
  }
});

initViewer();
loadDemo();
