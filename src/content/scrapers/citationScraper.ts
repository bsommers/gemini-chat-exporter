import type { Citation } from '../types';

const CITATION_LINK_SELECTOR = 'a.citation-link, .source-chip, a[data-citation]';
const GROUNDING_CONTAINER_SELECTOR = '.grounding-card, .sources-container';

/**
 * Collects grounding/citation sources from a model-response node. Returns
 * an empty array when no grounding data is present - citations are
 * optional and their absence shouldn't affect the rest of the turn.
 */
export function scrapeCitations(node: Element): Citation[] {
  try {
    const containers = Array.from(node.querySelectorAll(GROUNDING_CONTAINER_SELECTOR));
    const links = new Set<Element>();

    for (const container of containers) {
      container.querySelectorAll(CITATION_LINK_SELECTOR).forEach((el) => links.add(el));
    }
    // Some pages may render citation links outside a grounding container.
    node.querySelectorAll(CITATION_LINK_SELECTOR).forEach((el) => links.add(el));

    const citations: Citation[] = [];
    let fallbackIndex = 1;

    for (const link of links) {
      const anchor = link as HTMLAnchorElement;
      const index = anchor.querySelector('.source-index')?.textContent?.trim() || String(fallbackIndex);
      const title =
        anchor.querySelector('.source-title')?.textContent?.trim() ||
        anchor.textContent?.trim() ||
        anchor.href;
      const url = anchor.getAttribute('href') || '';
      const snippet = anchor.querySelector('.source-snippet')?.textContent?.trim() || '';

      citations.push({ index, title, url, snippet });
      fallbackIndex++;
    }

    return citations;
  } catch {
    return [];
  }
}
