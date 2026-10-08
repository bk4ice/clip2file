import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SelectionContent } from '../src/core/types';
import JSZip from 'jszip';

let click: (info: { menuItemId: string; frameId?: number }, tab: { id: number }) => Promise<void>;
let command: (name: string) => Promise<void>;
let content: SelectionContent;
let injections: { func: Function; args?: unknown[]; target: { tabId: number; frameIds?: number[] } }[];

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  injections = [];
  content = { text: 'Before\nAfter', rich: true, nodes: [{ kind: 'element', tag: 'p', children: [{ kind: 'text', text: 'Before' }] }, { kind: 'image', id: 'image-1', alt: '' }, { kind: 'element', tag: 'p', children: [{ kind: 'text', text: 'After' }] }], imageSources: [{ id: 'image-1', url: 'https://example.com/missing.png' }] };
  vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
  vi.stubGlobal('chrome', {
    runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    contextMenus: { onClicked: { addListener(fn: typeof click) { click = fn; } } },
    commands: { onCommand: { addListener(fn: typeof command) { command = fn; } } },
    storage: { local: { get(_keys: string[], callback: Function) { callback({ badgeFeedback: true }); } } },
    tabs: { get: async () => ({ url: 'https://example.com/' }), query: async () => [{ id: 10 }] },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    scripting: { executeScript: async (options: typeof injections[number]) => {
      injections.push(options);
      if (options.func.name === 'extractSelectionContent') return [{ result: content }];
      if (options.func.name === 'fetchImageViaCanvas') return [{ result: null }];
      return [{ result: undefined }];
    } },
  });
  await import('../src/background/service-worker');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('selection save workflow', () => {
  it('reports partial image output in the clicked frame instead of complete success', async () => {
    await click({ menuItemId: 'clip2file-format-html', frameId: 7 }, { id: 10 });
    const download = injections.find((item) => item.func.name === 'downloadTextInPage')!;
    expect(download.target.frameIds).toEqual([7]);
    expect(download.args![0]).toContain('Image unavailable');
    const feedback = injections.find((item) => item.func.name === 'showPageFeedback')!;
    expect(feedback.args![1]).toBe('warning');
  });

  it('does not download or show success for an empty selection', async () => {
    content = { nodes: [], text: '', imageSources: [], rich: false };
    await click({ menuItemId: 'clip2file-save' }, { id: 10 });
    expect(injections.some((item) => item.func.name.startsWith('download'))).toBe(false);
    expect(injections.find((item) => item.func.name === 'showPageFeedback')!.args![1]).toBe('error');
  });

  it('treats an unavailable nested image as a selection instead of saving unrelated clipboard text', async () => {
    content = { text: '', rich: true, imageSources: [], nodes: [{ kind: 'element', tag: 'div', children: [{ kind: 'image', id: 'unavailable', alt: '' }] }] };
    await command('quick-save');
    expect(injections.find((item) => item.func.name === 'downloadTextInPage')?.args![0]).toContain('Image unavailable');
    expect(injections.find((item) => item.func.name === 'showPageFeedback')!.args![1]).toBe('warning');
  });

  it('does not overwrite a project file when adding image failure diagnostics', async () => {
    const text = '```txt filename="image-errors.txt"\nOriginal\n```\n```js filename="app.js"\nconsole.log(1)\n```';
    content = { ...content, text, nodes: [{ kind: 'text', text }, { kind: 'image', id: 'image-1', alt: '' }] };
    await click({ menuItemId: 'clip2file-format-zip' }, { id: 10 });
    const download = injections.find((item) => item.func.name === 'downloadBase64Blob')!;
    const zip = await JSZip.loadAsync(Buffer.from(download.args![0] as string, 'base64'));
    expect(await zip.file('image-errors.txt')!.async('string')).toBe('Original');
    expect(injections.find((item) => item.func.name === 'showPageFeedback')!.args![1]).toBe('warning');
  });

  it('does not silently drop a failed image when TXT is requested', async () => {
    await click({ menuItemId: 'clip2file-format-text' }, { id: 10 });
    expect(injections.some((item) => item.func.name.startsWith('download'))).toBe(false);
    expect(injections.find((item) => item.func.name === 'showPageFeedback')!.args![1]).toBe('error');
  });
});
