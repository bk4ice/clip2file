import { describe, it, expect } from 'vitest';
import { detect } from '../src/core/detector';

describe('detect', () => {
  it('detects plain text', () => {
    const result = detect('hello world');
    expect(result.type).toBe('text');
    expect(result.extension).toBe('.txt');
  });

  it('detects python', () => {
    const result = detect('def hello():\n    print("hello")');
    expect(result.language).toBe('python');
    expect(result.extension).toBe('.py');
    expect(result.suggestedFilename).toBe('main.py');
  });

  it('detects json', () => {
    const result = detect('{"name":"test"}');
    expect(result.type).toBe('json');
    expect(result.extension).toBe('.json');
  });

  it('detects markdown', () => {
    const result = detect('# Hello\n\nThis is a test.');
    expect(result.type).toBe('markdown');
    expect(result.extension).toBe('.md');
  });

  it('detects html', () => {
    const result = detect('<div>hello</div>');
    expect(result.language).toBe('html');
    expect(result.extension).toBe('.html');
  });

  it('detects python with dict-heavy mem0 config (not css)', () => {
    const code = [
      'import json',
      'from mem0 import Memory',
      '',
      'config = {',
      '    "llm": {',
      '        "provider": "openai",',
      '        "config": {"model": "qwen-plus", "temperature": 0.2, "max_tokens": 2000, "top_p": 1.0},',
      '    },',
      '    "embedder": {',
      '        "provider": "openai",',
      '        "config": {"model": "text-embedding-v4", "embedding_dims": 1536},',
      '    },',
      '}',
      '',
      'm = Memory.from_config(config_dict=config)',
      'm.add(messages, user_id="alice", metadata={"category": "movies"})',
      'memories = m.search(query="movie", user_id="alice")',
      'print(json.dumps(memories, indent=2))',
    ].join('\n');
    const result = detect(code);
    expect(result.language).toBe('python');
    expect(result.extension).toBe('.py');
    expect(result.suggestedFilename).toBe('main.py');
  });

  it('detects multi-file project and infers zip filename from heading', () => {
    const input = [
      '# My FastAPI Project',
      '',
      'app.py',
      '```python',
      'print(1)',
      '```',
      '',
      'requirements.txt',
      '```txt',
      'fastapi',
      '```',
    ].join('\n');
    const result = detect(input);
    expect(result.type).toBe('project');
    expect(result.extension).toBe('.zip');
    expect(result.suggestedFilename).toBe('My FastAPI Project.zip');
  });

  it('does not detect project for single fenced block', () => {
    const result = detect('```python\nprint(1)\n```');
    expect(result.type).not.toBe('project');
  });
});
