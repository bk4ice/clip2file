import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from '../src/core/sanitizer';

describe('sanitizeFilename', () => {
  it('strips path traversal', () => {
    expect(sanitizeFilename('../../evil.sh')).toBe('evil.sh');
  });

  it('removes null bytes', () => {
    expect(sanitizeFilename('file.txt\0.exe')).not.toContain('\0');
  });

  it('replaces unsafe chars', () => {
    expect(sanitizeFilename('hello:world.txt')).toBe('hello_world.txt');
  });

  it('returns filename for empty', () => {
    expect(sanitizeFilename('   ')).toBe('untitled.txt');
  });
});
