#!/usr/bin/env node
import path from 'node:path';
import { createSyntheticFrame } from './core/mesh-generator.mjs';
import { writeCaptureJob } from './core/artifact-writer.mjs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args[key] = argv[i + 1];
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(arg);
    }
  }
  return args;
}

function help() {
  return `Kai 3D Capture

Usage:
  node src/cli.mjs demo [--workspace path] [--mode relief|turntable]
  node src/server/kai-capture-server.mjs --port 3947 --workspace path
`;
}

async function main() {
  const command = process.argv[2] || 'help';
  const args = parseArgs(process.argv.slice(3));
  if (command === 'help' || command === '--help') {
    console.log(help());
    return;
  }
  if (command === 'demo') {
    const frames = Array.from({ length: args.mode === 'relief' ? 1 : 12 }, (_, index) =>
      createSyntheticFrame({ width: 48, height: 48, phase: index / 12, name: `synthetic-${String(index).padStart(3, '0')}` })
    );
    const result = await writeCaptureJob({
      name: 'demo-capture',
      mode: args.mode || 'turntable',
      measurement: { axis: 'height', millimeters: 120 },
      quality: { widthSegments: 48, heightSegments: 48, depthMillimeters: 32 },
      frames
    }, {
      workspace: path.resolve(args.workspace || path.join(process.cwd(), '.kai-3d-capture', 'demo'))
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

