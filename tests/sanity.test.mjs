import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';

test('DOM environment loads properly in test harness', () => {
    const dom = loadDom('<div id="test">Hello Gemini</div>');
    const el = dom.window.document.getElementById('test');
    assert.equal(el.textContent, 'Hello Gemini');
});
