import { detect } from '../core/detector';
import { getSettings } from '../utils/storage';
import { parseProject } from '../core/parser';
import { sanitizeFilename } from '../core/sanitizer';
import { buildZip } from '../core/zip-builder';
import { buildMarkdown } from '../core/markdown-builder';
import { buildHtml } from '../core/html-builder';
import type { ParsedFile } from '../core/types';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'clip2file-save',
    title: 'Save as File with Clip2File',
    contexts: ['selection']
  });
});

/** Result of extracting content from a page selection.
 *  Images are returned as URL references (not base64) so the service
 *  worker can fetch them without page-level CORS restrictions. */
interface ExtractedContent {
  text: string;
  /** Image URLs found within the selection, in document order. */
  imageUrls: string[];
}

/** Injected into the page to extract text + image URLs from the current
 *  selection. Does NOT fetch images (avoids CORS issues in the page);
 *  the service worker handles image downloading separately. */
function extractSelectionContent(): ExtractedContent {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { text: '', imageUrls: [] };
  }

  // --- Extract text ---
  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const blockTags = new Set([
      'br', 'p', 'div', 'pre', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'section', 'article', 'blockquote', 'tr', 'td', 'th',
    ]);
    const styleDisplay =
      typeof window !== 'undefined' && el.style?.display ? el.style.display : '';
    const isBlock = blockTags.has(tag) || styleDisplay === 'block';

    let text = '';
    for (const child of el.childNodes) {
      text += walk(child);
    }

    if (tag === 'br') {
      text = '\n';
    } else if (isBlock) {
      text = '\n' + text + '\n';
    }

    return text;
  }

  let text = walk(fragment).replace(/\n{3,}/g, '\n\n').trim();

  // Fallback: if custom walk produced nothing, use toString()
  if (!text) {
    text = selection.toString().replace(/\n{3,}/g, '\n\n').trim();
  }

  // --- Collect image URLs within the selection ---
  const imageUrls: string[] = [];
  const imgs = document.querySelectorAll('img');
  const seen = new Set<string>();

  for (const img of imgs) {
    // Check if the image is within the selection range.
    if (range.intersectsNode(img) || selection.containsNode(img, true)) {
      const src = img.src || img.getAttribute('src') || img.dataset.src || '';
      if (!src || seen.has(src)) continue;
      seen.add(src);
      imageUrls.push(src);
    }
  }

  return { text, imageUrls };
}

/** Injected helper: download a base64-encoded blob. */
function downloadBase64Blob(b64: string, name: string, mime: string): void {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const blob = new Blob([u8], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Injected helper: download a text string as a file. */
function downloadTextInPage(text: string, name: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Convert a Blob to a base64 string (without data: prefix).
 *  Required because chrome.scripting.executeScript args must be
 *  JSON-serializable — ArrayBuffer/TypedArray are not. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Fetch an image URL from the service worker (not subject to page CORS).
 *  Returns a ParsedFile with blob set, or null on failure.
 *  Uses the page tab's origin as referer to improve success rate. */
async function fetchImageAsParsedFile(
  url: string,
  index: number,
  referer?: string
): Promise<ParsedFile | null> {
  try {
    const headers: Record<string, string> = {};
    if (referer) headers['Referer'] = referer;

    const resp = await fetch(url, { headers });
    if (!resp.ok) return null;

    const blob = await resp.blob();
    if (!blob.type.startsWith('image/')) return null;

    const ext = blob.type.split('/')[1]?.replace('svg+xml', 'svg') || 'png';
    return {
      path: `image-${index}.${ext}`,
      language: 'image',
      content: '',
      blob,
      mimeType: blob.type,
      nameSource: 'clipboard-image',
    };
  } catch {
    return null;
  }
}

/** Injected helper: draw an image to canvas and export as PNG base64.
 *  This is the CORS fallback — works for same-origin images or images with
 *  permissive CORS headers. Returns null if the canvas is tainted. */
function fetchImageViaCanvas(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        const comma = dataUrl.indexOf(',');
        resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
      } catch {
        // Canvas tainted by cross-origin image
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Core save logic shared by context menu and keyboard shortcut.
 *  Extracts selection content (text + image URLs) from the active tab,
 *  downloads images in the service worker (bypassing page CORS), then
 *  downloads the result as the appropriate file type. */
async function saveSelectionFromTab(tabId: number): Promise<void> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractSelectionContent,
  });

  const extracted = results[0]?.result as ExtractedContent | undefined;
  const selectedText = extracted?.text || '';
  const imageUrls = extracted?.imageUrls || [];

  if (!selectedText && imageUrls.length === 0) {
    console.warn('[Clip2File] empty selection');
    return;
  }

  // Get the page URL for referer header when fetching images.
  const tab = await chrome.tabs.get(tabId);
  const pageUrl = tab.url || '';

  // --- Download images from the service worker (not subject to page CORS) ---
  const imageFiles: ParsedFile[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    let file: ParsedFile | null = null;

    // Strategy 1: direct fetch from service worker
    file = await fetchImageAsParsedFile(url, i + 1, pageUrl);

    // Strategy 2: if direct fetch failed, try canvas extraction in the page
    if (!file) {
      const b64 = await chrome.scripting
        .executeScript({
          target: { tabId },
          func: fetchImageViaCanvas,
          args: [url],
        })
        .then((r) => r[0]?.result as string | null)
        .catch(() => null);

      if (b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
        file = {
          path: `image-${i + 1}.png`,
          language: 'image',
          content: '',
          blob: new Blob([bytes], { type: 'image/png' }),
          mimeType: 'image/png',
          nameSource: 'clipboard-image',
        };
      }
    }

    if (file) {
      imageFiles.push(file);
    } else {
      console.warn(`[Clip2File] could not fetch image: ${url}`);
    }
  }

  const result = detect(selectedText);

  // --- Multi-file project (text only, no images in ZIP) ---
  if (result.type === 'project' && imageFiles.length === 0) {
    const parsed = parseProject(selectedText);
    const { blob, count, rejected } = await buildZip(parsed.files);
    if (count === 0) {
      console.warn('[Clip2File] no safe files to zip');
      return;
    }
    const base64 = await blobToBase64(blob);
    const zipName = sanitizeFilename(result.suggestedFilename);

    await chrome.scripting.executeScript({
      target: { tabId },
      func: downloadBase64Blob,
      args: [base64, zipName, 'application/zip'],
    });

    return;
  }

  // --- Has images: build a self-contained HTML file with embedded base64 images ---
  //  (HTML renders base64 images natively in any browser; most Markdown
  //  renderers do NOT support data: URLs in ![img](...) syntax.)
  if (imageFiles.length > 0) {
    const html = await buildHtml(selectedText, imageFiles);

    let filename = result.suggestedFilename || 'clipboard.html';
    filename = sanitizeFilename(filename).replace(/\.[^.]+$/, '') + '.html';

    await chrome.scripting.executeScript({
      target: { tabId },
      func: downloadTextInPage,
      args: [html, filename, 'text/html;charset=utf-8'],
    });

    return;
  }

  // --- Single text file (no images) ---
  const filename = sanitizeFilename(result.suggestedFilename);

  await chrome.scripting.executeScript({
    target: { tabId },
    func: downloadTextInPage,
    args: [selectedText, filename, 'text/plain;charset=utf-8'],
  });
}

/** Fallback: save clipboard content when there is no page selection
 *  (e.g. shortcut pressed with nothing selected). Reads clipboard text
 *  in the service worker via the offscreen API fallback. */
async function saveFromClipboard(): Promise<void> {
  // In MV3 service workers, navigator.clipboard is not available.
  // We use chrome.scripting to read clipboard from the active tab.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => navigator.clipboard.readText().catch(() => ''),
  });
  const text = (results[0]?.result as string) || '';
  if (!text.trim()) {
    console.warn('[Clip2File] clipboard empty and no selection');
    return;
  }

  const result = detect(text);
  const filename = sanitizeFilename(result.suggestedFilename);

  if (result.type === 'project') {
    const parsed = parseProject(text);
    const { blob, count } = await buildZip(parsed.files);
    if (count === 0) return;
    const base64 = await blobToBase64(blob);
    const zipName = sanitizeFilename(result.suggestedFilename);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: downloadBase64Blob,
      args: [base64, zipName, 'application/zip'],
    });
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: downloadTextInPage,
    args: [text, filename, 'text/plain;charset=utf-8'],
  });
}

/** Check whether the active tab has a non-empty text selection. */
async function hasSelection(tabId: number): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const sel = window.getSelection();
      return !!(sel && sel.rangeCount > 0 && sel.toString().trim());
    },
  });
  return results[0]?.result === true;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'clip2file-save' || !tab?.id) return;
  try {
    await saveSelectionFromTab(tab.id);
  } catch (err) {
    console.error('[Clip2File] failed:', err);
  }
});

/** Flash the extension badge briefly to give visual feedback that the
 *  shortcut was received. color: green=success, red=error.
 *  Respects the user's "badge feedback" preference from Options. */
async function flashBadge(color: 'success' | 'error', text?: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.badgeFeedback) return;
  const bg = color === 'success' ? '#16a34a' : '#dc2626';
  const label = text || (color === 'success' ? '✓' : '!');
  chrome.action.setBadgeBackgroundColor({ color: bg });
  chrome.action.setBadgeText({ text: label });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
}

/** Keyboard shortcut handler. */
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'quick-save') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.warn('[Clip2File] no active tab');
      flashBadge('error');
      return;
    }

    // Prefer page selection; fall back to clipboard if nothing is selected.
    if (await hasSelection(tab.id)) {
      await saveSelectionFromTab(tab.id);
    } else {
      await saveFromClipboard();
    }
    await flashBadge('success');
  } catch (err) {
    console.error('[Clip2File] quick-save failed:', err);
    await flashBadge('error');
  }
});
