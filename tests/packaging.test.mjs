import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

test('npm run build creates dist/unpacked with valid manifest and no development files', () => {
    // Run build script
    execSync('node scripts/package.mjs', { stdio: 'pipe' });

    assert.ok(fs.existsSync('dist/unpacked/manifest.json'), 'manifest exists in unpacked');
    assert.ok(fs.existsSync('dist/unpacked/popup.html'), 'popup.html exists in unpacked');
    assert.ok(fs.existsSync('dist/unpacked/content.js'), 'content.js exists in unpacked');
    assert.ok(fs.existsSync('dist/unpacked/background.js'), 'background.js exists in unpacked');
    assert.ok(fs.existsSync('dist/unpacked/exporters/markdown.js'), 'markdown exporter exists');
    assert.ok(fs.existsSync('dist/unpacked/exporters/json_export.js'), 'json exporter exists');
    assert.ok(fs.existsSync('dist/unpacked/exporters/docx_export.js'), 'docx exporter exists');
    assert.ok(fs.existsSync('dist/unpacked/exporters/html_single.js'), 'html single exporter exists');
    assert.ok(fs.existsSync('dist/unpacked/exporters/html_linked.js'), 'html linked exporter exists');
    assert.ok(fs.existsSync('dist/unpacked/lib/turndown.min.js'), 'turndown lib exists');
    assert.ok(fs.existsSync('dist/unpacked/lib/jszip.min.js'), 'jszip lib exists');
    assert.ok(fs.existsSync('dist/unpacked/lib/docx.min.js'), 'docx lib exists');
    assert.ok(fs.existsSync('dist/unpacked/icons/icon16.png'), 'icon16 exists');
    assert.ok(fs.existsSync('dist/unpacked/icons/icon48.png'), 'icon48 exists');
    assert.ok(fs.existsSync('dist/unpacked/icons/icon128.png'), 'icon128 exists');
    assert.ok(fs.existsSync('dist/unpacked/LICENSE'), 'LICENSE exists in unpacked');

    // Verify development files are EXCLUDED from dist/unpacked
    assert.ok(!fs.existsSync('dist/unpacked/tests'), 'tests directory excluded');
    assert.ok(!fs.existsSync('dist/unpacked/docs'), 'docs directory excluded');
    assert.ok(!fs.existsSync('dist/unpacked/scripts'), 'scripts directory excluded');
    assert.ok(!fs.existsSync('dist/unpacked/package.json'), 'package.json excluded');
    assert.ok(!fs.existsSync('dist/unpacked/package-lock.json'), 'package-lock.json excluded');
    assert.ok(!fs.existsSync('dist/unpacked/node_modules'), 'node_modules excluded');
    assert.ok(!fs.existsSync('dist/unpacked/.git'), '.git excluded');

    // Verify zip package exists
    const files = fs.readdirSync('dist');
    const zip = files.find(f => f.endsWith('.zip'));
    assert.ok(zip, 'dist contains a zip package');
    assert.ok(fs.statSync(`dist/${zip}`).size > 0, 'zip package is not empty');
});
