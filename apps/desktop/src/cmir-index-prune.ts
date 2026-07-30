/**
 * Prune logic for the cached .cmir file index (main.ts owns the cache).
 *
 * The index maps search root → file entries and persists to disk. Roots
 * REMOVED from settings simply stop being requested — nothing ever told
 * the index to forget them, so their entries were carried forward in
 * every persist, forever (observed in the wild: a 130 MB index whose
 * bulk was roots the user had removed weeks earlier). The renderer now
 * reports the full current-roots set whenever it kicks a listing pass,
 * and main drops everything else via this helper.
 *
 * Pure module (no `electron` import) so it's unit-testable.
 */

/**
 * Delete every root in `mem` that isn't in `currentRoots`. Returns
 * whether anything was dropped (the caller persists only then, so an
 * unchanged index costs no rewrite). Exact string match: the settings
 * list and the index keys come from the same picker paths.
 */
export function pruneIndexRoots<T>(
  mem: Map<string, T>,
  currentRoots: readonly string[],
): boolean {
  const keep = new Set(currentRoots);
  let dropped = false;
  for (const root of [...mem.keys()]) {
    if (!keep.has(root)) {
      mem.delete(root);
      dropped = true;
    }
  }
  return dropped;
}
