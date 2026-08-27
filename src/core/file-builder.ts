function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function downloadTextFile(filename: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const dataUrl = await blobToBase64(blob);

  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[Clip2File] download failed:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (downloadId === undefined) {
        reject(new Error('Download was cancelled or blocked'));
        return;
      }

      resolve();
    });
  });
}
