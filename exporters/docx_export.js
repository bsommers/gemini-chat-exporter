// exporters/docx_export.js
// Generates a .docx file using the docx.js library

'use strict';

async function exportDocx(chatData) {
    const { title, turns, images } = chatData;
    const {
        Document, Paragraph, TextRun, HeadingLevel, ImageRun,
        Packer, AlignmentType, BorderStyle, Table, TableRow, TableCell,
        WidthType, ShadingType
    } = docx;

    // Image lookup
    const imageMap = {};
    for (const img of images) {
        imageMap[img.id] = img;
    }

    // Convert base64 to ArrayBuffer for docx ImageRun
    function base64ToArrayBuffer(base64) {
        const binary = atob(base64.replace(/^data:[^;]+;base64,/, ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Parse HTML into docx Paragraph/Run objects (simplified parser).
     * Handles: p, h1-h6, ul/ol/li, pre/code, strong, em, a, br, img
     */
    function htmlToDocxChildren(htmlStr) {
        const div = document.createElement('div');
        div.innerHTML = htmlStr;
        return nodesToDocx(div.childNodes);
    }

    function nodesToDocx(nodes) {
        const results = [];
        for (const node of nodes) {
            const items = nodeToDocx(node);
            results.push(...items);
        }
        return results;
    }

    function nodeToDocx(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (!text.trim()) return [];
            return [new TextRun({ text })];
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return [];

        const tag = node.tagName.toLowerCase();

        // Headings
        if (/^h[1-6]$/.test(tag)) {
            const level = parseInt(tag[1]);
            const levelMap = {
                1: HeadingLevel.HEADING_1,
                2: HeadingLevel.HEADING_2,
                3: HeadingLevel.HEADING_3,
                4: HeadingLevel.HEADING_4,
                5: HeadingLevel.HEADING_5,
                6: HeadingLevel.HEADING_6
            };
            return [new Paragraph({
                text: node.innerText || node.textContent,
                heading: levelMap[level] || HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 80 }
            })];
        }

        // Code block
        if (tag === 'pre') {
            const codeEl = node.querySelector('code') || node;
            const codeText = codeEl.textContent || '';
            return [new Paragraph({
                children: [new TextRun({
                    text: codeText,
                    font: 'Courier New',
                    size: 18
                })],
                shading: { type: ShadingType.SOLID, color: 'F0F0F0' },
                spacing: { before: 120, after: 120 },
                style: 'Normal'
            })];
        }

        // Inline code
        if (tag === 'code') {
            return [new TextRun({
                text: node.textContent || '',
                font: 'Courier New',
                size: 18,
                shading: { type: ShadingType.SOLID, color: 'F0F0F0', fill: 'F0F0F0' }
            })];
        }

        // Image (with placeholder id)
        if (tag === 'img') {
            const src = node.getAttribute('src') || '';
            const idMatch = src.match(/__IMAGE_PLACEHOLDER__(image-\d+)/);
            if (idMatch) {
                const imgMeta = imageMap[idMatch[1]];
                if (imgMeta?.base64) {
                    try {
                        const arrayBuffer = base64ToArrayBuffer(imgMeta.base64);
                        const mimeType = imgMeta.base64.match(/^data:([^;]+)/)?.[1] || 'image/png';
                        const typeMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'png' };
                        const imgType = typeMap[mimeType] || 'png';
                        return [new Paragraph({
                            children: [new ImageRun({
                                data: arrayBuffer,
                                transformation: { width: 500, height: 300 },
                                type: imgType
                            })]
                        })];
                    } catch (e) {
                        return [new Paragraph({ text: `[Image: ${imgMeta.alt || idMatch[1]}]` })];
                    }
                }
            }
            return [new Paragraph({ text: `[Image: ${node.alt || ''}]` })];
        }

        // Paragraph
        if (tag === 'p') {
            const inlineRuns = inlineNodesToRuns(node.childNodes);
            if (inlineRuns.length === 0) return [];
            return [new Paragraph({ children: inlineRuns, spacing: { after: 100 } })];
        }

        // Line break
        if (tag === 'br') {
            return [new TextRun({ break: 1 })];
        }

        // Unordered list
        if (tag === 'ul') {
            return Array.from(node.querySelectorAll('li')).map(li =>
                new Paragraph({
                    text: '• ' + (li.innerText || li.textContent).trim(),
                    spacing: { after: 60 }
                })
            );
        }

        // Ordered list
        if (tag === 'ol') {
            return Array.from(node.querySelectorAll('li')).map((li, i) =>
                new Paragraph({
                    text: `${i + 1}. ` + (li.innerText || li.textContent).trim(),
                    spacing: { after: 60 }
                })
            );
        }

        // Blockquote
        if (tag === 'blockquote') {
            return [new Paragraph({
                children: [new TextRun({ text: node.innerText || node.textContent, italics: true, color: '666666' })],
                indent: { left: 720 },
                border: { left: { style: BorderStyle.SINGLE, size: 6, color: '8AB4F8' } },
                spacing: { after: 100 }
            })];
        }

        // Table
        if (tag === 'table') {
            const rows = [];
            node.querySelectorAll('tr').forEach(tr => {
                const cells = [];
                tr.querySelectorAll('th, td').forEach(td => {
                    cells.push(new TableCell({
                        children: [new Paragraph({ text: td.innerText || td.textContent })],
                        shading: td.tagName.toLowerCase() === 'th'
                            ? { type: ShadingType.SOLID, color: 'E8F0FE' }
                            : undefined
                    }));
                });
                if (cells.length > 0) rows.push(new TableRow({ children: cells }));
            });
            if (rows.length > 0) {
                return [new Table({
                    rows,
                    width: { size: 100, type: WidthType.PERCENTAGE }
                })];
            }
            return [];
        }

        // Recurse for divs, spans, section, article, etc.
        return nodesToDocx(node.childNodes);
    }

    // For inline context (inside p, li, etc.) - returns TextRun array only
    function inlineNodesToRuns(nodes) {
        const runs = [];
        for (const node of nodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                if (text) runs.push(new TextRun({ text }));
                continue;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const tag = node.tagName.toLowerCase();
            if (tag === 'strong' || tag === 'b') {
                runs.push(new TextRun({ text: node.textContent, bold: true }));
            } else if (tag === 'em' || tag === 'i') {
                runs.push(new TextRun({ text: node.textContent, italics: true }));
            } else if (tag === 'code') {
                runs.push(new TextRun({ text: node.textContent, font: 'Courier New', size: 18 }));
            } else if (tag === 'a') {
                runs.push(new TextRun({ text: node.textContent, color: '1155CC', underline: {} }));
            } else if (tag === 'br') {
                runs.push(new TextRun({ break: 1 }));
            } else {
                runs.push(...inlineNodesToRuns(node.childNodes));
            }
        }
        return runs;
    }

    // Build document children
    const children = [];

    // Title
    children.push(new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 }
    }));

    children.push(new Paragraph({
        children: [new TextRun({
            text: `Exported from Gemini on ${new Date().toLocaleString()}`,
            italics: true,
            color: '666666',
            size: 20
        })],
        spacing: { after: 400 }
    }));

    // Turns
    for (const turn of turns) {
        const isUser = turn.role === 'user';

        // Role header
        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: isUser ? '👤 You' : '✦ Gemini',
                    bold: true,
                    color: isUser ? '6B2FBA' : '1A73E8',
                    size: 24
                })
            ],
            spacing: { before: 300, after: 100 },
            border: {
                bottom: { style: BorderStyle.SINGLE, size: 2, color: isUser ? 'BD93F9' : '8AB4F8' }
            }
        }));

        if (isUser) {
            children.push(new Paragraph({
                children: [new TextRun({ text: turn.text, size: 24 })],
                spacing: { after: 200 }
            }));
        } else {
            const docxNodes = htmlToDocxChildren(turn.html);
            for (const node of docxNodes) {
                if (node instanceof Paragraph || node instanceof Table) {
                    children.push(node);
                }
                // TextRuns at top level get wrapped in a paragraph
                else if (node instanceof TextRun) {
                    children.push(new Paragraph({ children: [node] }));
                }
            }
        }
    }

    const doc = new Document({
        title,
        creator: 'Gemini Chat Exporter',
        sections: [{ children }]
    });

    return await Packer.toBlob(doc);
}
