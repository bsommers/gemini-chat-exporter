import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { exportHtmlLinked } from '../../../src/exporters/htmlLinked';
import type { ChatData } from '../../../src/content/types';
import { blobToBuffer } from '../../helpers/blob';

function baseChat(overrides: Partial<ChatData> = {}): ChatData {
  return {
    title: 'Linked Test',
    turns: [
      { role: 'user', text: 'Hi', html: '<p>Hi</p>' },
      { role: 'model', text: 'Hello', html: '<p>Hello</p>' }
    ],
    images: [],
    ...overrides
  };
}

describe('exportHtmlLinked', () => {
  it('produces a zip with index.html and styles.css', async () => {
    const blob = await exportHtmlLinked(baseChat());
    const buf = await blobToBuffer(blob);
    const zip = await JSZip.loadAsync(buf);

    expect(zip.file('index.html')).not.toBeNull();
    expect(zip.file('styles.css')).not.toBeNull();

    const indexHtml = await zip.file('index.html')!.async('string');
    expect(indexHtml).toContain('Linked Test');
    expect(indexHtml).toContain('Hello');
  });

  it('writes image assets into images/ and rewrites placeholder src to a relative path', async () => {
    const chat = baseChat({
      turns: [{ role: 'model', text: 'img', html: '<img src="__IMAGE_PLACEHOLDER__image-0" />' }],
      images: [{ id: 'image-0', src: 'x', alt: '', base64: 'data:image/png;base64,AAAA', ext: 'png' }]
    });
    const blob = await exportHtmlLinked(chat);
    const buf = await blobToBuffer(blob);
    const zip = await JSZip.loadAsync(buf);

    expect(zip.file('images/image-0.png')).not.toBeNull();
    const indexHtml = await zip.file('index.html')!.async('string');
    expect(indexHtml).toContain('src="images/image-0.png"');
  });

  it('renders a thought details block and citations list in the zipped HTML', async () => {
    const chat = baseChat({
      turns: [
        {
          role: 'model',
          text: 'answer',
          html: '<p>answer</p>',
          thought: { text: 'thinking...', html: '<p>thinking...</p>', duration: '2s' },
          citations: [{ index: '1', title: 'Example', url: 'https://example.com', snippet: '' }]
        }
      ]
    });
    const blob = await exportHtmlLinked(chat);
    const buf = await blobToBuffer(blob);
    const zip = await JSZip.loadAsync(buf);
    const indexHtml = await zip.file('index.html')!.async('string');

    expect(indexHtml).toContain('<details class="thought-details">');
    expect(indexHtml).toContain('class="citations"');
    expect(indexHtml).toContain('href="https://example.com"');
  });

  it('sanitizes malicious turn html before writing it into the zip', async () => {
    const chat = baseChat({
      turns: [{ role: 'model', text: 'x', html: '<p>Legit</p><script>alert(1)</script>' }]
    });
    const blob = await exportHtmlLinked(chat);
    const buf = await blobToBuffer(blob);
    const zip = await JSZip.loadAsync(buf);
    const indexHtml = await zip.file('index.html')!.async('string');

    expect(indexHtml).toContain('Legit');
    expect(indexHtml).not.toContain('<script>');
  });

  it('adds an images/README.txt note only when images are present', async () => {
    const withImages = baseChat({
      images: [{ id: 'image-0', src: 'x', alt: '', base64: 'data:image/png;base64,AAAA', ext: 'png' }]
    });
    const zipWith = await JSZip.loadAsync(await blobToBuffer(await exportHtmlLinked(withImages)));
    expect(zipWith.file('images/README.txt')).not.toBeNull();

    const withoutImages = baseChat();
    const zipWithout = await JSZip.loadAsync(await blobToBuffer(await exportHtmlLinked(withoutImages)));
    expect(zipWithout.file('images/README.txt')).toBeNull();
  });
});
