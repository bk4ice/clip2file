import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../src/utils/i18n';

function readMessages(locale: string): Record<string, { message: string }> {
  const path = resolve(process.cwd(), 'public', '_locales', locale, 'messages.json');
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, { message: string }>;
}

describe('localization resources', () => {
  it('keeps English and Simplified Chinese message keys in sync', () => {
    expect(Object.keys(readMessages('zh_CN')).sort()).toEqual(Object.keys(readMessages('en')).sort());
  });

  it('defines every manifest message reference in English', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'public', 'manifest.json'), 'utf8')) as unknown;
    const serialized = JSON.stringify(manifest);
    const keys = [...serialized.matchAll(/__MSG_([^_]+(?:_[^_]+)*)__?/g)].map((match) => match[1]);
    const messages = readMessages('en');
    for (const key of keys) expect(messages[key]).toBeDefined();
  });

  it('falls back to a non-empty English string when Chrome returns no message', () => {
    vi.stubGlobal('chrome', { i18n: { getMessage: () => '' } });
    expect(t('popupSaveFile')).toBe('Save File');
    vi.unstubAllGlobals();
  });
});
