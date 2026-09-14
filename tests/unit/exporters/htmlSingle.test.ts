import { describe, it, expect } from 'vitest';
import { exportHtmlSingle } from '../../../src/exporters/htmlSingle';
import type { ChatData } from '../../../src/content/types';

function baseChat(overrides: Partial<ChatData> = {}): ChatData {
  return {
    title: 'HTML Test',
    turns: [
      { role: 'user', text: 'Hi', html: '<p>Hi</p>' },
      { role: 'model', text: 'Hello', html: '<p>Hello</p>' }
    ],
    images: [],
    ...overrides
  };
}

describe('exportHtmlSingle', () => {
  it('produces a full HTML document containing the title and turn text', () => {
    const html = exportHtmlSingle(baseChat());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('HTML Test');
    expect(html).toContain('Hi');
    expect(html).toContain('Hello');
  });

  it('embeds an image placeholder as a base64 data URI when metadata has base64', () => {
    const chat = baseChat({
      turns: [{ role: 'model', text: 'img', html: '<img src="__IMAGE_PLACEHOLDER__image-0" />' }],
      images: [{ id: 'image-0', src: 'x', alt: '', base64: 'data:image/png;base64,AAAA', ext: 'png' }]
    });
    const html = exportHtmlSingle(chat);
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it('falls back to an empty src with a data-original-id when base64 is missing', () => {
    const chat = baseChat({
      turns: [{ role: 'model', text: 'img', html: '<img src="__IMAGE_PLACEHOLDER__image-0" />' }],
      images: [{ id: 'image-0', src: 'x', alt: '', base64: null, ext: 'png' }]
    });
    const html = exportHtmlSingle(chat);
    expect(html).toContain('data-original-id="image-0"');
  });

  it('renders a thought as a collapsible details block', () => {
    const chat = baseChat({
      turns: [
        {
          role: 'model',
          text: 'answer',
          html: '<p>answer</p>',
          thought: { text: 'thinking...', html: '<p>thinking...</p>', duration: '7s' }
        }
      ]
    });
    const html = exportHtmlSingle(chat);
    expect(html).toContain('<details class="thought-details">');
    expect(html).toContain('Thinking Process (7s)');
    expect(html).toContain('thinking...');
  });

  it('renders citations as a linked sources list', () => {
    const chat = baseChat({
      turns: [
        {
          role: 'model',
          text: 'answer',
          html: '<p>answer</p>',
          citations: [{ index: '1', title: 'Example', url: 'https://example.com', snippet: '' }]
        }
      ]
    });
    const html = exportHtmlSingle(chat);
    expect(html).toContain('class="citations"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('Example');
  });

  it('sanitizes malicious turn html: strips <script> and event handlers, keeps legitimate content', () => {
    const chat = baseChat({
      turns: [
        {
          role: 'model',
          text: 'x',
          html: '<p>Legit</p><script>alert(1)</script><img src="a.png" onerror="alert(2)">'
        }
      ]
    });
    const html = exportHtmlSingle(chat);
    expect(html).toContain('Legit');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror');
  });

  it('escapes user text rather than rendering it as HTML', () => {
    const chat = baseChat({
      turns: [{ role: 'user', text: '<img src=x onerror=alert(1)>', html: '' }]
    });
    const html = exportHtmlSingle(chat);
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img');
  });
});
