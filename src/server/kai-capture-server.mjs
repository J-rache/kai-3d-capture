import http from 'node:http';
import path from 'node:path';
import { writeCaptureJob } from '../core/artifact-writer.mjs';

function parseArgs(argv) {
  const args = { port: 3947, workspace: path.join(process.cwd(), '.kai-3d-capture', 'jobs') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') {
      args.port = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--workspace') {
      args.workspace = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--host') {
      args.host = argv[i + 1];
      i += 1;
    }
  }
  args.host ??= '127.0.0.1';
  args.workspace = path.resolve(args.workspace);
  return args;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024 * 1024) throw new Error('Request too large. Send sampled frames, not raw video.');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': 'http://127.0.0.1',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

export function createKaiCaptureServer(options = {}) {
  const workspace = path.resolve(options.workspace || path.join(process.cwd(), '.kai-3d-capture', 'jobs'));
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'OPTIONS') {
        sendJson(res, 200, { ok: true });
        return;
      }
      if (url.pathname === '/health') {
        sendJson(res, 200, {
          ok: true,
          name: 'kai-3d-capture',
          version: '0.1.0',
          workspace,
          endpoints: ['/api/reconstruct', '/api/engines']
        });
        return;
      }
      if (url.pathname === '/api/engines') {
        sendJson(res, 200, {
          ok: true,
          builtIn: ['relief', 'turntable'],
          optionalExternal: [
            { id: 'colmap-openmvs', status: 'adapter-slot', bundled: false },
            { id: 'meshroom-alicevision', status: 'adapter-slot', bundled: false },
            { id: 'nerfstudio-gaussian', status: 'adapter-slot', bundled: false }
          ]
        });
        return;
      }
      if (url.pathname === '/api/reconstruct' && req.method === 'POST') {
        const body = await readJson(req);
        const result = await writeCaptureJob(body, { workspace });
        sendJson(res, 200, result);
        return;
      }
      sendJson(res, 404, { ok: false, error: 'Not found' });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
  });
}

export async function startKaiCaptureServer(options = {}) {
  const server = createKaiCaptureServer(options);
  const port = Number(options.port ?? 3947);
  const host = options.host || '127.0.0.1';
  await new Promise((resolve) => server.listen(port, host, resolve));
  return {
    server,
    url: `http://${host}:${port}/`,
    workspace: path.resolve(options.workspace || path.join(process.cwd(), '.kai-3d-capture', 'jobs'))
  };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('kai-capture-server.mjs')) {
  const args = parseArgs(process.argv.slice(2));
  startKaiCaptureServer(args)
    .then((runtime) => {
      console.log(JSON.stringify({
        ok: true,
        url: runtime.url,
        workspace: runtime.workspace,
        pid: process.pid
      }, null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
