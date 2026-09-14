import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '../..');
const distDir = path.join(rootDir, 'dist');

beforeAll(() => {
  execSync('npm run build', { cwd: rootDir, stdio: 'pipe' });
}, 60_000);

describe('dist/ packaging', () => {
  it('contains a valid Manifest V3 manifest.json matching src/manifest.json', () => {
    const manifestPath = path.join(distDir, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const sourceManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/manifest.json'), 'utf8'));

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe(sourceManifest.name);
    for (const permission of sourceManifest.permissions) {
      expect(manifest.permissions).toContain(permission);
    }
  });

  it('produces all three bundled entry scripts', () => {
    for (const file of ['background.js', 'content.js', 'popup.js']) {
      expect(fs.existsSync(path.join(distDir, file))).toBe(true);
    }
  });

  it('copies popup.html and popup.css alongside the bundled popup.js', () => {
    expect(fs.existsSync(path.join(distDir, 'popup.html'))).toBe(true);
    expect(fs.existsSync(path.join(distDir, 'popup.css'))).toBe(true);
  });

  it('has every icon referenced in the manifest present as a real file', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8'));
    for (const size of Object.keys(manifest.icons)) {
      const iconPath = path.join(distDir, manifest.icons[size]);
      expect(fs.existsSync(iconPath)).toBe(true);
    }
  });

  it('does not leak test files, TypeScript sources, or node_modules into dist/', () => {
    const files = walk(distDir);
    expect(files.some((f) => f.includes('.test.'))).toBe(false);
    expect(files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'))).toBe(false);
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
  });
});

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
