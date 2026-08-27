/**
 * HTML builder: assemble text + images into a single self-contained .html file.
 *
 * Images are embedded as base64 data URLs (`<img src="data:image/png;base64,...">`),
 * which all browsers render natively. The text is wrapped in a clean,
 * readable HTML document with basic styling.
 */

import type { ParsedFile } from './types';
import { blobToDataUrl } from './markdown-builder';

/** Escape HTML special characters in text. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convert plain text to simple HTML paragraphs, preserving line breaks
 *  and code blocks. Lightweight — not a full Markdown renderer. */
function textToHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  // If the text already looks like HTML, keep it as-is.
  if (/^\s*<(html|body|div|p|h[1-6]|ul|ol|table|pre)\b/i.test(trimmed)) {
    return trimmed;
  }

  // Split into blocks separated by blank lines.
  const blocks = trimmed.split(/\n{2,}/);
  const htmlParts: string[] = [];

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    // Code block: indented 4+ spaces or tab
    if (/^(    |\t)/m.test(trimmedBlock)) {
      htmlParts.push(`<pre><code>${escapeHtml(trimmedBlock)}</code></pre>`);
      continue;
    }

    // Heading: # ## ### etc
    const headingMatch = trimmedBlock.match(/^(#{1,6})\s+(.+)$/m);
    if (headingMatch && trimmedBlock.split('\n').length === 1) {
      const level = headingMatch[1].length;
      const content = escapeHtml(headingMatch[2].replace(/[*_`]/g, ''));
      htmlParts.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    // Regular paragraph: preserve single line breaks
    const escaped = escapeHtml(trimmedBlock);
    const withBreaks = escaped.replace(/\n/g, '<br>\n');
    htmlParts.push(`<p>${withBreaks}</p>`);
  }

  return htmlParts.join('\n');
}

/**
 * Build a self-contained HTML string from text content + image files.
 *
 * @param text   The text content (plain text, code, or markdown-ish).
 * @param images Image files (must have `blob` + `mimeType` set).
 * @returns A complete HTML document string.
 */
export async function buildHtml(
  text: string,
  images: ParsedFile[]
): Promise<string> {
  const bodyParts: string[] = [];

  const textHtml = textToHtml(text);
  if (textHtml) {
    bodyParts.push(textHtml);
  }

  for (const img of images) {
    if (!img.blob || !img.mimeType) continue;
    const dataUrl = await blobToDataUrl(img.blob);
    const altName = escapeHtml(img.path.replace(/\.[^.]+$/, ''));
    bodyParts.push(`<img src="${dataUrl}" alt="${altName}" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" />`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clip2File Saved Content</title>
  <style>
    body {
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }
    pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 14px;
    }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    img { display: block; }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; }
  </style>
</head>
<body>
${bodyParts.join('\n')}
</body>
</html>`;
}
