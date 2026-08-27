import { describe, it, expect } from 'vitest';
import { normalizePath, isSafePath, ensureExtension, sanitizePathSegment } from '../src/core/path-utils';

describe('normalizePath', () => {
  it('strips leading slashes', () => {
    expect(normalizePath('/etc/passwd')).toBe('etc/passwd');
  });

  it('strips windows drive letters', () => {
    expect(normalizePath('C:Users/foo/bar')).toBe('Users/foo/bar');
  });

  it('resolves .. without escaping root', () => {
    expect(normalizePath('a/../../b')).toBe('b');
  });

  it('drops .. that would escape root', () => {
    expect(normalizePath('../../etc/passwd')).toBe('etc/passwd');
  });

  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('src\\utils\\app.py')).toBe('src/utils/app.py');
  });

  it('collapses dot segments', () => {
    expect(normalizePath('a/./b/./c')).toBe('a/b/c');
  });

  it('replaces control chars', () => {
    expect(normalizePath('a\0b')).toBe('a_b');
  });

  it('returns empty for unusable input', () => {
    expect(normalizePath('///')).toBe('');
    expect(normalizePath('')).toBe('');
  });
});

describe('sanitizePathSegment', () => {
  it('replaces unsafe chars', () => {
    expect(sanitizePathSegment('hello:world')).toBe('hello_world');
  });

  it('converts all-dots segment', () => {
    expect(sanitizePathSegment('..')).toBe('_');
  });
});

describe('isSafePath', () => {
  it('accepts normal relative paths', () => {
    expect(isSafePath('src/app.py')).toBe(true);
  });

  it('rejects absolute paths', () => {
    expect(isSafePath('/etc/passwd')).toBe(false);
  });

  it('rejects traversal', () => {
    expect(isSafePath('../etc/passwd')).toBe(false);
    expect(isSafePath('a/../../b')).toBe(false);
  });

  it('rejects drive letters', () => {
    expect(isSafePath('C:Users/x')).toBe(false);
  });

  it('rejects empty', () => {
    expect(isSafePath('')).toBe(false);
  });
});

describe('ensureExtension', () => {
  it('appends missing extension', () => {
    expect(ensureExtension('app', '.py')).toBe('app.py');
  });

  it('keeps existing extension', () => {
    expect(ensureExtension('app.py', '.py')).toBe('app.py');
  });

  it('handles ext without leading dot', () => {
    expect(ensureExtension('app', 'py')).toBe('app.py');
  });
});
