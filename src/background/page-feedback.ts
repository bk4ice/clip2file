export function showPageFeedback(message: string, type: 'success' | 'warning' | 'error', closeLabel: string): void {
  document.getElementById('clip2file-feedback')?.remove();
  const host = document.createElement('div');
  host.id = 'clip2file-feedback';
  host.style.cssText = 'all:initial!important;position:fixed!important;bottom:24px!important;right:24px!important;z-index:2147483647!important;display:block!important;max-width:calc(100vw - 48px)!important;';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = ':host{color-scheme:light dark}section{box-sizing:border-box;display:flex;align-items:flex-start;gap:12px;width:max-content;max-width:min(440px,calc(100vw - 48px));padding:14px 16px;border:1px solid #888;border-radius:12px;background:#fff;color:#222;box-shadow:0 4px 24px #0003;font:14px/1.5 system-ui,sans-serif;overflow-wrap:anywhere}section.warning{border-color:#b45309}section.error{border-color:#dc2626}button{flex:none;background:transparent;border:0;color:inherit;cursor:pointer;font:20px/1 system-ui;padding:4px}button:focus-visible{outline:2px solid #2563eb}p{margin:0;white-space:pre-wrap}@media(prefers-color-scheme:dark){section{background:#252525;color:#eee}}';
  const panel = document.createElement('section');
  panel.className = type;
  panel.setAttribute('role', type === 'success' ? 'status' : 'alert');
  const text = document.createElement('p');
  text.textContent = 'Clip2File — ' + message;
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', closeLabel);
  close.textContent = '×';
  close.addEventListener('click', () => host.remove());
  panel.append(text, close);
  root.append(style, panel);
  (document.body || document.documentElement).appendChild(host);
  if (type === 'success') setTimeout(() => host.remove(), 4000);
}
