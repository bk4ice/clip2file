import { describe, it, expect } from 'vitest';
import { buildHtml } from '../src/core/html-builder';
import type { ParsedFile } from '../src/core/types';

function makeImageBlob(): Blob {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6KgAAAABJRU5ErkJggg==';
  const binary = atob(pngBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

describe('buildHtml', () => {
  it('produces a complete HTML document', async () => {
    const html = await buildHtml('Hello world', []);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('Hello world');
  });

  it('embeds images as base64 data URLs in <img> tags', async () => {
    const blob = makeImageBlob();
    const images: ParsedFile[] = [
      { path: 'photo.png', language: 'image', content: '', blob, mimeType: 'image/png', nameSource: 'clipboard-image' },
    ];
    const html = await buildHtml('See this photo', images);
    expect(html).toContain('<img src="data:image/png;base64,');
    expect(html).toContain('alt="photo"');
  });

  it('escapes HTML special characters in text', async () => {
    const html = await buildHtml('<script>alert("xss")</script>', []);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('preserves code blocks in <pre> tags', async () => {
    const code = '    def hello():\n        print("hi")';
    const html = await buildHtml(code, []);
    expect(html).toContain('<pre>');
    expect(html).toContain('def hello():');
  });

  it('handles images only (no text)', async () => {
    const blob = makeImageBlob();
    const images: ParsedFile[] = [
      { path: 'img.png', language: 'image', content: '', blob, mimeType: 'image/png', nameSource: 'clipboard-image' },
    ];
    const html = await buildHtml('   ', images);
    expect(html).toContain('<img src="data:image/png;base64,');
  });

  it('embeds multiple images', async () => {
    const blob = makeImageBlob();
    const images: ParsedFile[] = [
      { path: 'a.png', language: 'image', content: '', blob, mimeType: 'image/png', nameSource: 'clipboard-image' },
      { path: 'b.png', language: 'image', content: '', blob, mimeType: 'image/png', nameSource: 'clipboard-image' },
    ];
    const html = await buildHtml('Text', images);
    const matches = html.match(/<img src="data:image\/png;base64,/g);
    expect(matches).toHaveLength(2);
  });
});
