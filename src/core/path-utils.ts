/**
 * Path safety utilities for Phase 2 multi-file export.
 *
 * Goal: take arbitrary user-supplied path fragments (from AI output) and
 * produce a single normalized, safe, project-relative POSIX path that is
 * guaranteed to stay inside the project root (no `..`, no absolute paths,
 * no drive letters, no leading slashes).
 */

/**
 * Normalize a raw path fragment into a safe project-relative POSIX path.
 *
 * Rules:
 * - Converts backslashes to forward slashes.
 * - Strips Windows drive letters (`C:`) and UNC prefixes.
 * - Strips leading slashes (no absolute paths).
 * - Removes `.` segments and resolves `..` segments; if `..` would escape
 *   the root, the offending segment is dropped (path stays inside root).
 * - Replaces NUL and control chars with `_`.
 * - Sanitizes each segment against filesystem-unsafe chars.
 * - Collapses empty segments.
 * - Returns `''` if nothing usable remains.
 */
export function normalizePath(raw: string): string {
  if (!raw) return '';

  let p = raw.replace(/\0/g, '_');

  // Backslashes -> forward slashes (treat as POSIX)
  p = p.replace(/\\/g, '/');

  // Strip Windows drive letter (e.g. C:) and leading colon
  p = p.replace(/^[a-zA-Z]:/, '');

  // Strip UNC prefixes
  p = p.replace(/^\/\//, '/');

  // Strip leading slashes
  p = p.replace(/^\/+/, '');

  const segments: string[] = [];
  for (const seg of p.split('/')) {
    const trimmed = seg.trim();
    if (!trimmed || trimmed === '.') continue;
    if (trimmed === '..') {
      // Pop one segment if possible; otherwise drop (never escape root)
      if (segments.length > 0) segments.pop();
      continue;
    }
    segments.push(sanitizePathSegment(trimmed));
  }

  return segments.join('/');
}

/**
 * Sanitize a single path segment (file or directory name).
 * Keeps unicode letters/digits, dots, dashes, underscores, spaces.
 * Replaces filesystem-unsafe chars with `_`.
 */
export function sanitizePathSegment(name: string): string {
  let s = name.replace(/[\x00-\x1f\x7f<>|:"?*]/g, '_');
  // A segment should not be all dots
  if (/^\.+$/.test(s)) s = '_';
  // Trim trailing dots/spaces (Windows dislikes them)
  s = s.replace(/[.\s]+$/g, '');
  if (!s) s = '_';
  // Cap segment length
  if (s.length > 96) s = s.slice(0, 96);
  return s;
}

/**
 * Returns true if `path` is safe (inside root, no traversal, non-empty).
 */
export function isSafePath(path: string): boolean {
  if (!path) return false;
  if (path.includes('\0')) return false;
  // No absolute / drive / traversal after normalization
  if (/^[a-zA-Z]:/.test(path)) return false;
  if (path.startsWith('/')) return false;
  if (/(^|\/)\.\.(\/|$)/.test(path)) return false;
  return true;
}

/**
 * Ensure a path has the given extension (append if missing).
 */
export function ensureExtension(path: string, ext: string): string {
  if (!ext) return path;
  const dot = ext.startsWith('.') ? ext : `.${ext}`;
  if (path.toLowerCase().endsWith(dot.toLowerCase())) return path;
  return `${path}${dot}`;
}
