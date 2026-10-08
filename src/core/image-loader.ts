import type { SelectionAsset } from './types';

interface ImageLimits {
  maxImageBytes: number;
  maxTotalBytes: number;
  maxImages: number;
  timeoutMs: number;
  totalTimeoutMs: number;
}

const defaults: ImageLimits = {
  maxImageBytes: 10 * 1024 * 1024,
  maxTotalBytes: 30 * 1024 * 1024,
  maxImages: 100,
  timeoutMs: 8000,
  totalTimeoutMs: 45000,
};

const extensions: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/x-icon': 'ico',
};

export async function loadSelectionAssets(
  sources: { id: string; url: string }[],
  fallback?: (url: string, timeoutMs: number, maxBytes: number) => Promise<Blob | null>,
  options: Partial<ImageLimits> = {},
): Promise<SelectionAsset[]> {
  const limits = { ...defaults, ...options };
  const assets: SelectionAsset[] = [];
  const started = Date.now();
  let total = 0;

  for (const [index, source] of sources.entries()) {
    const limit = Math.min(limits.maxImageBytes, limits.maxTotalBytes - total);
    const remaining = limits.totalTimeoutMs - (Date.now() - started);
    if (limit <= 0 || index >= limits.maxImages || remaining <= 0) {
      assets.push({ id: source.id, error: remaining <= 0 ? 'fetch-failed' : 'image-too-large' });
      continue;
    }
    const controller = new AbortController();
    const timeoutMs = Math.min(limits.timeoutMs, remaining);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let blob: Blob | null = null;
    let error = 'fetch-failed';
    let allowFallback = true;
    try {
      const parsed = new URL(source.url);
      if (!['http:', 'https:', 'blob:'].includes(parsed.protocol) && !/^data:image\/(png|jpeg|gif|webp|bmp|x-icon);base64,/i.test(source.url)) {
        allowFallback = false;
        throw new Error('unsupported-image');
      }
      const response = await fetch(source.url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('fetch-failed');
      const type = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() || '';
      if (!extensions[type]) {
        allowFallback = false;
        throw new Error('unsupported-image');
      }
      if (Number(response.headers.get('Content-Length')) > limit) {
        allowFallback = false;
        throw new Error('image-too-large');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('fetch-failed');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit) {
            allowFallback = false;
            await reader.cancel();
            throw new Error('image-too-large');
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      if (!size) throw new Error('fetch-failed');
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      blob = new Blob([bytes], { type });
    } catch (err) {
      error = err instanceof Error && ['image-too-large', 'unsupported-image'].includes(err.message) ? err.message : 'fetch-failed';
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
    if (!blob && allowFallback && fallback) {
      const fallbackTime = Math.min(limits.timeoutMs, limits.totalTimeoutMs - (Date.now() - started));
      if (fallbackTime > 0) {
        let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          blob = await Promise.race([
            fallback(source.url, fallbackTime, limit).catch(() => null),
            new Promise<null>((resolve) => { fallbackTimer = setTimeout(() => resolve(null), fallbackTime); }),
          ]);
        } finally {
          clearTimeout(fallbackTimer);
        }
      }
    }
    if (blob && (!extensions[blob.type] || blob.size > limit || !blob.size)) {
      error = blob.size > limit ? 'image-too-large' : 'unsupported-image';
      blob = null;
    }
    if (blob) {
      total += blob.size;
      assets.push({ id: source.id, file: {
        path: `${source.id}.${extensions[blob.type]}`,
        language: 'image', content: '', blob, mimeType: blob.type, nameSource: 'clipboard-image',
      } });
    } else {
      assets.push({ id: source.id, error });
    }
  }
  return assets;
}
