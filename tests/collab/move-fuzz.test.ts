// @vitest-environment jsdom

/**
 * Move-centric CRDT fuzz — the coverage gap behind the concurrent-move
 * data loss. loro-fuzz and the transclusion fuzz exercise typing,
 * marks, splits, and tables, but never RELOCATE a card; the move-aware
 * diff rewrote exactly that path, so this fuzzer hammers it: random
 * long/short moves (the drag-controller's delete-then-insert shape)
 * interleaved with typing, marks, and card inserts across 3 peers with
 * random offline partitions.
 *
 * Invariants, split by mode (found by this fuzzer's first run):
 *
 * - Shipped mode (plain LoroList + move-aware diff): no card is EVER
 *   lost and peers converge — but two peers concurrently moving the
 *   SAME card can leave a convergent duplicate, because each move
 *   deletes the original container and recreates the card, and both
 *   recreations survive the merge. Visible and user-fixable, unlike
 *   the silent loss the diff eliminated; duplicates are logged.
 * - Movable-list mode (the v1.0 cutover): moves preserve container
 *   identity, so the STRICT invariant holds — exactly one of every
 *   card, always.
 *
 * Seeds default suite-friendly; crank locally with FUZZ_SEEDS=200.
 */

import { describe, it, expect } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
declare global {
  // eslint-disable-next-line no-var
  var __CM_MOVABLE_LIST__: boolean | undefined;
}

import {
  createLoroPeers,
  syncAll,
  docText,
  settle,
  findText,
  type LoroPeer,
} from './_loro-helpers.js';

const SEEDS = Number(process.env['FUZZ_SEEDS'] ?? 20);
const CARDS = 24;
const ROUNDS = 4;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function card(label: string): PMNode {
  return schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(`Tag ${label}`)),
    schema.nodes['card_body']!.create(null, schema.text(`${label} body evidence text`)),
  ]);
}
const seedDoc = (): PMNode =>
  schema.nodes['doc']!.createChecked(
    null,
    Array.from({ length: CARDS }, (_, i) => card(`ANCHOR${i}`)),
  );

/** The drag-controller's move shape: delete the child, reinsert its
 *  slice at the mapped target. */
function moveChild(peer: LoroPeer, fromIndex: number, toIndex: number): void {
  const view = peer.view;
  const doc = view.state.doc;
  if (doc.childCount < 2) return;
  const f = fromIndex % doc.childCount;
  const node = doc.child(f);
  let fromPos = 0;
  for (let i = 0; i < f; i++) fromPos += doc.child(i).nodeSize;
  const slice = doc.slice(fromPos, fromPos + node.nodeSize);
  let tr = view.state.tr.delete(fromPos, fromPos + node.nodeSize);
  const t = toIndex % Math.max(tr.doc.childCount, 1);
  let toPos = 0;
  for (let i = 0; i < t; i++) toPos += tr.doc.child(i).nodeSize;
  tr = tr.insert(toPos, slice.content);
  view.dispatch(tr);
}

/** Returns the anchor of a newly inserted card, or null. */
function randomOp(rnd: () => number, peer: LoroPeer, peerIdx: number, opN: number): string | null {
  const view = peer.view;
  const roll = rnd();
  try {
    if (roll < 0.45) {
      // Moves dominate — they are what this fuzzer exists for.
      moveChild(peer, Math.floor(rnd() * CARDS * 2), Math.floor(rnd() * CARDS * 2));
    } else if (roll < 0.7) {
      // Type into a random existing card body.
      const anchor = `ANCHOR${Math.floor(rnd() * CARDS)}`;
      const r = findText(view.state.doc, anchor);
      view.dispatch(view.state.tr.insertText(`+${peerIdx}`, r.to));
    } else if (roll < 0.9) {
      // Mark a random span.
      const anchor = `ANCHOR${Math.floor(rnd() * CARDS)}`;
      const r = findText(view.state.doc, anchor);
      view.dispatch(
        view.state.tr.addMark(
          r.from,
          Math.min(r.to + 8, view.state.doc.content.size - 1),
          rnd() < 0.5
            ? schema.marks['highlight']!.create({ color: 'yellow' })
            : schema.marks['bold']!.create(),
        ),
      );
    } else {
      // Insert a fresh card (unique anchor, so exactly-once still holds).
      const anchor = `NEWP${peerIdx}N${opN}`;
      view.dispatch(view.state.tr.insert(view.state.doc.content.size, card(anchor)));
      return anchor;
    }
  } catch {
    /* op landed on a stale position — skip, same as loro-fuzz */
  }
  return null;
}

async function fuzzRun(strictExactlyOnce: boolean): Promise<number> {
  let duplicates = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rnd = mulberry32(seed);
    const peers = await createLoroPeers(seedDoc(), 3);
    let opN = 0;
    const expectedAnchors = new Set<string>(
      Array.from({ length: CARDS }, (_, i) => `ANCHOR${i}`),
    );
    for (let round = 0; round < ROUNDS; round++) {
      for (const [pi, p] of peers.entries()) {
        const k = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < k; i++) {
          opN++;
          const inserted = randomOp(rnd, p, pi, opN);
          if (inserted) expectedAnchors.add(inserted);
        }
      }
      await settle();
      const mode = rnd();
      if (mode < 0.35) {
        await syncAll(peers);
      } else if (mode < 0.7) {
        const i = Math.floor(rnd() * 3);
        const j = (i + 1 + Math.floor(rnd() * 2)) % 3;
        await syncAll([peers[i]!, peers[j]!]);
      }
      // else: fully offline round
    }
    await syncAll(peers);
    await syncAll(peers);

    const texts = peers.map((p) => docText(p.doc()));
    for (const [i, t] of texts.entries()) {
      expect(t, `seed ${seed} peer ${i} converges`).toBe(texts[0]!);
    }
    for (const p of peers) {
      expect(() => p.doc().check(), `seed ${seed} validity`).not.toThrow();
    }
    const t0 = texts[0]!;
    for (const anchor of expectedAnchors) {
      let n = 0;
      let at = -1;
      while ((at = t0.indexOf(`${anchor} `, at + 1)) !== -1) n++;
      // Loss is the catastrophic, silent failure — never acceptable.
      expect(n, `seed ${seed}: "${anchor}" survives`).toBeGreaterThanOrEqual(1);
      if (strictExactlyOnce) {
        expect(n, `seed ${seed}: "${anchor}" appears exactly once`).toBe(1);
      } else if (n > 1) {
        duplicates += n - 1;
      }
    }
    peers.forEach((p) => p.destroy());
  }
  return duplicates;
}

describe('move fuzz (3 peers, offline partitions)', () => {
  it(`list-format rooms: nothing lost across ${SEEDS} seeds (duplicates logged)`, { timeout: 30_000 * SEEDS }, async () => {
    // Pinned explicitly: once the build crosses MOVABLE_ROOMS_MIN_VERSION,
    // collab-session's module side-effect flips the ambient flag on — but
    // list-format rooms keep existing forever, and THEIR semantics are
    // what this run guards.
    globalThis.__CM_MOVABLE_LIST__ = false;
    try {
      const duplicates = await fuzzRun(false);
      console.log(`[move-fuzz] list rooms: 0 lost, ${duplicates} duplicate(s) from same-card contention`);
    } finally {
      globalThis.__CM_MOVABLE_LIST__ = undefined;
    }
  });

  it(`movable-list mode (v1.0): strictly exactly-once across ${SEEDS} seeds`, { timeout: 30_000 * SEEDS }, async () => {
    globalThis.__CM_MOVABLE_LIST__ = true;
    try {
      const duplicates = await fuzzRun(true);
      expect(duplicates).toBe(0);
    } finally {
      globalThis.__CM_MOVABLE_LIST__ = undefined;
    }
  });
});
