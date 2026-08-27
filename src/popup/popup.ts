import { detect, getLastProjectParse } from '../core/detector';
import { parseProject } from '../core/parser';
import { sanitizeFilename } from '../core/sanitizer';
import { downloadTextFile } from '../core/file-builder';
import { buildZip, downloadBlob } from '../core/zip-builder';
import { buildMarkdown } from '../core/markdown-builder';
import { buildHtml } from '../core/html-builder';
import { getSettings } from '../utils/storage';
import type { DetectResult, ParsedFile, ParseResult } from '../core/types';

let autoCloseOnSave = false;
getSettings().then((s) => { autoCloseOnSave = s.autoCloseOnSave; });

/** Close the popup window a short moment after a successful save,
 *  if the user has enabled that preference in Options. */
function maybeAutoClose(): void {
  if (autoCloseOnSave) {
    setTimeout(() => window.close(), 900);
  }
}

const sourceInput = document.getElementById('source-input') as HTMLTextAreaElement;
const filenameInput = document.getElementById('filename-input') as HTMLInputElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const detectInfo = document.getElementById('detect-info') as HTMLDivElement;
const detectLabel = document.getElementById('detect-label') as HTMLSpanElement;
const detectConfidence = document.getElementById('detect-confidence') as HTMLSpanElement;
const detectDot = document.getElementById('detect-dot') as HTMLSpanElement;
const status = document.getElementById('status') as HTMLDivElement;
const optionsBtn = document.getElementById('options-btn') as HTMLButtonElement;

const singleMode = document.getElementById('single-mode') as HTMLDivElement;
const projectMode = document.getElementById('project-mode') as HTMLDivElement;
const fileList = document.getElementById('file-list') as HTMLDivElement;
const zipNameInput = document.getElementById('zip-name-input') as HTMLInputElement;
const zipBtn = document.getElementById('zip-btn') as HTMLButtonElement;
const selectAllBtn = document.getElementById('select-all-btn') as HTMLButtonElement;
const selectNoneBtn = document.getElementById('select-none-btn') as HTMLButtonElement;

const imageSection = document.getElementById('image-section') as HTMLDivElement;
const imageList = document.getElementById('image-list') as HTMLDivElement;
const saveMdBtn = document.getElementById('save-md-btn') as HTMLButtonElement;
const saveZipBtn = document.getElementById('save-zip-btn') as HTMLButtonElement;

let currentResult: DetectResult | null = null;
let currentFiles: ParsedFile[] = [];
let currentParse: ParseResult | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
/** Images captured from clipboard (not from text parsing). */
let currentImages: ParsedFile[] = [];

function showStatus(message: string, type: 'success' | 'error'): void {
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.remove('hidden');
  setTimeout(() => status.classList.add('hidden'), 3000);
}

function setMode(mode: 'single' | 'project'): void {
  if (mode === 'project') {
    singleMode.classList.add('hidden');
    projectMode.classList.remove('hidden');
  } else {
    singleMode.classList.remove('hidden');
    projectMode.classList.add('hidden');
  }
}

function renderFileList(files: ParsedFile[]): void {
  fileList.innerHTML = '';
  files.forEach((f, i) => {
    const row = document.createElement('label');
    row.className = 'file-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.dataset.index = String(i);

    const path = document.createElement('span');
    path.className = 'file-path';
    path.textContent = f.path;
    path.title = f.path;

    const lang = document.createElement('span');
    lang.className = 'file-lang';
    lang.textContent = f.language;

    const src = document.createElement('span');
    src.className = 'file-source';
    src.textContent = f.nameSource;

    row.appendChild(cb);
    row.appendChild(path);
    row.appendChild(lang);
    row.appendChild(src);
    fileList.appendChild(row);
  });
}

function getSelectedFiles(): ParsedFile[] {
  const boxes = fileList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const selected: ParsedFile[] = [];
  boxes.forEach((cb) => {
    if (cb.checked) {
      const i = Number(cb.dataset.index);
      if (currentFiles[i]) selected.push(currentFiles[i]);
    }
  });
  return selected;
}

function getSelectedImages(): ParsedFile[] {
  const boxes = imageList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const selected: ParsedFile[] = [];
  boxes.forEach((cb) => {
    if (cb.checked) {
      const i = Number(cb.dataset.index);
      if (currentImages[i]) selected.push(currentImages[i]);
    }
  });
  return selected;
}

/** Determine file extension from MIME type. */
function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',
    'image/x-icon': '.ico',
  };
  return map[mime] || '.png';
}

/** Format byte size for display. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderImageList(images: ParsedFile[]): void {
  imageList.innerHTML = '';
  images.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'image-item';

    const header = document.createElement('div');
    header.className = 'image-item-header';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.dataset.index = String(i);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'image-item-name';
    nameInput.value = f.path;
    nameInput.dataset.index = String(i);

    const info = document.createElement('span');
    info.className = 'image-item-info';
    if (f.blob) info.textContent = formatSize(f.blob.size);

    header.appendChild(cb);
    header.appendChild(nameInput);
    header.appendChild(info);

    const img = document.createElement('img');
    if (f.blob) img.src = URL.createObjectURL(f.blob);

    item.appendChild(header);
    item.appendChild(img);
    imageList.appendChild(item);
  });
}

/** Read images from clipboard via ClipboardItem API. Returns ParsedFile[]
 *  with blob + mimeType set. Falls back gracefully if API unavailable. */
async function readClipboardImages(): Promise<ParsedFile[]> {
  const images: ParsedFile[] = [];
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) return images;
    const items: ClipboardItem[] = await navigator.clipboard.read();
    let imgIdx = 1;
    for (const item of items) {
      // Prefer the highest-quality available image type.
      const imageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];
      for (const mime of imageTypes) {
        if (item.types.includes(mime)) {
          const blob = await item.getType(mime);
          const ext = extFromMime(mime);
          images.push({
            path: `image-${imgIdx}${ext}`,
            language: 'image',
            content: '',
            blob,
            mimeType: mime,
            nameSource: 'clipboard-image',
          });
          imgIdx++;
          break; // one image per ClipboardItem
        }
      }
    }
  } catch (err) {
    // clipboard.read() may fail if permission not granted or no image.
    console.warn('[Clip2File] could not read clipboard images:', err);
  }
  return images;
}

function updateUI(result: DetectResult, content: string, parsed?: ParseResult): void {
  currentResult = result;
  detectLabel.textContent = `${result.type === 'code' ? result.language : result.type}`;
  detectConfidence.textContent = `${Math.round(result.confidence * 100)}%`;
  detectDot.className = `detect-dot ${result.confidence >= 0.8 ? 'is-high' : result.confidence >= 0.6 ? 'is-mid' : 'is-low'}`;
  detectInfo.classList.remove('hidden');

  if (result.type === 'project') {
    // Reuse the parse result cached by detect() to avoid double parsing.
    const pr = parsed ?? getLastProjectParse() ?? parseProject(content);
    currentParse = pr;
    currentFiles = pr.files;
    renderFileList(currentFiles);
    zipNameInput.value = result.suggestedFilename;
    setMode('project');
  } else {
    currentParse = null;
    currentFiles = [];
    filenameInput.value = result.suggestedFilename;
    setMode('single');
  }
}

/** Show/hide image section based on currentImages. Also toggle the
 *  Save-as-Markdown / Save-as-ZIP buttons in single-file mode. */
function updateImageSection(): void {
  if (currentImages.length > 0) {
    imageSection.classList.remove('hidden');
    renderImageList(currentImages);
    // In single-file mode, show HTML + ZIP options.
    saveMdBtn.classList.remove('hidden');
    saveZipBtn.classList.remove('hidden');
    // Auto-suggest .html filename if current suggestion is text/code.
    if (currentResult && !filenameInput.value.toLowerCase().endsWith('.html')) {
      const baseName = filenameInput.value.replace(/\.[^.]+$/, '') || 'clipboard';
      filenameInput.value = `${baseName}.html`;
    }
  } else {
    imageSection.classList.add('hidden');
    saveMdBtn.classList.add('hidden');
    saveZipBtn.classList.add('hidden');
  }
}

async function loadClipboard(): Promise<void> {
  // Read text and images in parallel.
  const [text, images] = await Promise.all([
    navigator.clipboard.readText().catch(() => ''),
    readClipboardImages(),
  ]);

  if (text) {
    sourceInput.value = text;
    updateUI(detect(text), text);
  }
  if (images.length > 0) {
    currentImages = images;
    updateImageSection();
  }
}

function handleInput(): void {
  const text = sourceInput.value;
  if (!text.trim()) {
    detectInfo.classList.add('hidden');
    filenameInput.value = '';
    zipNameInput.value = '';
    currentResult = null;
    currentFiles = [];
    currentParse = null;
    setMode('single');
    return;
  }
  updateUI(detect(text), text);
}

sourceInput.addEventListener('input', () => {
  // Debounce: avoid running detect+parseProject on every keystroke.
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(handleInput, 200);
});

/** Also handle paste events directly in the textarea — when a user pastes
 *  an image (not text), capture it via the ClipboardEvent. */
sourceInput.addEventListener('paste', async (e: ClipboardEvent) => {
  const clipboardData = e.clipboardData;
  if (!clipboardData) return;
  const files: ParsedFile[] = [];
  let imgIdx = currentImages.length + 1;
  for (const item of Array.from(clipboardData.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (!blob) continue;
      const ext = extFromMime(item.type);
      files.push({
        path: `image-${imgIdx}${ext}`,
        language: 'image',
        content: '',
        blob,
        mimeType: item.type,
        nameSource: 'clipboard-image',
      });
      imgIdx++;
    }
  }
  if (files.length > 0) {
    e.preventDefault(); // don't paste image binary into textarea
    currentImages = [...currentImages, ...files];
    updateImageSection();
  }
});

saveBtn.addEventListener('click', async () => {
  const content = sourceInput.value;

  if (!content.trim()) {
    showStatus('Nothing to save', 'error');
    return;
  }

  // Save File = text only (original behavior). Use Save as Markdown / ZIP
  // to include images.
  let filename = filenameInput.value.trim();
  if (!filename) {
    filename = currentResult?.suggestedFilename || 'untitled.txt';
  }

  const safe = sanitizeFilename(filename);
  const hasExt = /\.[^./\\]+$/.test(safe);
  if (!hasExt && currentResult) {
    filename = `${safe}${currentResult.extension}`;
  } else {
    filename = safe;
  }

  try {
    await downloadTextFile(filename, content);
    showStatus(`Saved as ${filename}`, 'success');
    maybeAutoClose();
  } catch (err) {
    showStatus(err instanceof Error ? err.message : 'Save failed', 'error');
  }
});

/** Sync editable image names from the UI into currentImages. */
function syncImageNames(): void {
  const nameInputs = imageList.querySelectorAll<HTMLInputElement>('.image-item-name');
  nameInputs.forEach((ni) => {
    const i = Number(ni.dataset.index);
    if (currentImages[i] && ni.value.trim()) {
      currentImages[i].path = sanitizeFilename(ni.value.trim());
    }
  });
}

/** Resolve a filename for the text portion. */
function resolveTextFilename(): string {
  let name = filenameInput.value.trim() || currentResult?.suggestedFilename || 'untitled.txt';
  const safe = sanitizeFilename(name);
  const hasExt = /\.[^./\\]+$/.test(safe);
  return hasExt ? safe : (currentResult ? `${safe}${currentResult.extension}` : `${safe}.txt`);
}

saveMdBtn.addEventListener('click', async () => {
  const content = sourceInput.value;
  const selectedImages = getSelectedImages();

  if (!content.trim() && selectedImages.length === 0) {
    showStatus('Nothing to save', 'error');
    return;
  }

  syncImageNames();
  const images = getSelectedImages();

  const saveMdLabel = saveMdBtn.querySelector('.btn-label') as HTMLSpanElement;
  try {
    saveMdBtn.disabled = true;
    saveMdLabel.textContent = 'Building…';
    const html = await buildHtml(content, images);
    let filename = filenameInput.value.trim() || 'clipboard.html';
    if (!filename.toLowerCase().endsWith('.html')) {
      filename = `${sanitizeFilename(filename.replace(/\.[^.]+$/, ''))}.html`;
    } else {
      filename = sanitizeFilename(filename);
    }
    await downloadTextFile(filename, html);
    showStatus(`Saved as ${filename} (${images.length} images embedded)`, 'success');
    maybeAutoClose();
  } catch (err) {
    showStatus(err instanceof Error ? err.message : 'Save failed', 'error');
  } finally {
    saveMdBtn.disabled = false;
    saveMdLabel.textContent = 'Save as HTML';
  }
});

saveZipBtn.addEventListener('click', async () => {
  const content = sourceInput.value;
  const selectedImages = getSelectedImages();

  if (!content.trim() && selectedImages.length === 0) {
    showStatus('Nothing to save', 'error');
    return;
  }

  syncImageNames();
  const files: ParsedFile[] = [];

  if (content.trim()) {
    files.push({
      path: resolveTextFilename(),
      language: currentResult?.language || 'text',
      content,
      nameSource: 'inferred',
    });
  }
  files.push(...getSelectedImages());

  const saveZipLabel = saveZipBtn.querySelector('.btn-label') as HTMLSpanElement;
  try {
    saveZipBtn.disabled = true;
    saveZipLabel.textContent = 'Zipping…';
    const { blob, count } = await buildZip(files);
    if (count === 0) {
      showStatus('No safe files to zip', 'error');
      return;
    }
    await downloadBlob(blob, 'clipboard.zip');
    showStatus(`Saved ${count} files as clipboard.zip`, 'success');
    maybeAutoClose();
  } catch (err) {
    showStatus(err instanceof Error ? err.message : 'Save failed', 'error');
  } finally {
    saveZipBtn.disabled = false;
    saveZipLabel.textContent = 'Save as ZIP';
  }
});

zipBtn.addEventListener('click', async () => {
  const selected = getSelectedFiles();
  const selectedImages = getSelectedImages();
  const allFiles = [...selected];

  // Include selected images, syncing their editable names.
  if (selectedImages.length > 0 || currentImages.length > 0) {
    syncImageNames();
    allFiles.push(...getSelectedImages());
  }

  if (allFiles.length === 0) {
    showStatus('No files selected', 'error');
    return;
  }

  let zipName = zipNameInput.value.trim() || 'project.zip';
  if (!zipName.toLowerCase().endsWith('.zip')) {
    zipName = `${sanitizeFilename(zipName)}.zip`;
  } else {
    zipName = sanitizeFilename(zipName);
  }

  const zipLabel = zipBtn.querySelector('.btn-label') as HTMLSpanElement;
  try {
    zipBtn.disabled = true;
    zipLabel.textContent = 'Zipping…';
    const { blob, count, rejected } = await buildZip(allFiles);
    if (count === 0) {
      showStatus('No safe files to zip', 'error');
      return;
    }
    await downloadBlob(blob, zipName);
    const note = rejected.length ? ` (${rejected.length} unsafe skipped)` : '';
    showStatus(`Generated ${zipName} with ${count} files${note}`, 'success');
    maybeAutoClose();
  } catch (err) {
    showStatus(err instanceof Error ? err.message : 'ZIP failed', 'error');
  } finally {
    zipBtn.disabled = false;
    zipLabel.textContent = 'Generate ZIP';
  }
});

selectAllBtn.addEventListener('click', () => {
  fileList
    .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    .forEach((cb) => (cb.checked = true));
});

selectNoneBtn.addEventListener('click', () => {
  fileList
    .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    .forEach((cb) => (cb.checked = false));
});

optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage?.();
});

document.addEventListener('DOMContentLoaded', loadClipboard);
