// background.js – service worker
// Lean Manifest V3 background service worker

'use strict';

chrome.runtime.onInstalled.addListener(() => {
    console.log('Gemini Chat Exporter v1.1.0 installed.');
});
