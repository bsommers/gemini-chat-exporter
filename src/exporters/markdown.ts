import TurndownService from 'turndown';
import type { ChatData } from '../content/types';

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

  // Handle image placeholders
  td.addRule('imagePlaceholder', {
    filter: (node) =>
      node.nodeName === 'IMG' &&
      !!(node as HTMLImageElement).src &&
      (node as HTMLImageElement).src.includes('__IMAGE_PLACEHOLDER__'),
    replacement: (_content, node) => {
      const id = (node as HTMLImageElement).src.replace('__IMAGE_PLACEHOLDER__', '');
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
      try {
        const md = td.turndown(turn.html);
        lines.push(md);
      } catch {
        lines.push(turn.text);
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
