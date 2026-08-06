// @vitest-environment jsdom
/**
 * Send pill: the bottom actions row (add contact / start session ↔ the
 * drag zones), snooze filtering, and the recent-senders drag list.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const promptForText = vi.fn(async (_opts?: unknown) => null as string | null);
vi.mock('../../src/editor/text-prompt.js', () => ({
  promptForText: (o: unknown) => promptForText(o as never),
}));
const recentSendersMock = vi.fn((): { code: string; name: string; at: number }[] => []);
vi.mock('../../src/editor/pairing/inbox-store.js', () => ({
  recentSenders: () => recentSendersMock(),
}));
vi.mock('../../src/editor/toast.js', () => ({ showToast: vi.fn() }));

import { SendPillController } from '../../src/editor/pairing/send-pill-ui.js';
import { settings } from '../../src/editor/settings.js';
import { setCollabSessionStarter } from '../../src/editor/collab/collab-hooks.js';
import { showToast } from '../../src/editor/toast.js';

function mountPill(): { pill: SendPillController; root: HTMLElement } {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const pill = new SendPillController();
  pill.mount({ parent });
  return { pill, root: parent };
}

beforeEach(() => {
  settings.set('pairingEnabled', true);
  settings.set('pairingPartners', []);
  settings.set('pairingGroups', []);
  settings.set('pairingBlockedCodes', []);
  recentSendersMock.mockReturnValue([]);
  promptForText.mockReset();
  vi.mocked(showToast).mockClear();
});

afterEach(() => {
  document.body.innerHTML = '';
  settings.set('pairingPartners', []);
  settings.set('pairingEnabled', false);
  setCollabSessionStarter(null);
});

describe('send pill actions row + snooze', () => {
  it('snoozed recipients vanish from the pill rows; groups still fan out to them', () => {
    settings.set('pairingPartners', [
      { code: 'cmk1.aaa', name: 'Awake' },
      { code: 'cmk1.bbb', name: 'Sleepy', snoozed: true },
    ]);
    settings.set('pairingGroups', [
      { id: 'g1', label: 'Team', memberCodes: ['cmk1.aaa', 'cmk1.bbb'] },
    ]);
    const { root } = mountPill();
    const rowNames = [...root.querySelectorAll('.pmd-send-target-name')].map(
      (el) => el.textContent,
    );
    expect(rowNames).toContain('Awake');
    expect(rowNames).toContain('Team');
    expect(rowNames).not.toContain('Sleepy'); // snoozed → no pill row
    // …but the group target still reaches the snoozed member.
    const pillAny = document.querySelector('.pmd-send-pill');
    expect(pillAny).toBeTruthy();
    const groupCount = root.querySelector('.pmd-send-target-count');
    expect(groupCount?.textContent).toBe('2'); // both members, snoozed included
  });

  it('the actions row renders; Start session hides while the collab gate is closed', () => {
    const { root } = mountPill();
    const actions = root.querySelectorAll('.pmd-send-action');
    expect(actions.length).toBe(2);
    expect(actions[0]!.textContent).toContain('Add contact');
    // No collab starter registered (gate closed) → hidden by class.
    expect(actions[1]!.classList.contains('pmd-send-action-collab-hidden')).toBe(true);
  });

  it('snoozed flag survives the settings sanitize round-trip', () => {
    settings.set('pairingPartners', [
      { code: 'cmk1.aaa', name: 'Keep', snoozed: true },
      { code: 'cmk1.bbb', name: 'Plain' },
    ]);
    const back = settings.get('pairingPartners');
    expect(back[0]!.snoozed).toBe(true);
    expect(back[1]!.snoozed).toBeUndefined();
  });

  it('Add contact: code prompt, then a name prompt pre-filled from recent senders', async () => {
    settings.set('pairingPartners', [{ code: 'cmk1.first', name: 'First' }]);
    recentSendersMock.mockReturnValue([{ code: 'cmk1.newperson', name: 'Priya', at: 1 }]);
    promptForText.mockResolvedValueOnce('cmk1.newperson'); // code
    promptForText.mockResolvedValueOnce('Priya K'); // name (user edited)
    const { root } = mountPill();
    // Open click mode and press the button.
    (root.querySelector('.pmd-send-bar') as HTMLElement).click();
    (root.querySelector('.pmd-send-action') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));

    const partners = settings.get('pairingPartners');
    expect(partners.map((p) => p.code)).toEqual(['cmk1.first', 'cmk1.newperson']);
    expect(partners[1]!.name).toBe('Priya K');
    // The name prompt was pre-filled with the ledger's name.
    const nameCall = promptForText.mock.calls[1]![0] as { initial?: string };
    expect(nameCall.initial).toBe('Priya');
  });

  it('Add contact: cancelling the name prompt aborts the whole add', async () => {
    const { root } = mountPill();
    (root.querySelector('.pmd-send-bar') as HTMLElement).click();
    promptForText.mockResolvedValueOnce('cmk1.someone'); // code accepted
    promptForText.mockResolvedValueOnce(null); // name cancelled
    (root.querySelector('.pmd-send-action') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(settings.get('pairingPartners')).toHaveLength(0);
  });

  it('Add contact refuses duplicates and junk codes', async () => {
    settings.set('pairingPartners', [{ code: 'cmk1.first', name: 'First' }]);
    const { root } = mountPill();
    (root.querySelector('.pmd-send-bar') as HTMLElement).click();

    promptForText.mockResolvedValueOnce('cmk1.first');
    (root.querySelector('.pmd-send-action') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(settings.get('pairingPartners')).toHaveLength(1);

    (root.querySelector('.pmd-send-bar') as HTMLElement).click();
    promptForText.mockResolvedValueOnce('not a code');
    (root.querySelector('.pmd-send-action') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(settings.get('pairingPartners')).toHaveLength(1);
    expect(vi.mocked(showToast).mock.calls.flat().join(' ')).toContain('pairing code');
  });

  it('the drag recent-senders list excludes blocked codes and labels known partners', () => {
    settings.set('pairingPartners', [{ code: 'cmk1.known', name: 'Ana' }]);
    settings.set('pairingBlockedCodes', ['cmk1.badguy']);
    recentSendersMock.mockReturnValue([
      { code: 'cmk1.known', name: 'self-declared', at: 3 },
      { code: 'cmk1.badguy', name: 'Bad', at: 2 },
      { code: 'cmk1.stranger', name: 'Sam', at: 1 },
    ]);
    const { root } = mountPill();
    const section = root.querySelector('.pmd-send-recent-flyout')!;
    expect(section).toBeTruthy();
    expect((section as HTMLElement).hidden).toBe(true); // drag-only reveal
    const labels = [...section.querySelectorAll('.pmd-send-target-name')].map(
      (el) => el.textContent,
    );
    expect(labels).toContain('Ana'); // your nickname wins over self-declared
    expect(labels).toContain('Sam');
    expect(labels.join(' ')).not.toContain('Bad');
  });
});
