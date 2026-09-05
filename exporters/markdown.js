// exporters/markdown.js
// Converts structured chat data to Markdown format with GFM table, math, and thinking support

'use strict';

function exportMarkdown(chatData) {
    const { title, turns, images = [] } = chatData;
    const lines = [];

    lines.push(`# ${title || 'Gemini Chat'}`);
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
            const lang = (code.className.match(/language-([a-zA-Z0-9_+-]+)/) || [])[1] || '';
            const text = code.textContent || '';
            return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
        }
    });

    // Handle GFM tables
    td.addRule('table', {
        filter: 'table',
        replacement: (content, node) => {
            const rows = Array.from(node.querySelectorAll('tr'));
            if (rows.length === 0) return '';
            const tableLines = [];
            let hasHeader = false;

            for (let i = 0; i < rows.length; i++) {
                const tr = rows[i];
                const cells = Array.from(tr.querySelectorAll('th, td'));
                if (cells.length === 0) continue;

                const rowContent = '| ' + cells.map(c => {
                    const cellText = td.turndown(c.innerHTML).replace(/\n+/g, ' ').trim();
                    return cellText || ' ';
                }).join(' | ') + ' |';

                tableLines.push(rowContent);

                if (i === 0 && (tr.querySelector('th') || tr.closest('thead'))) {
                    hasHeader = true;
                    const delimiter = '| ' + cells.map(() => '---').join(' | ') + ' |';
                    tableLines.push(delimiter);
                }
            }

            if (!hasHeader && tableLines.length > 0) {
                const firstCells = Array.from(rows[0].querySelectorAll('th, td'));
                const delimiter = '| ' + firstCells.map(() => '---').join(' | ') + ' |';
                tableLines.splice(1, 0, delimiter);
            }

            return `\n\n${tableLines.join('\n')}\n\n`;
        }
    });

    // Handle Gemini thinking process blocks
    td.addRule('geminiThought', {
        filter: node => node.nodeName === 'DETAILS' && node.classList.contains('gemini-thought'),
        replacement: (content, node) => {
            const summary = node.querySelector('summary')?.textContent?.trim() || 'Thinking Process';
            const contentEl = node.querySelector('.thought-content') || node;
            const inner = td.turndown(contentEl.innerHTML).trim();
            const quoted = inner.split('\n').map(l => `> ${l}`).join('\n');
            return `\n\n> **${summary}:**\n${quoted}\n\n`;
        }
    });

    // Handle LaTeX math spans
    td.addRule('latexMath', {
        filter: node => node.classList && node.classList.contains('latex-math'),
        replacement: (content, node) => {
            const text = (node.textContent || '').trim();
            if (text.startsWith('$$')) {
                return `\n\n${text}\n\n`;
            }
            return text;
        }
    });

    // Handle image placeholders (data-exporter-id or placeholder in src)
    td.addRule('imagePlaceholder', {
        filter: node =>
            node.nodeName === 'IMG' &&
            (node.getAttribute('data-exporter-id') ||
             (node.src && node.src.includes('__IMAGE_PLACEHOLDER__'))),
        replacement: (content, node) => {
            const id = node.getAttribute('data-exporter-id') ||
                node.src.match(/__IMAGE_PLACEHOLDER__(image-\d+)/)?.[1] ||
                node.src.replace(/^.*?__IMAGE_PLACEHOLDER__/, '');
            const imgMeta = images.find(i => i.id === id);
            const alt = imgMeta?.alt || node.getAttribute('alt') || id;
            const ext = imgMeta?.ext || 'png';
            return `\n![${alt}](${id}.${ext})\n`;
        }
    });

    for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];

        if (turn.role === 'user') {
            lines.push(`## 👤 You`);
            lines.push('');
            lines.push(turn.text.trim());

            // User attachments
            if (turn.attachments && turn.attachments.length > 0) {
                lines.push('');
                for (const att of turn.attachments) {
                    if (att.type === 'image') {
                        lines.push(`![${att.alt || att.id}](${att.id}.png)`);
                    }
                }
            }
        } else {
            lines.push(`## 🤖 Gemini`);
            lines.push('');

            // If turn has a structured thought property and not already in HTML details
            if (turn.thought && !turn.html.includes('gemini-thought')) {
                const quotedThought = turn.thought.split('\n').map(l => `> ${l}`).join('\n');
                lines.push(`> **Thinking Process:**\n${quotedThought}\n`);
            }

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

// Expose on window / global for browser and test environments
if (typeof window !== 'undefined') {
    window.exportMarkdown = exportMarkdown;
}
if (typeof globalThis !== 'undefined') {
    globalThis.exportMarkdown = exportMarkdown;
}
