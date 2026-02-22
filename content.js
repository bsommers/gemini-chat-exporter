// content.js – injected into gemini.google.com pages
// Scrapes the active chat conversation and returns structured data

'use strict';

/**
 * Convert an img element's src to a base64 data URI.
 * Returns null if the image can't be fetched.
 */
async function imgToBase64(img) {
    try {
        const src = img.src;
        if (!src || src.startsWith('data:')) return src;
        const resp = await fetch(src, { credentials: 'include' });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

/**
 * Extract a clean text version of a turn's HTML content.
 */
function htmlToText(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.innerText || div.textContent || '';
}

/**
 * Main extraction function – walks all user-query and model-response elements.
 */
async function extractChat() {
    const title = document.title.replace(/\s*[-|].*$/, '').trim() || 'Gemini Chat';

    // Collect all turns in DOM order
    const allTurnNodes = Array.from(
        document.querySelectorAll('user-query, model-response')
    );

    if (allTurnNodes.length === 0) {
        return { title, turns: [], images: [] };
    }

    const images = [];
    let imageCounter = 0;
    const turns = [];

    for (const node of allTurnNodes) {
        const isUser = node.tagName.toLowerCase() === 'user-query';
        let html = '';
        let text = '';

        if (isUser) {
            // User message
            const queryEl = node.querySelector('.query-text') ||
                node.querySelector('[data-query-text]') ||
                node;
            html = queryEl.innerHTML;
            text = queryEl.innerText || queryEl.textContent || '';
        } else {
            // Model response – grab the markdown container
            const markdownEl = node.querySelector('.markdown') ||
                node.querySelector('.response-content') ||
                node.querySelector('.message-content') ||
                node;

            // Deep-clone so we can manipulate for image extraction
            const clone = markdownEl.cloneNode(true);

            // Process code-block custom elements: replace with pre>code
            node.querySelectorAll('code-block').forEach((cb, i) => {
                const preEl = cb.querySelector('pre') || cb.querySelector('code');
                const lang = cb.getAttribute('lang') ||
                    cb.querySelector('[class*="language-"]')?.className.match(/language-(\w+)/)?.[1] ||
                    '';
                const codeText = preEl ? preEl.innerText : cb.innerText;
                const replacement = document.createElement('pre');
                const codeEl = document.createElement('code');
                if (lang) codeEl.className = `language-${lang}`;
                codeEl.textContent = codeText;
                replacement.appendChild(codeEl);
                // Find corresponding element in clone and replace
                const cloneCodeBlocks = clone.querySelectorAll('code-block');
                if (cloneCodeBlocks[i]) {
                    cloneCodeBlocks[i].replaceWith(replacement);
                }
            });

            // Process images: collect and replace src with placeholder id
            const imgEls = clone.querySelectorAll('img');
            for (const img of imgEls) {
                // Skip UI icons / avatar images (small or svg-based)
                if ((img.width > 0 && img.width < 32) || img.src.includes('icon') || img.src.includes('avatar')) {
                    img.remove();
                    continue;
                }
                const imageId = `image-${imageCounter++}`;
                const base64 = await imgToBase64(img);
                images.push({
                    id: imageId,
                    src: img.src,
                    alt: img.alt || '',
                    base64: base64 || null,
                    ext: 'png'
                });
                img.dataset.exportId = imageId;
                img.src = `__IMAGE_PLACEHOLDER__${imageId}`;
                img.removeAttribute('srcset');
            }

            html = clone.innerHTML;
            text = htmlToText(html);
        }

        turns.push({
            role: isUser ? 'user' : 'model',
            html: html.trim(),
            text: text.trim()
        });
    }

    return { title, turns, images };
}

// Listen for messages from popup / background
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'getTitle') {
        const title = document.title.replace(/\s*[-|].*$/, '').trim() || 'Gemini Chat';
        sendResponse({ title });
        return true;
    }

    if (msg.action === 'extractChat') {
        extractChat()
            .then(data => sendResponse(data))
            .catch(err => sendResponse({ error: err.message, turns: [], images: [] }));
        return true; // async
    }
});
