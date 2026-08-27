import { sanitizeFilename } from './sanitizer';

export function extractTitleFromText(content: string, maxLength = 30): string {
  const trimmed = content.trim();
  if (!trimmed) return 'untitled';

  // Try first non-empty line
  const firstLine = trimmed.split(/\r?\n/)[0].trim();
  if (!firstLine) return 'untitled';

  // Remove Markdown heading markers
  const cleaned = firstLine
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .trim();

  if (!cleaned) return 'untitled';

  // Truncate reasonably
  const title = cleaned.slice(0, maxLength).trim();
  return title;
}

export function buildFilename(baseTitle: string, extension: string): string {
  // Trim any trailing period or space
  let title = baseTitle.replace(/[.\s]+$/, '');
  if (!title) title = 'untitled';

  const withoutExt = title.replace(/\.[^./\\]+$/, '');
  const safe = sanitizeFilename(withoutExt);

  // If user gave a clean title, keep it; extension is provided
  return `${safe}${extension}`;
}
