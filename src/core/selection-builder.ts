import type { SelectionAsset, SelectionContent, SelectionNode, ParsedFile } from './types';
import { blobToDataUrl } from './markdown-builder';
import { buildZip } from './zip-builder';
import { sanitizeFilename } from './sanitizer';

export interface SelectionBuildResult {
  filename: string;
  mime: string;
  text?: string;
  blob?: Blob;
  issues: ('missing-image' | 'complex-table')[];
  imageCount: number;
  missingImageCount: number;
  tableCount: number;
}

const tags = new Set(['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'strong', 'em', 'del', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption']);
const imageExtensions: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/x-icon': 'ico',
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeLink(href?: string): string | undefined {
  try {
    const url = new URL(href || '');
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function markdownText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/([`*_\[\]<>~|#])/g, '\\$1');
}

function rawText(node: SelectionNode): string {
  if (node.kind === 'text') return node.text;
  if (node.kind === 'image') return node.alt;
  return node.tag === 'br' ? '\n' : node.children.map(rawText).join('');
}

function countNodes(nodes: SelectionNode[], tag: string): number {
  return nodes.reduce((sum, node) => sum + (node.kind === 'element' ? Number(node.tag === tag) + countNodes(node.children, tag) : 0), 0);
}

export async function buildSelectionFile(
  selection: SelectionContent,
  assets: SelectionAsset[],
  mode: 'html' | 'markdown',
  filename: string,
  messages: { missingImage: string; complexTable: string },
): Promise<SelectionBuildResult> {
  const images = new Map<string, { html: string; path: string }>();
  const files: ParsedFile[] = [];
  const issues = new Set<'missing-image' | 'complex-table'>();
  const missing = new Set<string>();
  let hasImage = false;
  const base = sanitizeFilename(filename || 'selection').replace(/\.[^.]+$/, '') || 'selection';

  for (const asset of assets) {
    const blob = asset.file?.blob;
    const extension = blob && imageExtensions[blob.type];
    if (!blob || !extension || images.has(asset.id)) continue;
    const path = `assets/image-${images.size + 1}.${extension}`;
    images.set(asset.id, { html: mode === 'html' ? await blobToDataUrl(blob) : path, path });
    files.push({ path, language: 'image', content: '', blob, mimeType: blob.type, nameSource: 'clipboard-image' });
  }

  function html(node: SelectionNode): string {
    if (node.kind === 'text') return escapeHtml(node.text);
    if (node.kind === 'image') {
      hasImage = true;
      const image = images.get(node.id);
      if (!image) {
        issues.add('missing-image');
        missing.add(node.id);
        return `<span class="missing-image">${escapeHtml(messages.missingImage)}${node.alt ? ': ' + escapeHtml(node.alt) : ''}</span>`;
      }
      return `<img src="${escapeHtml(image.html)}" alt="${escapeHtml(node.alt)}">`;
    }
    const children = node.children.map(html).join('');
    if (!tags.has(node.tag)) return children;
    if (node.tag === 'br' || node.tag === 'hr') return `<${node.tag}>`;
    const href = node.tag === 'a' ? safeLink(node.href) : undefined;
    if (node.tag === 'a' && !href) return children;
    let attrs = href ? ` href="${escapeHtml(href)}" rel="noreferrer noopener"` : '';
    if (node.tag === 'ol' && Number.isSafeInteger(node.start)) attrs += ` start="${node.start}"`;
    if (node.tag === 'td' || node.tag === 'th') {
      for (const attr of ['colspan', 'rowspan'] as const) {
        const value = node[attr];
        if (value && Number.isInteger(value) && value > 1 && value <= 1000) attrs += ` ${attr}="${value}"`;
      }
    }
    return `<${node.tag}${attrs}>${children}</${node.tag}>`;
  }

  function tableRows(node: SelectionNode): Extract<SelectionNode, { kind: 'element' }>[] {
    if (node.kind !== 'element') return [];
    if (node.tag === 'tr') return [node];
    return node.children.flatMap(tableRows);
  }

  function md(node: SelectionNode): string {
    if (node.kind === 'text') return markdownText(node.text.replace(/\s+/g, ' '));
    if (node.kind === 'image') {
      hasImage = true;
      const image = images.get(node.id);
      if (!image) {
        issues.add('missing-image');
        missing.add(node.id);
        return `[${markdownText(messages.missingImage)}${node.alt ? ': ' + markdownText(node.alt) : ''}]`;
      }
      return `![${markdownText(node.alt)}](${image.path})`;
    }
    if (node.tag === 'pre') {
      const text = rawText(node).replace(/\n$/, '');
      const longest = Math.max(0, ...(text.match(/`+/g) || []).map((run) => run.length));
      const fence = '`'.repeat(Math.max(3, longest + 1));
      return `\n\n${fence}\n${text}\n${fence}\n\n`;
    }
    if (node.tag === 'code') {
      const text = rawText(node);
      const longest = Math.max(0, ...(text.match(/`+/g) || []).map((run) => run.length));
      const fence = '`'.repeat(longest + 1);
      return `${fence} ${text} ${fence}`;
    }
    if (node.tag === 'ul' || node.tag === 'ol') {
      let index = node.start ?? 1;
      const items = node.children.filter((child) => child.kind === 'element' && child.tag === 'li');
      return '\n\n' + items.map((item) => {
        const prefix = node.tag === 'ol' ? `${index++}. ` : '- ';
        const text = (item as Extract<SelectionNode, { kind: 'element' }>).children.map((child) => child.kind === 'element' && (child.tag === 'ul' || child.tag === 'ol') ? '\n' + md(child).trim() : md(child)).join('').trim();
        const lines = text.split('\n').filter((line, i, all) => line || (i > 0 && all[i - 1]));
        return prefix + lines.join('\n' + ' '.repeat(prefix.length));
      }).join('\n') + '\n\n';
    }
    if (node.tag === 'table') {
      const rows = tableRows(node);
      const cells = rows.map((row) => row.children.filter((child) => child.kind === 'element' && (child.tag === 'td' || child.tag === 'th')) as Extract<SelectionNode, { kind: 'element' }>[]);
      const width = cells[0]?.length || 0;
      const complex = !width || cells.some((row) => row.length !== width || row.some((cell) => (cell.colspan || 1) > 1 || (cell.rowspan || 1) > 1 || countNodes(cell.children, 'table') > 0));
      if (complex) {
        issues.add('complex-table');
        return `\n\n${html(node)}\n\n`;
      }
      const lines = cells.map((row) => '| ' + row.map((cell) => cell.children.map(md).join('').trim().replace(/\n+/g, '<br>')).join(' | ') + ' |');
      const separator = '| ' + Array(width).fill('---').join(' | ') + ' |';
      const header = cells[0].some((cell) => cell.tag === 'th') ? lines.shift()! : '| ' + Array(width).fill('').join(' | ') + ' |';
      const caption = node.children.filter((child) => child.kind === 'element' && child.tag === 'caption').map(md).join('');
      return `\n\n${caption}${[header, separator, ...lines].join('\n')}\n\n`;
    }
    const text = node.children.map(md).join('');
    if (/^h[1-6]$/.test(node.tag)) return `\n\n${'#'.repeat(Number(node.tag[1]))} ${text.trim()}\n\n`;
    if (node.tag === 'p' || node.tag === 'div' || node.tag === 'caption') return `\n\n${text.trim()}\n\n`;
    if (node.tag === 'br') return '\n';
    if (node.tag === 'hr') return '\n\n---\n\n';
    if (node.tag === 'strong') return `**${text}**`;
    if (node.tag === 'em') return `*${text}*`;
    if (node.tag === 'del') return `~~${text}~~`;
    if (node.tag === 'blockquote') return '\n\n' + text.trim().split('\n').map((line) => '> ' + line).join('\n') + '\n\n';
    if (node.tag === 'a') {
      const href = safeLink(node.href);
      return href ? `[${text}](${href.replace(/[()<>"\\\s]/g, (char) => encodeURIComponent(char).replace(/\(/g, '%28').replace(/\)/g, '%29'))})` : text;
    }
    return text;
  }

  const tableCount = countNodes(selection.nodes, 'table');
  if (mode === 'html') {
    const body = selection.nodes.map(html).join('');
    const text = `<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(base)}</title><style>body{max-width:850px;margin:32px auto;padding:20px;font-family:system-ui,sans-serif;line-height:1.7;overflow-wrap:anywhere}img{max-width:100%;height:auto}pre{white-space:pre-wrap;background:#f5f5f5;padding:16px}table{border-collapse:collapse;max-width:100%;display:block;overflow-x:auto}th,td{border:1px solid #bbb;padding:6px 12px}.missing-image{display:inline-block;border:1px dashed #b45309;padding:8px;color:#92400e}</style></head><body>${body}</body></html>`;
    return { filename: `${base}.html`, mime: 'text/html;charset=utf-8', text, issues: [...issues], imageCount: images.size, missingImageCount: missing.size, tableCount };
  }
  const text = selection.nodes.map(md).join('').trim();
  if (hasImage) {
    const { blob } = await buildZip([{ path: 'content.md', language: 'markdown', content: text, nameSource: 'inferred' }, ...files]);
    return { filename: `${base}.zip`, mime: 'application/zip', blob, issues: [...issues], imageCount: images.size, missingImageCount: missing.size, tableCount };
  }
  return { filename: `${base}.md`, mime: 'text/markdown;charset=utf-8', text, issues: [...issues], imageCount: 0, missingImageCount: 0, tableCount };
}
