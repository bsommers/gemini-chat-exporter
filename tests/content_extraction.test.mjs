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

test('cleanCodeBlocks strips button decorations and handles language regex with symbols', () => {
    const dom = loadDom(`
        <div id="root">
            <code-block>
                <div class="code-block-decoration"><button>Copy code</button></div>
                <pre><code class="language-c++">#include &lt;iostream&gt;</code></pre>
            </code-block>
        </div>
    `);
    dom.window.eval(contentJs);
    const helpers = dom.window.__geminiExporterHelpers;
    const root = dom.window.document.getElementById('root');

    helpers.cleanCodeBlocks(root);

    const pre = root.querySelector('pre');
    assert.ok(pre);
    const code = pre.querySelector('code');
    assert.equal(code.className, 'language-c++');
    assert.equal(code.textContent.trim(), '#include <iostream>');
    assert.equal(root.querySelectorAll('button').length, 0);
    assert.equal(root.querySelectorAll('.code-block-decoration').length, 0);
});

test('extractConversationTitle ignores unselected sidebar items and scopes to selected', () => {
    const dom = loadDom(`
        <div class="sidebar">
            <div class="conversation-item">
                <span data-test-id="conversation-title">Unselected Previous Chat</span>
            </div>
            <div class="conversation-item selected">
                <span data-test-id="conversation-title">Selected Active Chat</span>
            </div>
        </div>
    `);
    dom.window.eval(contentJs);
    const helpers = dom.window.__geminiExporterHelpers;

    const title = helpers.extractConversationTitle();
    assert.equal(title, 'Selected Active Chat');
});

test('extractConversationTitle falls back to first user-query in DOM when firstUserText is empty', () => {
    const dom = loadDom(`
        <user-query>
            <div class="query-text">What is the speed of light in vacuum?</div>
        </user-query>
    `);
    dom.window.document.title = 'Gemini';
    dom.window.eval(contentJs);
    const helpers = dom.window.__geminiExporterHelpers;

    const title = helpers.extractConversationTitle('');
    assert.equal(title, 'What is the speed of light in vacuum?');
});

test('extractChat end-to-end extracts title, user attachments, model thinking, code, and images with data-exporter-id', async () => {
    const dom = loadDom(`
        <div class="chat-history">
            <div class="selected-chat">Quantum Mechanics Overview</div>
        </div>
        <main>
            <user-query>
                <div class="query-text">Can you explain this circuit diagram?</div>
                <div class="attachments">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="Circuit diagram" />
                </div>
            </user-query>
            <model-response>
                <div class="markdown">
                    <div class="thinking-process">
                        1. Identify circuit elements.
                        2. Formulate explanation.
                    </div>
                    <p>Here is the analysis and simulation script:</p>
                    <code-block lang="python">
                        <div class="code-block-decoration"><button>Copy code</button></div>
                        <pre><code>print("simulating circuit")</code></pre>
                    </code-block>
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="Simulation result" />
                </div>
            </model-response>
        </main>
    `);
    dom.window.eval(contentJs);
    const helpers = dom.window.__geminiExporterHelpers;

    const result = await helpers.extractChat();

    // 1. Title extraction integration
    assert.equal(result.title, 'Quantum Mechanics Overview');

    // 2. Turns structure
    assert.equal(result.turns.length, 2);

    // User turn & attachments
    const userTurn = result.turns[0];
    assert.equal(userTurn.role, 'user');
    assert.equal(userTurn.text, 'Can you explain this circuit diagram?');
    assert.ok(Array.isArray(userTurn.attachments));
    assert.equal(userTurn.attachments.length, 1);
    assert.equal(userTurn.attachments[0].type, 'image');
    assert.equal(userTurn.attachments[0].id, 'image-0');
    assert.equal(userTurn.attachments[0].alt, 'Circuit diagram');

    // Model turn & thinking blocks, code blocks, images with data-exporter-id
    const modelTurn = result.turns[1];
    assert.equal(modelTurn.role, 'model');
    assert.ok(modelTurn.thought);
    assert.ok(modelTurn.thought.includes('1. Identify circuit elements.'));
    assert.ok(modelTurn.html.includes('<details class="gemini-thought">'));
    assert.ok(modelTurn.html.includes('<summary>Thinking Process</summary>'));

    // Code block modernized and button stripped
    assert.ok(modelTurn.html.includes('<pre><code class="language-python">print("simulating circuit")</code></pre>'));
    assert.ok(!modelTurn.html.includes('Copy code'));

    // Model image assigned data-exporter-id and placeholder
    assert.ok(modelTurn.html.includes('data-exporter-id="image-1"'));
    assert.ok(modelTurn.html.includes('src="__IMAGE_PLACEHOLDER__image-1"'));

    // 3. Images extracted with concurrency cap
    assert.equal(result.images.length, 2);
    assert.equal(result.images[0].id, 'image-0');
    assert.ok(result.images[0].base64.startsWith('data:image/png;base64,'));
    assert.equal(result.images[1].id, 'image-1');
    assert.ok(result.images[1].base64.startsWith('data:image/png;base64,'));
});
