export function createKaiCaptureClient(options = {}) {
  const baseUrl = options.baseUrl || 'http://127.0.0.1:3947';
  return {
    async health() {
      const response = await fetch(`${baseUrl}/health`);
      return response.json();
    },
    async reconstruct(job) {
      const response = await fetch(`${baseUrl}/api/reconstruct`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(job)
      });
      const json = await response.json();
      if (!response.ok || json.ok === false) {
        throw new Error(json.error || `Kai 3D Capture request failed: ${response.status}`);
      }
      return json;
    }
  };
}

export async function sampleImageElement(image, options = {}) {
  const width = options.width || 56;
  const height = options.height || 56;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  return samplesFromRgba(data, width, height, options.name || image.currentSrc || image.src || 'image');
}

export async function sampleVideoElement(video, options = {}) {
  const frameCount = options.frameCount || 24;
  const width = options.width || 56;
  const height = options.height || 56;
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
  const frames = [];
  const originalTime = video.currentTime || 0;
  for (let index = 0; index < frameCount; index += 1) {
    const time = duration * (index + 0.5) / frameCount;
    video.currentTime = time;
    await once(video, 'seeked');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(video, 0, 0, width, height);
    frames.push(samplesFromRgba(context.getImageData(0, 0, width, height).data, width, height, `video-${String(index).padStart(3, '0')}`));
  }
  video.currentTime = originalTime;
  return frames;
}

export function samplesFromRgba(data, width, height, name = 'frame') {
  const heights = [];
  const colors = [];
  for (let index = 0; index < width * height; index += 1) {
    const r = data[index * 4];
    const g = data[index * 4 + 1];
    const b = data[index * 4 + 2];
    const a = data[index * 4 + 3] / 255;
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const edgeBias = Math.abs(r - b) / 255 * 0.08;
    heights.push(Math.max(0, Math.min(1, luma * a + edgeBias)));
    colors.push(r, g, b);
  }
  return { name, width, height, heights, colors };
}

function once(target, eventName) {
  return new Promise((resolve) => {
    target.addEventListener(eventName, resolve, { once: true });
  });
}

