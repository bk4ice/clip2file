const FALLBACK_MESSAGES: Record<string, string> = {
  manifestName: 'Clip2File',
  manifestDescription: 'Turn clipboard content into the right file, instantly.',
  commandQuickSave: 'Quick save current selection (or clipboard) as a file',
  commandOpenPopup: 'Open Clip2File popup',
  menuRoot: 'Clip2File',
  menuSmartSave: 'Smart Save',
  menuSaveAs: 'Save as...',
  menuPlainText: 'Plain Text',
  menuMarkdown: 'Markdown (images in ZIP)',
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
  selectionMissingImage: 'Image unavailable',
  selectionComplexTable: 'Merged or irregular tables are preserved as HTML in Markdown; some editors may not display them.',
  selectionDownloadRequested: 'Generated $1 with $2 images and $3 tables. Download requested.',
  selectionPartialImages: '$1 images could not be saved. Their positions are marked in the document.',
  selectionFilesRequested: 'Generated $1 with $2 files. Download requested.',
  selectionZipPartialImages: '$1 images could not be saved. See the export warnings file in the ZIP.',
  selectionTextRequested: 'Generated $1 as plain text; formatting and links are not retained. Download requested.',
  selectionFileRequested: 'Generated $1. Download requested.',
  selectionProjectRequiresZip: 'Multiple files detected. Please use ZIP or Smart Save.',
  selectionTextCannotSaveImages: 'Plain text cannot retain images. Please use HTML or Markdown.',
  selectionRestrictedPage: 'This page does not allow access. Copy the content and save it from the extension panel.',
  selectionSaveFailed: 'Unable to save this selection. Try again on a regular web page, or copy it to the extension panel.',
  selectionTooLarge: 'This selection is too large. Please select a smaller section.',
  selectionClose: 'Close',
  popupRateUs: 'Rate Clip2File',
  popupRateUsTitle: 'Rate on Chrome Web Store',
  popupFeedback: 'Feedback',
  popupFeedbackTitle: 'Report issues or suggest features on GitHub',
  optionsSupport: 'Support Clip2File',
  optionsRateUs: 'Rate on Chrome Web Store',
  optionsRateUsHint: 'A quick rating helps more people discover it',
  optionsSendFeedback: 'Report issue / suggest a feature',
  optionsSendFeedbackHint: 'GitHub Issues, or email bk4ice@gmail.com',
  optionsOpenLink: 'Open →',
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
