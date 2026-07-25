// @vitest-environment jsdom
// Renderer half of external-app consent: settings mirror sync, the
// first-contact prompt (records decisions + replies), and notes
// (lastSeen stamps, unidentified-caller explanations).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/editor/toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../../src/editor/text-prompt.js', () => ({
  promptForRouteChoice: vi.fn(),
  alertDialog: vi.fn(() => Promise.resolve()),
}));

import { settings } from '../../src/editor/settings.js';
import { alertDialog, promptForRouteChoice } from '../../src/editor/text-prompt.js';
import { showToast } from '../../src/editor/toast.js';
import {
  installExternalConsent,
  recordExternalAppDecision,
} from '../../src/editor/external-consent-ui.js';

type PromptReq = {
  requestId: string;
  appId: string;
  appName: string | null;
  appVersion: string | null;
};
type Note = { kind: 'seen' | 'unidentified'; appId?: string; when?: string };

function mockBridge(): {
  synced: Array<{ enabled: boolean; apps: Record<string, string> }>;
  results: Array<{ requestId: string; outcome: string }>;
  firePrompt: (req: PromptReq) => void;
  fireNote: (note: Note) => void;
} {
  const synced: Array<{ enabled: boolean; apps: Record<string, string> }> = [];
  const results: Array<{ requestId: string; outcome: string }> = [];
  let promptHandler: ((req: PromptReq) => void) | null = null;
  let noteHandler: ((note: Note) => void) | null = null;
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    syncExternalConsent: (s: { enabled: boolean; apps: Record<string, string> }) => synced.push(s),
    onExternalConsentPrompt: (h: (req: PromptReq) => void) => {
      promptHandler = h;
      return () => {};
    },
    sendExternalConsentPromptResult: (r: { requestId: string; outcome: string }) => results.push(r),
    onExternalConsentNote: (h: (note: Note) => void) => {
      noteHandler = h;
      return () => {};
    },
  };
  return {
    synced,
    results,
    firePrompt: (req) => promptHandler?.(req),
    fireNote: (note) => noteHandler?.(note),
  };
}

const settled = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

let uninstall: (() => void) | null = null;

beforeEach(() => {
  localStorage.clear();
  settings.set('externalAppConsents', []);
  settings.set('externalInsertsEnabled', true);
  vi.mocked(promptForRouteChoice).mockReset();
  vi.mocked(alertDialog).mockClear();
  vi.mocked(showToast).mockClear();
});
afterEach(() => {
  uninstall?.();
  uninstall = null;
  delete (window as { electronAPI?: unknown }).electronAPI;
});

describe('external consent renderer bridge', () => {
  it('pushes the mirror on boot and on every settings change', () => {
    recordExternalAppDecision('ebb', 'allow');
    const bridge = mockBridge();
    uninstall = installExternalConsent();
    expect(bridge.synced).toHaveLength(1);
    expect(bridge.synced[0]).toEqual({ enabled: true, apps: { ebb: 'allow' } });
    settings.set('externalInsertsEnabled', false);
    expect(bridge.synced.at(-1)).toMatchObject({ enabled: false });
    recordExternalAppDecision('other', 'deny');
    expect(bridge.synced.at(-1)!.apps).toEqual({ ebb: 'allow', other: 'deny' });
  });

  it('Always Allow records the decision and replies allow-always', async () => {
    const bridge = mockBridge();
    uninstall = installExternalConsent();
    vi.mocked(promptForRouteChoice).mockResolvedValue('allow-always');
    bridge.firePrompt({ requestId: 'r1', appId: 'ebb', appName: 'ebb', appVersion: '0.7.1' });
    await settled();
    const msg = vi.mocked(promptForRouteChoice).mock.calls[0]![0].message;
    expect(msg).toContain('ebb v0.7.1');
    expect(bridge.results).toEqual([{ requestId: 'r1', outcome: 'allow-always' }]);
    const consents = settings.get('externalAppConsents');
    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({ id: 'ebb', decision: 'allow' });
    expect(consents[0]!.firstSeen).toBeTruthy();
  });

  it('Allow Once replies without recording anything', async () => {
    const bridge = mockBridge();
    uninstall = installExternalConsent();
    vi.mocked(promptForRouteChoice).mockResolvedValue('allow-once');
    bridge.firePrompt({ requestId: 'r1', appId: 'newapp', appName: null, appVersion: null });
    await settled();
    expect(bridge.results).toEqual([{ requestId: 'r1', outcome: 'allow-once' }]);
    expect(settings.get('externalAppConsents')).toEqual([]);
  });

  it('Deny records deny; Esc replies dismissed and records nothing', async () => {
    const bridge = mockBridge();
    uninstall = installExternalConsent();
    vi.mocked(promptForRouteChoice).mockResolvedValue('deny');
    bridge.firePrompt({ requestId: 'r1', appId: 'newapp', appName: null, appVersion: null });
    await settled();
    expect(settings.get('externalAppConsents')[0]).toMatchObject({
      id: 'newapp',
      decision: 'deny',
    });
    vi.mocked(promptForRouteChoice).mockResolvedValue(null);
    bridge.firePrompt({ requestId: 'r2', appId: 'other', appName: null, appVersion: null });
    await settled();
    expect(bridge.results.at(-1)).toEqual({ requestId: 'r2', outcome: 'dismissed' });
    expect(settings.get('externalAppConsents')).toHaveLength(1);
  });

  it('a seen note stamps lastSeen for a known app only', () => {
    recordExternalAppDecision('ebb', 'allow');
    const bridge = mockBridge();
    uninstall = installExternalConsent();
    bridge.fireNote({ kind: 'seen', appId: 'ebb', when: '2026-07-25T12:00:00.000Z' });
    expect(settings.get('externalAppConsents')[0]!.lastSeen).toBe('2026-07-25T12:00:00.000Z');
    bridge.fireNote({ kind: 'seen', appId: 'stranger', when: '2026-07-25T12:00:00.000Z' });
    expect(settings.get('externalAppConsents')).toHaveLength(1);
  });

  it('unidentified notes: dialog first, toast after', () => {
    const bridge = mockBridge();
    uninstall = installExternalConsent();
    bridge.fireNote({ kind: 'unidentified' });
    expect(alertDialog).toHaveBeenCalledOnce();
    expect(showToast).not.toHaveBeenCalled();
    bridge.fireNote({ kind: 'unidentified' });
    expect(alertDialog).toHaveBeenCalledOnce();
    expect(showToast).toHaveBeenCalledOnce();
  });

  it('no-ops cleanly when the preload lacks the consent surface', () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {};
    expect(() => {
      uninstall = installExternalConsent();
    }).not.toThrow();
  });
});
