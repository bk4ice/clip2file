import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['tests/selection.test.ts', 'jsdom'], ['tests/selection-builder.test.ts', 'jsdom'], ['tests/page-feedback.test.ts', 'jsdom']]
  }
});
