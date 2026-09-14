import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../src/content/index';

/**
 * src/content/index.ts registers its onMessage listener once, as an
 * import-time side effect, against whatever `chrome` mock existed at that
 * moment (the setup file's initial top-level instance - `beforeEach` below
 * replaces `globalThis.chrome` with a fresh mock for every test, so we must
 * not look the listener up via `globalThis.chrome` again after that).
 */
const chromeAtContentScriptLoad = (globalThis as any).chrome;

function getRegisteredListener() {
  const calls = chromeAtContentScriptLoad.runtime.onMessage.addListener.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[0][0] as (msg: any, sender: any, sendResponse: (r: any) => void) => boolean | undefined;
}

describe('content script message contract', () => {
  beforeEach(() => {
    document.title = 'Chat Title - Gemini';
    document.body.innerHTML = '';
  });

  it('responds synchronously to getTitle with the current chat title', () => {
    const listener = getRegisteredListener();
    const sendResponse = vi.fn();

    const keptAlive = listener({ action: 'getTitle' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ title: 'Chat Title' });
    expect(keptAlive).toBe(true);
  });

  it('responds asynchronously to extractChat with structured chat data', async () => {
    document.body.innerHTML = `
      <user-query><div class="query-text"><p>Hi</p></div></user-query>
    `;
    const listener = getRegisteredListener();
    const sendResponse = vi.fn();

    const keptAlive = listener({ action: 'extractChat' }, {}, sendResponse);
    expect(keptAlive).toBe(true); // signals the async sendResponse path to chrome

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    const response = sendResponse.mock.calls[0]![0];
    expect(response.turns).toHaveLength(1);
    expect(response.turns[0].role).toBe('user');
  });

  it('responds with an error shape rather than throwing when extraction fails', async () => {
    document.body.innerHTML = `<user-query></user-query>`;
    // Force extraction to throw for this turn.
    vi.spyOn(document, 'querySelectorAll').mockImplementationOnce(() => {
      throw new Error('dom exploded');
    });

    const listener = getRegisteredListener();
    const sendResponse = vi.fn();
    listener({ action: 'extractChat' }, {}, sendResponse);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    const response = sendResponse.mock.calls[0]![0];
    expect(response.error).toBeDefined();
    expect(response.turns).toEqual([]);
  });

  it('ignores unknown message actions', () => {
    const listener = getRegisteredListener();
    const sendResponse = vi.fn();
    const result = listener({ action: 'somethingElse' as any }, {}, sendResponse);

    expect(sendResponse).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});

describe('popup outbound message shape', () => {
  it('sends the exact getTitle/extractChat action contract the content script expects', async () => {
    document.body.innerHTML = `
      <div class="chat-title" id="chatTitle"></div>
      <div class="buttons"><button class="export-btn" data-format="markdown"></button></div>
      <div id="status" class="status hidden"></div>
    `;
    const chromeMock = (globalThis as any).chrome;
    chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://gemini.google.com/app' }]);
    chromeMock.tabs.sendMessage.mockResolvedValue({ title: 'X' });

    vi.resetModules();
    const { getActiveGeminiTab, sendMessageWithInject } = await import('../../src/popup/popup');
    const tab = await getActiveGeminiTab();
    await sendMessageWithInject(tab!.id!, { action: 'getTitle' });

    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(1, { action: 'getTitle' });
  });
});
