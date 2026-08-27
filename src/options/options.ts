import { getSettings, setSettings, getCommands, DEFAULT_SETTINGS } from '../utils/storage';

const defaultTextInput = document.getElementById('default-text') as HTMLInputElement;
const badgeToggle = document.getElementById('badge-toggle') as HTMLInputElement;
const autoCloseToggle = document.getElementById('autoclose-toggle') as HTMLInputElement;
const saveBtn = document.getElementById('save-settings') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-settings') as HTMLButtonElement;
const status = document.getElementById('status') as HTMLDivElement;
const shortcutsList = document.getElementById('shortcuts-list') as HTMLDivElement;
const openShortcutsBtn = document.getElementById('open-shortcuts-btn') as HTMLButtonElement;
const versionBadge = document.getElementById('version-badge') as HTMLSpanElement;
const aboutVersion = document.getElementById('about-version') as HTMLSpanElement;
const privacyLink = document.getElementById('privacy-link-row') as HTMLDivElement;
const PRIVACY_URL = 'https://bk4ice.github.io/clip2file/';

/** --- Sidebar navigation (single-page section switcher) --- */
const navItems = document.querySelectorAll<HTMLButtonElement>('.nav-item');
const sections = document.querySelectorAll<HTMLElement>('.content-section');

function activateSection(targetId: string): void {
  navItems.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.target === targetId);
  });
  sections.forEach((sec) => {
    sec.classList.toggle('is-active', sec.id === targetId);
  });
}

navItems.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    if (target) activateSection(target);
  });
});

function showStatus(message: string, type: 'success' | 'error' = 'success'): void {
  status.textContent = message;
  status.className = `inline-status ${type}`;
  status.classList.remove('hidden');
  setTimeout(() => status.classList.add('hidden'), 2500);
}

async function loadShortcuts(): Promise<void> {
  try {
    const commands = await getCommands();
    shortcutsList.innerHTML = '';
    for (const cmd of commands) {
      const item = document.createElement('div');
      item.className = 'shortcut-item';

      const desc = document.createElement('span');
      desc.className = 'shortcut-desc';
      desc.textContent = cmd.description || cmd.name || '';

      const key = document.createElement('span');
      const shortcut = cmd.shortcut || '';
      key.className = `shortcut-key${shortcut ? '' : ' unset'}`;
      key.textContent = shortcut || 'Not set';

      item.appendChild(desc);
      item.appendChild(key);
      shortcutsList.appendChild(item);
    }
  } catch {
    shortcutsList.textContent = 'Unable to load shortcuts.';
  }
}

function loadMeta(): void {
  try {
    const manifest = chrome.runtime.getManifest();
    const version = manifest.version || '1.0.0';
    versionBadge.textContent = `Version ${version}`;
    aboutVersion.textContent = version;
  } catch {
    // chrome.runtime unavailable outside extension context (shouldn't happen)
  }
}

function bindPrivacyLink(): void {
  privacyLink?.addEventListener('click', (e) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      chrome.tabs?.create({ url: PRIVACY_URL, active: true });
    } else {
      activateSection('section-privacy');
    }
  });
  privacyLink?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateSection('section-privacy');
    }
  });
  privacyLink?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    chrome.tabs?.create({ url: PRIVACY_URL, active: true });
  });
}

async function load(): Promise<void> {
  const settings = await getSettings();
  defaultTextInput.value = settings.defaultTextName;
  badgeToggle.checked = settings.badgeFeedback;
  autoCloseToggle.checked = settings.autoCloseOnSave;
  await loadShortcuts();
  loadMeta();
  bindPrivacyLink();
}

saveBtn.addEventListener('click', async () => {
  const value = defaultTextInput.value.trim() || 'untitled';
  await setSettings({
    defaultTextName: value,
    badgeFeedback: badgeToggle.checked,
    autoCloseOnSave: autoCloseToggle.checked,
  });
  showStatus('Settings saved', 'success');
});

resetBtn.addEventListener('click', async () => {
  defaultTextInput.value = DEFAULT_SETTINGS.defaultTextName;
  badgeToggle.checked = DEFAULT_SETTINGS.badgeFeedback;
  autoCloseToggle.checked = DEFAULT_SETTINGS.autoCloseOnSave;
  await setSettings({ ...DEFAULT_SETTINGS });
  showStatus('Restored default settings', 'success');
});

openShortcutsBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

document.addEventListener('DOMContentLoaded', load);
