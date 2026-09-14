import type { Thought } from '../types';

const THOUGHT_SELECTOR =
  '.thought-container, thought-box, details.thought-details, .thinking-process, [data-thought-box]';

function extractDuration(container: Element): string | null {
  const toggle = container.querySelector('.thought-toggle') || container;
  const text = toggle.textContent || '';
  // Alternatives are ordered longest-first per prefix group (seconds before
  // sec before s) since regex alternation takes the first matching branch,
  // not the longest overall match.
  const match = text.match(/\(([^)]*\d[^)]*)\)/) || text.match(/(\d+\s*(?:seconds?|sec|s|minutes?|min|m))/i);
  return match?.[1] ? match[1].trim() : null;
}

/**
 * Finds a thinking/reasoning trace within a model-response node (if any),
 * removes it from `clone` so it isn't duplicated in the main response body,
 * and returns the extracted Thought data.
 */
export function scrapeThought(node: Element, clone: HTMLElement): Thought | undefined {
  try {
    const sourceContainer = node.querySelector(THOUGHT_SELECTOR);
    if (!sourceContainer) return undefined;

    const contentEl = sourceContainer.querySelector('.thought-content') || sourceContainer;
    const html = (contentEl as HTMLElement).innerHTML || '';
    const text = (contentEl as HTMLElement).innerText || contentEl.textContent || '';
    const duration = extractDuration(sourceContainer);

    // Remove the corresponding container from the clone so the reasoning
    // trace doesn't also appear in the main response body.
    const cloneContainer = clone.querySelector(THOUGHT_SELECTOR);
    cloneContainer?.remove();

    if (!text.trim() && !html.trim()) return undefined;

    return { text: text.trim(), html: html.trim(), duration };
  } catch {
    return undefined;
  }
}
