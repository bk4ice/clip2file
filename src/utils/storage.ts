export interface Settings {
  defaultTextName?: string;
  /** Flash the toolbar badge (green check / red x) after shortcut saves. */
  badgeFeedback?: boolean;
  /** Automatically close the popup a moment after a successful save. */
  autoCloseOnSave?: boolean;
}

export const DEFAULT_SETTINGS: Required<Settings> = {
  defaultTextName: 'untitled',
  badgeFeedback: true,
  autoCloseOnSave: false,
};

export function getSettings(): Promise<Required<Settings>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['defaultTextName', 'badgeFeedback', 'autoCloseOnSave'],
      (result) => {
        resolve({
          defaultTextName: result.defaultTextName ?? DEFAULT_SETTINGS.defaultTextName,
          badgeFeedback: result.badgeFeedback ?? DEFAULT_SETTINGS.badgeFeedback,
          autoCloseOnSave: result.autoCloseOnSave ?? DEFAULT_SETTINGS.autoCloseOnSave,
        });
      }
    );
  });
}

export function setSettings(settings: Settings): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(settings, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/** Get all registered keyboard shortcuts via chrome.commands API. */
export function getCommands(): Promise<chrome.commands.Command[]> {
  return new Promise((resolve) => {
    chrome.commands.getAll((commands) => resolve(commands));
  });
}
