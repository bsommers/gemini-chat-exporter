import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { exportDocx } from '../../../src/exporters/docx';
import type { ChatData } from '../../../src/content/types';
import { blobToBuffer } from '../../helpers/blob';

// A 1x1 transparent PNG, base64-encoded.
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function docxTextContent(blob: Blob): Promise<string> {
  const buf = await blobToBuffer(blob);
  const zip = await JSZip.loadAsync(buf);
  const doc = await zip.file('word/document.xml')!.async('string');
  return doc;
}

function baseChat(overrides: Partial<ChatData> = {}): ChatData {
  return {
    title: 'Docx Test',
    turns: [
      { role: 'user', text: 'Hello there', html: '<p>Hello there</p>' },
      { role: 'model', text: 'General Kenobi', html: '<p>General <strong>Kenobi</strong></p>' }
    ],
    images: [],
    ...overrides
  };
}

describe('exportDocx', () => {
  it('produces a non-empty valid docx Blob (a real zip with word/document.xml)', async () => {
    const blob = await exportDocx(baseChat());
    expect(blob.size).toBeGreaterThan(0);
    const xml = await docxTextContent(blob);
    expect(xml).toContain('General');
    expect(xml).toContain('Kenobi');
  });

  it('includes the chat title and turn text', async () => {
    const blob = await exportDocx(baseChat());
    const xml = await docxTextContent(blob);
    expect(xml).toContain('Docx Test');
    expect(xml).toContain('Hello there');
  });

  it('renders a thought as a distinct callout paragraph', async () => {
    const chat = baseChat({
      turns: [
        {
          role: 'model',
          text: 'Answer',
          html: '<p>Answer</p>',
          thought: { text: 'Thinking it through...', html: '<p>Thinking it through...</p>', duration: '2s' }
        }
      ]
    });
    const blob = await exportDocx(chat);
    const xml = await docxTextContent(blob);
    expect(xml).toContain('Thinking');
    expect(xml).toContain('Thinking it through');
  });

  it('renders citations as a numbered sources list with hyperlinks', async () => {
    const chat = baseChat({
      turns: [
        {
          role: 'model',
          text: 'Answer',
          html: '<p>Answer</p>',
          citations: [{ index: '1', title: 'Example Source', url: 'https://example.com/src', snippet: '' }]
        }
      ]
    });
    const blob = await exportDocx(chat);
    const xml = await docxTextContent(blob);
    expect(xml).toContain('Sources');
    expect(xml).toContain('Example Source');

    // ExternalHyperlink stores the actual URL as a relationship target, not
    // inline in document.xml - it's referenced there only by r:id.
    const buf = await blobToBuffer(blob);
    const zip = await JSZip.loadAsync(buf);
    const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');
    expect(rels).toContain('https://example.com/src');
  });

  it('embeds a resolved image placeholder as an actual image relationship', async () => {
    const chat = baseChat({
      turns: [{ role: 'model', text: 'img', html: '<img src="__IMAGE_PLACEHOLDER__image-0" alt="pic" />' }],
      images: [{ id: 'image-0', src: 'https://example.com/x.png', alt: 'pic', base64: TINY_PNG, ext: 'png' }]
    });
    const blob = await exportDocx(chat);
    const buf = await blobToBuffer(blob);
    const zip = await JSZip.loadAsync(buf);
    const mediaFiles = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  it('falls back to an [Image: alt] placeholder paragraph when base64 data is missing', async () => {
    const chat = baseChat({
      turns: [{ role: 'model', text: 'img', html: '<img src="__IMAGE_PLACEHOLDER__image-0" alt="missing" />' }],
      images: [{ id: 'image-0', src: 'https://example.com/x.png', alt: 'missing', base64: null, ext: 'png' }]
    });
    const blob = await exportDocx(chat);
    const xml = await docxTextContent(blob);
    expect(xml).toContain('missing');
  });

  it('strips a script tag from turn html instead of embedding it (sanitization applied)', async () => {
    const chat = baseChat({
      turns: [{ role: 'model', text: 'x', html: '<p>Safe text</p><script>alert(1)</script>' }]
    });
    const blob = await exportDocx(chat);
    const xml = await docxTextContent(blob);
    expect(xml).not.toContain('alert(1)');
    expect(xml).toContain('Safe text');
  });
});
