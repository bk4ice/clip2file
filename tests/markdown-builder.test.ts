import { describe, it, expect } from 'vitest';
import { buildMarkdown, blobToDataUrl } from '../src/core/markdown-builder';
import type { ParsedFile } from '../src/core/types';

function makeImageBlob(): Blob {
  // 1x1 transparent PNG
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6KgAAAABJRU5ErkJggg==';
  const binary = atob(pngBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

describe('buildMarkdown', () => {
  it('embeds text and image into a single markdown string', async () => {
    const blob = makeImageBlob();
    const images: ParsedFile[] = [
      { path: 'screenshot.png', language: 'image', content: '', blob, mimeType: 'image/png', nameSource: 'clipboard-image' },
    ];
    const md = await buildMarkdown('Hello world', images);
    expect(md).toContain('Hello world');
    expect(md).toContain('![screenshot](data:image/png;base64,');
    expect(md).toMatch(/base64,[A-Za-z0-9+/]+={0,2}/);
  });

  it('works with text only (no images)', async () => {
    const md = await buildMarkdown('Just text', []);
    expect(md).toBe('Just text');
  });

  it('works with images only (no text)', async () => {
    const blob = makeImageBlob();
    const images: ParsedFile[] = [
      { path: 'img.png', language: 'image', content: '', blob, mimeType: 'image/png', nameSource: 'clipboard-image' },
    ];
    const md = await buildMarkdown('   ', images);
    expect(md).toContain('![img](data:image/png;base64,');
    expect(md).not.toContain('   '); // no leading whitespace from empty text
  });

  it('embeds multiple images', async () => {
    const blob = makeImageBlob();
    const images: ParsedFile[] = [
      { path: 'a.png', language: 'image', content: '', blob, mimeType: 'image/png', nameSource: 'clipboard-image' },
      { path: 'b.png', language: 'image', content: '', blob, mimeType: 'image/png', nameSource: 'clipboard-image' },
    ];
    const md = await buildMarkdown('Text', images);
    const matches = md.match(/data:image\/png;base64,/g);
    expect(matches).toHaveLength(2);
  });
});

describe('blobToDataUrl', () => {
  it('returns a data URL with correct mime prefix', async () => {
    const blob = makeImageBlob();
    const url = await blobToDataUrl(blob);
    expect(url).toMatch(/^data:image\/png;base64,/);
  });
});
