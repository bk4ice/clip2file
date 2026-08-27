export interface DetectResult {
  type: 'text' | 'code' | 'markdown' | 'json' | 'yaml' | 'project';
  language: string;
  extension: string;
  suggestedFilename: string;
  confidence: number;
  content: string;
}

export interface LanguageRule {
  name: string;
  extension: string;
  keywords: RegExp;
  weight: number;
}

/** A single parsed file extracted from multi-block content (Phase 2). */
export interface ParsedFile {
  /** Project-relative path, e.g. `src/app.py`. Always normalized & safe. */
  path: string;
  /** Detected or declared language id, e.g. `python`. */
  language: string;
  /** Raw file content (no fence). For text files this is a string; for
   *  binary files (images) this is an empty string and `blob` is set. */
  content: string;
  /** Binary content (images). When set, `content` is empty. */
  blob?: Blob;
  /** MIME type for binary files, e.g. `image/png`. */
  mimeType?: string;
  /** Where the filename came from. */
  nameSource: 'fence-attr' | 'heading' | 'inline-label' | 'inferred' | 'clipboard-image';
}

/** Result of parsing multi-block content into a virtual project. */
export interface ParseResult {
  files: ParsedFile[];
  /** True when at least one code fence was found. */
  hasMultiple: boolean;
}
