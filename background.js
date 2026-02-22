// background.js – service worker
// Imports export modules and handles file generation + download

'use strict';

importScripts(
    'lib/turndown.min.js',
    'lib/jszip.min.js',
    'lib/docx.min.js',
    'exporters/markdown.js',
    'exporters/html_single.js',
    'exporters/html_linked.js',
    'exporters/docx_export.js'
);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action !== 'export') return;

    const { format, chatData } = msg;
    handleExport(format, chatData)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));

    return true; // async
});

async function handleExport(format, chatData) {
    const safeName = chatData.title
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 60) || 'gemini-chat';

    switch (format) {
        case 'markdown': {
            const md = exportMarkdown(chatData);
            const filename = `${safeName}.md`;
            await downloadText(md, filename, 'text/markdown');
            return { success: true, filename };
        }
        case 'docx': {
            const blob = await exportDocx(chatData);
            const filename = `${safeName}.docx`;
            await downloadBlob(blob, filename);
            return { success: true, filename };
        }
        case 'html_single': {
            const html = exportHtmlSingle(chatData);
            const filename = `${safeName}.html`;
            await downloadText(html, filename, 'text/html');
            return { success: true, filename };
        }
        case 'html_linked': {
            const zipBlob = await exportHtmlLinked(chatData);
            const filename = `${safeName}.zip`;
            await downloadBlob(zipBlob, filename);
            return { success: true, filename };
        }
        default:
            return { success: false, error: `Unknown format: ${format}` };
    }
}

function downloadText(text, filename, mimeType) {
    const dataUrl = `data:${mimeType};charset=utf-8,` + encodeURIComponent(text);
    return new Promise((resolve) => {
        chrome.downloads.download({ url: dataUrl, filename, saveAs: false }, resolve);
    });
}

function downloadBlob(blob, filename) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            chrome.downloads.download({ url: reader.result, filename, saveAs: false }, resolve);
        };
        reader.readAsDataURL(blob);
    });
}
