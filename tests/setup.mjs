import { JSDOM } from 'jsdom';

export function loadDom(html = '<!DOCTYPE html><html><body></body></html>') {
    return new JSDOM(html, {
        url: 'https://gemini.google.com/app',
        runScripts: 'dangerously'
    });
}
