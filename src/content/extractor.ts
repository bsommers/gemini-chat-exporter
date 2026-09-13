import type { ChatData, ImageAsset, Turn } from './types';

/**
 * Convert an img element's src to a base64 data URI.
 * Returns null if the image can't be fetched.
 */
export async function imgToBase64(img: HTMLImageElement): Promise<string | null> {
  try {
    const src = img.src;
    if (!src || src.startsWith('data:')) return src;
    const resp = await fetch(src, { credentials: 'include' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Extract a clean text version of a turn's HTML content.
 */
export function htmlToText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.innerText || div.textContent || '';
}

export function getChatTitle(): string {
  return document.title.replace(/\s*[-|].*$/, '').trim() || 'Gemini Chat';
}

/**
 * Main extraction function - walks all user-query and model-response elements.
 */
export async function extractChat(): Promise<ChatData> {
  const title = getChatTitle();

  // Collect all turns in DOM order
  const allTurnNodes = Array.from(
    document.querySelectorAll('user-query, model-response')
  );

  if (allTurnNodes.length === 0) {
    return { title, turns: [], images: [] };
  }

  const images: ImageAsset[] = [];
  let imageCounter = 0;
  const turns: Turn[] = [];

  for (const node of allTurnNodes) {
    const isUser = node.tagName.toLowerCase() === 'user-query';
    let html = '';
    let text = '';

    if (isUser) {
      // User message
      const queryEl =
        node.querySelector('.query-text') ||
        node.querySelector('[data-query-text]') ||
        node;
      html = (queryEl as HTMLElement).innerHTML;
      text = (queryEl as HTMLElement).innerText || queryEl.textContent || '';
    } else {
      // Model response - grab the markdown container
      const markdownEl =
        node.querySelector('.markdown') ||
        node.querySelector('.response-content') ||
        node.querySelector('.message-content') ||
        node;

      // Deep-clone so we can manipulate for image extraction
      const clone = markdownEl.cloneNode(true) as HTMLElement;

      // Process code-block custom elements: replace with pre>code
      const codeBlocks = Array.from(node.querySelectorAll('code-block'));
      codeBlocks.forEach((cb, i) => {
        const preEl = cb.querySelector('pre') || cb.querySelector('code');
        const langClassMatch = cb
          .querySelector('[class*="language-"]')
          ?.className.match(/language-(\w+)/);
        const lang = cb.getAttribute('lang') || langClassMatch?.[1] || '';
        const codeText = preEl ? (preEl as HTMLElement).innerText : (cb as HTMLElement).innerText;
        const replacement = document.createElement('pre');
        const codeEl = document.createElement('code');
        if (lang) codeEl.className = `language-${lang}`;
        codeEl.textContent = codeText;
        replacement.appendChild(codeEl);
        // Find corresponding element in clone and replace
        const cloneCodeBlocks = clone.querySelectorAll('code-block');
        if (cloneCodeBlocks[i]) {
          cloneCodeBlocks[i].replaceWith(replacement);
        }
      });

      // Process images: collect and replace src with placeholder id
      const imgEls = Array.from(clone.querySelectorAll('img'));
      for (const img of imgEls) {
        // Skip UI icons / avatar images (small or svg-based)
        if ((img.width > 0 && img.width < 32) || img.src.includes('icon') || img.src.includes('avatar')) {
          img.remove();
          continue;
        }
        const imageId = `image-${imageCounter++}`;
        const base64 = await imgToBase64(img);
        images.push({
          id: imageId,
          src: img.src,
          alt: img.alt || '',
          base64: base64 || null,
          ext: 'png'
        });
        img.dataset.exportId = imageId;
        img.src = `__IMAGE_PLACEHOLDER__${imageId}`;
        img.removeAttribute('srcset');
      }

      html = clone.innerHTML;
      text = htmlToText(html);
    }

    turns.push({
      role: isUser ? 'user' : 'model',
      html: html.trim(),
      text: text.trim()
    });
  }

  return { title, turns, images };
}
