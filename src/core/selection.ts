import type { SelectionContent, SelectionNode } from './types';

export function extractSelectionContent(): SelectionContent {
  const empty: SelectionContent = { nodes: [], text: '', imageSources: [], rich: false };
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return empty;

  const range = selection.getRangeAt(0);
  let root: Node = range.cloneContents();
  let ancestor = range.commonAncestorContainer;
  if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentNode!;
  const contextTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'strong', 'b', 'em', 'i', 'del', 's', 'code', 'pre', 'blockquote', 'li', 'ol', 'ul', 'td', 'th', 'tr', 'thead', 'tbody', 'tfoot', 'table']);
  while (ancestor.nodeType === Node.ELEMENT_NODE && contextTags.has((ancestor as Element).tagName.toLowerCase())) {
    const wrapper = ancestor.cloneNode(false);
    if ((ancestor as Element).tagName.toLowerCase() === 'ol') {
      const list = ancestor as HTMLOListElement;
      const offset = Array.from(list.children).filter((child) => child.tagName.toLowerCase() === 'li').findIndex((child) => range.intersectsNode(child));
      (wrapper as Element).setAttribute('start', String(list.start + Math.max(0, offset)));
    }
    wrapper.appendChild(root);
    root = wrapper;
    ancestor = ancestor.parentNode!;
  }

  const allowed = new Set(['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'strong', 'em', 'del', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption']);
  const blocked = new Set(['script', 'style', 'template', 'noscript', 'iframe', 'object', 'embed', 'svg', 'canvas', 'input', 'textarea', 'select', 'button', 'audio', 'video']);
  const aliases: Record<string, string> = { b: 'strong', i: 'em', s: 'del', section: 'div', article: 'div', figure: 'div', figcaption: 'p' };
  const sources: { id: string; url: string }[] = [];
  const imageIds = new Map<string, string>();
  let visited = 0;
  let size = 0;
  let rich = false;

  function url(value: string, image: boolean): string | undefined {
    try {
      const parsed = new URL(value, document.baseURI);
      if (image) {
        if (['http:', 'https:', 'blob:'].includes(parsed.protocol) || /^data:image\/(png|jpeg|gif|webp|bmp|x-icon);base64,/i.test(value)) return parsed.href;
      } else if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        return parsed.href;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  function walk(node: Node, depth: number): SelectionNode[] {
    if (++visited > 10000 || depth > 64) throw new Error('selection-too-large');
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      size += text.length;
      if (size > 2 * 1024 * 1024) throw new Error('selection-too-large');
      return text ? [{ kind: 'text', text }] : [];
    }
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) return Array.from(node.childNodes).flatMap((child) => walk(child, depth + 1));
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const element = node as HTMLElement;
    const originalTag = element.tagName.toLowerCase();
    if (element.id === 'clip2file-feedback' || blocked.has(originalTag) || element.hidden || element.style.display === 'none' || element.style.visibility === 'hidden') return [];
    if (originalTag === 'img') {
      rich = true;
      const raw = (element as HTMLImageElement).currentSrc || element.getAttribute('src') || element.dataset.src || '';
      const source = raw ? url(raw, true) : undefined;
      const alt = element.getAttribute('alt') || '';
      if (!source) return [{ kind: 'image', id: 'unavailable', alt }];
      size += source.length;
      if (size > 2 * 1024 * 1024 || sources.length >= 100) throw new Error('selection-too-large');
      let id = imageIds.get(source);
      if (!id) {
        id = `image-${sources.length + 1}`;
        imageIds.set(source, id);
        sources.push({ id, url: source });
      }
      return [{ kind: 'image', id, alt }];
    }
    const children = Array.from(node.childNodes).flatMap((child) => walk(child, depth + 1));
    const tag = aliases[originalTag] || originalTag;
    if (!allowed.has(tag)) return children;
    const result: Extract<SelectionNode, { kind: 'element' }> = { kind: 'element', tag, children };
    if (tag === 'a') {
      const href = element.getAttribute('href');
      if (href) result.href = url(href, false);
    }
    if (tag === 'ol' && element.hasAttribute('start')) {
      const start = Number(element.getAttribute('start'));
      if (Number.isSafeInteger(start)) result.start = start;
    }
    for (const attr of ['colspan', 'rowspan'] as const) {
      if ((tag === 'td' || tag === 'th') && element.hasAttribute(attr)) {
        const value = Number(element.getAttribute(attr));
        if (Number.isInteger(value) && value > 0 && value <= 1000) result[attr] = value;
      }
    }
    if (!['div', 'p', 'br'].includes(tag)) rich = true;
    return [result];
  }

  function plain(node: SelectionNode): string {
    if (node.kind === 'text') return node.text;
    if (node.kind === 'image') return '';
    const children = node.children.map(plain).join('');
    if (node.tag === 'br' || node.tag === 'hr') return '\n';
    if (node.tag === 'td' || node.tag === 'th') return children + '\t';
    if (['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'tr', 'table'].includes(node.tag)) return children + '\n';
    return children;
  }

  const nodes = walk(root, 0);
  const text = nodes.map(plain).join('').replace(/[\t ]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { nodes, text, imageSources: sources, rich };
}
