// @vitest-environment jsdom
/**
 * Save watchdog: a hung disk write must produce feedback (warning
 * notice at the warn threshold, Save As escalation at the dialog
 * threshold) while fast writes stay silent and real errors propagate
 * unchanged to the caller's EMODIFIED/ENOENT/ELOCKED handling.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/editor/status-notices.js', () => ({ postNotice: vi.fn() }));
vi.mock('../../src/editor/text-prompt.js', () => ({ promptForRouteChoice: vi.fn() }));

import { postNotice } from '../../src/editor/status-notices.js';
import { promptForRouteChoice } from '../../src/editor/text-prompt.js';
import { awaitWithSaveWatchdog } from '../../src/editor/save-watchdog.js';

const notice = vi.mocked(postNotice);
const prompt = vi.mocked(promptForRouteChoice);

beforeEach(() => {
  vi.useFakeTimers();
  notice.mockClear();
  prompt.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

const hung = (): Promise<void> => new Promise<void>(() => {});

describe('awaitWithSaveWatchdog', () => {
  it('a fast write resolves done with no notice and no dialog', async () => {
    const result = await awaitWithSaveWatchdog(Promise.resolve(), 'a.cmir', {
      escalate: true,
      warnMs: 100,
      dialogMs: 200,
    });
    expect(result).toBe('done');
    await vi.advanceTimersByTimeAsync(500);
    expect(notice).not.toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
  });

  it('a hung write posts the warning at the threshold', async () => {
    void awaitWithSaveWatchdog(hung(), 'a.cmir', { escalate: false, warnMs: 100 });
    await vi.advanceTimersByTimeAsync(99);
    expect(notice).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(notice).toHaveBeenCalledTimes(1);
    expect(notice.mock.calls[0]![0].severity).toBe('warning');
    expect(notice.mock.calls[0]![0].key).toBe('slow-save:a.cmir');
  });

  it('escalates to the dialog; Save As resolves saveAs', async () => {
    prompt.mockResolvedValue('saveAs');
    const p = awaitWithSaveWatchdog(hung(), 'a.cmir', {
      escalate: true,
      warnMs: 100,
      dialogMs: 200,
    });
    await vi.advanceTimersByTimeAsync(201);
    expect(prompt).toHaveBeenCalledTimes(1);
    await expect(p).resolves.toBe('saveAs');
  });

  it('never shows the dialog when escalation is off (autosave)', async () => {
    void awaitWithSaveWatchdog(hung(), 'a.cmir', {
      escalate: false,
      warnMs: 100,
      dialogMs: 200,
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(prompt).not.toHaveBeenCalled();
    expect(notice).toHaveBeenCalledTimes(1); // warning only
  });

  it('a write settling while the dialog is open wins and CLOSES the dialog', async () => {
    // Mirror the real prompt's abort behavior: resolve null on abort.
    let answer: (v: 'saveAs' | 'wait' | null) => void = () => {};
    let dialogSignal: AbortSignal | undefined;
    prompt.mockImplementation(((opts: { signal?: AbortSignal }) => {
      dialogSignal = opts.signal;
      return new Promise((r) => {
        answer = r as typeof answer;
        opts.signal?.addEventListener('abort', () => r(null), { once: true });
      });
    }) as unknown as typeof promptForRouteChoice);
    let settle: () => void = () => {};
    const write = new Promise<void>((r) => (settle = r));
    const p = awaitWithSaveWatchdog(write, 'a.cmir', {
      escalate: true,
      warnMs: 50,
      dialogMs: 100,
    });
    await vi.advanceTimersByTimeAsync(101); // dialog now open
    expect(dialogSignal?.aborted).toBe(false);
    settle();
    await expect(p).resolves.toBe('done');
    // The settled write aborts the dialog — it closes itself.
    expect(dialogSignal?.aborted).toBe(true);
    answer('saveAs'); // impossible late click — must change nothing
  });

  it('propagates the write rejection unchanged in effect', async () => {
    const p = awaitWithSaveWatchdog(
      Promise.reject(new Error('EMODIFIED: changed on disk')),
      'a.cmir',
      { escalate: true, warnMs: 100, dialogMs: 200 },
    );
    await expect(p).rejects.toThrow('EMODIFIED');
    await vi.advanceTimersByTimeAsync(500);
    expect(notice).not.toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
  });
});
