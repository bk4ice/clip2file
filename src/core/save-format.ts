import { sanitizeFilename } from './sanitizer';

export type SaveMode = 'auto' | 'text' | 'markdown' | 'html' | 'zip';

export interface FormatContext {
  hasText: boolean;
  imageCount: number;
  isProject: boolean;
  suggestedFilename: string;
}

export type FormatRejection =
  | 'empty'
  | 'text-required'
  | 'project-requires-zip'
  | 'text-cannot-save-images';

export interface FormatDecision {
  allowed: boolean;
  reason?: FormatRejection;
  extension: string;
  filename: string;
}

function replaceExtension(filename: string, extension: string): string {
  const safe = sanitizeFilename(filename);
  const base = safe.replace(/\.[^.]+$/, '') || 'untitled';
  return `${base}${extension}`;
}

function hasContent(context: FormatContext): boolean {
  return context.hasText || context.imageCount > 0;
}

export function decideFormat(mode: SaveMode, context: FormatContext): FormatDecision {
  const suggested = sanitizeFilename(context.suggestedFilename || 'untitled.txt');

  if (!hasContent(context)) {
    return { allowed: false, reason: 'empty', extension: '', filename: suggested };
  }

  if (mode === 'auto') {
    if (context.isProject) {
      return { allowed: true, extension: '.zip', filename: replaceExtension(suggested, '.zip') };
    }
    if (context.imageCount > 0) {
      return { allowed: true, extension: '.html', filename: replaceExtension(suggested, '.html') };
    }
    const match = suggested.match(/\.[^.]+$/);
    const extension = match?.[0] || '.txt';
    return { allowed: true, extension, filename: match ? suggested : `${suggested}.txt` };
  }

  if (context.isProject && mode !== 'zip') {
    return { allowed: false, reason: 'project-requires-zip', extension: '', filename: suggested };
  }

  if (mode === 'text' && (context.imageCount > 0 || !context.hasText)) {
    return { allowed: false, reason: 'text-cannot-save-images', extension: '', filename: suggested };
  }

  const extensionByMode: Record<Exclude<SaveMode, 'auto'>, string> = {
    text: '.txt',
    markdown: '.md',
    html: '.html',
    zip: '.zip',
  };
  const extension = extensionByMode[mode];
  return { allowed: true, extension, filename: replaceExtension(suggested, extension) };
}
