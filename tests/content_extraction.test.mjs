import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';
import fs from 'node:fs';

const contentJs = fs.readFileSync('content.js', 'utf8');

function setupContent() {
    const dom = loadDom();
    dom.window.eval(contentJs);
    return dom.window.__geminiExporterHelpers;
}

test('cleanCodeBlocks in content.js replaces multiple code blocks without skipping', () => {
    const dom = loadDom(`
        <div id="root">
            <code-block lang="python"><pre><code>print(1)</code></pre></code-block>
            <code-block lang="javascript"><pre><code>console.log(2)</code></pre></code-block>
            <code-block lang="bash"><pre><code>echo 3</code></pre></code-block>
        </div>
    `);
    dom.window.eval(contentJs);
    const helpers = dom.window.__geminiExporterHelpers;
    const root = dom.window.document.getElementById('root');

    helpers.cleanCodeBlocks(root);

    const preEls = root.querySelectorAll('pre');
    assert.equal(preEls.length, 3);
    assert.equal(preEls[0].querySelector('code').className, 'language-python');
    assert.equal(preEls[0].textContent.trim(), 'print(1)');
    assert.equal(preEls[1].querySelector('code').className, 'language-javascript');
    assert.equal(preEls[1].textContent.trim(), 'console.log(2)');
    assert.equal(preEls[2].querySelector('code').className, 'language-bash');
    assert.equal(preEls[2].textContent.trim(), 'echo 3');
});

test('cleanKatexMath in content.js extracts raw TeX from annotations and distinguishes display vs inline', () => {
    const dom = loadDom(`
        <div id="root">
            <span class="katex">
                <span class="katex-mathml">
                    <math><semantics><mrow><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow>
                    <annotation encoding="application/x-tex">E=mc^2</annotation></semantics></math>
                </span>
                <span class="katex-html"><span class="base">E=mc2</span></span>
            </span>
            <div class="katex-display">
                <span class="katex">
                    <annotation encoding="application/x-tex">\\int_0^1 x dx</annotation>
                </span>
            </div>
        </div>
    `);
    dom.window.eval(contentJs);
    const helpers = dom.window.__geminiExporterHelpers;
    const root = dom.window.document.getElementById('root');

    helpers.cleanKatexMath(root);

    const mathSpans = root.querySelectorAll('.latex-math');
    assert.equal(mathSpans.length, 2);
    assert.equal(mathSpans[0].textContent, '$E=mc^2$');
    assert.ok(mathSpans[1].textContent.includes('$$\n\\int_0^1 x dx\n$$'));
});

test('extractConversationTitle prioritizes sidebar over header and first prompt fallback', () => {
    const dom = loadDom(`
        <conversation-item class="selected">
            <div class="title">My Custom Deep Dive</div>
        </conversation-item>
        <header><div class="title">Gemini</div></header>
    `);
    dom.window.eval(contentJs);
    const helpers = dom.window.__geminiExporterHelpers;

    const title = helpers.extractConversationTitle('Fallback prompt text');
    assert.equal(title, 'My Custom Deep Dive');
});

test('extractConversationTitle falls back to first prompt if document title is generic', () => {
    const dom = loadDom(`
        <header><div class="title">Gemini</div></header>
    `);
    dom.window.document.title = 'Google Gemini';
    dom.window.eval(contentJs);
    const helpers = dom.window.__geminiExporterHelpers;

    const title = helpers.extractConversationTitle('Explain quantum entanglement simply for high schoolers');
    assert.equal(title, 'Explain quantum entanglement simply for high schoo');
});

test('processThinkingBlocks wraps reasoning in details and extracts text', () => {
    const dom = loadDom(`
        <div id="root">
            <div class="thinking-process">
                <p>1. Analyzing prompt</p>
                <p>2. Checking facts</p>
            </div>
            <p>Final response here.</p>
        </div>
    `);
    dom.window.eval(contentJs);
    const helpers = dom.window.__geminiExporterHelpers;
    const root = dom.window.document.getElementById('root');

    const thoughtText = helpers.processThinkingBlocks(root);
    assert.ok(thoughtText.includes('1. Analyzing prompt'));
    assert.ok(root.querySelector('details.gemini-thought'));
    assert.equal(root.querySelector('details summary').textContent, 'Thinking Process');
});

test('content.js is idempotent and safe under repeated evaluations', () => {
    const dom = loadDom();
    dom.window.eval(contentJs);
    // Should not throw or fail on second eval
    dom.window.eval(contentJs);
    assert.equal(dom.window.__geminiExporterLoaded, true);
});
