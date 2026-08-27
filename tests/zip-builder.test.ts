import { describe, it, expect } from 'vitest';
import { buildZip } from '../src/core/zip-builder';
import type { ParsedFile } from '../src/core/types';

describe('buildZip', () => {
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
