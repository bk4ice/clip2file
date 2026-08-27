import { describe, it, expect } from 'vitest';
import { extractTitleFromText, buildFilename } from '../src/core/filename';

describe('extractTitleFromText', () => {
  it('extracts first line from plain text', () => {
    expect(extractTitleFromText('今天的会议内容：\n1. 完成接口')).toBe('今天的会议内容：');
  });

  it('strips markdown heading markers', () => {
    expect(extractTitleFromText('# 项目说明\n\n这是一个项目。')).toBe('项目说明');
  });

  it('returns untitled for empty', () => {
    expect(extractTitleFromText('   ')).toBe('untitled');
  });
});

describe('buildFilename', () => {
  it('combines title with extension', () => {
    expect(buildFilename('项目说明', '.md')).toBe('项目说明.md');
  });

  it('strips existing extension from title', () => {
    expect(buildFilename('README.md', '.md')).toBe('README.md');
  });
});
