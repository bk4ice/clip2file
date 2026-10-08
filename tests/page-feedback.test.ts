import { afterEach, describe, expect, it, vi } from 'vitest';
import { showPageFeedback } from '../src/background/page-feedback';

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('page save feedback', () => {
  it('renders messages as text, not executable page HTML', () => {
    showPageFeedback('<img src=x onerror=bad()>', 'error', 'Close');
    const root = document.getElementById('clip2file-feedback')!.shadowRoot!;
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('<img src=x onerror=bad()>');
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('button')!.getAttribute('aria-label')).toBe('Close');
  });

  it('keeps partial and error feedback until explicitly dismissed', () => {
    vi.useFakeTimers();
    showPageFeedback('Partial', 'warning', 'Close');
    vi.advanceTimersByTime(10000);
    const host = document.getElementById('clip2file-feedback')!;
    expect(host).not.toBeNull();
    host.shadowRoot!.querySelector('button')!.click();
    expect(document.getElementById('clip2file-feedback')).toBeNull();
  });

  it('removes success feedback without removing a newer warning', () => {
    vi.useFakeTimers();
    showPageFeedback('Saved', 'success', 'Close');
    showPageFeedback('Partial', 'warning', 'Close');
    vi.advanceTimersByTime(10000);
    expect(document.getElementById('clip2file-feedback')!.shadowRoot!.textContent).toContain('Partial');
  });

  it('can be serialized and executed without module references', () => {
    const injected = new Function(`return (${showPageFeedback.toString()})('Saved', 'success', 'Close');`);
    injected();
    expect(document.getElementById('clip2file-feedback')).not.toBeNull();
  });
});
