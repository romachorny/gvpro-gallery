import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';

// Which public/icons/<id>.png files exist, so the page never asks for a missing one.
// Adding an icon file and rebuilding is the only step needed.
function iconFiles() {
  try { return readdirSync('public/icons').filter((f) => /\.png$/i.test(f)).map((f) => f.replace(/\.png$/i, '')); }
  catch { return []; }
}

export default defineConfig({
  define: { __ICONS__: JSON.stringify(iconFiles()) },
  build: { target: 'es2020', reportCompressedSize: true },
});
