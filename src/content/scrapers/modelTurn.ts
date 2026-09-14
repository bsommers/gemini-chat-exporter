import type { ImageAsset, Turn } from '../types';
import { htmlToText } from '../extractor';
import { scrapeThought } from './thoughtScraper';
import { scrapeCode } from './codeScraper';
import { scrapeMath } from './mathScraper';
import { scrapeCitations } from './citationScraper';
import { scrapeImages } from './imageScraper';

/**
 * Extracts a model-response turn: thinking trace, main markdown body (code
 * blocks normalized, math restored to TeX, images collected), and grounding
 * citations.
 */
export async function scrapeModelTurn(
  node: Element,
  images: ImageAsset[],
  imageCounter: { value: number }
): Promise<Turn> {
  const markdownEl =
    node.querySelector('.markdown') ||
    node.querySelector('.response-content') ||
    node.querySelector('.message-content') ||
    node;

  // Deep-clone so we can manipulate for code/math/image extraction without
  // touching the live page.
  const clone = markdownEl.cloneNode(true) as HTMLElement;

  const thought = scrapeThought(node, clone);
  scrapeCode(node, clone);
  scrapeMath(clone);
  await scrapeImages(clone, images, imageCounter);

  const html = clone.innerHTML.trim();
  const text = htmlToText(html).trim();
  const citations = scrapeCitations(node);

  const turn: Turn = { role: 'model', html, text };
  if (thought) turn.thought = thought;
  if (citations.length > 0) turn.citations = citations;
  return turn;
}
