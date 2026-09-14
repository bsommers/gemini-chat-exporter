import { describe, it, expect, vi, beforeEach } from 'vitest';
import { imgToBase64, scrapeImages } from '../../../src/content/scrapers/imageScraper';
import type { ImageAsset } from '../../../src/content/types';

function mockFetchOk(base64DataUrl: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['fake-image-bytes'], { type: 'image/png' })
    })
  );
  // FileReader.readAsDataURL is exercised for real by jsdom's FileReader, but
  // its result depends on the Blob's actual bytes, not `base64DataUrl` - the
  // param is unused; kept for readability at call sites that only care that
  // *some* data URI comes back.
  void base64DataUrl;
}

describe('imgToBase64', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the src unchanged when it is already a data: URI', async () => {
    const img = document.createElement('img');
    img.src = 'data:image/png;base64,AAAA';
    await expect(imgToBase64(img)).resolves.toBe('data:image/png;base64,AAAA');
  });

  it('returns null when fetch fails (non-ok response)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.png';
    await expect(imgToBase64(img)).resolves.toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.png';
    await expect(imgToBase64(img)).resolves.toBeNull();
  });

  it('converts a successful fetch response to a base64 data URI', async () => {
    mockFetchOk('');
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.png';
    const result = await imgToBase64(img);
    expect(result).toMatch(/^data:/);
  });

  it('returns empty string unchanged when src is empty', async () => {
    const img = document.createElement('img');
    await expect(imgToBase64(img)).resolves.toBe('');
  });
});

describe('scrapeImages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockFetchOk('');
  });

  it('collects a real content image, assigns a placeholder id, and pushes ImageAsset metadata', async () => {
    const container = document.createElement('div');
    container.innerHTML = '<p>Some text</p><img src="https://example.com/diagram.png" alt="diagram" />';

    const images: ImageAsset[] = [];
    const counter = { value: 0 };
    await scrapeImages(container, images, counter);

    expect(images).toHaveLength(1);
    expect(images[0]!.id).toBe('image-0');
    expect(images[0]!.alt).toBe('diagram');
    expect(images[0]!.base64).toMatch(/^data:/);
    expect(counter.value).toBe(1);

    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('__IMAGE_PLACEHOLDER__image-0');
    expect(img.hasAttribute('srcset')).toBe(false);
  });

  it('strips decorative images (small width) instead of collecting them', async () => {
    const container = document.createElement('div');
    container.innerHTML = '<img src="https://example.com/tiny.png" width="16" />';

    const images: ImageAsset[] = [];
    const counter = { value: 0 };
    await scrapeImages(container, images, counter);

    expect(images).toHaveLength(0);
    expect(container.querySelector('img')).toBeNull();
  });

  it.each(['https://cdn.example.com/icon-close.png', 'https://cdn.example.com/user-avatar.png', 'https://lh3.googleusercontent.com/a/avatar123'])(
    'strips decorative images matched by URL pattern: %s',
    async (src) => {
      const container = document.createElement('div');
      container.innerHTML = `<img src="${src}" />`;

      const images: ImageAsset[] = [];
      const counter = { value: 0 };
      await scrapeImages(container, images, counter);

      expect(images).toHaveLength(0);
    }
  );

  it('assigns sequential ids across multiple images sharing one counter', async () => {
    const container = document.createElement('div');
    container.innerHTML =
      '<img src="https://example.com/a.png" /><img src="https://example.com/b.png" />';

    const images: ImageAsset[] = [];
    const counter = { value: 0 };
    await scrapeImages(container, images, counter);

    expect(images.map((i) => i.id)).toEqual(['image-0', 'image-1']);
  });

  it('does not throw when a single image fetch fails, and still processes the rest', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) })
    );

    const container = document.createElement('div');
    container.innerHTML =
      '<img src="https://example.com/broken.png" /><img src="https://example.com/ok.png" />';

    const images: ImageAsset[] = [];
    const counter = { value: 0 };
    await expect(scrapeImages(container, images, counter)).resolves.toBeUndefined();

    expect(images).toHaveLength(2);
    expect(images[0]!.base64).toBeNull();
    expect(images[1]!.base64).toMatch(/^data:/);
  });
});
