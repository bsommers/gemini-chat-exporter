import { describe, it, expect } from 'vitest';
import { scrapeCode } from '../../../src/content/scrapers/codeScraper';

function setup(html: string) {
  document.body.innerHTML = `<div id="node">${html}</div>`;
  const node = document.getElementById('node')!;
  const clone = node.cloneNode(true) as HTMLElement;
  return { node, clone };
}

describe('scrapeCode', () => {
  it('replaces a code-block element with plain pre>code, preserving language and text', () => {
    const { node, clone } = setup(`
      <code-block lang="python">
        <pre><code class="language-python">print("hi")</code></pre>
      </code-block>
    `);

    scrapeCode(node, clone);

    expect(clone.querySelector('code-block')).toBeNull();
    const codeEl = clone.querySelector('pre > code')!;
    expect(codeEl.className).toBe('language-python');
    expect(codeEl.textContent).toBe('print("hi")');
  });

  it('detects language from the header span when the lang attribute is absent', () => {
    const { node, clone } = setup(`
      <code-block>
        <div class="code-block-header"><span>javascript</span></div>
        <pre><code>console.log(1)</code></pre>
      </code-block>
    `);

    scrapeCode(node, clone);
    expect(clone.querySelector('code')!.className).toBe('language-javascript');
  });

  it('detects language from a language-* class when no attribute or header is present', () => {
    const { node, clone } = setup(`
      <code-block>
        <pre><code class="language-rust">fn main() {}</code></pre>
      </code-block>
    `);

    scrapeCode(node, clone);
    expect(clone.querySelector('code')!.className).toBe('language-rust');
  });

  it('appends execution output as a separate pre.code-execution-output block', () => {
    const { node, clone } = setup(`
      <code-block lang="python">
        <pre><code>print(1)</code></pre>
        <div class="code-execution-output"><pre class="stdout">1</pre></div>
      </code-block>
    `);

    scrapeCode(node, clone);
    const output = clone.querySelector('pre.code-execution-output')!;
    expect(output.textContent).toContain('1');
  });

  it('does not add an execution-output block when none is present', () => {
    const { node, clone } = setup(`
      <code-block lang="python">
        <pre><code>print(1)</code></pre>
      </code-block>
    `);

    scrapeCode(node, clone);
    expect(clone.querySelector('pre.code-execution-output')).toBeNull();
  });

  it('leaves bare pre>code blocks (no code-block wrapper) untouched', () => {
    const { node, clone } = setup(`<pre><code>already plain</code></pre>`);
    scrapeCode(node, clone);
    expect(clone.querySelector('pre > code')!.textContent).toBe('already plain');
  });

  it('handles multiple code-block elements independently, matching clone to source by order', () => {
    const { node, clone } = setup(`
      <code-block lang="python"><pre><code>a = 1</code></pre></code-block>
      <p>between</p>
      <code-block lang="go"><pre><code>b := 2</code></pre></code-block>
    `);

    scrapeCode(node, clone);
    const codes = Array.from(clone.querySelectorAll('code'));
    expect(codes).toHaveLength(2);
    expect(codes[0]!.className).toBe('language-python');
    expect(codes[0]!.textContent).toBe('a = 1');
    expect(codes[1]!.className).toBe('language-go');
    expect(codes[1]!.textContent).toBe('b := 2');
  });

  it('does not throw when a code-block is malformed (no pre/code inside)', () => {
    const { node, clone } = setup(`<code-block lang="text">just text, no pre</code-block>`);
    expect(() => scrapeCode(node, clone)).not.toThrow();
  });
});
