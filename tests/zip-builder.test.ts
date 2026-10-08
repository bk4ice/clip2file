import { describe, it, expect } from 'vitest';
import { buildZip } from '../src/core/zip-builder';
import JSZip from 'jszip';
import type { ParsedFile } from '../src/core/types';

describe('buildZip', () => {
  it('preserves binary image bytes in the ZIP', async () => {
    const { blob } = await buildZip([
      { path: 'assets/image.png', language: 'image', content: '', blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), nameSource: 'clipboard-image' },
    ]);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Array.from(await zip.file('assets/image.png')!.async('uint8array'))).toEqual([1, 2, 3]);
  });
  it('packs multiple files into a zip blob', async () => {
    const files: ParsedFile[] = [
      { path: 'app.py', language: 'python', content: 'print(1)', nameSource: 'inferred' },
      { path: 'README.md', language: 'markdown', content: '# Hi', nameSource: 'inferred' },
    ];
    const { blob, count, rejected } = await buildZip(files);
    expect(count).toBe(2);
    expect(rejected).toHaveLength(0);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/zip');
  });

  it('rejects path traversal entries', async () => {
    const files: ParsedFile[] = [
      { path: '../evil.sh', language: 'shell', content: 'x', nameSource: 'inferred' },
      { path: 'safe.txt', language: 'text', content: 'ok', nameSource: 'inferred' },
    ];
    const { count, rejected } = await buildZip(files);
    expect(count).toBe(1);
    expect(rejected).toContain('../evil.sh');
  });

  it('does NOT reject filenames with double dots like file..txt', async () => {
    const files: ParsedFile[] = [
      { path: 'file..txt', language: 'text', content: 'ok', nameSource: 'inferred' },
    ];
    const { count, rejected } = await buildZip(files);
    expect(count).toBe(1);
    expect(rejected).toHaveLength(0);
  });

  it('rejects absolute paths', async () => {
    const files: ParsedFile[] = [
      { path: '/etc/passwd', language: 'text', content: 'x', nameSource: 'inferred' },
    ];
    const { count, rejected } = await buildZip(files);
    expect(count).toBe(0);
    expect(rejected).toHaveLength(1);
  });

  it('handles empty file list', async () => {
    const { count, rejected } = await buildZip([]);
    expect(count).toBe(0);
    expect(rejected).toHaveLength(0);
  });
});
