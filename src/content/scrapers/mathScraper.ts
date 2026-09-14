const MATH_SELECTOR = '.math-inline, .math-block, [data-math]';

function extractTex(el: Element): string | null {
  const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
  if (annotation?.textContent) return annotation.textContent.trim();
  const dataTex = el.getAttribute('data-tex') || el.querySelector('[data-tex]')?.getAttribute('data-tex');
  return dataTex ? dataTex.trim() : null;
}

/**
 * Replaces KaTeX-rendered math nodes in `clone` with their raw TeX source
 * wrapped per docs/GEMINI_DOM_SPEC.md section 3.5, so exporters can emit real
 * math markup instead of KaTeX's rendered HTML soup.
 */
export function scrapeMath(clone: HTMLElement): void {
  const mathEls = Array.from(clone.querySelectorAll(MATH_SELECTOR));
  for (const el of mathEls) {
    try {
      const tex = extractTex(el);
      if (!tex) continue;

      const isBlock = el.classList.contains('math-block');
      const replacementText = isBlock ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`;

      const replacement = document.createTextNode(replacementText);
      el.replaceWith(replacement);
    } catch {
      // Leave the node as-is if we can't safely extract/replace it.
    }
  }
}
