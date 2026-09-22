const FALLBACK_MESSAGES: Record<string, string> = {
  manifestName: 'Clip2File',
  manifestDescription: 'Turn clipboard content into the right file, instantly.',
  commandQuickSave: 'Quick save current selection (or clipboard) as a file',
  commandOpenPopup: 'Open Clip2File popup',
  menuRoot: 'Clip2File',
  menuSmartSave: 'Smart Save',
  menuSaveAs: 'Save as...',
  menuPlainText: 'Plain Text',
  menuMarkdown: 'Markdown',
  menuHtml: 'HTML',
  menuZip: 'ZIP',
  popupSettings: 'Settings',
  optionsTitle: 'Clip2File Settings',
  popupTypeText: 'Type: Text',
  typeText: 'Text',
  typeMarkdown: 'Markdown',
  typeJson: 'JSON',
  typeYaml: 'YAML',
  typeProject: 'Project',
  popupSaveFile: 'Save File',
  statusNothingToSave: 'Nothing to save',
  statusSavedAs: 'Saved as $1',
  statusSaveFailed: 'Save failed',
  statusBuilding: 'Building…',
  statusSavedImages: 'Saved as $1 ($2 images embedded)',
  statusZipping: 'Zipping…',
  statusNoSafeFiles: 'No safe files to zip',
  statusSavedFiles: 'Saved $1 files as $2',
  statusNoFilesSelected: 'No files selected',
  statusGeneratedZip: 'Generated $1 with $2 files$3',
  optionsNotSet: 'Not set',
  optionsShortcutsLoadFailed: 'Unable to load shortcuts.',
  optionsSettingsSaved: 'Settings saved',
  optionsDefaultsRestored: 'Restored default settings',
};

function getMessage(key: string, substitutions?: string | string[]): string {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
    const message = chrome.i18n.getMessage(key, substitutions);
    if (message) return message;
  }
  const values = typeof substitutions === 'string' ? [substitutions] : substitutions || [];
  return (FALLBACK_MESSAGES[key] || key).replace(/\$(\d+)/g, (_, index: string) => values[Number(index) - 1] || '');
}

export function t(key: string, substitutions?: string | string[]): string {
  return getMessage(key, substitutions);
}

export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n || '');
  });
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-placeholder]').forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder || '');
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
    element.title = t(element.dataset.i18nTitle || '');
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel || ''));
  });
}
