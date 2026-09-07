import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';
import fs from 'node:fs';

function setupExporter() {
    const jsonExporterCode = fs.readFileSync('exporters/json_export.js', 'utf8');
    const dom = loadDom();
    dom.window.eval(jsonExporterCode);
    return dom.window.exportJson;
}

test('exportJson produces valid structured JSON schema', () => {
    const exportJson = setupExporter();
    const chatData = {
        title: 'Project Architecture',
        turns: [
            { role: 'user', text: 'How should we build this?', html: '<p>How should we build this?</p>' },
            { role: 'model', text: 'Use clean architecture.', html: '<p>Use clean architecture.</p>', thought: 'Plan: breakdown components' }
        ],
        images: [{ id: 'image-0', alt: 'diagram', ext: 'png' }]
    };

    const jsonString = exportJson(chatData);
    const parsed = JSON.parse(jsonString);

    assert.equal(parsed.title, 'Project Architecture');
    assert.equal(parsed.turns.length, 2);
    assert.equal(parsed.turns[0].role, 'user');
    assert.equal(parsed.turns[1].role, 'model');
    assert.equal(parsed.turns[1].thought, 'Plan: breakdown components');
    assert.equal(parsed.images.length, 1);
    assert.ok(parsed.exportedAt);
    assert.equal(parsed.version, '1.1.0');
});
