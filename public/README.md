# Clip2File

Turn clipboard content into the right file, instantly.

## Build

```bash
npm install
npm run build    # tsc + gen-icons + vite build
```

## Load into Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist` folder

## Test

```bash
npm test         # 70 unit tests, all passing
```

## Features

- Detects content type automatically (text, markdown, json, python, javascript, typescript, html, css, yaml, sql, shell, dockerfile, cpp, java, go, rust)
- Generates filename and extension automatically
- Sanitizes filenames for safety
- Right-click selected text → "Save as File with Clip2File"
- Keyboard shortcuts: `Alt+S` quick-save, `Alt+Y` open popup
- Multi-file project detection → ZIP export
- Image support: clipboard images + cross-domain image download → self-contained HTML
- Settings page (macOS System Settings style): default filename, badge feedback toggle, auto-close toggle, shortcut viewer, supported formats, about
- Full dark mode support, on-device only — no data ever leaves the browser

## Privacy

All processing happens locally. See `privacy.html` (bundled in the extension) or `PRIVACY.md` in the repo.
