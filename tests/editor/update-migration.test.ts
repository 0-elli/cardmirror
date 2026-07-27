// @vitest-environment jsdom
/**
 * The 2026-07-27 opt-out flip for automatic update checks.
 *
 * `persist()` snapshots EVERY settings key, so pre-flip installs have
 * the old `false` default baked into their stored blob — the DEFAULTS
 * change alone reaches only fresh installs. `migrateAutoUpdateOptOut`
 * must flip a stored `false` exactly once (marker-keyed), fire the
 * notice callback only when it actually changed something, and forever
 * respect a user who turns the toggle off after the migration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  settings,
  SETTINGS_DEFAULTS,
  migrateAutoUpdateOptOut,
} from '../../src/editor/settings.js';

const MARKER = 'cm-update-check-optout-migrated';

beforeEach(() => {
  localStorage.removeItem(MARKER);
  settings.set('checkForUpdatesOnLaunch', SETTINGS_DEFAULTS.checkForUpdatesOnLaunch);
});

describe('auto-update opt-out migration', () => {
  it('the default itself is now ON', () => {
    expect(SETTINGS_DEFAULTS.checkForUpdatesOnLaunch).toBe(true);
  });

  it('flips a stored false once and fires the notice', () => {
    settings.set('checkForUpdatesOnLaunch', false); // pre-flip install
    let notices = 0;
    migrateAutoUpdateOptOut(() => notices++);
    expect(settings.get('checkForUpdatesOnLaunch')).toBe(true);
    expect(notices).toBe(1);
    expect(localStorage.getItem(MARKER)).toBe('1');
  });

  it('respects a post-migration opt-out forever (marker present)', () => {
    migrateAutoUpdateOptOut(() => {});
    settings.set('checkForUpdatesOnLaunch', false); // deliberate opt-out
    let notices = 0;
    migrateAutoUpdateOptOut(() => notices++);
    expect(settings.get('checkForUpdatesOnLaunch')).toBe(false);
    expect(notices).toBe(0);
  });

  it('an already-on install migrates silently (marker set, no notice)', () => {
    settings.set('checkForUpdatesOnLaunch', true);
    let notices = 0;
    migrateAutoUpdateOptOut(() => notices++);
    expect(settings.get('checkForUpdatesOnLaunch')).toBe(true);
    expect(notices).toBe(0);
    expect(localStorage.getItem(MARKER)).toBe('1');
  });
});
