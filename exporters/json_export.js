// exporters/json_export.js
// Exports structured conversation data as formatted JSON

'use strict';

function exportJson(chatData) {
    const { title, turns = [], images = [] } = chatData;
    const output = {
        title: title || 'Gemini Chat',
        exportedAt: new Date().toISOString(),
        generator: 'Gemini Chat Exporter',
        version: '1.1.0',
        turns: turns.map(t => ({
            role: t.role,
            text: t.text || '',
            thought: t.thought || undefined,
            attachments: t.attachments || undefined,
            html: t.html || undefined
        })),
        images: images.map(img => ({
            id: img.id,
            alt: img.alt || '',
            ext: img.ext || 'png'
        }))
    };

    return JSON.stringify(output, null, 2);
}

if (typeof window !== 'undefined') {
    window.exportJson = exportJson;
}
if (typeof globalThis !== 'undefined') {
    globalThis.exportJson = exportJson;
}
