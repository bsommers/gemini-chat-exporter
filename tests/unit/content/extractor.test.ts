import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractChat, getChatTitle, htmlToText } from '../../../src/content/extractor';

describe('htmlToText', () => {
  it('strips tags and returns plain text', () => {
    expect(htmlToText('<p>Hello <strong>world</strong></p>')).toContain('Hello world');
  });
});

describe('getChatTitle', () => {
  it('prefers the sidebar conversation title when present', () => {
    document.title = 'Something - Gemini';
    document.body.innerHTML = `<div class="conversation-title active">Sidebar Title</div>`;
    expect(getChatTitle()).toBe('Sidebar Title');
  });

  it('falls back to the header title when no sidebar title exists', () => {
    document.title = 'Something - Gemini';
    document.body.innerHTML = `<header><div class="conversation-title">Header Title</div></header>`;
    expect(getChatTitle()).toBe('Header Title');
  });

  it('falls back to a cleaned document.title when no DOM title elements exist', () => {
    document.title = 'My Chat - Gemini';
    document.body.innerHTML = ``;
    expect(getChatTitle()).toBe('My Chat');
  });

  it('falls back to the first user query text, truncated to 50 chars, as a last resort', () => {
    document.title = '';
    const longText = 'x'.repeat(80);
    document.body.innerHTML = `<user-query><div class="query-text">${longText}</div></user-query>`;
    const title = getChatTitle();
    expect(title.length).toBe(50);
  });

  it('returns the generic default when nothing at all is available', () => {
    document.title = '';
    document.body.innerHTML = ``;
    expect(getChatTitle()).toBe('Gemini Chat');
  });
});

describe('extractChat', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) })
    );
    document.title = 'Test Chat - Gemini';
  });

  it('returns an empty turns array when no conversation nodes are found', async () => {
    document.body.innerHTML = `<main></main>`;
    const data = await extractChat();
    expect(data.turns).toEqual([]);
    expect(data.images).toEqual([]);
  });

  it('walks user-query/model-response pairs in DOM order and aggregates images across turns', async () => {
    document.body.innerHTML = `
      <user-query><div class="query-text"><p>Q1</p></div></user-query>
      <model-response>
        <div class="markdown response-content">
          <p>A1</p><img src="https://example.com/one.png" />
        </div>
      </model-response>
      <user-query><div class="query-text"><p>Q2</p></div></user-query>
      <model-response>
        <div class="markdown response-content">
          <p>A2</p><img src="https://example.com/two.png" />
        </div>
      </model-response>
    `;
    const data = await extractChat();

    expect(data.turns.map((t) => t.role)).toEqual(['user', 'model', 'user', 'model']);
    expect(data.turns[0]!.text).toContain('Q1');
    expect(data.turns[1]!.text).toContain('A1');
    expect(data.images.map((i) => i.id)).toEqual(['image-0', 'image-1']);
  });

  it('does not abort the whole extraction when a single turn throws', async () => {
    document.body.innerHTML = `
      <user-query><div class="query-text"><p>Q1</p></div></user-query>
      <model-response><div class="markdown response-content"><p>Fine</p></div></model-response>
    `;
    // Force the first (user) turn to throw by making querySelector blow up
    // only for that specific node - simulate via a getter that throws once.
    const userNode = document.querySelector('user-query')!;
    const originalQuerySelector = userNode.querySelector.bind(userNode);
    vi.spyOn(userNode, 'querySelector').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    void originalQuerySelector;

    const data = await extractChat();
    // The user turn that threw is skipped; the model turn still extracts fine.
    expect(data.turns.some((t) => t.role === 'model' && t.text.includes('Fine'))).toBe(true);
  });
});
