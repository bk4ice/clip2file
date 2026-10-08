import { test, expect, chromium, type BrowserContext, type Worker, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import JSZip from 'jszip';

let server: Server;
let base: string;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6KgAAAABJRU5ErkJggg==', 'base64');

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/image.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(png); return; }
    if (req.url === '/missing.png') { res.writeHead(404); res.end(); return; }
    if (req.url === '/frame') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<iframe src="/inner"></iframe>'); return; }
    if (req.url === '/image-only') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<main id="content"><img src="/image.png" alt="only"></main>'); return; }
    const missing = req.url?.includes('missing');
    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end(`<!DOCTYPE html><html><body><main id="content"><h2>Selected title</h2><p>Before <a href="/reference">reference</a></p><img alt="figure" src="/${missing ? 'missing' : 'image'}.png"><p>After</p><ul><li>first<ul><li>nested</li></ul></li></ul><table><tr><th>Name</th><th>Value</th></tr><tr><td>A</td><td>B</td></tr></table></main></body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

async function launch(locale = 'en-US'): Promise<{ context: BrowserContext; worker: Worker; profile: string }> {
  const profile = await mkdtemp(join(tmpdir(), 'clip2file-e2e-'));
  const extension = join(profile, 'extension');
  await cp(resolve('dist'), extension, { recursive: true });
  const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
  manifest.background.service_worker = 'background-probe.js';
  await writeFile(join(extension, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(join(extension, 'probe-hook.js'), `const event = chrome.contextMenus.onClicked; const register = event.addListener; event.addListener = function(listener) { globalThis.invokeSelectionSave = listener; return register.call(event, listener); }; const command = chrome.commands.onCommand; const registerCommand = command.addListener; command.addListener = function(listener) { globalThis.invokeQuickSave = listener; return registerCommand.call(command, listener); };`);
  await writeFile(join(extension, 'background-probe.js'), `import './probe-hook.js'; import './background.js';`);
  const context = await chromium.launchPersistentContext(join(profile, 'browser'), {
    channel: 'chromium', headless: true, locale,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, `--lang=${locale}`],
    acceptDownloads: true,
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await expect.poll(() => worker.evaluate(() => typeof (globalThis as any).invokeSelectionSave)).toBe('function');
  return { context, worker, profile };
}

async function select(page: Page): Promise<void> {
  await page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('#content')!);
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
  });
}

async function save(worker: Worker, page: Page, mode: string): Promise<void> {
  const url = page.url();
  await worker.evaluate(async ({ url, mode }) => {
    const root = globalThis as any;
    const tabs = await root.chrome.tabs.query({ url });
    await root.invokeSelectionSave({ menuItemId: mode, frameId: 0 }, { id: tabs[0].id });
  }, { url, mode });
}

async function bytes(download: import('@playwright/test').Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

for (const locale of ['en-US', 'zh-CN']) {
  test(`MV3 HTML and Markdown downloads preserve the selection (${locale})`, async () => {
    const { context, worker, profile } = await launch(locale);
    try {
      const page = await context.newPage();
      await page.goto(base + '/');
      await select(page);
      const htmlDownload = page.waitForEvent('download');
      await save(worker, page, 'clip2file-format-html');
      const html = (await bytes(await htmlDownload)).toString('utf8');
      expect(html.indexOf('Before')).toBeLessThan(html.indexOf('<img'));
      expect(html.indexOf('<img')).toBeLessThan(html.indexOf('After'));
      expect(html).toContain('<table>');
      expect(html).toContain('data:image/png;base64,');
      const offline = await context.newPage();
      await offline.setContent(html);
      await expect(offline.locator('img')).toHaveJSProperty('naturalWidth', 1);
      await select(page);
      const mdDownload = page.waitForEvent('download');
      await save(worker, page, 'clip2file-format-markdown');
      const download = await mdDownload;
      expect(download.suggestedFilename()).toMatch(/\.zip$/);
      const zip = await JSZip.loadAsync(await bytes(download));
      const md = await zip.file('content.md')!.async('string');
      expect(md).toContain('![figure](assets/image-1.png)');
      expect(md).toContain('| Name | Value |');
      expect(Buffer.from(await zip.file('assets/image-1.png')!.async('uint8array'))).toEqual(png);
      const popup = await context.newPage();
      const id = worker.url().split('/')[2];
      await popup.goto(`chrome-extension://${id}/popup/index.html`);
      const uiLanguage = await worker.evaluate(() => (globalThis as any).chrome.i18n.getUILanguage());
      expect(uiLanguage.toLowerCase().startsWith(locale.split('-')[0])).toBe(true);
      await expect(popup.locator('#save-btn')).toContainText(uiLanguage.startsWith('zh') ? '保存文件' : 'Save File');
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  });
}

test('MV3 reports missing images and refuses lossy TXT output', async () => {
  const { context, worker, profile } = await launch();
  try {
    const page = await context.newPage();
    await page.goto(base + '/?missing=1');
    await select(page);
    const download = page.waitForEvent('download');
    await save(worker, page, 'clip2file-format-html');
    expect((await bytes(await download)).toString()).toContain('Image unavailable');
    await expect(page.locator('#clip2file-feedback').locator('section')).toHaveClass('warning');
    await page.locator('#clip2file-feedback').getByRole('button', { name: 'Close' }).click();
    await select(page);
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await save(worker, page, 'clip2file-format-text');
    await expect(page.locator('#clip2file-feedback').locator('section')).toHaveClass('error');
    expect(downloaded).toBe(false);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('MV3 uses the selected iframe rather than the top page', async () => {
  const { context, worker, profile } = await launch();
  try {
    const page = await context.newPage();
    await page.goto(base + '/frame');
    const frame = page.frames().find((frame) => frame.url().endsWith('/inner'))!;
    await frame.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('#content')!);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
    });
    const download = page.waitForEvent('download');
    await worker.evaluate(async (url) => {
      const root = globalThis as any;
      const [tab] = await root.chrome.tabs.query({ url });
      const frames = await root.chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: () => Boolean(document.querySelector('#content')) });
      const selected = frames.find((frame: any) => frame.result);
      await root.invokeSelectionSave({ menuItemId: 'clip2file-format-html', frameId: selected.frameId }, { id: tab.id });
    }, page.url());
    expect((await bytes(await download)).toString()).toContain('Selected title');
    await expect(frame.locator('#clip2file-feedback').locator('section')).toHaveClass('success');
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('MV3 quick-save handler retains an image-only selection', async () => {
  const { context, worker, profile } = await launch();
  try {
    const page = await context.newPage();
    await page.goto(base + '/image-only');
    await page.bringToFront();
    await select(page);
    const download = page.waitForEvent('download');
    await worker.evaluate(async () => { await (globalThis as any).invokeQuickSave('quick-save'); });
    expect((await bytes(await download)).toString()).toContain('data:image/png;base64,');
    await expect(page.locator('#clip2file-feedback').locator('section')).toHaveClass('success');
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('MV3 restricted-page failure remains visible in the extension tooltip', async () => {
  const { context, worker, profile } = await launch();
  try {
    const page = await context.newPage();
    await page.goto('chrome://version/');
    await page.bringToFront();
    const title = await worker.evaluate(async () => {
      const root = globalThis as any;
      const [tab] = await root.chrome.tabs.query({ active: true, currentWindow: true });
      await root.invokeSelectionSave({ menuItemId: 'clip2file-format-html', frameId: 0 }, { id: tab.id });
      return root.chrome.action.getTitle({});
    });
    expect(title).toContain('extension panel');
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
