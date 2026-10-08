import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Blob } from 'node:buffer';
import JSZip from 'jszip';
import { extractSelectionContent } from '../src/core/selection';
import { buildSelectionFile } from '../src/core/selection-builder';
import type { SelectionAsset } from '../src/core/types';

function snapshot(html: string) {
  document.body.innerHTML = html;
  const range = document.createRange();
  range.selectNodeContents(document.body);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
  return extractSelectionContent();
}

beforeAll(() => {
  vi.stubGlobal('Blob', Blob);
  vi.stubGlobal('FileReader', undefined);
});
afterAll(() => vi.unstubAllGlobals());

const messages = { missingImage: 'Image unavailable', complexTable: 'Table preserved as HTML' };

function imageAsset(): SelectionAsset {
  return {
    id: 'image-1',
    file: { path: 'image-1.png', language: 'image', content: '', blob: new globalThis.Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), mimeType: 'image/png', nameSource: 'clipboard-image' },
  };
}

describe('selection exports', () => {
  it('creates self-contained HTML with images between the selected paragraphs', async () => {
    const selection = snapshot('<h2>Title</h2><p>Before</p><img src="https://example.com/a.png"><p>After</p>');
    const result = await buildSelectionFile(selection, [imageAsset()], 'html', 'note.txt', messages);
    const html = result.text!;
    expect(result.filename).toBe('note.html');
    expect(html.indexOf('Before')).toBeLessThan(html.indexOf('<img'));
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('After'));
    expect(html).toContain('data:image/png;base64,AQID');
    expect(html).not.toContain('https://example.com/a.png');
    expect(result.issues).toEqual([]);
  });

  it('creates Markdown without a ZIP for text-only selections', async () => {
    const result = await buildSelectionFile(snapshot('<h2>Title</h2><p>Visit <a href="https://example.com">docs</a>.</p><ol start="3"><li>Item<ul><li>Nested</li></ul></li></ol><pre><code>  line\n    next</code></pre>'), [], 'markdown', 'note.txt', messages);
    expect(result.filename).toBe('note.md');
    expect(result.blob).toBeUndefined();
    expect(result.text).toContain('## Title');
    expect(result.text).toContain('[docs](https://example.com/)');
    expect(result.text).toContain('3. Item\n   - Nested');
    expect(result.text).toContain('```\n  line\n    next\n```');
  });

  it('packs Markdown and image bytes using relative asset references', async () => {
    const selection = snapshot('<p>Before</p><img src="https://example.com/a.png"><p>After</p>');
    const result = await buildSelectionFile(selection, [imageAsset()], 'markdown', 'note.html', messages);
    expect(result.filename).toBe('note.zip');
    const zip = await JSZip.loadAsync(new Uint8Array(await result.blob!.arrayBuffer()));
    const md = await zip.file('content.md')!.async('string');
    expect(md).toContain('![](assets/image-1.png)');
    expect(md.indexOf('Before')).toBeLessThan(md.indexOf('assets/image-1.png'));
    expect(md.indexOf('assets/image-1.png')).toBeLessThan(md.indexOf('After'));
    expect(md).not.toContain('data:');
    expect(Array.from(await zip.file('assets/image-1.png')!.async('uint8array'))).toEqual([1, 2, 3]);
  });

  it('keeps a missing image placeholder at its original position and reports partial output', async () => {
    const selection = snapshot('<p>Before</p><img src="https://example.com/a.png"><p>After</p>');
    const result = await buildSelectionFile(selection, [{ id: 'image-1', error: 'fetch-failed' }], 'html', 'note', messages);
    expect(result.issues).toContain('missing-image');
    expect(result.text!.indexOf('Before')).toBeLessThan(result.text!.indexOf('Image unavailable'));
    expect(result.text!.indexOf('Image unavailable')).toBeLessThan(result.text!.indexOf('After'));
    expect(result.imageCount).toBe(0);
  });

  it('uses a Markdown table for rectangular data, escaping pipes and line breaks', async () => {
    const result = await buildSelectionFile(snapshot('<table><tr><th>Name</th><th>Value</th></tr><tr><td>A|B</td><td>one<br>two</td></tr></table>'), [], 'markdown', 'data', messages);
    expect(result.text).toContain('| Name | Value |');
    expect(result.text).toContain('| --- | --- |');
    expect(result.text).toContain('| A\\|B | one<br>two |');
    expect(result.tableCount).toBe(1);
  });

  it('preserves merged cells as safe HTML inside Markdown and reports the limitation', async () => {
    const result = await buildSelectionFile(snapshot('<table><tr><td colspan="2">Merged</td></tr></table>'), [], 'markdown', 'data', messages);
    expect(result.text).toContain('<table>');
    expect(result.text).toContain('colspan="2"');
    expect(result.issues).toContain('complex-table');
  });

  it('does not emit script, event attributes or unsafe links', async () => {
    const selection = snapshot('<p onclick="bad()"><a href="javascript:bad()">label</a><script>bad()</script><strong>safe</strong></p>');
    const result = await buildSelectionFile(selection, [], 'html', 'safe', messages);
    expect(result.text).not.toMatch(/<script|onclick|javascript:/);
    expect(result.text).toContain('<strong>safe</strong>');
  });
});
