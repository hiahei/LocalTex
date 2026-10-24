import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');

await build({
  entryPoints: [path.join(root, 'client', 'collaboration-runtime.js')],
  outfile: path.join(root, 'public', 'vendor', 'collaboration.js'),
  bundle: true,
  format: 'iife',
  legalComments: 'none',
  minify: true,
  sourcemap: false,
  target: ['chrome100', 'edge100', 'firefox100'],
});
