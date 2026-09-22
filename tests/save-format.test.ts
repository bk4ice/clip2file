import { describe, expect, it } from 'vitest';
import { decideFormat } from '../src/core/save-format';

describe('decideFormat', () => {
  it('keeps the detected extension for smart save', () => {
    expect(decideFormat('auto', {
      hasText: true,
      imageCount: 0,
      isProject: false,
      suggestedFilename: 'main.py',
    })).toMatchObject({ allowed: true, extension: '.py', filename: 'main.py' });
  });

  it('forces plain text output for an explicit text save', () => {
    expect(decideFormat('text', {
      hasText: true,
      imageCount: 0,
      isProject: false,
      suggestedFilename: 'main.py',
    })).toMatchObject({ allowed: true, extension: '.txt', filename: 'main.txt' });
  });

  it('converts a text and image selection to Markdown', () => {
    expect(decideFormat('markdown', {
      hasText: true,
      imageCount: 1,
      isProject: false,
      suggestedFilename: 'note.txt',
    })).toMatchObject({ allowed: true, extension: '.md', filename: 'note.md' });
  });

  it('converts an image-only selection to HTML', () => {
    expect(decideFormat('html', {
      hasText: false,
      imageCount: 1,
      isProject: false,
      suggestedFilename: 'image.png',
    })).toMatchObject({ allowed: true, extension: '.html', filename: 'image.html' });
  });

  it('rejects plain text for an image-only selection', () => {
    expect(decideFormat('text', {
      hasText: false,
      imageCount: 1,
      isProject: false,
      suggestedFilename: 'image.png',
    })).toMatchObject({ allowed: false, reason: 'text-cannot-save-images' });
  });

  it('rejects plain text when text and images would lose the images', () => {
    expect(decideFormat('text', {
      hasText: true,
      imageCount: 1,
      isProject: false,
      suggestedFilename: 'note.txt',
    })).toMatchObject({ allowed: false, reason: 'text-cannot-save-images' });
  });

  it('rejects single-file formats for a multi-file project', () => {
    for (const mode of ['text', 'markdown', 'html'] as const) {
      expect(decideFormat(mode, {
        hasText: true,
        imageCount: 0,
        isProject: true,
        suggestedFilename: 'project.zip',
      })).toMatchObject({ allowed: false, reason: 'project-requires-zip' });
    }
  });

  it('allows ZIP for a multi-file project', () => {
    expect(decideFormat('zip', {
      hasText: true,
      imageCount: 0,
      isProject: true,
      suggestedFilename: 'project.zip',
    })).toMatchObject({ allowed: true, extension: '.zip', filename: 'project.zip' });
  });
});
