/**
 * Index-root pruning (2026-07-30): roots removed from settings must be
 * droppable from the persisted .cmir file index — before this, removed
 * roots' entries were carried forward in every persist forever (found
 * in the wild: a 130 MB index whose bulk was long-removed roots).
 */

import { describe, expect, it } from 'vitest';
import { pruneIndexRoots } from '../../apps/desktop/src/cmir-index-prune.js';

function mem(roots: Record<string, number[]>): Map<string, number[]> {
  return new Map(Object.entries(roots));
}

describe('pruneIndexRoots', () => {
  it('drops roots absent from the current set and reports the drop', () => {
    const m = mem({ '/a': [1], '/removed': [2, 3], '/b': [4] });
    expect(pruneIndexRoots(m, ['/a', '/b'])).toBe(true);
    expect([...m.keys()]).toEqual(['/a', '/b']);
  });

  it('an empty current set clears everything (user removed all roots)', () => {
    const m = mem({ '/old-topic': [1], '/downloads': [2] });
    expect(pruneIndexRoots(m, [])).toBe(true);
    expect(m.size).toBe(0);
  });

  it('no-op when every stored root is still current — caller skips the rewrite', () => {
    const m = mem({ '/a': [1], '/b': [2] });
    expect(pruneIndexRoots(m, ['/a', '/b', '/new-not-yet-scanned'])).toBe(false);
    expect(m.size).toBe(2);
  });

  it('current roots not yet in the index are left for the scan to add', () => {
    const m = mem({});
    expect(pruneIndexRoots(m, ['/a'])).toBe(false);
    expect(m.size).toBe(0);
  });

  it('exact string match — no prefix/subpath games', () => {
    const m = mem({ '/a/sub': [1] });
    // '/a' being current does NOT keep '/a/sub': each root is its own key.
    expect(pruneIndexRoots(m, ['/a'])).toBe(true);
    expect(m.size).toBe(0);
  });
});
