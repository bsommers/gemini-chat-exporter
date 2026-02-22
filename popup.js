// popup.js – handles toolbar popup UI and dispatches export requests

const statusEl = document.getElementById('status');
const chatTitleEl = document.getElementById('chatTitle');

function showStatus(msg, type = 'info') {
    statusEl.textContent = msg;
    statusEl.className = `status ${type}`;
}

function setButtonsDisabled(disabled) {
    document.querySelectorAll('.export-btn').forEach(b => b.disabled = disabled);
}

async function getActiveGeminiTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes('gemini.google.com')) return null;
    return tab;
}

/**
 * Ensure the content script is running in the given tab.
 * If the tab was already open when the extension was installed,
 * chrome.tabs.sendMessage throws "Receiving end does not exist".
 * We catch that and inject the script programmatically, then retry.
 */
async function sendMessageWithInject(tabId, message) {
    try {
        return await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
        if (!err.message?.includes('Receiving end does not exist') &&
            !err.message?.includes('Could not establish connection')) {
            throw err;
        }
        // Inject content script on demand
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });
        // Small delay to let script initialise
        await new Promise(r => setTimeout(r, 300));
        return await chrome.tabs.sendMessage(tabId, message);
    }
}

async function init() {
    const tab = await getActiveGeminiTab();
    if (!tab) {
        chatTitleEl.textContent = 'Not on Gemini – open a chat first';
        setButtonsDisabled(true);
        return;
    }

    try {
        const result = await sendMessageWithInject(tab.id, { action: 'getTitle' });
        if (result?.title) {
            chatTitleEl.textContent = result.title;
        } else {
            chatTitleEl.textContent = 'Gemini chat detected';
        }
    } catch {
        chatTitleEl.textContent = 'Open a Gemini chat to export';
    }
}

document.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const format = btn.dataset.format;
        const tab = await getActiveGeminiTab();
        if (!tab) {
            showStatus('Please open a Gemini chat tab first.', 'error');
            return;
        }

        showStatus('Extracting chat content…', 'loading');
        setButtonsDisabled(true);

        try {
            const chatData = await sendMessageWithInject(tab.id, { action: 'extractChat' });

            if (!chatData || !chatData.turns || chatData.turns.length === 0) {
                showStatus('No chat content found. Make sure a conversation is open.', 'error');
                setButtonsDisabled(false);
                return;
            }

            showStatus('Generating export…', 'loading');

            const safeName = chatData.title
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-')
                .substring(0, 60) || 'gemini-chat';

            let filename, blob;

            switch (format) {
                case 'markdown': {
                    const md = exportMarkdown(chatData);
                    filename = `${safeName}.md`;
                    blob = new Blob([md], { type: 'text/markdown' });
                    break;
                }
                case 'docx': {
                    blob = await exportDocx(chatData);
                    filename = `${safeName}.docx`;
                    break;
                }
                case 'html_single': {
                    const html = exportHtmlSingle(chatData);
                    filename = `${safeName}.html`;
                    blob = new Blob([html], { type: 'text/html' });
                    break;
                }
                case 'html_linked': {
                    blob = await exportHtmlLinked(chatData);
                    filename = `${safeName}.zip`;
                    break;
                }
                default:
                    throw new Error(`Unknown format: ${format}`);
            }

            // Trigger download via object URL
            const url = URL.createObjectURL(blob);
            await chrome.downloads.download({ url, filename, saveAs: false });
            URL.revokeObjectURL(url);

            showStatus(`✓ Exported as ${filename}`, 'success');
        } catch (err) {
            console.error('Export error:', err);
            showStatus(`Error: ${err.message}`, 'error');
        } finally {
            setButtonsDisabled(false);
        }
    });
});

init();
