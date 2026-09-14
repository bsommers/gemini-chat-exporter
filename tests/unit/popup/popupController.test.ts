import { describe, it, expect, vi, beforeEach } from 'vitest';

const POPUP_BODY = `
  <div class="chat-title" id="chatTitle">Detecting chat…</div>
  <div class="buttons">
    <button class="export-btn" id="btnMarkdown" data-format="markdown"></button>
    <button class="export-btn" id="btnDocx" data-format="docx"></button>
  </div>
  <div id="status" class="status hidden"></div>
`;

/**
 * popup.ts runs DOM queries, event-listener wiring, and init() as side
 * effects at import time, so each test gets a fresh module instance (via
 * vi.resetModules()) after setting up the DOM and any chrome mock overrides
 * it needs to see during that import-time execution.
 */
async function loadPopup() {
  document.body.innerHTML = POPUP_BODY;
  vi.resetModules();
  return import('../../../src/popup/popup');
}

describe('popup.ts', () => {
  beforeEach(() => {
    // jsdom doesn't implement object URL creation - patch the two methods
    // directly rather than replacing the global, so `URL` stays usable as a
    // constructor for anything else that touches it.
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  describe('buildSafeFilename', () => {
    it('strips unsafe characters and collapses whitespace to hyphens', async () => {
      const { buildSafeFilename } = await loadPopup();
      expect(buildSafeFilename('My Chat: "Quantum" Physics?!')).toBe('My-Chat-Quantum-Physics');
    });

    it('falls back to gemini-chat when the title has nothing usable', async () => {
      const { buildSafeFilename } = await loadPopup();
      expect(buildSafeFilename('???')).toBe('gemini-chat');
    });

    it('truncates to 60 characters', async () => {
      const { buildSafeFilename } = await loadPopup();
      const long = 'a'.repeat(100);
      expect(buildSafeFilename(long).length).toBe(60);
    });
  });

  describe('getActiveGeminiTab', () => {
    it('returns null when there is no active tab', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.query.mockResolvedValue([]);
      const { getActiveGeminiTab } = await loadPopup();
      expect(await getActiveGeminiTab()).toBeNull();
    });

    it('returns null when the active tab is not a gemini.google.com URL', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com' }]);
      const { getActiveGeminiTab } = await loadPopup();
      expect(await getActiveGeminiTab()).toBeNull();
    });

    it('returns the tab when it is a gemini.google.com URL', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://gemini.google.com/app/abc' }]);
      const { getActiveGeminiTab } = await loadPopup();
      const tab = await getActiveGeminiTab();
      expect(tab?.id).toBe(1);
    });
  });

  describe('sendMessageWithInject', () => {
    it('sends directly when the content script is already there', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.sendMessage.mockResolvedValue({ title: 'Hi' });
      const { sendMessageWithInject } = await loadPopup();

      const result = await sendMessageWithInject<{ title: string }>(1, { action: 'getTitle' });
      expect(result).toEqual({ title: 'Hi' });
      expect(chromeMock.scripting.executeScript).not.toHaveBeenCalled();
    });

    it('injects the content script and retries on "Receiving end does not exist"', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.sendMessage
        .mockRejectedValueOnce(new Error('Receiving end does not exist'))
        .mockResolvedValueOnce({ title: 'Injected' });
      const { sendMessageWithInject } = await loadPopup();

      const result = await sendMessageWithInject<{ title: string }>(1, { action: 'getTitle' });
      expect(chromeMock.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        files: ['content.js']
      });
      expect(result).toEqual({ title: 'Injected' });
    });

    it('rethrows other errors without attempting injection', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.sendMessage.mockRejectedValue(new Error('some other failure'));
      const { sendMessageWithInject } = await loadPopup();

      await expect(sendMessageWithInject(1, { action: 'getTitle' })).rejects.toThrow('some other failure');
      expect(chromeMock.scripting.executeScript).not.toHaveBeenCalled();
    });
  });

  describe('init', () => {
    it('disables export buttons and shows a message when not on a Gemini tab', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.query.mockResolvedValue([]);
      await loadPopup();
      // init() runs at import time; wait a tick for its promise chain.
      await new Promise((r) => setTimeout(r, 0));

      const btn = document.querySelector<HTMLButtonElement>('.export-btn')!;
      expect(btn.disabled).toBe(true);
      expect(document.getElementById('chatTitle')!.textContent).toContain('Not on Gemini');
    });

    it('shows the detected chat title on a Gemini tab', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://gemini.google.com/app' }]);
      chromeMock.tabs.sendMessage.mockResolvedValue({ title: 'My Conversation' });
      await loadPopup();
      await new Promise((r) => setTimeout(r, 0));

      expect(document.getElementById('chatTitle')!.textContent).toBe('My Conversation');
    });
  });

  describe('handleExportClick', () => {
    it('shows an error status when there is no active Gemini tab', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.query.mockResolvedValue([]);
      const { handleExportClick } = await loadPopup();

      await handleExportClick('markdown');
      expect(document.getElementById('status')!.textContent).toContain('open a Gemini chat tab');
    });

    it('shows an error when the extracted chat has no turns', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://gemini.google.com/app' }]);
      chromeMock.tabs.sendMessage.mockResolvedValue({ title: 'Empty', turns: [], images: [] });
      const { handleExportClick } = await loadPopup();

      await handleExportClick('markdown');
      expect(document.getElementById('status')!.textContent).toContain('No chat content found');
    });

    it('exports markdown and triggers a download on success', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://gemini.google.com/app' }]);
      chromeMock.tabs.sendMessage.mockResolvedValue({
        title: 'A Chat',
        turns: [{ role: 'user', text: 'hi', html: '<p>hi</p>' }],
        images: []
      });
      const { handleExportClick } = await loadPopup();

      await handleExportClick('markdown');

      expect(chromeMock.downloads.download).toHaveBeenCalledTimes(1);
      const call = chromeMock.downloads.download.mock.calls[0][0];
      expect(call.filename).toBe('A-Chat.md');
      expect(document.getElementById('status')!.textContent).toContain('Exported as A-Chat.md');
    });

    it('shows an error status for an unknown export format', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://gemini.google.com/app' }]);
      chromeMock.tabs.sendMessage.mockResolvedValue({
        title: 'A Chat',
        turns: [{ role: 'user', text: 'hi', html: '<p>hi</p>' }],
        images: []
      });
      const { handleExportClick } = await loadPopup();

      await handleExportClick('carrier-pigeon');
      expect(document.getElementById('status')!.textContent).toContain('Unknown format');
    });

    it('re-enables export buttons after the export completes', async () => {
      const chromeMock = (globalThis as any).chrome;
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://gemini.google.com/app' }]);
      chromeMock.tabs.sendMessage.mockResolvedValue({
        title: 'A Chat',
        turns: [{ role: 'user', text: 'hi', html: '<p>hi</p>' }],
        images: []
      });
      const { handleExportClick } = await loadPopup();

      await handleExportClick('markdown');
      const btn = document.querySelector<HTMLButtonElement>('.export-btn')!;
      expect(btn.disabled).toBe(false);
    });
  });
});
