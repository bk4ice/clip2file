import type { DetectResult, LanguageRule, ParseResult } from './types';
import { extractTitleFromText, buildFilename } from './filename';
import { parseProject, mightBeProject } from './parser';

/** Cache of the most recent project parse, so callers (popup) can reuse it
 *  instead of re-running parseProject after detect() already did. */
let lastProjectParse: ParseResult | null = null;

/** Get the cached project parse from the last detect() call, if any. */
export function getLastProjectParse(): ParseResult | null {
  return lastProjectParse;
}

const languages: LanguageRule[] = [
  { name: 'python', extension: '.py', keywords: /\b(from [\w.]+ import |import [\w.]+|def |class |if __name__|print\(|lambda |async def |await |raise |except |finally:)/m, weight: 1.0 },
  { name: 'javascript', extension: '.js', keywords: /\b(const |let |var |function |=>|console\.log|require\(|module\.exports|export )/m, weight: 1.0 },
  { name: 'typescript', extension: '.ts', keywords: /\b(interface |type |enum |: string|: number|: boolean|as |implements )/m, weight: 1.2 },
  { name: 'html', extension: '.html', keywords: /<(html|head|body|div|span|script|style|p|a)\b/i, weight: 5.0 },
  // CSS selector: `.`/`#` must be followed by an identifier letter (not a digit,
  // to avoid matching float literals like `1.0`), and the selector portion up
  // to `{` must not contain `(`, `)`, `/`, `}` — this prevents matching Python
  // method calls (`m.add(...dict...)`) and URLs (`https://host/path`) which
  // previously caused false positives on dict-heavy code.
  { name: 'css', extension: '.css', keywords: /[.#][A-Za-z_-][\w-]*[^{}()/]*\{[^}]*\}/, weight: 1.0 },
  { name: 'json', extension: '.json', keywords: /^\s*[\[{]/, weight: 0.8 },
  { name: 'yaml', extension: '.yaml', keywords: /^\s*[\w-]+:\s/m, weight: 0.8 },
  { name: 'sql', extension: '.sql', keywords: /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|FROM|WHERE|JOIN)\b/i, weight: 1.0 },
  { name: 'shell', extension: '.sh', keywords: /\b(echo |if \[|then|fi|for |while |do\n)/m, weight: 1.0 },
  { name: 'dockerfile', extension: 'Dockerfile', keywords: /\b(FROM|RUN|COPY|CMD|ENTRYPOINT|WORKDIR|EXPOSE)\b/m, weight: 1.0 },
  { name: 'cpp', extension: '.cpp', keywords: /\b(#include|int main|std::|using namespace|cout <<)/, weight: 1.0 },
  { name: 'java', extension: '.java', keywords: /\b(public class|public static void main|System\.out|import java)/, weight: 1.0 },
  { name: 'go', extension: '.go', keywords: /\b(package main|func main|fmt\.Print|import \()/, weight: 1.0 },
  { name: 'rust', extension: '.rs', keywords: /\b(fn main|let mut|println!|use std|impl |struct )/, weight: 1.0 },
];

const languageDefaultNames: Record<string, string> = {
  python: 'main.py',
  javascript: 'script.js',
  typescript: 'index.ts',
  json: 'data.json',
  yaml: 'config.yaml',
  html: 'index.html',
  css: 'style.css',
  sql: 'query.sql',
  shell: 'script.sh',
  dockerfile: 'Dockerfile',
  cpp: 'main.cpp',
  java: 'Main.java',
  go: 'main.go',
  rust: 'main.rs',
};

export function detect(content: string): DetectResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return fallback(trimmed);
  }

  // 0. Multi-file project detection (Phase 2): only run the full parser
  //    when a cheap pre-check suggests multiple files. This avoids running
  //    the global FENCE_RE on every keystroke for plain single-file content.
  if (mightBeProject(trimmed)) {
    const project = parseProject(trimmed);
    if (project.hasMultiple) {
      lastProjectParse = project;
      const title = inferProjectTitle(trimmed);
      return {
        type: 'project',
        language: 'project',
        extension: '.zip',
        suggestedFilename: buildFilename(title || 'project', '.zip'),
        confidence: 0.9,
        content: trimmed
      };
    }
  }

  lastProjectParse = null;

  // 1. Detect programming language signals first
  const languageScores: { name: string; score: number; extension: string }[] = [];
  for (const lang of languages) {
    const matches = (trimmed.match(new RegExp(lang.keywords, 'g')) || []).length;
    if (matches > 0) {
      languageScores.push({ name: lang.name, score: matches * lang.weight, extension: lang.extension });
    }
  }
  languageScores.sort((a, b) => b.score - a.score);

  const bestLanguage = languageScores[0] ?? null;

  // 2. If Python-like signals dominate, force Python even if content contains valid JSON blocks
  if (bestLanguage?.name === 'python') {
    return {
      type: 'code',
      language: 'python',
      extension: '.py',
      suggestedFilename: languageDefaultNames.python,
      confidence: Math.min(0.99, 0.7 + bestLanguage.score * 0.05),
      content: trimmed
    };
  }

  // 3. Markdown detection
  const hasMarkdownFeatures = /^#{1,6}\s/m.test(trimmed) ||
    /(\*\*|__|\[.*?\]\(.*?\)|^\s*[-*+]\s)/m.test(trimmed);

  // 4. JSON detection only when no strong language signal
  if (isJSON(trimmed) && (!bestLanguage || bestLanguage.score < 2)) {
    return {
      type: 'json',
      language: 'json',
      extension: '.json',
      suggestedFilename: languageDefaultNames.json,
      confidence: 0.95,
      content: trimmed
    };
  }

  // 5. YAML detection
  if (isYAML(trimmed) && !isJSON(trimmed) && (!bestLanguage || bestLanguage.score < 2)) {
    return {
      type: 'text',
      language: 'yaml',
      extension: '.yaml',
      suggestedFilename: languageDefaultNames.yaml,
      confidence: 0.8,
      content: trimmed
    };
  }

  // 6. Other language detection
  if (bestLanguage && bestLanguage.score >= 1.5) {
    return {
      type: 'code',
      language: bestLanguage.name,
      extension: bestLanguage.extension,
      suggestedFilename: languageDefaultNames[bestLanguage.name] || `untitled${bestLanguage.extension}`,
      confidence: Math.min(0.99, 0.5 + bestLanguage.score * 0.1),
      content: trimmed
    };
  }

  if (hasMarkdownFeatures) {
    const title = extractTitleFromText(trimmed);
    return {
      type: 'markdown',
      language: 'markdown',
      extension: '.md',
      suggestedFilename: buildFilename(title, '.md'),
      confidence: 0.85,
      content: trimmed
    };
  }

  // 7. Plain text with title inference
  const title = extractTitleFromText(trimmed);
  return {
    type: 'text',
    language: 'text',
    extension: '.txt',
    suggestedFilename: buildFilename(title, '.txt'),
    confidence: 0.6,
    content: trimmed
  };
}

function isJSON(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

function isYAML(content: string): boolean {
  return /^\s*[A-Za-z_][\w-]*:\s/m.test(content) ||
    /^\s*-\s/m.test(content);
}

function fallback(content: string): DetectResult {
  return {
    type: 'text',
    language: 'text',
    extension: '.txt',
    suggestedFilename: 'untitled.txt',
    confidence: 0.5,
    content
  };
}

/** Infer a sensible ZIP filename for a multi-file project.
 *  Skips code lines, bare filenames, and fence markers — prefers a real
 *  markdown heading or a prose description line. Falls back to 'project'. */
function inferProjectTitle(content: string): string {
  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Skip fence markers
    if (/^[`~]{3,}/.test(line)) continue;
    // Skip bare filenames like `app.py`, `src/utils.ts`
    if (/\.[a-zA-Z0-9]{1,8}$/.test(line) && !/\s/.test(line)) continue;
    // Markdown heading — best candidate (check BEFORE the code-line skip,
    // since headings start with `#` which would otherwise look like code).
    if (/^#{1,6}\s+/.test(line)) {
      return line.replace(/^#{1,6}\s+/, '').replace(/[*_`]/g, '').trim();
    }
    // Skip code lines (indented or starting with code punctuation)
    if (/^[{}\[\(<>]/.test(line) || /^\s{4,}\S/.test(raw)) continue;
    // A prose line with spaces and no code-like density
    if (/\s/.test(line) && !/[;{}]/.test(line) && line.length <= 60) {
      return line.replace(/[*_`]/g, '').trim();
    }
  }
  return 'project';
}
