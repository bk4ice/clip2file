import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSelectionAssets } from '../src/core/image-loader';

const source = [{ id: 'image-1', url: 'https://example.com/image.png' }];
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('bounded selection image loading', () => {
  it('keeps the image id and original bytes for a downloaded raster image', async () => {
    vi.stubGlobal('fetch', async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }));
    const assets = await loadSelectionAssets(source);
    expect(assets[0].id).toBe('image-1');
    expect(Array.from(new Uint8Array(await assets[0].file!.blob!.arrayBuffer()))).toEqual([1, 2, 3]);
  });

  it('rejects images over the declared resource limit', async () => {
    vi.stubGlobal('fetch', async () => new Response('large', { headers: { 'Content-Type': 'image/png', 'Content-Length': '100' } }));
    const assets = await loadSelectionAssets(source, undefined, { maxImageBytes: 3 });
    expect(assets[0].file).toBeUndefined();
    expect(assets[0].error).toBe('image-too-large');
  });

  it('limits chunked responses even without Content-Length', async () => {
    vi.stubGlobal('fetch', async () => new Response(new Uint8Array([1, 2, 3, 4]), { headers: { 'Content-Type': 'image/png' } }));
    const assets = await loadSelectionAssets(source, undefined, { maxImageBytes: 3 });
    expect(assets[0].error).toBe('image-too-large');
  });

  it('does not embed SVG or non-image responses', async () => {
    vi.stubGlobal('fetch', async () => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }));
    expect((await loadSelectionAssets(source))[0].error).toBe('unsupported-image');
  });

  it('aborts a stalled fetch instead of waiting indefinitely', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', (_url: string, options: RequestInit) => new Promise((_resolve, reject) => options.signal!.addEventListener('abort', () => reject(new Error('aborted')))));
    const pending = loadSelectionAssets(source, undefined, { timeoutMs: 20 });
    await vi.advanceTimersByTimeAsync(30);
    expect((await pending)[0].error).toBe('fetch-failed');
  });

  it('bounds a stalled canvas fallback as well as the network request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
    const pending = loadSelectionAssets(source, () => new Promise(() => undefined), { timeoutMs: 20 });
    await vi.advanceTimersByTimeAsync(30);
    expect((await pending)[0].error).toBe('fetch-failed');
  });

  it('keeps failures alongside successful images instead of shifting their identities', async () => {
    vi.stubGlobal('fetch', async (url: string) => url.endsWith('missing') ? new Response('', { status: 404 }) : new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'image/png' } }));
    const assets = await loadSelectionAssets([{ id: 'image-1', url: 'https://example.com/missing' }, { id: 'image-2', url: 'https://example.com/ok' }]);
    expect(assets[0]).toMatchObject({ id: 'image-1', error: 'fetch-failed' });
    expect(assets[1]).toMatchObject({ id: 'image-2', file: { path: 'image-2.png' } });
  });

  it('stops at the total image budget', async () => {
    vi.stubGlobal('fetch', async () => new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/png' } }));
    const assets = await loadSelectionAssets([...source, { id: 'image-2', url: 'https://example.com/next.png' }], undefined, { maxTotalBytes: 2 });
    expect(assets[0].file).toBeDefined();
    expect(assets[1].error).toBe('image-too-large');
  });
});
