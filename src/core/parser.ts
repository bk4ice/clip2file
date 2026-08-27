/**
 * Markdown multi-file parser (Phase 2).
 *
 * Parses content that contains one or more fenced code blocks and extracts
 * a list of virtual files. Filename is resolved from, in priority order:
 *   1. Code fence attribute: ```python filename="app.py"  /  ```python app.py
 *   2. A filename-like token on the line(s) immediately preceding the fence
 *      (e.g. a heading `### app.py` or a bare `app.py` line).
 *   3. Inferred from the detected language (e.g. `main.py`).
 *
 * Non-fenced prose between blocks is ignored. If no fences are found, the
 * whole content is treated as a single inferred file.
 */

import type { ParsedFile, ParseResult } from './types';
import { normalizePath, ensureExtension } from './path-utils';

/** Match a fenced code block: opening fence, body, closing fence.
 *  The `|$` alternative also matches unclosed fences (common in truncated
 *  AI output) — the body extends to end of string in that case.
 *  `\r?\n` handles CRLF line endings. */
const FENCE_RE = /(^|\r?\n)[ \t]*(`{3,}|~{3,})[ \t]*([^\n\r]*)\r?\n([\s\S]*?)(?:\r?\n[ \t]*\2[ \t]*[^\n\r]*|$)/g;

/** Non-global version for quick output-marker checks (avoids lastIndex bugs). */
const OUTPUT_MARKER_TEST = /(?:^|\r?\n)[ \t]*(?:输出|结果|运行结果|执行结果|输出结果|Output|Result|Console output|Stdout)\s*[:：。]?\s*(?=\r?\n|$)/;

/** Safety limits to prevent pathological input from hanging the UI. */
const MAX_FILES = 200;

/** Known language -> default filename map (mirrors detector defaults). */
const LANG_DEFAULT_NAME: Record<string, string> = {
  python: 'main.py',
  javascript: 'script.js',
  typescript: 'index.ts',
  json: 'data.json',
  yaml: 'config.yaml',
  html: 'index.html',
  css: 'style.css',
  sql: 'query.sql',
  shell: 'script.sh',
  bash: 'script.sh',
  sh: 'script.sh',
  dockerfile: 'Dockerfile',
  cpp: 'main.cpp',
  'c++': 'main.cpp',
  java: 'Main.java',
  go: 'main.go',
  rust: 'main.rs',
  markdown: 'README.md',
  md: 'README.md',
  text: 'note.txt',
  txt: 'note.txt',
  xml: 'document.xml',
  toml: 'config.toml',
  ini: 'config.ini',
  php: 'index.php',
  ruby: 'main.rb',
  rb: 'main.rb',
  kotlin: 'Main.kt',
  swift: 'main.swift',
  scala: 'Main.scala',
  lua: 'main.lua',
  r: 'main.R',
  graphql: 'schema.graphql',
  proto: 'proto.proto',
};

/** Map of language aliases to canonical extension (without dot). */
const LANG_EXT: Record<string, string> = {
  python: 'py',
  py: 'py',
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  html: 'html',
  css: 'css',
  sql: 'sql',
  shell: 'sh',
  bash: 'sh',
  sh: 'sh',
  dockerfile: 'Dockerfile',
  docker: 'Dockerfile',
  cpp: 'cpp',
  'c++': 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  c: 'c',
  java: 'java',
  go: 'go',
  rust: 'rs',
  rs: 'rs',
  markdown: 'md',
  md: 'md',
  text: 'txt',
  txt: 'txt',
  xml: 'xml',
  toml: 'toml',
  ini: 'ini',
  php: 'php',
  ruby: 'rb',
  rb: 'rb',
  kotlin: 'kt',
  swift: 'swift',
  scala: 'scala',
  lua: 'lua',
  r: 'R',
  graphql: 'graphql',
  proto: 'proto',
};

const EXT_BY_LANG: Record<string, string> = Object.fromEntries(
  Object.entries(LANG_EXT).map(([k, v]) => [k, v.startsWith('.') ? v : `.${v}`])
);

/** Parse the info string of a fence: `python filename="app.py" title=foo`. */
interface FenceInfo {
  language: string;
  attrs: Record<string, string>;
  /** Bare positional token after the language, if any (e.g. `app.py`). */
  positional?: string;
}

function parseFenceInfo(info: string): FenceInfo {
  const trimmed = info.trim();
  const result: FenceInfo = { language: '', attrs: {} };

  if (!trimmed) return result;

  // Tokenize: quoted strings, key=value, bare words.
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3] ?? '');
  }

  if (tokens.length === 0) return result;

  // First token is the language only if it looks like a lang id — no dots
  // or path separators (so `app.py` is NOT treated as a language name).
  const first = tokens[0];
  if (/^[A-Za-z0-9+#-]+$/.test(first) && !first.includes('=')) {
    result.language = first.toLowerCase();
    tokens.shift();
  } else if (!first.includes('=') && looksLikeFilename(first)) {
    // First token is actually a filename (e.g. ```app.py)
    result.positional = first;
  }

  for (const tok of tokens) {
    const eq = tok.indexOf('=');
    if (eq > 0) {
      const key = tok.slice(0, eq).trim().toLowerCase();
      const val = tok.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key) result.attrs[key] = val;
    } else if (tok && !result.positional) {
      // Bare token after language — treat as candidate filename.
      result.positional = tok;
    }
  }

  return result;
}

/** Heuristic: does `line` look like a bare filename? e.g. `app.py`, `src/utils.ts`. */
function looksLikeFilename(line: string): boolean {
  const s = line.trim().replace(/^['"]|['"]$/g, '');
  if (!s) return false;
  if (s.length > 128) return false;
  // Must contain a dot OR be a known extensionless name like Dockerfile.
  const knownNoExt = /^(dockerfile|makefile|rakefile|gemfile)$/i;
  if (knownNoExt.test(s)) return true;
  // Allow path-like with extension on last segment.
  if (!/\.[a-zA-Z0-9]{1,8}$/.test(s)) return false;
  // Reject sentences (spaces / punctuation beyond path chars).
  if (/[?!;,:]|^\s*$/.test(s)) return false;
  if (s.split(/\s+/).length > 1) return false;
  // Reject if it looks like prose ending with a period.
  if (/\.$/.test(s) && !/\.[a-zA-Z0-9]{1,8}$/.test(s)) return false;
  return true;
}

/** Strip markdown heading markers and emphasis from a line. */
function cleanHeadingLine(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[*_>`]+\s*/, '')
    .replace(/[*_`]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}

/** Infer a filename from the prose immediately preceding a fence. */
function inferNameFromPrecedingText(preceding: string): string | null {
  const lines = preceding.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // Walk the last few non-empty lines, prefer the closest filename-like line.
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 3; i--) {
    const raw = lines[i];
    // Heading line: `### app.py` or `### File: app.py`
    if (/^#{1,6}\s+/.test(raw)) {
      const cleaned = cleanHeadingLine(raw)
        .replace(/^(file|filename|path|文件|文件名|路径)[:：]?\s*/i, '');
      if (looksLikeFilename(cleaned)) return cleaned;
      // Heading without extension but a known no-ext name (Dockerfile, Makefile)
      if (cleaned && /^(dockerfile|makefile|rakefile|gemfile)$/i.test(cleaned)) return cleaned;
    }
    // Bold label line: **app.py** or `app.py`
    const stripped = raw.replace(/^[*`>]+\s*/, '').replace(/[*`]/g, '').trim();
    if (looksLikeFilename(stripped)) return stripped;
    // Bare filename line
    if (looksLikeFilename(raw)) return raw;
  }

  return null;
}

/** Resolve a filename for a fence, given info + preceding text. */
function resolveFilename(
  info: FenceInfo,
  preceding: string,
  body: string
): { path: string; source: ParsedFile['nameSource'] } {
  // 1. fence attribute: filename= / file= / path= / title=
  const attrKeys = ['filename', 'file', 'path', 'title', 'name'];
  for (const k of attrKeys) {
    const v = info.attrs[k];
    if (v) {
      return { path: normalizePath(v), source: 'fence-attr' };
    }
  }
  // 1b. positional token after language
  if (info.positional && looksLikeFilename(info.positional)) {
    return { path: normalizePath(info.positional), source: 'fence-attr' };
  }

  // 2. preceding text
  const fromPreceding = inferNameFromPrecedingText(preceding);
  if (fromPreceding) {
    return { path: normalizePath(fromPreceding), source: 'heading' };
  }

  // 3. infer from language
  const lang = info.language || detectLanguageFromBody(body);
  const defaultName = LANG_DEFAULT_NAME[lang] || `file.${LANG_EXT[lang] || 'txt'}`;
  return { path: normalizePath(defaultName), source: 'inferred' };
}

/** Detect language id from code body using a lightweight local heuristic.
 *  (Avoids importing detector to prevent a circular dependency.) */
function detectLanguageFromBody(body: string): string {
  const t = body.trim();
  if (!t) return 'text';
  if (/\b(from [\w.]+ import |import [\w.]+|def |class |if __name__|print\()/m.test(t)) return 'python';
  if (/\b(const |let |var |function |=>|console\.log|require\()/m.test(t)) return 'javascript';
  if (/\b(interface |type |enum |: string|: number|as )/m.test(t)) return 'typescript';
  if (/<(html|head|body|div|span|script|style|p|a)\b/i.test(t)) return 'html';
  // CSS: `.`/`#` must be followed by an identifier letter (not a digit),
  // and the selector must not contain `(`, `)`, `/`, `}` — prevents matching
  // Python method calls and URLs (consistent with detector.ts fix).
  if (/[.#][A-Za-z_-][\w-]*[^{}()/]*\{[^}]*\}/.test(t)) return 'css';
  if (/^\s*[\[{]/.test(t) && (() => { try { JSON.parse(t); return true; } catch { return false; } })()) return 'json';
  if (/\b(FROM|RUN|COPY|CMD|ENTRYPOINT|WORKDIR|EXPOSE)\b/m.test(t)) return 'dockerfile';
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|FROM|WHERE)\b/i.test(t)) return 'sql';
  if (/\b(package main|func main|fmt\.Print|import \()/m.test(t)) return 'go';
  if (/\b(fn main|let mut|println!|use std|impl |struct )/m.test(t)) return 'rust';
  if (/\b(#include|int main|std::|using namespace|cout <<)/m.test(t)) return 'cpp';
  if (/\b(public class|public static void main|System\.out|import java)/m.test(t)) return 'java';
  if (/^\s*[\w-]+:\s/m.test(t)) return 'yaml';
  if (/^#{1,6}\s/m.test(t) || /\*\*|\[.*?\]\(.*?\)/m.test(t)) return 'markdown';
  return 'text';
}

/** Lightweight single-file inference result (path + language) for the
 *  no-fence fallback path. */
function inferSingleFile(content: string): { path: string; language: string } {
  const lang = detectLanguageFromBody(content);
  const defaultName = LANG_DEFAULT_NAME[lang] || `file.${LANG_EXT[lang] || 'txt'}`;
  return { path: normalizePath(defaultName), language: lang };
}

/** Markers that AI tools use to label code output. Matches the marker on its
 *  own line (optionally followed by a colon/period), in CN or EN. */
const OUTPUT_MARKER_RE = /(?:^|\r?\n)[ \t]*(?:输出|结果|运行结果|执行结果|输出结果|Output|Result|Console output|Stdout)\s*[:：。]?\s*(?=\r?\n|$)/g;

/** Quick (cheap) check whether content might contain multiple files.
 *  Uses a simple fence-open count + output-marker test — no full parsing.
 *  Used by detect() to avoid running parseProject on every keystroke. */
export function mightBeProject(content: string): boolean {
  if (!content) return false;
  const fenceOpens = (content.match(/(^|\r?\n)[ \t]*(`{3,}|~{3,})/g) || []).length;
  if (fenceOpens >= 2) return true;
  return OUTPUT_MARKER_TEST.test(content);
}

/** Split content on "输出：/Output:" style markers into [code, output, ...]
 *  segments. Returns at least 1 segment; only returns >1 when a marker is
 *  found AND the preceding segment is non-empty. */
function splitOnOutputMarker(content: string): string[] {
  if (!content) return [];
  const indices: number[] = [];
  OUTPUT_MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OUTPUT_MARKER_RE.exec(content)) !== null) {
    // Position right after the leading newline — this is where the marker
    // line starts, and also where the previous segment ends.
    const leadingNl = m[0].match(/^(?:\r?\n)/)?.[0].length ?? 0;
    indices.push(m.index + leadingNl);
  }
  if (indices.length === 0) return [content];

  const segments: string[] = [];
  let prev = 0;
  for (const idx of indices) {
    if (idx > prev) segments.push(content.slice(prev, idx));
    // Skip past the marker line itself
    const lineEnd = content.indexOf('\n', idx);
    prev = lineEnd === -1 ? content.length : lineEnd + 1;
  }
  if (prev < content.length) segments.push(content.slice(prev));

  return segments.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Ensure a path carries an extension consistent with its language. */
function applyExtension(path: string, language: string): string {
  if (!path) return path;
  const ext = EXT_BY_LANG[language];
  if (!ext) return path;
  const extNoDot = ext.replace(/^\./, '');
  // Extensionless canonical names (Dockerfile, Makefile): never append an
  // extension; if the path already matches the name, keep it as-is.
  if (extNoDot === 'Dockerfile' || extNoDot === 'Makefile') {
    return path;
  }
  // If path already ends with a code-like extension, keep it.
  if (/\.[a-zA-Z0-9]{1,8}$/.test(path)) return path;
  return ensureExtension(path, ext);
}

/** De-duplicate file paths by appending `-2`, `-3`, ... before the extension. */
function dedupePaths(files: ParsedFile[]): ParsedFile[] {
  const seen = new Map<string, number>();
  return files.map((f) => {
    let p = f.path;
    if (!seen.has(p)) {
      seen.set(p, 1);
      return f;
    }
    const n = seen.get(p)! + 1;
    seen.set(p, n);
    const dot = p.lastIndexOf('.');
    const slash = p.lastIndexOf('/');
    const hasExt = dot > slash;
    const base = hasExt ? p.slice(0, dot) : p;
    const ext = hasExt ? p.slice(dot) : '';
    p = `${base}-${n}${ext}`;
    return { ...f, path: p };
  });
}

/**
 * Parse multi-block content into a list of virtual files.
 */
export function parseProject(content: string): ParseResult {
  if (!content || !content.trim()) {
    return { files: [], hasMultiple: false };
  }

  const files: ParsedFile[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let fenceCount = 0;

  FENCE_RE.lastIndex = 0;

  while ((match = FENCE_RE.exec(content)) !== null) {
    if (files.length >= MAX_FILES) break;
    fenceCount++;
    const preceding = content.slice(lastIndex, match.index + (match[1]?.length ?? 0));
    const info = parseFenceInfo(match[3]);
    const body = match[4].replace(/\s+$/, '');

    const { path, source } = resolveFilename(info, preceding, body);
    const language = info.language || detectLanguageFromBody(body);
    const safePath = applyExtension(path, language);

    files.push({
      path: safePath,
      language,
      content: body,
      nameSource: source,
    });

    lastIndex = FENCE_RE.lastIndex;
  }

  // No fences: try to split on "输出：/Output:" style separators that AI
  // tools use to label code + its output. Each segment becomes its own file.
  if (fenceCount === 0) {
    const segments = splitOnOutputMarker(content);
    if (segments.length > 1) {
      const segFiles: ParsedFile[] = segments.slice(0, MAX_FILES).map((seg) => {
        const { path, language } = inferSingleFile(seg);
        return {
          path,
          language,
          content: seg.trim(),
          nameSource: 'inferred' as const,
        };
      });
      return {
        files: dedupePaths(segFiles),
        hasMultiple: true,
      };
    }
    // Single segment, no output marker: one inferred file.
    const { path, language } = inferSingleFile(content);
    return {
      files: [
        {
          path,
          language,
          content: content.trim(),
          nameSource: 'inferred',
        },
      ],
      hasMultiple: false,
    };
  }

  return {
    files: dedupePaths(files),
    hasMultiple: files.length > 1,
  };
}
