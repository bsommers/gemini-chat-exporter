import type { Attachment, ImageAsset, Turn } from '../types';
import { htmlToText } from '../extractor';
import { scrapeImages } from './imageScraper';

function scrapeAttachments(node: Element): Attachment[] {
  try {
    const chips = Array.from(node.querySelectorAll('.file-attachment-chip'));
    return chips
      .map((chip) => {
        const name = chip.querySelector('.file-name')?.textContent?.trim() || chip.textContent?.trim() || '';
        return { name, type: 'file' };
      })
      .filter((a) => a.name);
  } catch {
    return [];
  }
}

/**
 * Extracts a user-query turn: prompt text plus any image/file attachments.
 */
export async function scrapeUserTurn(
  node: Element,
  images: ImageAsset[],
  imageCounter: { value: number }
): Promise<Turn> {
  const queryEl = node.querySelector('.query-text') || node.querySelector('[data-query-text]') || node;

  // Clone so image extraction (which mutates src/removes decorative imgs)
  // doesn't touch the live page.
  const clone = queryEl.cloneNode(true) as HTMLElement;

  const attachmentContainer = node.querySelector('.attachment-container') || node.querySelector('.image-preview');
  const imagePreviewImgs = attachmentContainer ? attachmentContainer.querySelectorAll('img') : [];
  if (imagePreviewImgs.length > 0) {
    // Attachment images live outside `.query-text` in the DOM spec's markup,
    // so pull them into the clone before running the shared scraper.
    imagePreviewImgs.forEach((img) => clone.appendChild(img.cloneNode(true)));
  }

  await scrapeImages(clone, images, imageCounter);

  const html = clone.innerHTML.trim();
  const text = ((clone as HTMLElement).innerText || clone.textContent || htmlToText(html)).trim();
  const attachments = scrapeAttachments(node);

  const turn: Turn = { role: 'user', html, text };
  if (attachments.length > 0) turn.attachments = attachments;
  return turn;
}
