import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, rmSync } from 'fs';

function postBuild() {
  return {
    name: 'clip2file-postbuild',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');

      // Vite emits popup.html and options.html at dist/<name>/<name>.html,
      // with JS/CSS/chunks at the dist root (../<name>.js, ../assets/, ../chunks/).
      // We rename them to index.html (so Chrome finds the entry page) but keep
      // them inside their subfolder, so the ../ paths must stay as-is — only
      // the filename changes.
      for (const name of ['popup', 'options']) {
        const htmlPath = resolve(dist, `${name}/${name}.html`);
        let html: string;
        try {
          html = readFileSync(htmlPath, 'utf-8');
        } catch {
          continue;
        }

        writeFileSync(resolve(dist, `${name}/index.html`), html);
        rmSync(htmlPath);
      }
    }
  };
}

export default defineConfig({
  base: './',
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        options: resolve(__dirname, 'src/options/options.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name ?? '';
          if (info.endsWith('.css')) return 'assets/[name][extname]';
          return 'assets/[name][extname]';
        }
      }
    }
  },
  publicDir: '../public',
  plugins: [postBuild()]
});
