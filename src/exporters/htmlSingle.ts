import type { ChatData } from '../content/types';

export function exportHtmlSingle(chatData: ChatData): string {
  const { title, turns, images } = chatData;

  // Build image lookup map
  const imageMap: Record<string, (typeof images)[number]> = {};
  for (const img of images) {
    imageMap[img.id] = img;
  }

  function processHtml(html: string): string {
    // TODO milestone 3: apply sanitizer before embedding raw Gemini HTML
    // Replace image placeholders with embedded base64
    return html.replace(/src="__IMAGE_PLACEHOLDER__(image-\d+)"/g, (_match, id) => {
      const imgMeta = imageMap[id];
      if (imgMeta?.base64) {
        return `src="${imgMeta.base64}"`;
      }
      return `src="" data-original-id="${id}"`;
    });
  }

  const turnsHtml = turns
    .map((turn) => {
      const isUser = turn.role === 'user';
      const html = isUser ? `<p class="user-text">${escapeHtml(turn.text)}</p>` : processHtml(turn.html);

      return `
    <div class="turn ${isUser ? 'turn-user' : 'turn-model'}">
      <div class="turn-avatar">${isUser ? '👤' : '✦'}</div>
      <div class="turn-content">
        <div class="turn-role">${isUser ? 'You' : 'Gemini'}</div>
        <div class="turn-body">${html}</div>
      </div>
    </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${getStyles()}
  </style>
</head>
<body>
  <div class="page">
    <div class="page-header">
      <div class="page-logo">✦ Gemini</div>
      <h1 class="page-title">${escapeHtml(title)}</h1>
      <div class="page-meta">Exported on ${new Date().toLocaleString()}</div>
    </div>
    <div class="conversation">
      ${turnsHtml}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getStyles(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #0f1117;
      color: #e0e0ff;
      line-height: 1.7;
    }
    .page {
      max-width: 860px;
      margin: 0 auto;
      padding: 0 20px 60px;
    }
    .page-header {
      padding: 40px 0 30px;
      border-bottom: 1px solid rgba(138,180,248,0.15);
      margin-bottom: 32px;
    }
    .page-logo {
      font-size: 13px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #8ab4f8;
      margin-bottom: 10px;
      font-weight: 600;
    }
    .page-title {
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 8px;
    }
    .page-meta { font-size: 12px; color: #6272a4; }
    .turn {
      display: flex;
      gap: 16px;
      margin-bottom: 28px;
      align-items: flex-start;
    }
    .turn-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .turn-model .turn-avatar {
      background: linear-gradient(135deg, #1e3a5f, #1a1b2e);
      border-color: rgba(138,180,248,0.25);
    }
    .turn-content { flex: 1; min-width: 0; }
    .turn-role {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 8px;
      color: #6272a4;
    }
    .turn-user .turn-role { color: #bd93f9; }
    .turn-model .turn-role { color: #8ab4f8; }
    .turn-body { font-size: 15px; }
    .turn-user .turn-body {
      background: rgba(189,147,249,0.08);
      border: 1px solid rgba(189,147,249,0.15);
      border-radius: 12px;
      padding: 14px 18px;
    }
    .user-text { white-space: pre-wrap; }
    .turn-model .turn-body p { margin-bottom: 12px; }
    .turn-model .turn-body p:last-child { margin-bottom: 0; }
    .turn-model .turn-body ul,
    .turn-model .turn-body ol { margin: 8px 0 12px 24px; }
    .turn-model .turn-body li { margin-bottom: 4px; }
    .turn-model .turn-body h1,
    .turn-model .turn-body h2,
    .turn-model .turn-body h3 {
      color: #8ab4f8;
      margin: 20px 0 8px;
    }
    .turn-model .turn-body strong { color: #fff; font-weight: 600; }
    .turn-model .turn-body em { color: #cdd6f4; }
    .turn-model .turn-body code {
      background: rgba(255,255,255,0.08);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 13px;
      font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
      color: #f1fa8c;
    }
    .turn-model .turn-body pre {
      background: #191a2e;
      border: 1px solid rgba(138,180,248,0.15);
      border-radius: 10px;
      padding: 16px 18px;
      margin: 12px 0;
      overflow-x: auto;
    }
    .turn-model .turn-body pre code {
      background: none;
      padding: 0;
      color: #f8f8f2;
      font-size: 13px;
    }
    .turn-model .turn-body img {
      max-width: 100%;
      border-radius: 10px;
      margin: 10px 0;
      border: 1px solid rgba(138,180,248,0.2);
    }
    .turn-model .turn-body a { color: #8ab4f8; }
    .turn-model .turn-body blockquote {
      border-left: 3px solid rgba(138,180,248,0.4);
      padding-left: 16px;
      color: #aab4d4;
      margin: 12px 0;
    }
    .turn-model .turn-body table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
      font-size: 14px;
    }
    .turn-model .turn-body th,
    .turn-model .turn-body td {
      border: 1px solid rgba(138,180,248,0.2);
      padding: 8px 12px;
      text-align: left;
    }
    .turn-model .turn-body th {
      background: rgba(138,180,248,0.1);
      color: #8ab4f8;
      font-weight: 600;
    }
  `;
}
