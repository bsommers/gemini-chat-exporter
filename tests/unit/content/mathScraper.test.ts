import { describe, it, expect } from 'vitest';
import { scrapeMath } from '../../../src/content/scrapers/mathScraper';

describe('scrapeMath', () => {
  it('replaces an inline .math-inline node with single-dollar TeX', () => {
    document.body.innerHTML = `
      <div id="root">
        <p>Formula:
          <span class="math-inline">
            <span class="katex">
              <annotation encoding="application/x-tex">E = mc^2</annotation>
            </span>
          </span>
        </p>
      </div>
    `;
    const root = document.getElementById('root')!;
    scrapeMath(root);

    expect(root.querySelector('.math-inline')).toBeNull();
    expect(root.textContent).toContain('$E = mc^2$');
    expect(root.textContent).not.toContain('$$E = mc^2$$');
  });

  it('replaces a .math-block node with double-dollar TeX on its own lines', () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="math-block">
          <annotation encoding="application/x-tex">\\int_0^1 x^2 dx</annotation>
        </div>
      </div>
    `;
    const root = document.getElementById('root')!;
    scrapeMath(root);

    expect(root.querySelector('.math-block')).toBeNull();
    expect(root.textContent).toContain('$$\n\\int_0^1 x^2 dx\n$$');
  });

  it('falls back to a data-tex attribute when no TeX annotation is present', () => {
    document.body.innerHTML = `<div id="root"><span class="math-inline" data-tex="a+b"></span></div>`;
    const root = document.getElementById('root')!;
    scrapeMath(root);

    expect(root.textContent).toContain('$a+b$');
  });

  it('leaves a math node untouched when no TeX source can be found', () => {
    document.body.innerHTML = `<div id="root"><span class="math-inline"><span class="katex-html">???</span></span></div>`;
    const root = document.getElementById('root')!;
    scrapeMath(root);

    expect(root.querySelector('.math-inline')).not.toBeNull();
  });

  it('does nothing when there are no math nodes', () => {
    document.body.innerHTML = `<div id="root"><p>No math here.</p></div>`;
    const root = document.getElementById('root')!;
    expect(() => scrapeMath(root)).not.toThrow();
    expect(root.textContent).toBe('No math here.');
  });
});
