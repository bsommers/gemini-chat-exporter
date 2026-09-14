import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../../src/exporters/sanitizer';

describe('sanitizeHtml', () => {
  it('removes <script> tags entirely', () => {
    const out = sanitizeHtml('<p>Legitimate text</p><script>alert("pwned")</script>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('alert');
    expect(out).toContain('Legitimate text');
  });

  it('strips onerror/onclick event handler attributes', () => {
    const out = sanitizeHtml('<img src="valid.png" onerror="alert(1)"><button onclick="alert(2)">Click</button>');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('onclick');
    expect(out).toContain('src="valid.png"');
  });

  it('neutralizes javascript: URLs in href', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">Click me</a>');
    expect(out).not.toContain('javascript:');
  });

  it('strips <iframe> elements', () => {
    const out = sanitizeHtml('<p>Text</p><iframe src="https://evil.example"></iframe>');
    expect(out).not.toContain('<iframe');
    expect(out).toContain('Text');
  });

  it('strips <style> tags and inline CSS injection vectors', () => {
    const out = sanitizeHtml('<style>body{background:url(javascript:alert(1))}</style><p>ok</p>');
    expect(out).not.toContain('<style>');
    expect(out).toContain('ok');
  });

  it('strips data: URIs with embedded script payloads used as an href', () => {
    const out = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">link</a>');
    expect(out).not.toContain('<script>');
  });

  it('strips <object> and <embed> elements', () => {
    const out = sanitizeHtml('<object data="evil.swf"></object><embed src="evil.swf">');
    expect(out).not.toContain('<object');
    expect(out).not.toContain('<embed');
  });

  it('strips <form> elements entirely', () => {
    const out = sanitizeHtml('<form action="https://evil.example"><input type="text"></form><p>safe</p>');
    expect(out).not.toContain('<form');
    expect(out).toContain('safe');
  });

  it('preserves legitimate prose, links, images, and tables', () => {
    const html =
      '<p>Hello <strong>world</strong></p>' +
      '<a href="https://example.com">link</a>' +
      '<img src="__IMAGE_PLACEHOLDER__image-0" alt="pic">' +
      '<table><tr><th>A</th></tr><tr><td>1</td></tr></table>';
    const out = sanitizeHtml(html);

    expect(out).toContain('Hello');
    expect(out).toContain('<strong>world</strong>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('src="__IMAGE_PLACEHOLDER__image-0"');
    expect(out).toContain('<table>');
    expect(out).toContain('<th>A</th>');
  });

  it('drops data-* attributes since ALLOW_DATA_ATTR is disabled, except the explicitly allowed data-original-id', () => {
    const out = sanitizeHtml('<img src="x.png" data-exfil="secret" data-original-id="image-0">');
    expect(out).not.toContain('data-exfil');
  });
});
