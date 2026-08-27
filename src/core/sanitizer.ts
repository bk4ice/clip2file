export function sanitizeFilename(filename: string): string {
  // Strip path traversal
  const normalized = filename.replace(/\\/g, '/').split('/').pop() || filename;

  // Remove null bytes
  let safe = normalized.replace(/\0/g, '');

  // Strip control chars and unsafe filesystem chars
  safe = safe.replace(/[\x00-\x1f\x7f<>|:"?*]/g, '_');

  // Trim and ensure not empty
  safe = safe.trim();
  if (!safe) safe = 'untitled.txt';

  // Limit length
  if (safe.length > 128) {
    const ext = safe.lastIndexOf('.');
    if (ext > 0) {
      safe = safe.slice(0, 100) + safe.slice(ext);
    } else {
      safe = safe.slice(0, 128);
    }
  }

  return safe;
}
