import { detect } from '../core/detector';
import { getSettings } from '../utils/storage';
import { parseProject } from '../core/parser';
import { sanitizeFilename } from '../core/sanitizer';
import { buildZip } from '../core/zip-builder';
import { blobToDataUrl } from '../core/markdown-builder';
import { extractSelectionContent as extractStructuredSelection } from '../core/selection';
import { buildSelectionFile } from '../core/selection-builder';
import { loadSelectionAssets } from '../core/image-loader';
import { showPageFeedback } from './page-feedback';
import { buildHtml } from '../core/html-builder';
import { decideFormat, type SaveMode } from '../core/save-format';
import { t } from '../utils/i18n';
import type { ParsedFile, SelectionContent } from '../core/types';

interface SaveFeedback {
  message: string;
  type: 'success' | 'warning';
}

const MENU_SMART_SAVE = 'clip2file-save';
const MENU_FORMAT = 'clip2file-format';
const MENU_TEXT = 'clip2file-format-text';
const MENU_MARKDOWN = 'clip2file-format-markdown';
const MENU_HTML = 'clip2file-format-html';
const MENU_ZIP = 'clip2file-format-zip';

function createContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_SMART_SAVE,
      title: t('menuSmartSave'),
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: MENU_FORMAT,
      title: t('menuSaveAs'),
      contexts: ['selection'],
    });
    chrome.contextMenus.create({ id: MENU_TEXT, parentId: MENU_FORMAT, title: t('menuPlainText'), contexts: ['selection'] });
    chrome.contextMenus.create({ id: MENU_MARKDOWN, parentId: MENU_FORMAT, title: t('menuMarkdown'), contexts: ['selection'] });
    chrome.contextMenus.create({ id: MENU_HTML, parentId: MENU_FORMAT, title: t('menuHtml'), contexts: ['selection'] });
    chrome.contextMenus.create({ id: MENU_ZIP, parentId: MENU_FORMAT, title: t('menuZip'), contexts: ['selection'] });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenus);
chrome.runtime.onStartup.addListener(createContextMenus);

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
async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await blobToDataUrl(blob);
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
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
function fetchImageViaCanvas(url: string, timeoutMs = 8000, maxBytes = 10 * 1024 * 1024): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let finished = false;
    const timer = setTimeout(() => finish(null), timeoutMs);
    function finish(result: string | null): void {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      img.src = '';
      resolve(result);
    }
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        if (canvas.width * canvas.height > 16 * 1024 * 1024) return finish(null);
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        const comma = dataUrl.indexOf(',');
        const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        finish(base64.length * 3 / 4 > maxBytes ? null : base64);
      } catch {
        // Canvas tainted by cross-origin image
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = url;
  });
}

/** Core save logic shared by context menu and keyboard shortcut.
 *  Extracts selection content (text + image URLs) from the active tab,
 *  downloads images in the service worker (bypassing page CORS), then
 *  downloads the result as the appropriate file type. */
async function saveSelectionFromTab(tabId: number, mode: SaveMode = 'auto', frameId = 0): Promise<SaveFeedback> {
  const target = { tabId, frameIds: [frameId] };
  const results = await chrome.scripting.executeScript({ target, func: extractStructuredSelection });
  const extracted = results[0]?.result as SelectionContent | undefined;
  if (!extracted) throw new Error('statusNothingToSave');
  const selectedText = extracted.text;
  const containsImage = (nodes: SelectionContent['nodes']): boolean => nodes.some((node) => node.kind === 'image' || (node.kind === 'element' && containsImage(node.children)));
  const hasImages = containsImage(extracted.nodes);
  if (!selectedText && !hasImages) throw new Error('statusNothingToSave');
  const result = detect(selectedText);
  const decision = decideFormat(mode, {
    hasText: Boolean(selectedText.trim()),
    imageCount: hasImages ? Math.max(1, extracted.imageSources.length) : 0,
    isProject: result.type === 'project',
    suggestedFilename: result.suggestedFilename,
  });
  if (!decision.allowed) {
    const reasonKeys: Record<string, string> = { 'empty': 'statusNothingToSave', 'project-requires-zip': 'selectionProjectRequiresZip', 'text-cannot-save-images': 'selectionTextCannotSaveImages' };
    throw new Error(reasonKeys[decision.reason || 'empty']);
  }

  // Get the page URL for referer header when fetching images.
  const tab = await chrome.tabs.get(tabId);
  const pageUrl = tab.url || '';

  // --- Download images from the service worker (not subject to page CORS) ---
  // Strategy 1: direct fetch from service worker
  const assets = await loadSelectionAssets(extracted.imageSources, async (url, timeoutMs, maxBytes) => {
    // Strategy 2: if direct fetch failed, try canvas extraction in the page
    const responses = await chrome.scripting.executeScript({ target, func: fetchImageViaCanvas, args: [url, timeoutMs, maxBytes] });
    const b64 = responses[0]?.result;
    if (!b64) return null;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  });
  const imageFiles = assets.flatMap((asset) => asset.file ? [asset.file] : []);

  if (mode === 'html' || mode === 'markdown' || (mode === 'auto' && (hasImages || (extracted.rich && result.type !== 'code' && result.type !== 'project' && result.type !== 'json')))) {
    const built = await buildSelectionFile(extracted, assets, mode === 'markdown' ? 'markdown' : 'html', result.suggestedFilename, {
      missingImage: t('selectionMissingImage'), complexTable: t('selectionComplexTable'),
    });
    if (built.blob) {
      const base64 = await blobToBase64(built.blob);
      await chrome.scripting.executeScript({ target, func: downloadBase64Blob, args: [base64, built.filename, built.mime] });
    } else {
      await chrome.scripting.executeScript({ target, func: downloadTextInPage, args: [built.text || '', built.filename, built.mime] });
    }
    const details = [t('selectionDownloadRequested', [built.filename, String(built.imageCount), String(built.tableCount)])];
    if (built.missingImageCount) details.push(t('selectionPartialImages', String(built.missingImageCount)));
    if (built.issues.includes('complex-table')) details.push(t('selectionComplexTable'));
    return { message: details.join('\n'), type: built.issues.length ? 'warning' : 'success' };
  }

  if (mode === 'zip') {
    const files: ParsedFile[] = result.type === 'project' ? parseProject(selectedText).files : selectedText ? [{
      path: sanitizeFilename(result.suggestedFilename), language: result.language || 'text', content: selectedText, nameSource: 'inferred',
    }] : [];
    files.push(...imageFiles);
    const failed = assets.filter((asset) => !asset.file).length;
    if (failed) {
      const paths = new Set(files.map((file) => file.path));
      let path = 'clip2file-export-warnings.txt';
      for (let index = 1; paths.has(path); index++) path = `clip2file-export-warnings-${index}.txt`;
      files.push({ path, language: 'text', content: t('selectionZipPartialImages', String(failed)), nameSource: 'inferred' });
    }
    const { blob, count, rejected } = await buildZip(files);
    if (!count) throw new Error('statusNoSafeFiles');
    const base64 = await blobToBase64(blob);
    await chrome.scripting.executeScript({ target, func: downloadBase64Blob, args: [base64, decision.filename, 'application/zip'] });
    const note = failed ? '\n' + t('selectionZipPartialImages', String(failed)) : '';
    return { message: t('selectionFilesRequested', [decision.filename, String(count)]) + note, type: failed || rejected.length ? 'warning' : 'success' };
  }

  if (mode === 'text') {
    await chrome.scripting.executeScript({ target, func: downloadTextInPage, args: [selectedText, decision.filename, 'text/plain;charset=utf-8'] });
    return { message: t('selectionTextRequested', decision.filename), type: 'success' };
  }

  // --- Multi-file project (text only, no images in ZIP) ---
  if (result.type === 'project' && imageFiles.length === 0) {
    const parsed = parseProject(selectedText);
    const { blob, count, rejected } = await buildZip(parsed.files);
    if (count === 0) {
      console.warn('[Clip2File] no safe files to zip');
      throw new Error('statusNoSafeFiles');
    }
    const base64 = await blobToBase64(blob);
    const zipName = sanitizeFilename(result.suggestedFilename);

    await chrome.scripting.executeScript({
      target,
      func: downloadBase64Blob,
      args: [base64, zipName, 'application/zip'],
    });

    return { message: t('selectionFilesRequested', [zipName, String(count)]), type: rejected.length ? 'warning' : 'success' };
  }

  // --- Has images: build a self-contained HTML file with embedded base64 images ---
  //  (HTML renders base64 images natively in any browser; most Markdown
  //  renderers do NOT support data: URLs in ![img](...) syntax.)
  if (imageFiles.length > 0) {
    const html = await buildHtml(selectedText, imageFiles);

    let filename = result.suggestedFilename || 'clipboard.html';
    filename = sanitizeFilename(filename).replace(/\.[^.]+$/, '') + '.html';

    await chrome.scripting.executeScript({
      target,
      func: downloadTextInPage,
      args: [html, filename, 'text/html;charset=utf-8'],
    });

    return { message: t('selectionDownloadRequested', [filename, String(imageFiles.length), '0']), type: 'success' };
  }

  // --- Single text file (no images) ---
  const filename = sanitizeFilename(result.suggestedFilename);

  await chrome.scripting.executeScript({
    target,
    func: downloadTextInPage,
    args: [selectedText, filename, 'text/plain;charset=utf-8'],
  });
  return { message: t('selectionFileRequested', filename), type: 'success' };
}

/** Fallback: save clipboard content when there is no page selection
 *  (e.g. shortcut pressed with nothing selected). Reads clipboard text
 *  in the service worker via the offscreen API fallback. */
async function saveFromClipboard(): Promise<SaveFeedback> {
  // In MV3 service workers, navigator.clipboard is not available.
  // We use chrome.scripting to read clipboard from the active tab.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('selectionRestrictedPage');

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => navigator.clipboard.readText().catch(() => ''),
  });
  const text = (results[0]?.result as string) || '';
  if (!text.trim()) {
    console.warn('[Clip2File] clipboard empty and no selection');
    throw new Error('statusNothingToSave');
  }

  const result = detect(text);
  const filename = sanitizeFilename(result.suggestedFilename);

  if (result.type === 'project') {
    const parsed = parseProject(text);
    const { blob, count } = await buildZip(parsed.files);
    if (count === 0) throw new Error('statusNoSafeFiles');
    const base64 = await blobToBase64(blob);
    const zipName = sanitizeFilename(result.suggestedFilename);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: downloadBase64Blob,
      args: [base64, zipName, 'application/zip'],
    });
    return { message: t('selectionFilesRequested', [zipName, String(count)]), type: 'success' };
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: downloadTextInPage,
    args: [text, filename, 'text/plain;charset=utf-8'],
  });
  return { message: t('selectionFileRequested', filename), type: 'success' };
}

/** Check whether the active tab has a non-empty text selection. */
async function hasSelection(tabId: number): Promise<boolean> {
  const results = await chrome.scripting.executeScript({ target: { tabId }, func: extractStructuredSelection });
  const selection = results[0]?.result;
  const containsImage = (nodes: SelectionContent['nodes']): boolean => nodes.some((node) => node.kind === 'image' || (node.kind === 'element' && containsImage(node.children)));
  return Boolean(selection && (selection.text.trim() || containsImage(selection.nodes)));
}

const MENU_MODES: Record<string, SaveMode> = {
  [MENU_SMART_SAVE]: 'auto',
  [MENU_TEXT]: 'text',
  [MENU_MARKDOWN]: 'markdown',
  [MENU_HTML]: 'html',
  [MENU_ZIP]: 'zip',
};

function saveErrorMessage(error: unknown): string {
  const key = error instanceof Error ? error.message : '';
  const known = ['statusNothingToSave', 'statusNoSafeFiles', 'selectionProjectRequiresZip', 'selectionTextCannotSaveImages', 'selectionRestrictedPage'];
  if (key === 'selection-too-large') return t('selectionTooLarge');
  return t(known.includes(key) ? key : 'selectionSaveFailed');
}

async function reportFeedback(tabId: number, feedback: { message: string; type: 'success' | 'warning' | 'error' }, frameId = 0): Promise<void> {
  await chrome.action.setTitle({ title: 'Clip2File — ' + feedback.message });
  await flashBadge(feedback.type === 'success' ? 'success' : 'error', feedback.type === 'warning' ? '!' : undefined);
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, func: showPageFeedback, args: [feedback.message, feedback.type, t('selectionClose')] }).catch(() => undefined);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const mode = MENU_MODES[String(info.menuItemId)];
  if (!mode || !tab?.id) return;
  try {
    const feedback = await saveSelectionFromTab(tab.id, mode, info.frameId || 0);
    await reportFeedback(tab.id, feedback, info.frameId || 0);
  } catch (err) {
    await reportFeedback(tab.id, { message: saveErrorMessage(err), type: 'error' }, info.frameId || 0);
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    await flashBadge('error');
    return;
  }
  try {
    // Prefer page selection; fall back to clipboard if nothing is selected.
    const feedback = await hasSelection(tab.id) ? await saveSelectionFromTab(tab.id) : await saveFromClipboard();
    await reportFeedback(tab.id, feedback);
  } catch (err) {
    await reportFeedback(tab.id, { message: saveErrorMessage(err), type: 'error' });
  }
});
