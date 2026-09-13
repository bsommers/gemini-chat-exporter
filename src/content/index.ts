import { extractChat, getChatTitle } from './extractor';

interface ContentMessage {
  action: 'getTitle' | 'extractChat';
}

chrome.runtime.onMessage.addListener((msg: ContentMessage, _sender, sendResponse) => {
  if (msg.action === 'getTitle') {
    sendResponse({ title: getChatTitle() });
    return true;
  }

  if (msg.action === 'extractChat') {
    extractChat()
      .then((data) => sendResponse(data))
      .catch((err: Error) => sendResponse({ error: err.message, turns: [], images: [] }));
    return true; // async
  }

  return undefined;
});
