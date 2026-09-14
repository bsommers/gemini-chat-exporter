const EXECUTION_OUTPUT_SELECTOR = '.code-execution-output, .python-execution-cell, .output-container';

function detectLanguage(cb: Element): string {
  const attr = cb.getAttribute('lang') || cb.getAttribute('data-language');
  if (attr) return attr;

  const headerLang = cb.querySelector('.code-lang, .code-block-header span')?.textContent?.trim();
  if (headerLang) return headerLang;

  const langClassMatch = cb.querySelector('[class*="language-"]')?.className.match(/language-(\w+)/);
  return langClassMatch?.[1] || '';
}

function extractExecutionOutput(cb: Element): string | null {
  const outputEl = cb.querySelector(EXECUTION_OUTPUT_SELECTOR);
  if (!outputEl) return null;
  const text = (outputEl as HTMLElement).innerText || outputEl.textContent || '';
  return text.trim() || null;
}

/**
 * Replaces `code-block` custom elements (and any execution-output cells
 * they carry) in `clone` with plain `pre>code` markup, preserving detected
 * language and appending execution stdout/result text when present.
 */
export function scrapeCode(node: Element, clone: HTMLElement): void {
  const codeBlocks = Array.from(node.querySelectorAll('code-block'));
  const cloneCodeBlocks = Array.from(clone.querySelectorAll('code-block'));

  codeBlocks.forEach((cb, i) => {
    try {
      const preEl = cb.querySelector('pre') || cb.querySelector('code');
      const lang = detectLanguage(cb);
      const codeText = preEl ? (preEl as HTMLElement).innerText : (cb as HTMLElement).innerText;
      const executionOutput = extractExecutionOutput(cb);

      const replacement = document.createElement('pre');
      const codeEl = document.createElement('code');
      if (lang) codeEl.className = `language-${lang}`;
      codeEl.textContent = codeText;
      replacement.appendChild(codeEl);

      if (executionOutput) {
        const outputPre = document.createElement('pre');
        outputPre.className = 'code-execution-output';
        outputPre.textContent = executionOutput;
        replacement.appendChild(outputPre);
      }

      const cloneCb = cloneCodeBlocks[i];
      cloneCb?.replaceWith(replacement);
    } catch {
      // Leave this code block as-is in the clone if extraction fails.
    }
  });

  // Bare pre>code blocks (no code-block wrapper) also fall under 3.6's
  // selector list but need no transformation - they're already the target
  // shape - so nothing further to do for `pre:has(code)` matches here.
}
