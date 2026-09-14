import type { ChatData, ImageAsset, Turn } from './types';
import { scrapeUserTurn } from './scrapers/userTurn';
import { scrapeModelTurn } from './scrapers/modelTurn';

// Re-exported for callers that imported imgToBase64 from here pre-Milestone 2;
// the real implementation now lives in scrapers/imageScraper.ts.
export { imgToBase64 } from './scrapers/imageScraper';

/**
 * Extract a clean text version of a turn's HTML content.
 */
export function htmlToText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.innerText || div.textContent || '';
}

/**
 * Conversation title, per docs/GEMINI_DOM_SPEC.md section 3.1's priority chain:
 * sidebar title -> top-bar heading -> cleaned document.title -> first user
 * query text as a last resort.
 */
export function getChatTitle(): string {
  const sidebarTitle = document
    .querySelector('[data-test-id="conversation-title"], .conversation-title.active')
    ?.textContent?.trim();
  if (sidebarTitle) return sidebarTitle;

  const headerTitle = document.querySelector('header .conversation-title, h1.chat-title')?.textContent?.trim();
  if (headerTitle) return headerTitle;

  const cleanedDocTitle = document.title.replace(/\s*[-|]\s*Gemini.*$/i, '').trim();
  if (cleanedDocTitle) return cleanedDocTitle;

  const firstQuery = document
    .querySelector('user-query .query-text, user-query [data-query-text], user-query')
    ?.textContent?.trim();
  if (firstQuery) return firstQuery.slice(0, 50);

  return 'Gemini Chat';
}

/**
 * Main extraction function - walks all user-query and model-response elements.
 */
export async function extractChat(): Promise<ChatData> {
  const title = getChatTitle();

  // Collect all turns in DOM order
  const allTurnNodes = Array.from(document.querySelectorAll('user-query, model-response'));

  if (allTurnNodes.length === 0) {
    return { title, turns: [], images: [] };
  }

  const images: ImageAsset[] = [];
  const imageCounter = { value: 0 };
  const turns: Turn[] = [];

  for (const node of allTurnNodes) {
    try {
      const isUser = node.tagName.toLowerCase() === 'user-query';
      const turn = isUser
        ? await scrapeUserTurn(node, images, imageCounter)
        : await scrapeModelTurn(node, images, imageCounter);
      turns.push(turn);
    } catch {
      // A single malformed turn shouldn't abort extraction of the rest of
      // the conversation.
    }
  }

  return { title, turns, images };
}
