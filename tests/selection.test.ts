import { afterEach, describe, expect, it } from 'vitest';
import { extractSelectionContent } from '../src/core/selection';

function select(html: string): void {
  document.body.innerHTML = html;
  const range = document.createRange();
  range.selectNodeContents(document.body);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
});

describe('structured selection extraction', () => {
  it('preserves text and repeated images in document order', () => {
    select('<p>Before</p><img src="https://example.com/a.png"><p>Between</p><img src="https://example.com/a.png"><p>After</p>');
    const result = extractSelectionContent();
    expect(result.nodes.map((node) => node.kind)).toEqual(['element', 'image', 'element', 'image', 'element']);
    expect(result.imageSources).toEqual([{ id: 'image-1', url: 'https://example.com/a.png' }]);
    expect(result.nodes[1]).toMatchObject({ kind: 'image', id: 'image-1' });
    expect(result.nodes[3]).toMatchObject({ kind: 'image', id: 'image-1' });
    expect(result.text).toBe('Before\nBetween\nAfter');
  });

  it('retains only selected text and its heading ancestor', () => {
    select('<h2>unselected Selected trailing</h2>');
    const text = document.querySelector('h2')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 11);
    range.setEnd(text, 19);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    const result = extractSelectionContent();
    expect(result.text).toBe('Selected');
    expect(result.nodes).toEqual([{ kind: 'element', tag: 'h2', children: [{ kind: 'text', text: 'Selected' }] }]);
  });

  it('keeps list nesting, links, table spans and code whitespace', () => {
    select('<ol start="3"><li>one<ul><li>nested</li></ul></li></ol><p><a href="https://example.com/docs" onclick="bad()">docs</a></p><table><tr><td colspan="2">cell</td></tr></table><pre><code>  first\n    second</code></pre>');
    const result = extractSelectionContent();
    const json = JSON.stringify(result);
    expect(json).toContain('"start":3');
    expect(json).toContain('"colspan":2');
    expect(json).toContain('"href":"https://example.com/docs"');
    expect(json).not.toContain('onclick');
    expect(result.nodes[3]).toMatchObject({ tag: 'pre', children: [{ tag: 'code', children: [{ text: '  first\n    second' }] }] });
  });

  it('drops active content and unsafe destinations', () => {
    select('<p>safe<script>secret()</script><a href="javascript:alert(1)">label</a><img src="data:image/svg+xml,bad"><iframe src="https://example.com"></iframe><input value="secret"></p>');
    const result = extractSelectionContent();
    const json = JSON.stringify(result);
    expect(json).not.toContain('secret');
    expect(json).not.toContain('javascript:');
    expect(json).not.toContain('svg+xml');
    expect(result.text).toBe('safelabel');
    expect(result.imageSources).toEqual([]);
  });

  it('marks partial table cells without importing unselected cells', () => {
    select('<table><tr><td>LEFT</td><td>RIGHT</td></tr></table>');
    const text = document.querySelectorAll('td')[1].firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    const result = extractSelectionContent();
    expect(result.nodes[0]).toMatchObject({ tag: 'table' });
    expect(result.text).toBe('RIGHT');
    expect(JSON.stringify(result)).not.toContain('LEFT');
  });

  it('retains the numbering of a partially selected ordered list', () => {
    select('<ol start="3"><li>first</li><li>second</li><li>third</li></ol>');
    const range = document.createRange();
    range.selectNodeContents(document.querySelectorAll('li')[1]);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    expect(extractSelectionContent().nodes[0]).toMatchObject({ tag: 'ol', start: 4 });
    expect(extractSelectionContent().text).toBe('second');
  });

  it('runs without module closures when serialized for chrome.scripting', () => {
    select('<p>portable</p>');
    const injected = new Function(`return (${extractSelectionContent.toString()})();`);
    expect(injected().text).toBe('portable');
  });

  it('does not recapture the extension feedback as part of a page selection', () => {
    select('<p>Original</p><div id="clip2file-feedback"><p>Download requested</p></div>');
    expect(extractSelectionContent().text).toBe('Original');
  });

  it('returns an empty snapshot for an empty selection', () => {
    expect(extractSelectionContent()).toEqual({ nodes: [], text: '', imageSources: [], rich: false });
  });
});
