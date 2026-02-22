// exporters/markdown.js
// Converts structured chat data to Markdown format

'use strict';

function exportMarkdown(chatData) {
    const { title, turns, images } = chatData;
    const lines = [];

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
        filter: node => node.nodeName === 'PRE' && node.querySelector('code'),
        replacement: (content, node) => {
            const code = node.querySelector('code');
            const lang = (code.className.match(/language-(\w+)/) || [])[1] || '';
            const text = code.textContent || '';
            return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
        }
    });

    // Handle image placeholders
    td.addRule('imagePlaceholder', {
        filter: node =>
            node.nodeName === 'IMG' &&
            node.src && node.src.includes('__IMAGE_PLACEHOLDER__'),
        replacement: (content, node) => {
            const id = node.src.replace('__IMAGE_PLACEHOLDER__', '');
            const imgMeta = images.find(i => i.id === id);
            const alt = imgMeta?.alt || id;
            return `\n![${alt}](${id}.png)\n`;
        }
    });

    for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];

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
