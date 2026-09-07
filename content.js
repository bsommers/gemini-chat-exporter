// content.js – injected into gemini.google.com pages
// Scrapes the active chat conversation and returns structured data

(() => {
    'use strict';

    if (window.__geminiExporterLoaded) return;
    window.__geminiExporterLoaded = true;

    /**
     * Convert an img element's src to a base64 data URI.
     * Returns null if the image can't be fetched.
     */
    async function imgToBase64(src) {
        try {
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
     * Extract clean conversation title.
     * Fallback hierarchy:
     * 1. Active sidebar conversation title
     * 2. Header title
     * 3. First user query (truncated)
     * 4. Document title (cleaned)
     * 5. Default "Gemini Chat"
     */
    function extractConversationTitle(firstUserText = '') {
        const sidebarTitleEl = document.querySelector(
            'conversation-item.selected [data-test-id="conversation-title"], ' +
            'conversation-item.selected .title, ' +
            '.conversation-item.selected [data-test-id="conversation-title"], ' +
            '.conversation-item.selected .title, ' +
            '.conversation.selected [data-test-id="conversation-title"], ' +
            '.conversation.selected .title, ' +
            '[aria-selected="true"] [data-test-id="conversation-title"], ' +
            '.chat-history .selected-chat'
        );
        const sidebarTitle = sidebarTitleEl?.textContent?.trim();
        if (sidebarTitle && sidebarTitle.length > 1) {
            return sidebarTitle;
        }

        const headerTitleEl = document.querySelector('header .title, main h1, .chat-title');
        const headerTitle = headerTitleEl?.textContent?.trim();
        if (headerTitle && !headerTitle.toLowerCase().includes('gemini') && headerTitle.length > 1) {
            return headerTitle;
        }

        let userText = (firstUserText || '').trim();
        if (!userText) {
            const firstQueryEl = document.querySelector(
                'user-query .query-text, user-query [data-query-text], user-query'
            );
            userText = firstQueryEl?.textContent?.trim() || '';
        }

        if (userText && userText.length > 0) {
            const truncated = userText.replace(/\s+/g, ' ').trim().slice(0, 50);
            if (truncated.length > 0) return truncated;
        }

        const docTitle = document.title
            .replace(/\s*[-|].*$/, '')
            .replace(/Google\s*Gemini/i, '')
            .replace(/Gemini/i, '')
            .trim();
        if (docTitle && docTitle.length > 1) {
            return docTitle;
        }

        return 'Gemini Chat';
    }

    /**
     * Clean code-blocks inside container:
     * Replaces <code-block> elements with clean <pre><code class="language-...">
     * without loop-indexing mutation bugs.
     */
    function cleanCodeBlocks(container) {
        const codeBlocks = Array.from(container.querySelectorAll('code-block'));
        for (const cb of codeBlocks) {
            cb.querySelectorAll('button, .code-block-decoration').forEach(el => el.remove());
            const preEl = cb.querySelector('pre') || cb.querySelector('code');
            const langClassEl = cb.matches?.('[class*="language-"]') ? cb : cb.querySelector('[class*="language-"]');
            const langMatch = langClassEl?.className?.match?.(/language-([a-zA-Z0-9_+-]+)/);
            const lang = cb.getAttribute('lang') ||
                cb.getAttribute('data-language') ||
                (langMatch ? langMatch[1] : '') ||
                '';
            const codeText = preEl ? preEl.textContent : cb.textContent;
            const replacement = document.createElement('pre');
            const codeEl = document.createElement('code');
            if (lang) codeEl.className = `language-${lang}`;
            codeEl.textContent = codeText || '';
            replacement.appendChild(codeEl);
            cb.replaceWith(replacement);
        }
    }

    /**
     * Clean KaTeX / MathJax formulas inside container:
     * Extracts TeX source from annotations or data attributes,
     * stripping duplicate MathML and HTML spans.
     */
    function cleanKatexMath(container) {
        const mathEls = Array.from(container.querySelectorAll('.katex, math-renderer'));
        for (const el of mathEls) {
            const annotation = el.querySelector('annotation[encoding*="tex"]');
            const tex = annotation ? annotation.textContent.trim() : (el.getAttribute('data-tex') || el.textContent.trim());
            const isDisplay = el.classList.contains('katex-display') || el.getAttribute('display') === 'true' || el.parentElement?.classList?.contains('katex-display');
            const span = document.createElement('span');
            span.className = 'latex-math';
            span.textContent = isDisplay ? `\n$$\n${tex}\n$$\n` : `$${tex}$`;
            el.replaceWith(span);
        }
    }

    /**
     * Detect and standardize thinking/reasoning blocks:
     * Wraps reasoning containers into a clean <details class="gemini-thought">
     */
    function processThinkingBlocks(container) {
        let thoughtText = '';
        const thoughtEls = Array.from(container.querySelectorAll(
            '.thinking-process, expandable-block, thought-box, .thought-container, [data-test-id="thinking-process"]'
        ));
        for (const th of thoughtEls) {
            thoughtText += (th.textContent || '').trim() + '\n';
            const details = document.createElement('details');
            details.className = 'gemini-thought';
            const summary = document.createElement('summary');
            summary.textContent = 'Thinking Process';
            details.appendChild(summary);
            const contentDiv = document.createElement('div');
            contentDiv.className = 'thought-content';
            contentDiv.innerHTML = th.innerHTML;
            details.appendChild(contentDiv);
            th.replaceWith(details);
        }
        return thoughtText.trim();
    }

    /**
     * Check if an image is an icon, badge, or avatar.
     */
    function isIconOrAvatar(img) {
        if (!img || !img.src) return true;
        const src = img.src.toLowerCase();
        if (src.includes('avatar') || src.includes('icon') || src.includes('favicon')) return true;
        if ((img.width > 0 && img.width < 32) || (img.height > 0 && img.height < 32)) return true;
        return false;
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
        const allTurnNodes = Array.from(
            document.querySelectorAll('user-query, model-response')
        );

        if (allTurnNodes.length === 0) {
            const title = extractConversationTitle();
            return { title, turns: [], images: [] };
        }

        const images = [];
        let imageCounter = 0;
        const turns = [];
        let firstUserText = '';

        for (const node of allTurnNodes) {
            const isUser = node.tagName.toLowerCase() === 'user-query';
            let html = '';
            let text = '';
            let thought = '';
            const attachments = [];

            if (isUser) {
                const queryEl = node.querySelector('.query-text') ||
                    node.querySelector('[data-query-text]') ||
                    node;
                html = queryEl.innerHTML;
                text = queryEl.innerText || queryEl.textContent || '';

                if (!firstUserText && text.trim()) {
                    firstUserText = text.trim();
                }

                // Extract user attached images
                const userImgs = Array.from(node.querySelectorAll('img')).filter(img => !isIconOrAvatar(img));
                for (const img of userImgs) {
                    const imageId = `image-${imageCounter++}`;
                    images.push({
                        id: imageId,
                        src: img.src,
                        alt: img.alt || 'User Attachment',
                        ext: 'png',
                        element: img
                    });
                    attachments.push({
                        type: 'image',
                        id: imageId,
                        alt: img.alt || 'User Attachment'
                    });
                }
            } else {
                const markdownEl = node.querySelector('.markdown') ||
                    node.querySelector('.response-content') ||
                    node.querySelector('.message-content') ||
                    node;

                const clone = markdownEl.cloneNode(true);

                // Clean thinking blocks
                thought = processThinkingBlocks(clone);

                // Clean code-blocks
                cleanCodeBlocks(clone);

                // Clean KaTeX math
                cleanKatexMath(clone);

                // Collect images in model response
                const imgEls = Array.from(clone.querySelectorAll('img')).filter(img => !isIconOrAvatar(img));
                for (const img of imgEls) {
                    const imageId = `image-${imageCounter++}`;
                    images.push({
                        id: imageId,
                        src: img.src,
                        alt: img.alt || '',
                        ext: 'png',
                        element: img
                    });
                    img.setAttribute('data-exporter-id', imageId);
                    img.setAttribute('src', `__IMAGE_PLACEHOLDER__${imageId}`);
                    img.removeAttribute('srcset');
                }

                html = clone.innerHTML;
                text = htmlToText(html);
            }

            turns.push({
                role: isUser ? 'user' : 'model',
                html: html.trim(),
                text: text.trim(),
                thought: thought || undefined,
                attachments: attachments.length > 0 ? attachments : undefined
            });
        }

        // Fetch images in parallel with concurrency cap
        const CONCURRENCY_LIMIT = 5;
        const resolvedImages = [];
        for (let i = 0; i < images.length; i += CONCURRENCY_LIMIT) {
            const chunk = images.slice(i, i + CONCURRENCY_LIMIT);
            const chunkResults = await Promise.all(
                chunk.map(async (img) => {
                    const base64 = await imgToBase64(img.src);
                    return {
                        id: img.id,
                        src: img.src,
                        alt: img.alt,
                        base64: base64 || null,
                        ext: img.ext || 'png'
                    };
                })
            );
            resolvedImages.push(...chunkResults);
        }
        const title = extractConversationTitle(firstUserText);

        return { title, turns, images: resolvedImages };
    }

    // Expose helpers for testing
    if (typeof window !== 'undefined') {
        window.__geminiExporterHelpers = {
            extractConversationTitle,
            cleanCodeBlocks,
            cleanKatexMath,
            processThinkingBlocks,
            isIconOrAvatar,
            htmlToText,
            extractChat
        };
    }

    // Listen for messages from popup / background
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
            if (msg.action === 'getTitle') {
                const title = extractConversationTitle();
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
    }
})();
