import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';
import fs from 'node:fs';

const turndownCode = fs.readFileSync('lib/turndown.min.js', 'utf8');
const exporterCode = fs.readFileSync('exporters/markdown.js', 'utf8');

function setupExporter() {
    const dom = loadDom();
    dom.window.eval(turndownCode);
    dom.window.eval(exporterCode);
    return dom.window.exportMarkdown;
}

test('exportMarkdown preserves GFM tables properly', () => {
    const exportMarkdown = setupExporter();
    const chatData = {
        title: 'Table Test',
        turns: [
            {
                role: 'user',
                text: 'Make a table',
                html: 'Make a table'
            },
            {
                role: 'model',
                text: '',
                html: `<table>
                    <thead><tr><th>Item</th><th>Cost</th></tr></thead>
                    <tbody><tr><td>Apple</td><td>$1</td></tr><tr><td>Orange</td><td>$2</td></tr></tbody>
                </table>`
            }
        ],
        images: []
    };

    const md = exportMarkdown(chatData);
    assert.ok(md.includes('| Item | Cost |'), 'Markdown contains table headers');
    assert.ok(md.includes('| --- | --- |') || md.includes('| :--- | :--- |'), 'Markdown contains header delimiter');
    assert.ok(md.includes('| Apple | $1 |'), 'Markdown contains first row');
    assert.ok(md.includes('| Orange | $2 |'), 'Markdown contains second row');
});

test('exportMarkdown formats thinking process cleanly', () => {
    const exportMarkdown = setupExporter();
    const chatData = {
        title: 'Thinking Test',
        turns: [
            {
                role: 'model',
                text: '',
                html: '<details class="gemini-thought"><summary>Thinking Process</summary><div class="thought-content"><p>Considering quantum state...</p></div></details><p>Here is the final answer.</p>'
            }
        ],
        images: []
    };

    const md = exportMarkdown(chatData);
    assert.ok(md.includes('Thinking Process') || md.includes('Considering quantum state'));
    assert.ok(md.includes('Here is the final answer.'));
});

test('exportMarkdown formats thinking process without duplicating summary when thought-content is absent', () => {
    const exportMarkdown = setupExporter();
    const chatData = {
        title: 'Thinking Test No Content Wrapper',
        turns: [
            {
                role: 'model',
                text: '',
                html: '<details class="gemini-thought"><summary>Thinking Process</summary><p>Raw reasoning text here.</p></details>'
            }
        ],
        images: []
    };

    const md = exportMarkdown(chatData);
    const occurrences = (md.match(/Thinking Process/g) || []).length;
    assert.equal(occurrences, 1, 'Summary should only appear once in markdown output');
    assert.ok(md.includes('Raw reasoning text here.'));
});

test('exportMarkdown preserves latex math spans without escaping', () => {
    const exportMarkdown = setupExporter();
    const chatData = {
        title: 'Math Test',
        turns: [
            {
                role: 'model',
                text: '',
                html: '<p>The formula is <span class="latex-math">$E=mc^2$</span> and display is <span class="latex-math">\n$$\n\\int_0^1 x dx\n$$\n</span></p>'
            }
        ],
        images: []
    };

    const md = exportMarkdown(chatData);
    assert.ok(md.includes('$E=mc^2$'), 'Inline math preserved');
    assert.ok(md.includes('$$') && md.includes('\\int_0^1 x dx'), 'Display math preserved');
});

test('exportMarkdown resolves images by data-exporter-id or placeholder in src', () => {
    const exportMarkdown = setupExporter();
    const chatData = {
        title: 'Image Test',
        turns: [
            {
                role: 'model',
                text: '',
                html: '<p><img src="https://gemini.google.com/app/__IMAGE_PLACEHOLDER__image-0" data-exporter-id="image-0" alt="Architecture Diagram"></p>'
            }
        ],
        images: [
            { id: 'image-0', alt: 'Architecture Diagram', ext: 'png' }
        ]
    };

    const md = exportMarkdown(chatData);
    assert.ok(md.includes('![Architecture Diagram](image-0.png)'), 'Image markdown resolved properly');
});
