import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';
import fs from 'node:fs';

const singleHtmlCode = fs.readFileSync('exporters/html_single.js', 'utf8');
const linkedHtmlCode = fs.readFileSync('exporters/html_linked.js', 'utf8');
const jszipCode = fs.readFileSync('lib/jszip.min.js', 'utf8');

function setupSingle() {
    const dom = loadDom();
    dom.window.eval(singleHtmlCode);
    return dom.window.exportHtmlSingle;
}

function setupLinked() {
    const dom = loadDom();
    dom.window.eval(jszipCode);
    dom.window.eval(linkedHtmlCode);
    return dom.window.exportHtmlLinked;
}

test('exportHtmlSingle replaces image placeholders with base64 data URIs even with full URLs in src', () => {
    const exportHtmlSingle = setupSingle();
    const chatData = {
        title: 'HTML Test',
        turns: [
            {
                role: 'model',
                text: 'Image response',
                html: '<p><img src="https://gemini.google.com/app/__IMAGE_PLACEHOLDER__image-0" data-exporter-id="image-0" alt="Generated Chart"></p>'
            }
        ],
        images: [
            { id: 'image-0', base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', alt: 'Generated Chart', ext: 'png' }
        ]
    };

    const html = exportHtmlSingle(chatData);
    assert.ok(html.includes('data:image/png;base64,iVBORw0KGgo'), 'Base64 image is embedded');
    assert.ok(!html.includes('__IMAGE_PLACEHOLDER__'), 'Placeholder is completely replaced');
    assert.ok(html.includes('gemini-thought'), 'CSS or HTML includes thought support');
});

test('exportHtmlLinked creates a zip with index.html, styles.css, and images folder', async () => {
    const exportHtmlLinked = setupLinked();
    const chatData = {
        title: 'Linked Test',
        turns: [
            {
                role: 'user',
                text: 'Prompt',
                attachments: [{ type: 'image', id: 'image-0', alt: 'User Upload' }]
            },
            {
                role: 'model',
                text: 'Response',
                html: '<p><img src="https://gemini.google.com/app/__IMAGE_PLACEHOLDER__image-1" data-exporter-id="image-1" alt="Model Output"></p>'
            }
        ],
        images: [
            { id: 'image-0', base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', alt: 'User Upload', ext: 'png' },
            { id: 'image-1', base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', alt: 'Model Output', ext: 'png' }
        ]
    };

    const blob = await exportHtmlLinked(chatData);
    assert.ok(blob, 'Zip blob generated');
    assert.ok(blob.size > 0, 'Zip contains content');

    // Verify zip archive contents using JSZip
    const testDom = loadDom();
    testDom.window.eval(jszipCode);
    const JSZip = testDom.window.JSZip;
    const unzipped = await JSZip.loadAsync(blob);
    assert.ok(unzipped.file('index.html'), 'index.html exists in zip');
    assert.ok(unzipped.file('styles.css'), 'styles.css exists in zip');
    assert.ok(unzipped.file('images/image-0.png'), 'images/image-0.png exists in zip');
    assert.ok(unzipped.file('images/image-1.png'), 'images/image-1.png exists in zip');
    const indexHtml = await unzipped.file('index.html').async('string');
    assert.ok(indexHtml.includes('src="images/image-0.png"'), 'user attachment referenced in index.html');
    assert.ok(indexHtml.includes('src="images/image-1.png"'), 'model image referenced in index.html');
});
