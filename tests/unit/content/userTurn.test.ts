import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrapeUserTurn } from '../../../src/content/scrapers/userTurn';
import type { ImageAsset } from '../../../src/content/types';

describe('scrapeUserTurn', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) })
    );
  });

  it('extracts plain prompt text', async () => {
    document.body.innerHTML = `
      <user-query>
        <div class="query-text" data-query-text="true"><p>What is the capital of France?</p></div>
      </user-query>
    `;
    const node = document.querySelector('user-query')!;
    const images: ImageAsset[] = [];
    const turn = await scrapeUserTurn(node, images, { value: 0 });

    expect(turn.role).toBe('user');
    expect(turn.text).toContain('What is the capital of France?');
    expect(turn.attachments).toBeUndefined();
  });

  it('extracts image attachments from the attachment container and records them as images', async () => {
    document.body.innerHTML = `
      <user-query>
        <div class="query-text" data-query-text="true"><p>What's in this?</p></div>
        <div class="attachment-container">
          <div class="image-preview">
            <img src="https://example.com/diagram.png" alt="diagram" />
          </div>
        </div>
      </user-query>
    `;
    const node = document.querySelector('user-query')!;
    const images: ImageAsset[] = [];
    const turn = await scrapeUserTurn(node, images, { value: 0 });

    expect(images).toHaveLength(1);
    expect(images[0]!.alt).toBe('diagram');
    expect(turn.html).toContain('__IMAGE_PLACEHOLDER__image-0');
  });

  it('extracts file attachment chips as Attachment metadata', async () => {
    document.body.innerHTML = `
      <user-query>
        <div class="query-text" data-query-text="true"><p>Analyze this file.</p></div>
        <div class="attachment-container">
          <div class="file-attachment-chip"><span class="file-name">data.csv</span></div>
        </div>
      </user-query>
    `;
    const node = document.querySelector('user-query')!;
    const images: ImageAsset[] = [];
    const turn = await scrapeUserTurn(node, images, { value: 0 });

    expect(turn.attachments).toEqual([{ name: 'data.csv', type: 'file' }]);
  });

  it('falls back to the whole node when .query-text is absent', async () => {
    document.body.innerHTML = `<user-query>raw text only</user-query>`;
    const node = document.querySelector('user-query')!;
    const images: ImageAsset[] = [];
    const turn = await scrapeUserTurn(node, images, { value: 0 });
    expect(turn.text).toContain('raw text only');
  });

  it('does not mutate the live DOM node (only the clone)', async () => {
    document.body.innerHTML = `
      <user-query>
        <div class="query-text" data-query-text="true">
          <p>hello</p>
          <img src="https://example.com/pic.png" />
        </div>
      </user-query>
    `;
    const node = document.querySelector('user-query')!;
    const images: ImageAsset[] = [];
    await scrapeUserTurn(node, images, { value: 0 });

    const liveImg = node.querySelector('img')!;
    expect(liveImg.getAttribute('src')).toBe('https://example.com/pic.png');
  });
});
