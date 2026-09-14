import type { ImageAsset } from '../types';

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

function isDecorativeImage(img: HTMLImageElement): boolean {
  const src = img.src || '';
  return (
    (img.width > 0 && img.width < 32) ||
    src.includes('icon') ||
    src.includes('avatar') ||
    src.includes('googleusercontent.com/a/')
  );
}

/**
 * Finds real content images within a cloned node, fetches+encodes each as
 * base64, appends an ImageAsset to `images`, and rewrites the clone's img
 * src to a `__IMAGE_PLACEHOLDER__<id>` token so exporters can splice in the
 * final asset later. Decorative images (avatars/icons) are stripped instead.
 */
export async function scrapeImages(
  clone: HTMLElement,
  images: ImageAsset[],
  counter: { value: number }
): Promise<void> {
  const imgEls = Array.from(clone.querySelectorAll('img'));
  for (const img of imgEls) {
    try {
      if (isDecorativeImage(img)) {
        img.remove();
        continue;
      }
      const imageId = `image-${counter.value++}`;
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
    } catch {
      // A single broken image shouldn't abort the whole turn.
    }
  }
}
