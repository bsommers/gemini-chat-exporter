import { JSDOM } from 'jsdom';

export function loadDom(html = '<!DOCTYPE html><html><body></body></html>') {
    const dom = new JSDOM(html, {
        url: 'https://gemini.google.com/app',
        runScripts: 'dangerously'
    });
    if (!dom.window.setImmediate && globalThis.setImmediate) {
        dom.window.setImmediate = globalThis.setImmediate;
        dom.window.clearImmediate = globalThis.clearImmediate;
    }
    return dom;
}
