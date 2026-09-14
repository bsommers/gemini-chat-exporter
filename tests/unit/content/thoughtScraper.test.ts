import { describe, it, expect } from 'vitest';
import { scrapeThought } from '../../../src/content/scrapers/thoughtScraper';

describe('scrapeThought', () => {
  it('extracts thinking text and duration, and removes the container from the clone', () => {
    document.body.innerHTML = `
      <div id="node">
        <div class="thought-container" data-thought-box="true">
          <button class="thought-toggle">Thinking Process (14s)</button>
          <div class="thought-content">
            <p>Analyzing quantum mechanical states...</p>
          </div>
        </div>
        <div class="markdown">real answer</div>
      </div>
    `;
    const node = document.getElementById('node')!;
    const clone = node.cloneNode(true) as HTMLElement;

    const thought = scrapeThought(node, clone);

    expect(thought).toBeDefined();
    expect(thought?.duration).toBe('14s');
    expect(thought?.text).toContain('Analyzing quantum mechanical states');
    expect(clone.querySelector('.thought-container')).toBeNull();
    // The source node itself is left untouched.
    expect(node.querySelector('.thought-container')).not.toBeNull();
  });

  it('returns undefined when no thought container is present', () => {
    document.body.innerHTML = `<div id="node"><div class="markdown">just an answer</div></div>`;
    const node = document.getElementById('node')!;
    const clone = node.cloneNode(true) as HTMLElement;

    expect(scrapeThought(node, clone)).toBeUndefined();
  });

  it('parses a plain-seconds duration format without parentheses', () => {
    document.body.innerHTML = `
      <div id="node">
        <div class="thought-container">
          <button class="thought-toggle">5 seconds</button>
          <div class="thought-content"><p>Quick thought.</p></div>
        </div>
      </div>
    `;
    const node = document.getElementById('node')!;
    const clone = node.cloneNode(true) as HTMLElement;

    const thought = scrapeThought(node, clone);
    expect(thought?.duration).toMatch(/5\s*seconds/i);
  });

  it('returns a null duration when none can be parsed', () => {
    document.body.innerHTML = `
      <div id="node">
        <div class="thought-container">
          <button class="thought-toggle">Thinking</button>
          <div class="thought-content"><p>No duration here.</p></div>
        </div>
      </div>
    `;
    const node = document.getElementById('node')!;
    const clone = node.cloneNode(true) as HTMLElement;

    const thought = scrapeThought(node, clone);
    expect(thought?.duration).toBeNull();
  });

  it('returns undefined instead of throwing when the container has no readable content', () => {
    document.body.innerHTML = `
      <div id="node">
        <div class="thought-container"></div>
      </div>
    `;
    const node = document.getElementById('node')!;
    const clone = node.cloneNode(true) as HTMLElement;

    expect(scrapeThought(node, clone)).toBeUndefined();
  });
});
