import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { ChatData, Citation, Thought } from '../content/types';

function renderThought(thought: Thought): string {
  const header = thought.duration ? `Thinking (${thought.duration})` : 'Thinking';
  const body = thought.text.trim();
  const quoted = [`> [!NOTE] ${header}`, ...body.split('\n').map((line) => `> ${line}`)];
  return quoted.join('\n');
}

function renderCitations(citations: Citation[]): string {
  const lines = ['**Sources:**', ''];
  citations.forEach((c, i) => {
    const label = c.index ?? String(i + 1);
    const suffix = c.snippet ? ` — ${c.snippet}` : '';
    lines.push(`[${label}] [${c.title || c.url}](${c.url})${suffix}`);
  });
  return lines.join('\n');
}

export function exportMarkdown(chatData: ChatData): string {
  const { title, turns, images } = chatData;
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`*Exported from Gemini on ${new Date().toLocaleString()}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  });
  td.use(gfm);

  // Preserve code blocks
  td.addRule('codeBlock', {
    filter: (node) => node.nodeName === 'PRE' && !!node.querySelector('code'),
    replacement: (_content, node) => {
      const code = (node as HTMLElement).querySelector('code')!;
      const lang = (code.className.match(/language-(\w+)/) || [])[1] || '';
      const text = code.textContent || '';
      return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    }
  });

  // Handle image placeholders. Read the raw `src` attribute rather than the
  // `.src` IDL property - the latter resolves against the parsing document's
  // base URI (e.g. `chrome-extension://<id>/__IMAGE_PLACEHOLDER__image-0`),
  // which would corrupt the extracted placeholder id.
  td.addRule('imagePlaceholder', {
    filter: (node) => node.nodeName === 'IMG' && !!(node as HTMLImageElement).getAttribute('src')?.includes('__IMAGE_PLACEHOLDER__'),
    replacement: (_content, node) => {
      const rawSrc = (node as HTMLImageElement).getAttribute('src') || '';
      const id = rawSrc.replace('__IMAGE_PLACEHOLDER__', '');
      const imgMeta = images.find((i) => i.id === id);
      const alt = imgMeta?.alt || id;
      return `\n![${alt}](${id}.png)\n`;
    }
  });

  for (const turn of turns) {
    if (turn.role === 'user') {
      lines.push(`## 👤 You`);
      lines.push('');
      lines.push(turn.text.trim());
    } else {
      lines.push(`## 🤖 Gemini`);
      lines.push('');

      if (turn.thought) {
        lines.push(renderThought(turn.thought));
        lines.push('');
      }

      try {
        const md = td.turndown(turn.html);
        lines.push(md);
      } catch {
        lines.push(turn.text);
      }

      if (turn.citations?.length) {
        lines.push('');
        lines.push(renderCitations(turn.citations));
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
