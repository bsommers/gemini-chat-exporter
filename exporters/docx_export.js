// exporters/docx_export.js
// Generates a .docx file using the docx.js library

'use strict';

async function exportDocx(chatData) {
    const { title, turns, images = [] } = chatData;
    const {
        Document, Paragraph, TextRun, HeadingLevel, ImageRun,
        Packer, BorderStyle, Table, TableRow, TableCell,
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

    // Extract image dimensions from raw buffer to preserve aspect ratio
    function getImageDimensions(buffer) {
        try {
            const view = new DataView(buffer);
            // PNG signature check: 0x89504E47
            if (view.byteLength >= 24 && view.getUint32(0) === 0x89504E47) {
                return {
                    width: view.getUint32(16),
                    height: view.getUint32(20)
                };
            }
            // GIF signature check: 'GIF87a' or 'GIF89a'
            if (view.byteLength >= 10 &&
                view.getUint8(0) === 0x47 && view.getUint8(1) === 0x49 && view.getUint8(2) === 0x46) {
                return {
                    width: view.getUint16(6, true),
                    height: view.getUint16(8, true)
                };
            }
            // JPEG signature check: 0xFFD8
            if (view.byteLength >= 4 && view.getUint16(0) === 0xFFD8) {
                let offset = 2;
                while (offset < view.byteLength) {
                    if (view.getUint8(offset) !== 0xFF) break;
                    const marker = view.getUint8(offset + 1);
                    if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) ||
                        (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
                        return {
                            height: view.getUint16(offset + 5),
                            width: view.getUint16(offset + 7)
                        };
                    }
                    const length = view.getUint16(offset + 2);
                    offset += 2 + length;
                }
            }
        } catch (_) {
            // Fallback
        }
        return null;
    }

    // Fit dimensions within bounding box while strictly preserving aspect ratio
    function fitDimensions(origWidth, origHeight, maxWidth = 500, maxHeight = 400) {
        if (!origWidth || !origHeight || origWidth <= 0 || origHeight <= 0) {
            return { width: maxWidth, height: Math.round(maxWidth * 0.6) };
        }
        const ratio = Math.min(maxWidth / origWidth, maxHeight / origHeight, 1);
        return {
            width: Math.max(1, Math.round(origWidth * ratio)),
            height: Math.max(1, Math.round(origHeight * ratio))
        };
    }

    // Recursively process unordered and ordered lists without duplicating nested items
    function processList(listEl, isOrdered, level = 0) {
        const paragraphs = [];
        let counter = 1;
        const listChildren = Array.from(listEl.children);

        for (const child of listChildren) {
            if (child.tagName.toLowerCase() === 'li') {
                // Find direct nested lists inside this li
                const nestedLists = Array.from(child.children).filter(c =>
                    ['ul', 'ol'].includes(c.tagName.toLowerCase())
                );

                // Clone li to extract text without nested list content
                const clone = child.cloneNode(true);
                clone.querySelectorAll('ul, ol').forEach(nested => nested.remove());
                const liText = (clone.textContent || '').trim();

                const indentLevel = level * 360; // 360 twips indentation per level
                const bullet = isOrdered ? `${counter}. ` : '• ';

                paragraphs.push(new Paragraph({
                    children: [
                        new TextRun({ text: bullet, bold: true }),
                        new TextRun({ text: liText })
                    ],
                    indent: indentLevel > 0 ? { left: indentLevel } : undefined,
                    spacing: { after: 60 }
                }));
                counter++;

                // Process nested lists
                for (const nested of nestedLists) {
                    paragraphs.push(...processList(nested, nested.tagName.toLowerCase() === 'ol', level + 1));
                }
            }
        }
        return paragraphs;
    }

    /**
     * Parse HTML into docx Paragraph/Run objects.
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

        // Details / Thinking Process block
        if (tag === 'details' && node.classList.contains('gemini-thought')) {
            const summary = node.querySelector('summary')?.textContent || 'Thinking Process';
            const contentEl = node.querySelector('.thought-content');
            const thoughtText = contentEl
                ? contentEl.textContent.trim()
                : node.textContent.replace(summary, '').trim();

            return [
                new Paragraph({
                    children: [
                        new TextRun({ text: `💭 ${summary}`, bold: true, italics: true, color: '555555', size: 20 })
                    ],
                    spacing: { before: 100, after: 60 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: thoughtText, italics: true, color: '777777', size: 18 })
                    ],
                    indent: { left: 360 },
                    spacing: { after: 120 }
                })
            ];
        }

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
            const lines = codeText.split('\n');
            const childrenRuns = [];
            for (let i = 0; i < lines.length; i++) {
                childrenRuns.push(new TextRun({
                    text: lines[i],
                    font: 'Courier New',
                    size: 18,
                    break: i > 0 ? 1 : undefined
                }));
            }
            return [new Paragraph({
                children: childrenRuns,
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

        // Image
        if (tag === 'img') {
            const src = node.getAttribute('src') || '';
            const exporterId = node.getAttribute('data-exporter-id');
            const idMatch = src.match(/__IMAGE_PLACEHOLDER__(image-\d+)/);
            const imageId = exporterId || (idMatch ? idMatch[1] : null);

            if (imageId) {
                const imgMeta = imageMap[imageId];
                if (imgMeta?.base64) {
                    try {
                        const arrayBuffer = base64ToArrayBuffer(imgMeta.base64);
                        const mimeType = imgMeta.base64.match(/^data:([^;]+)/)?.[1] || 'image/png';
                        const typeMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'png' };
                        const imgType = typeMap[mimeType] || 'png';
                        const dims = getImageDimensions(arrayBuffer);
                        const { width, height } = fitDimensions(dims?.width, dims?.height);

                        return [new Paragraph({
                            children: [new ImageRun({
                                data: arrayBuffer,
                                transformation: { width, height },
                                type: imgType
                            })]
                        })];
                    } catch (e) {
                        return [new Paragraph({ text: `[Image: ${imgMeta?.alt || imageId}]` })];
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
            return processList(node, false, 0);
        }

        // Ordered list
        if (tag === 'ol') {
            return processList(node, true, 0);
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
        text: title || 'Gemini Chat',
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
                spacing: { after: turn.attachments && turn.attachments.length > 0 ? 100 : 200 }
            }));

            // Handle user attachments
            if (turn.attachments && turn.attachments.length > 0) {
                for (const att of turn.attachments) {
                    const imgMeta = imageMap[att.id];
                    if (imgMeta?.base64) {
                        try {
                            const arrayBuffer = base64ToArrayBuffer(imgMeta.base64);
                            const mimeType = imgMeta.base64.match(/^data:([^;]+)/)?.[1] || 'image/png';
                            const typeMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'png' };
                            const imgType = typeMap[mimeType] || 'png';
                            const dims = getImageDimensions(arrayBuffer);
                            const { width, height } = fitDimensions(dims?.width, dims?.height);

                            children.push(new Paragraph({
                                children: [new ImageRun({
                                    data: arrayBuffer,
                                    transformation: { width, height },
                                    type: imgType
                                })],
                                spacing: { after: 100 }
                            }));
                        } catch (e) {
                            children.push(new Paragraph({ text: `[Attachment: ${att.alt || att.id}]` }));
                        }
                    }
                }
            }
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
        title: title || 'Gemini Chat',
        creator: 'Gemini Chat Exporter',
        sections: [{ children }]
    });

    return await Packer.toBlob(doc);
}

if (typeof window !== 'undefined') {
    window.exportDocx = exportDocx;
}
if (typeof globalThis !== 'undefined') {
    globalThis.exportDocx = exportDocx;
}
