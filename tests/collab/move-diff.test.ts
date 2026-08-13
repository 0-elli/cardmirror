// @vitest-environment jsdom

/**
 * The move-aware child diff (patches/loro-prosemirror+0.4.3.patch).
 *
 * Upstream `updateLoroMapChildren` reconciles a reordered children list
 * by delete-and-recreating every misaligned pair, so relocating one
 * card past N siblings rewrites all N — and, measured, concurrent
 * partitioned moves then silently destroy cards on merge (each peer's
 * rewrite clobbers the other's via LWW on the rebuilt containers). The
 * patch detects a pure rotation after the prefix/suffix trim and emits
 * one delete + one insert instead of rewriting the span.
 *
 * Pinned here:
 *  - concurrent partitioned moves converge with ZERO cards lost;
 *  - the upstream failure mode still exists when the patch is disabled
 *    (`__CM_DISABLE_MOVE_DIFF__`) — proving this harness can detect the
 *    bug, so a silent regression to upstream behaviour fails loudly;
 *  - a long move's wire payload stays rotation-sized (the 69x fix);
 *  - undo/redo across a long move round-trips and converges.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';
import { undo as loroUndo, redo as loroRedo, LoroUndoPlugin } from 'loro-prosemirror';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { createLoroPeers, syncAll, docText, settle, type LoroPeer } from './_loro-helpers.js';

declare global {
  // eslint-disable-next-line no-var
  var __CM_DISABLE_MOVE_DIFF__: boolean | undefined;
}

const CARDS = 60;

function card(i: number): PMNode {
  return schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(`Tag ${i}`)),
    schema.nodes['card_body']!.create(null, schema.text(`ANCHOR${i} body text ${i}`)),
  ]);
}
const seed = (): PMNode =>
  schema.nodes['doc']!.createChecked(null, Array.from({ length: CARDS }, (_, i) => card(i)));

/** Move a top-level child, the same delete-then-insert shape both
 *  `move-container.ts` and `drag-controller.ts` produce. Returns the
 *  bytes this peer emitted for the move. */
function moveCard(peer: LoroPeer, fromIndex: number, toIndex: number, patched: boolean): number {
  const view = peer.view;
  const doc = view.state.doc;
  let fromPos = 0;
  for (let i = 0; i < fromIndex; i++) fromPos += doc.child(i).nodeSize;
  const node = doc.child(fromIndex);
  const slice = doc.slice(fromPos, fromPos + node.nodeSize);
  let tr = view.state.tr.delete(fromPos, fromPos + node.nodeSize);
  let toPos = 0;
  for (let i = 0; i < toIndex; i++) toPos += tr.doc.child(i).nodeSize;
  tr = tr.insert(toPos, slice.content);
  const before = peer.ldoc.version();
  // The sync plugin translates PM -> Loro synchronously inside dispatch
  // (appendTransaction), so scoping the flag to the dispatch is exact.
  globalThis.__CM_DISABLE_MOVE_DIFF__ = !patched;
  try {
    view.dispatch(tr);
  } finally {
    globalThis.__CM_DISABLE_MOVE_DIFF__ = undefined;
  }
  peer.ldoc.commit();
  return peer.ldoc.export({ mode: 'update', from: before }).byteLength;
}

/** Occurrences of each card's anchor text — 0 = lost, 2+ = duplicated. */
function anchorCounts(text: string): number[] {
  return Array.from({ length: CARDS }, (_, i) => {
    let n = 0;
    let at = -1;
    // Trailing space disambiguates ANCHOR5 from ANCHOR50.
    while ((at = text.indexOf(`ANCHOR${i} `, at + 1)) !== -1) n++;
    return n;
  });
}

/** Both peers move a card while partitioned, then sync to quiescence. */
async function partitionedMoves(
  moves: Array<[number, number, number, number]>,
  patched: boolean,
): Promise<{ lost: number; duplicated: number; diverged: number; unsynced: number }> {
  let lost = 0;
  let duplicated = 0;
  let diverged = 0;
  let unsynced = 0;
  for (const [af, at, bf, bt] of moves) {
    const peers = await createLoroPeers(seed(), 2);
    moveCard(peers[0]!, af, at, patched);
    moveCard(peers[1]!, bf, bt, patched);
    await settle();
    await syncAll(peers);
    const t0 = docText(peers[0]!.doc());
    const t1 = docText(peers[1]!.doc());
    if (JSON.stringify(peers[0]!.ldoc.version().toJSON()) !==
        JSON.stringify(peers[1]!.ldoc.version().toJSON())) unsynced++;
    if (t0 !== t1) diverged++;
    for (const n of anchorCounts(t0)) {
      if (n === 0) lost++;
      if (n > 1) duplicated += n - 1;
    }
    peers.forEach((p) => p.destroy());
  }
  return { lost, duplicated, diverged, unsynced };
}

const SCENARIOS: Array<[number, number, number, number]> = [
  [0, 20, 40, 10], // long moves, overlapping spans
  [5, 45, 50, 2], // crossing moves
  [10, 11, 30, 31], // both adjacent (the app-command case)
  [0, 59, 59, 0], // full-length swap
  [25, 26, 25, 24], // the SAME card moved both ways
  [3, 40, 41, 4], // long, interleaved
];

beforeAll(() => {
  globalThis.__CM_DISABLE_MOVE_DIFF__ = undefined;
});
afterAll(() => {
  globalThis.__CM_DISABLE_MOVE_DIFF__ = undefined;
});

describe('concurrent partitioned moves', () => {
  it('with the patch: every scenario converges with no card lost', async () => {
    const r = await partitionedMoves(SCENARIOS, true);
    expect(r.unsynced, 'peers reached identical versions').toBe(0);
    expect(r.diverged, 'peers rendered identical documents').toBe(0);
    expect(r.lost, 'cards lost').toBe(0);
    // Both peers deleting + recreating the SAME card can duplicate it
    // rather than lose it; log so a change in that behaviour is visible.
    console.log(`[move-diff] patched: lost=0 duplicated=${r.duplicated}`);
  }, 120_000);

  it('canary: upstream behaviour (patch disabled) still loses cards', async () => {
    // If this stops failing-the-old-way, the harness itself has gone
    // blind (e.g. the flag no longer reaches the binding) — investigate
    // before trusting the test above.
    const r = await partitionedMoves(SCENARIOS, false);
    expect(r.unsynced).toBe(0);
    expect(r.diverged).toBe(0);
    expect(r.lost, 'upstream loses cards under concurrent moves').toBeGreaterThan(0);
    console.log(`[move-diff] baseline: lost=${r.lost} duplicated=${r.duplicated}`);
  }, 120_000);
});

describe('move wire cost', () => {
  it('a long move stays rotation-sized instead of rewriting the span', async () => {
    const peers = await createLoroPeers(seed(), 2);
    const patchedBytes = moveCard(peers[0]!, 0, CARDS - 1, true);
    await settle();
    await syncAll(peers);
    expect(docText(peers[0]!.doc())).toBe(docText(peers[1]!.doc()));

    const peers2 = await createLoroPeers(seed(), 2);
    const baselineBytes = moveCard(peers2[0]!, 0, CARDS - 1, false);
    console.log(`[move-diff] long move: patched ${patchedBytes} B vs baseline ${baselineBytes} B`);
    // The exact ratio varies with card size; an order of magnitude is
    // the regression signal (measured ~40-70x on realistic cards).
    expect(patchedBytes * 10).toBeLessThan(baselineBytes);
    peers.forEach((p) => p.destroy());
    peers2.forEach((p) => p.destroy());
  }, 120_000);
});

describe('undo across a move', () => {
  it('undo restores the order, redo reapplies it, and a peer converges', async () => {
    const peers = await createLoroPeers(seed(), 2, (ldoc) => [
      LoroUndoPlugin({ doc: ldoc as never }),
    ]);
    const [a, b] = peers as [LoroPeer, LoroPeer];
    const original = docText(a.doc());

    moveCard(a, 2, 50, true);
    await settle();
    const moved = docText(a.doc());
    expect(moved).not.toBe(original);

    const didUndo = loroUndo(a.view.state, a.view.dispatch.bind(a.view));
    expect(didUndo, 'undo command applied').toBe(true);
    await settle();
    expect(docText(a.doc()), 'undo restores the original order').toBe(original);

    const didRedo = loroRedo(a.view.state, a.view.dispatch.bind(a.view));
    expect(didRedo, 'redo command applied').toBe(true);
    await settle();
    expect(docText(a.doc()), 'redo reapplies the move').toBe(moved);

    await syncAll(peers);
    expect(docText(b.doc()), 'peer converges on the redone state').toBe(docText(a.doc()));
    expect(anchorCounts(docText(a.doc())).every((n) => n === 1), 'no card lost or duplicated').toBe(
      true,
    );
    peers.forEach((p) => p.destroy());
  }, 120_000);

  it('undo of a move a PEER made stays with the peer (undo is local-only)', async () => {
    const peers = await createLoroPeers(seed(), 2, (ldoc) => [
      LoroUndoPlugin({ doc: ldoc as never }),
    ]);
    const [a, b] = peers as [LoroPeer, LoroPeer];
    moveCard(a, 2, 50, true);
    await settle();
    await syncAll(peers);
    const synced = docText(b.doc());

    // B has made no local edits; undo on B must be a no-op.
    const didUndo = loroUndo(b.view.state, b.view.dispatch.bind(b.view));
    await settle();
    expect(didUndo).toBe(false);
    expect(docText(b.doc())).toBe(synced);
    peers.forEach((p) => p.destroy());
  }, 120_000);
});
