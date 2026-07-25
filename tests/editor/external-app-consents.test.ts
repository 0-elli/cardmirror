// @vitest-environment jsdom
// The `externalAppConsents` / `externalInsertsEnabled` settings
// sanitizers (ribbon-custom-buttons pattern: SettingsStore.replaceAll
// with hostile shapes).
import { describe, expect, it } from 'vitest';
import { SettingsStore, type ExternalAppConsent } from '../../src/editor/settings.js';

describe('externalAppConsents sanitize', () => {
  it('defaults empty / ask and rejects non-arrays', () => {
    const s = new SettingsStore();
    expect(s.get('externalAppConsents')).toEqual([]);
    expect(s.get('externalInsertPolicy')).toBe('ask');
    s.replaceAll({ externalAppConsents: 'nope' as unknown as ExternalAppConsent[] });
    expect(s.get('externalAppConsents')).toEqual([]);
  });

  it('keeps well-formed entries, drops malformed ones, dedupes by id', () => {
    const s = new SettingsStore();
    s.replaceAll({
      externalAppConsents: [
        { id: 'ebb', decision: 'allow', firstSeen: 'a', lastSeen: 'b' },
        { id: 'ebb', decision: 'deny', firstSeen: '', lastSeen: '' }, // dup → dropped
        { id: 'BAD ID', decision: 'allow', firstSeen: '', lastSeen: '' }, // bad id
        { id: 'x', decision: 'maybe', firstSeen: '', lastSeen: '' }, // bad decision
        { id: 'fdp', decision: 'deny' }, // missing timestamps → coerced to ''
        'nope',
      ] as unknown as ExternalAppConsent[],
    });
    expect(s.get('externalAppConsents')).toEqual([
      { id: 'ebb', decision: 'allow', firstSeen: 'a', lastSeen: 'b' },
      { id: 'fdp', decision: 'deny', firstSeen: '', lastSeen: '' },
    ]);
  });

  it('externalInsertPolicy accepts the three modes, garbage falls to ask', () => {
    const s = new SettingsStore();
    s.replaceAll({ externalInsertPolicy: 'off' });
    expect(s.get('externalInsertPolicy')).toBe('off');
    s.replaceAll({ externalInsertPolicy: 'open' });
    expect(s.get('externalInsertPolicy')).toBe('open');
    s.replaceAll({ externalInsertPolicy: 'nonsense' as unknown as 'ask' });
    expect(s.get('externalInsertPolicy')).toBe('ask');
  });
});
