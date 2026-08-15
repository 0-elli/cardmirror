// @vitest-environment jsdom

/**
 * Deep cross-family CRDT fuzz — the soak-scale variant (2026-08-15).
 *
 * loro-fuzz and move-fuzz each hammer one family at modest depth
 * (3 peers, 4 rounds). Both of this season's real bugs (span-drag
 * fusion, seed-51 table detonation) were CROSS-family interleavings —
 * so this fuzzer runs the combined hostile vocabulary at depth: moves
 * (the drag-controller delete+reinsert shape, span drags included),
 * guarded table commands (exactly what the ribbon dispatches), typing,
 * marks, splits, deletes, and card inserts, across MORE peers and MORE
 * rounds with random partial partitions.
 *
 * Invariants per seed: convergence (node-level eq, marks included),
 * schema validity, and repair-pass convergence. No anchor-loss check
 * here — splits legitimately cut anchor strings mid-word, which makes
 * text counting a false-alarm machine; exactly-once accounting is
 * move-fuzz's job and stays there.
 *
 * Defaults are CI-cheap. Soak knobs: FUZZ_SEEDS (default 5),
 * FUZZ_ROUNDS (default 8), FUZZ_PEERS (default 5). Both list modes
 * run, same split as move-fuzz.
 */

import { describe, it, expect } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { buildDocRepairTr } from '../../src/doc-repair.js';
import { repairView } from './_repair-view.js';
import {
  guardedAddRowAfter,
  guardedAddColumnAfter,
  guardedDeleteRow,
  guardedDeleteColumn,
} from '../../src/editor/table-guard.js';
import {
  createLoroPeers,
  syncAll,
  settle,
  tableNode,
  type LoroPeer,
} from './_loro-helpers.js';

declare global {
  // eslint-disable-next-line no-var
  var __CM_MOVABLE_LIST__: boolean | undefined;
}

const SEEDS = Number(process.env['FUZZ_SEEDS'] ?? 5);
const ROUNDS = Number(process.env['FUZZ_ROUNDS'] ?? 8);
const PEERS = Number(process.env['FUZZ_PEERS'] ?? 5);
const CARDS = 12;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ['impact', 'link', 'turns', 'warrant', 'solvency', 'uniqueness'];
const HIGHLIGHTS = ['green', 'yellow', 'cyan'];

function card(label: string): PMNode {
  return schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(`Tag ${label}`)),
    schema.nodes['card_body']!.create(null, schema.text(`${label} body evidence text here`)),
  ]);
}

function seedDoc(): PMNode {
  const kids: PMNode[] = Array.from({ length: CARDS }, (_, i) =>
    card(`ANCHOR${String(i).padStart(3, '0')}`),
  );
  kids.splice(4, 0, tableNode(2, 3, 'ta'));
  kids.splice(9, 0, tableNode(3, 2, 'tb'));
  return schema.nodes['doc']!.createChecked(null, kids);
}

/** The drag-controller's move shape (delete a contiguous child run,
 *  reinsert at the mapped target) — same as move-fuzz. */
function moveChildren(peer: LoroPeer, fromIndex: number, count: number, toIndex: number): void {
  const view = peer.view;
  const doc = view.state.doc;
  if (doc.childCount < 2) return;
  const f = fromIndex % doc.childCount;
  const k = Math.max(1, Math.min(count, doc.childCount - f));
  let fromPos = 0;
  for (let i = 0; i < f; i++) fromPos += doc.child(i).nodeSize;
  let endPos = fromPos;
  for (let i = f; i < f + k; i++) endPos += doc.child(i).nodeSize;
  const slice = doc.slice(fromPos, endPos);
  let tr = view.state.tr.delete(fromPos, endPos);
  const t = toIndex % Math.max(tr.doc.childCount + 1, 1);
  let toPos = 0;
  for (let i = 0; i < t; i++) toPos += tr.doc.child(i).nodeSize;
  tr = tr.insert(toPos, slice.content);
  view.dispatch(tr);
}

function textblocks(doc: PMNode): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      blocks.push({ start: pos + 1, end: pos + 1 + node.content.size });
      return false;
    }
    return true;
  });
  return blocks;
}

function randomOp(rnd: () => number, p: LoroPeer, peerIdx: number): void {
  const view = p.view;
  const roll = rnd();
  try {
    if (roll < 0.3) {
      // Moves dominate: half span drags, the nav-pane section shape.
      const span = rnd() < 0.5 ? 1 : 2 + Math.floor(rnd() * 3);
      moveChildren(p, Math.floor(rnd() * CARDS * 2), span, Math.floor(rnd() * CARDS * 2));
    } else if (roll < 0.5) {
      // Guarded table commands — the ribbon's dispatch path.
      const cells: number[] = [];
      view.state.doc.descendants((node, cp) => {
        if (node.type.name === 'table_cell') {
          cells.push(cp + 2);
          return false;
        }
        return true;
      });
      if (!cells.length) return;
      const cellPos = cells[Math.floor(rnd() * cells.length)]!;
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.create(view.state.doc, Math.min(cellPos, view.state.doc.content.size)),
        ),
      );
      const cmd = [
        guardedAddRowAfter,
        guardedAddColumnAfter,
        guardedDeleteRow,
        guardedDeleteColumn,
      ][Math.floor(rnd() * 4)]!;
      cmd(view.state, view.dispatch.bind(view));
    } else {
      const blocks = textblocks(view.state.doc);
      if (!blocks.length) return;
      const b = blocks[Math.floor(rnd() * blocks.length)]!;
      const pos = b.start + Math.floor(rnd() * Math.max(1, b.end - b.start));
      if (roll < 0.7) {
        view.dispatch(
          view.state.tr.insertText(` p${peerIdx}${WORDS[Math.floor(rnd() * WORDS.length)]}`, pos),
        );
      } else if (roll < 0.8) {
        const to = Math.min(b.end, pos + 2 + Math.floor(rnd() * 10));
        if (to > pos) {
          const mark =
            rnd() < 0.6
              ? schema.marks['highlight']!.create({ color: HIGHLIGHTS[Math.floor(rnd() * 3)] })
              : schema.marks['bold']!.create();
          view.dispatch(view.state.tr.addMark(pos, to, mark));
        }
      } else if (roll < 0.9) {
        view.dispatch(view.state.tr.split(pos));
      } else if (roll < 0.95) {
        const to = Math.min(b.end, pos + 1 + Math.floor(rnd() * 6));
        if (to > pos) view.dispatch(view.state.tr.delete(pos, to));
      } else {
        view.dispatch(
          view.state.tr.insert(
            view.state.doc.content.size,
            card(`NEWP${peerIdx}R${Math.floor(rnd() * 999)}`),
          ),
        );
      }
    }
  } catch {
    /* stale position for this op — skip, same as the other fuzzers */
  }
}

async function fuzzRun(): Promise<void> {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rnd = mulberry32(seed);
    const peers = await createLoroPeers(seedDoc(), PEERS);
    for (let round = 0; round < ROUNDS; round++) {
      for (const [pi, p] of peers.entries()) {
        const k = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < k; i++) randomOp(rnd, p, pi);
      }
      await settle();
      const mode = rnd();
      if (mode < 0.3) {
        await syncAll(peers);
      } else if (mode < 0.7) {
        // Random subset partition: 2..PEERS peers sync among
        // themselves, the rest stay offline this round.
        const size = 2 + Math.floor(rnd() * (PEERS - 1));
        const pool = [...peers.keys()];
        const subset: LoroPeer[] = [];
        for (let i = 0; i < size && pool.length; i++) {
          subset.push(peers[pool.splice(Math.floor(rnd() * pool.length), 1)[0]!]!);
        }
        await syncAll(subset);
      }
      // else: fully offline round
    }
    await syncAll(peers);
    await syncAll(peers);

    const docs = peers.map((p) => p.doc());
    for (const [i, d] of docs.entries()) {
      if (!d.eq(docs[0]!)) {
        const a = JSON.stringify(docs[0]!.toJSON());
        const b = JSON.stringify(d.toJSON());
        let at = 0;
        while (at < Math.min(a.length, b.length) && a[at] === b[at]) at++;
        console.log(
          `[deep-fuzz] seed ${seed} peer 0 vs peer ${i} first diff @${at}:\n` +
            `  peer0: …${a.slice(Math.max(0, at - 60), at + 120)}…\n` +
            `  peer${i}: …${b.slice(Math.max(0, at - 60), at + 120)}…`,
        );
      }
      expect(d.eq(docs[0]!), `seed ${seed} peer ${i} convergence`).toBe(true);
      expect(() => d.check(), `seed ${seed} peer ${i} validity`).not.toThrow();
    }

    if (buildDocRepairTr(peers[0]!.view.state)) {
      for (const p of peers) repairView(p.view);
      await settle();
      await syncAll(peers);
      for (const p of peers) repairView(p.view);
      await settle();
      await syncAll(peers);
      const repaired = peers.map((p) => p.doc());
      for (const d of repaired) {
        expect(d.eq(repaired[0]!), `seed ${seed} post-repair convergence`).toBe(true);
      }
    }
    peers.forEach((p) => p.destroy());
  }
}

describe(`deep cross-family fuzz (${PEERS} peers, ${ROUNDS} rounds)`, () => {
  it(`list-format rooms: converges valid across ${SEEDS} seeds`, { timeout: 30_000 * SEEDS + 60_000 }, async () => {
    globalThis.__CM_MOVABLE_LIST__ = false;
    try {
      await fuzzRun();
    } finally {
      globalThis.__CM_MOVABLE_LIST__ = undefined;
    }
  });

  it(`movable-list mode (v1.0): converges valid across ${SEEDS} seeds`, { timeout: 30_000 * SEEDS + 60_000 }, async () => {
    globalThis.__CM_MOVABLE_LIST__ = true;
    try {
      await fuzzRun();
    } finally {
      globalThis.__CM_MOVABLE_LIST__ = undefined;
    }
  });
});
