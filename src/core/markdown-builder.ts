/**
 * Markdown builder: assemble text + images into a single .md file.
 *
 * Images are embedded as base64 data URLs (`![name](data:image/png;base64,...)`),
 * producing a self-contained Markdown file with no external dependencies.
 */

import type { ParsedFile } from './types';

/** Convert a Blob to a data URL string (e.g. `data:image/png;base64,....`).
 *  Works in both browser (FileReader) and Node/test (manual base64) environments. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  // Node / test environment: FileReader is unavailable in jsdom.
  if (typeof FileReader === 'undefined') {
    return blob.arrayBuffer().then((buf: ArrayBuffer) => {
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
    });
  }
  // Browser environment
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Build a self-contained Markdown string from text content + image files.
 *
 * The text is placed first, then each image is appended as a Markdown image
 * with a heading. Images are embedded as base64 data URLs.
 *
 * @param text   The text content (may be plain text, code, or markdown).
 * @param images Image files (must have `blob` + `mimeType` set).
 * @returns A complete Markdown string.
 */
export async function buildMarkdown(
  text: string,
  images: ParsedFile[]
): Promise<string> {
  const parts: string[] = [];

  const trimmedText = text.trim();
  if (trimmedText) {
    parts.push(trimmedText);
  }

  for (const img of images) {
    if (!img.blob || !img.mimeType) continue;
    const dataUrl = await blobToDataUrl(img.blob);
    const altName = img.path.replace(/\.[^.]+$/, '');
    parts.push(`\n\n![${altName}](${dataUrl})\n`);
  }

  return parts.join('');
}
