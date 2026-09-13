// Service worker entry point.
//
// All export/download logic lives in the popup (src/popup/popup.ts), not here:
// the docx/jszip exporters need DOM access (canvas, document) that MV3 service
// workers don't have, so they run in the popup's document context instead.
// This worker currently has no responsibilities beyond existing so the
// manifest's `background.service_worker` entry resolves to a real bundle.

chrome.runtime.onInstalled.addListener(() => {
  // No first-run setup needed yet.
});
