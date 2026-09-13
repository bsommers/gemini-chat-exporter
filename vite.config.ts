import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// MV3 service workers and content scripts must be classic (non-module)
// scripts, so each entry is bundled standalone as an IIFE with its
// dependencies inlined. Rollup's "iife" output format can't code-split a
// shared chunk across multiple entry points in one build, so `npm run
// build` (see package.json) invokes `vite build` once per entry via the
// BUILD_ENTRY env var. Only the first pass (background) clears dist/ and
// copies static assets, so the later passes don't wipe out its output.
const ENTRIES: Record<string, string> = {
  background: 'src/background/index.ts',
  content: 'src/content/index.ts',
  popup: 'src/popup/popup.ts'
};

export default defineConfig(() => {
  const name = process.env.BUILD_ENTRY;
  if (!name || !(name in ENTRIES)) {
    throw new Error(`Set BUILD_ENTRY to one of: ${Object.keys(ENTRIES).join(', ')}`);
  }
  const isFirst = name === Object.keys(ENTRIES)[0];

  return {
    build: {
      outDir: 'dist',
      emptyOutDir: isFirst,
      rollupOptions: {
        input: resolve(__dirname, ENTRIES[name]!),
        output: {
          entryFileNames: `${name}.js`,
          format: 'iife' as const
        }
      }
    },
    plugins: isFirst
      ? [
          viteStaticCopy({
            targets: [
              { src: 'src/manifest.json', dest: '.' },
              { src: 'src/popup/popup.html', dest: '.' },
              { src: 'src/popup/popup.css', dest: '.' },
              { src: 'src/icons/*', dest: 'icons' }
            ]
          })
        ]
      : []
  };
});
