/**
 * ZIP builder for Phase 2 multi-file export.
 *
 * Uses JSZip to bundle parsed files into a single ZIP. All paths are
 * normalized upstream (parser/path-utils) so ZIP Slip is prevented before
 * we ever add an entry; this module additionally re-validates each path.
 */

import JSZip from 'jszip';
import type { ParsedFile } from './types';
import { isSafePath } from './path-utils';

export interface ZipBuildResult {
  blob: Blob;
  /** Number of files actually added (after safety filtering). */
  count: number;
  /** Paths that were rejected as unsafe. */
  rejected: string[];
}

/**
 * Build a ZIP Blob from parsed files.
 * @param files  Parsed virtual files.
 * @param zipName Optional base name (unused in blob, but available to caller).
 */
export async function buildZip(files: ParsedFile[]): Promise<ZipBuildResult> {
  const zip = new JSZip();
  const rejected: string[] = [];
  let count = 0;

  for (const f of files) {
    if (!isSafePath(f.path)) {
      rejected.push(f.path);
      continue;
    }
    // Final guard: ensure no entry escapes the root. Use segment-level check
    // (not a naive `includes('..')` which would reject `file..txt`).
    if (f.path.startsWith('/') || f.path.split('/').includes('..')) {
      rejected.push(f.path);
      continue;
    }
    // Binary files (images): add as Blob; text files: add as string.
    if (f.blob) {
      zip.file(f.path, f.blob);
    } else {
      zip.file(f.path, f.content);
    }
    count++;
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return { blob, count, rejected };
}

/**
 * Trigger a browser download of a Blob with the given filename.
 * Uses an `<a download>` + Blob URL so it works in extension popups and
 * injected page scripts alike.
 */
export function downloadBlob(blob: Blob, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve();
    }, 1500);
  });
}
