import { describe, it, expect } from 'vitest';
import { parseProject } from '../src/core/parser';

describe('parseProject', () => {
  it('returns empty for empty input', () => {
    expect(parseProject('').files).toHaveLength(0);
  });

  it('treats fenceless content as a single inferred file', () => {
    const r = parseProject('def hello():\n    print("hi")');
    expect(r.files).toHaveLength(1);
    expect(r.hasMultiple).toBe(false);
    expect(r.files[0].path).toBe('main.py');
  });

  it('parses a single fenced block and infers filename from language', () => {
    const r = parseProject('```python\nprint("hi")\n```');
    expect(r.files).toHaveLength(1);
    expect(r.files[0].language).toBe('python');
    expect(r.files[0].path).toBe('main.py');
    expect(r.files[0].nameSource).toBe('inferred');
  });

  it('reads filename from fence attribute filename=', () => {
    const r = parseProject('```python filename="app.py"\nprint(1)\n```');
    expect(r.files[0].path).toBe('app.py');
    expect(r.files[0].nameSource).toBe('fence-attr');
  });

  it('reads filename from bare positional token after language', () => {
    const r = parseProject('```python src/utils.py\nimport os\n```');
    expect(r.files[0].path).toBe('src/utils.py');
    expect(r.files[0].nameSource).toBe('fence-attr');
  });

  it('reads filename from preceding heading', () => {
    const r = parseProject('### app.py\n```python\nprint(1)\n```');
    expect(r.files[0].path).toBe('app.py');
    expect(r.files[0].nameSource).toBe('heading');
  });

  it('reads filename from preceding bare filename line', () => {
    const r = parseProject('requirements.txt\n```txt\nfastapi\nuvicorn\n```');
    expect(r.files[0].path).toBe('requirements.txt');
    expect(r.files[0].nameSource).toBe('heading');
  });

  it('parses multiple fenced blocks into multiple files', () => {
    const input = [
      'app.py',
      '```python',
      'print(1)',
      '```',
      '',
      'requirements.txt',
      '```txt',
      'fastapi',
      'uvicorn',
      '```',
      '',
      'Dockerfile',
      '```dockerfile',
      'FROM python:3.12',
      '```',
    ].join('\n');
    const r = parseProject(input);
    expect(r.hasMultiple).toBe(true);
    expect(r.files).toHaveLength(3);
    expect(r.files.map((f) => f.path)).toEqual([
      'app.py',
      'requirements.txt',
      'Dockerfile',
    ]);
  });

  it('dedupes identical paths with numeric suffixes', () => {
    const input = [
      '```python filename="app.py"',
      'print(1)',
      '```',
      '```python filename="app.py"',
      'print(2)',
      '```',
    ].join('\n');
    const r = parseProject(input);
    expect(r.files).toHaveLength(2);
    expect(r.files[0].path).toBe('app.py');
    expect(r.files[1].path).toBe('app-2.py');
  });

  it('strips fence body trailing whitespace', () => {
    const input = '```python\nprint(1)\n   \n```';
    const r = parseProject(input);
    expect(r.files[0].content).toBe('print(1)');
  });

  it('ignores prose between blocks', () => {
    const input = [
      'Here is the code:',
      '',
      '```python filename="a.py"',
      'x = 1',
      '```',
      '',
      'And another file below.',
      '',
      '```python filename="b.py"',
      'y = 2',
      '```',
    ].join('\n');
    const r = parseProject(input);
    expect(r.files).toHaveLength(2);
    expect(r.files.map((f) => f.path)).toEqual(['a.py', 'b.py']);
  });

  it('splits code + output (no fences) into multiple files', () => {
    const input = [
      'import json',
      'from mem0 import Memory',
      'config = {"llm": {"model": "qwen-plus"}}',
      'm = Memory.from_config(config_dict=config)',
      'memories = m.search(query="movie", user_id="alice")',
      'print(json.dumps(memories, indent=2))',
      '',
      '输出：',
      '{',
      '  "results": [',
      '    {"id": "abc", "memory": "喜欢科幻电影", "score": 0.6}',
      '  ]',
      '}',
    ].join('\n');
    const r = parseProject(input);
    expect(r.hasMultiple).toBe(true);
    expect(r.files).toHaveLength(2);
    expect(r.files[0].language).toBe('python');
    expect(r.files[0].path).toBe('main.py');
    expect(r.files[1].language).toBe('json');
    expect(r.files[1].path).toBe('data.json');
  });

  it('splits on English Output: marker too', () => {
    const input = [
      'print("hello")',
      '',
      'Output:',
      'hello',
    ].join('\n');
    const r = parseProject(input);
    expect(r.hasMultiple).toBe(true);
    expect(r.files).toHaveLength(2);
    expect(r.files[0].language).toBe('python');
    expect(r.files[1].language).toBe('text');
  });

  it('does not split when no output marker present', () => {
    const r = parseProject('def hello():\n    print("hi")');
    expect(r.hasMultiple).toBe(false);
    expect(r.files).toHaveLength(1);
  });

  it('handles unclosed fence (truncated AI output)', () => {
    const r = parseProject('```python\nprint("hello")\n');
    expect(r.files).toHaveLength(1);
    expect(r.files[0].language).toBe('python');
    expect(r.files[0].content).toContain('print');
  });

  it('does not treat bare filename as language in fence info', () => {
    // ```app.py should be a filename, not language "app.py"
    const r = parseProject('```app.py\nprint(1)\n```');
    expect(r.files[0].path).toBe('app.py');
  });

  it('does not pick up prose heading as filename', () => {
    // `### Summary` is a heading but not a filename — should fall through
    // to language inference, not produce a file named "Summary".
    const r = parseProject('### Summary\n```python\nprint(1)\n```');
    expect(r.files[0].path).toBe('main.py');
    expect(r.files[0].nameSource).toBe('inferred');
  });

  it('handles CRLF line endings in fences', () => {
    const input = '```python\r\nprint(1)\r\n```\r\n```txt filename="a.txt"\r\nhi\r\n```';
    const r = parseProject(input);
    expect(r.files).toHaveLength(2);
    expect(r.files[0].path).toBe('main.py');
    expect(r.files[1].path).toBe('a.txt');
  });

  it('caps file count at MAX_FILES', () => {
    // Generate 250 fenced blocks; parser should cap at 200.
    const blocks: string[] = [];
    for (let i = 0; i < 250; i++) {
      blocks.push('```txt\nhello\n```');
    }
    const r = parseProject(blocks.join('\n\n'));
    expect(r.files.length).toBeLessThanOrEqual(200);
  });
});
