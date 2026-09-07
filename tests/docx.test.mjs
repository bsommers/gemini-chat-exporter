import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';
import fs from 'node:fs';

const docxLibCode = fs.readFileSync('lib/docx.min.js', 'utf8');
const docxExportCode = fs.readFileSync('exporters/docx_export.js', 'utf8');

function setupDocx() {
    const dom = loadDom();
    dom.window.eval(docxLibCode);
    dom.window.eval(docxExportCode);
    return {
        exportDocx: dom.window.exportDocx,
        dom
    };
}

test('exportDocx generates a valid Blob without throwing errors', async () => {
    const { exportDocx } = setupDocx();
    assert.ok(typeof exportDocx === 'function', 'exportDocx is defined on window');
    const chatData = {
        title: 'DOCX Test',
        turns: [
            {
                role: 'user',
                text: 'Here is a list and an attachment',
                attachments: [
                    { type: 'image', id: 'image-0', alt: 'User Diagram' }
                ]
            },
            {
                role: 'model',
                text: 'Items',
                html: `
                    <details class="gemini-thought">
                        <summary>Thinking Process</summary>
                        <div class="thought-content">Evaluating response structure.</div>
                    </details>
                    <ul>
                        <li>Item 1</li>
                        <li>Item 2
                            <ul>
                                <li>Nested 2.1</li>
                                <li>Nested 2.2</li>
                            </ul>
                        </li>
                    </ul>
                    <p><img src="https://gemini.google.com/app/__IMAGE_PLACEHOLDER__image-1" data-exporter-id="image-1" alt="Model Output"></p>
                    <table>
                        <thead>
                            <tr><th>Col 1</th><th>Col 2</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Val 1</td><td>Val 2</td></tr>
                        </tbody>
                    </table>
                `
            }
        ],
        images: [
            {
                id: 'image-0',
                base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADklEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                alt: 'User Diagram',
                ext: 'png'
            },
            {
                id: 'image-1',
                base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADklEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                alt: 'Model Output',
                ext: 'png'
            }
        ]
    };

    const blob = await exportDocx(chatData);
    assert.ok(blob, 'Blob returned');
    assert.ok(blob.size > 0, 'Blob contains data');
});

test('exportDocx handles nested ordered lists and minimal chat data safely', async () => {
    const { exportDocx } = setupDocx();
    const chatData = {
        title: 'Minimal DOCX',
        turns: [
            {
                role: 'user',
                text: 'Simple prompt'
            },
            {
                role: 'model',
                text: 'Ordered list',
                html: '<ol><li>First step</li><li>Second step<ol><li>Substep A</li></ol></li></ol>'
            }
        ]
    };

    const blob = await exportDocx(chatData);
    assert.ok(blob, 'Blob returned for minimal chat');
    assert.ok(blob.size > 0, 'Blob contains content');
});
