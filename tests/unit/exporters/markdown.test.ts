import { describe, it, expect } from 'vitest';
import { exportMarkdown } from '../../../src/exporters/markdown';
import type { ChatData } from '../../../src/content/types';

function baseChat(overrides: Partial<ChatData> = {}): ChatData {
  return {
    title: 'Quantum Test',
    turns: [
      { role: 'user', text: 'What is the equation for energy?', html: '<p>What is the equation for energy?</p>' },
      {
        role: 'model',
        text: 'Energy equation: E=mc^2',
        html: '<p>Energy equation:</p><p>$$E=mc^2$$</p>',
        thought: { text: 'Recalling mass-energy equivalence...', html: '<p>Recalling...</p>', duration: '4s' }
      }
    ],
    images: [],
    ...overrides
  };
}

describe('exportMarkdown', () => {
  it('renders the title, role headers, and body text', () => {
    const output = exportMarkdown(baseChat());
    expect(output).toContain('# Quantum Test');
    expect(output).toContain('## 👤 You');
    expect(output).toContain('## 🤖 Gemini');
    expect(output).toContain('What is the equation for energy?');
  });

  it('renders a thought as a blockquote callout above the response', () => {
    const output = exportMarkdown(baseChat());
    expect(output).toContain('> [!NOTE]');
    expect(output).toMatch(/Thinking.*4s/);
    expect(output).toContain('> Recalling');
  });

  it('renders citations as a Sources list', () => {
    const chat = baseChat({
      turns: [
        {
          role: 'model',
          text: 'Cited answer.',
          html: '<p>Cited answer.</p>',
          citations: [{ index: '1', title: 'Nature', url: 'https://nature.com/x', snippet: 'A snippet' }]
        }
      ]
    });
    const output = exportMarkdown(chat);
    expect(output).toContain('**Sources:**');
    expect(output).toContain('[1]');
    expect(output).toContain('https://nature.com/x');
    expect(output).toContain('A snippet');
  });

  it('converts a GFM table to markdown table syntax', () => {
    const chat = baseChat({
      turns: [
        {
          role: 'model',
          text: 'table',
          html: '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
        }
      ]
    });
    const output = exportMarkdown(chat);
    expect(output).toContain('| A | B |');
    expect(output).toContain('| --- | --- |');
    expect(output).toContain('| 1 | 2 |');
  });

  it('preserves fenced code blocks with detected language', () => {
    const chat = baseChat({
      turns: [
        { role: 'model', text: 'code', html: '<pre><code class="language-python">print(1)</code></pre>' }
      ]
    });
    const output = exportMarkdown(chat);
    expect(output).toContain('```python');
    expect(output).toContain('print(1)');
  });

  it('resolves image placeholders to a relative filename using image metadata', () => {
    const chat = baseChat({
      turns: [{ role: 'model', text: 'img', html: '<img src="__IMAGE_PLACEHOLDER__image-0" alt="ignored" />' }],
      images: [{ id: 'image-0', src: 'https://example.com/x.png', alt: 'a diagram', base64: 'data:image/png;base64,AAA', ext: 'png' }]
    });
    const output = exportMarkdown(chat);
    expect(output).toContain('![a diagram](image-0.png)');
  });

  it('does not crash and omits Sources/blockquote sections when thought/citations are absent', () => {
    const output = exportMarkdown(baseChat({ turns: [{ role: 'model', text: 'plain', html: '<p>plain</p>' }] }));
    expect(output).not.toContain('[!NOTE]');
    expect(output).not.toContain('**Sources:**');
  });
});
