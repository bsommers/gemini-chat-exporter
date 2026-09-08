// scripts/package.mjs
// Automated packaging pipeline for Gemini Chat Exporter

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const UNPACKED = path.join(DIST, 'unpacked');

// 1. Read manifest version
const manifestPath = path.join(ROOT, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.0.0';

console.log(`📦 Packaging Gemini Chat Exporter v${version}...`);

// 2. Clean and recreate dist directories
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
}
fs.mkdirSync(UNPACKED, { recursive: true });

// 3. Define files and directories to include in unpacked extension
const filesToCopy = [
    'manifest.json',
    'background.js',
    'content.js',
    'popup.html',
    'popup.css',
    'popup.js',
    'LICENSE'
];

const dirsToCopy = [
    'exporters',
    'lib',
    'icons'
];

for (const file of filesToCopy) {
    const src = path.join(ROOT, file);
    const dest = path.join(UNPACKED, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
    }
}

for (const dir of dirsToCopy) {
    const src = path.join(ROOT, dir);
    const dest = path.join(UNPACKED, dir);
    if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
    }
}

console.log(`✓ Copied runtime files to dist/unpacked/`);

// 4. Initialize JSZip using vendored library
const jszipCode = fs.readFileSync(path.join(ROOT, 'lib/jszip.min.js'), 'utf8');
const sandbox = {
    globalThis: {},
    self: {},
    module: { exports: {} },
    exports: {},
    setImmediate,
    clearImmediate,
    Buffer
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.runInNewContext(jszipCode, sandbox);
const JSZip = sandbox.JSZip || sandbox.module.exports;

const zip = new JSZip();

function addDirToZip(currentDir, zipDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            addDirToZip(fullPath, zipDir.folder(entry.name));
        } else {
            zipDir.file(entry.name, fs.readFileSync(fullPath));
        }
    }
}

addDirToZip(UNPACKED, zip);

const zipFileName = `gemini-chat-exporter-v${version}.zip`;
const zipFilePath = path.join(DIST, zipFileName);

const zipData = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
});

fs.writeFileSync(zipFilePath, zipData);

const zipStat = fs.statSync(zipFilePath);
const zipKb = (zipStat.size / 1024).toFixed(1);

console.log(`✓ Created standalone zip: dist/${zipFileName} (${zipKb} KB)`);
console.log(`\n🎉 Packaging complete!`);
console.log(`• Unpacked directory for Chrome: dist/unpacked/`);
console.log(`• Distribution archive: dist/${zipFileName}\n`);
