// @vitest-environment jsdom

/**
 * Concurrent table-edit clash — the seed-51 soak divergence
 * (2026-08-15), pinned end to end.
 *
 * The chain: concurrent addRowAfter + addColumnAfter merge to a RAGGED
 * table (legal; content expressions can't constrain widths). A client
 * without the table-guard then runs raw `addRowAfter` from a short-row
 * cell and prosemirror-tables nests an empty table_row INSIDE the
 * trailing row — ProseMirror's replace fitter accepts the invalid doc,
 * and the binding writes it to the CRDT. Three defenses, tested here:
 *
 *  1. doc-repair's structural pass (both builders) heals the invalid
 *     doc instead of THROWING like bare fixTables did: empty nested
 *     rows (the artifact) are dropped, cell-bearing nested rows are
 *     hoisted, and the pass is idempotent.
 *  2. The patched materializer SALVAGES an invalid row's legal cells
 *     for remote peers (the pre-fix behavior dropped the entire row),
 *     deterministically — remote peers agree with each other.
 *  3. End to end: after the originating peer's all-peer repair half
 *     runs (as production's repair pass does), its write-back heals
 *     the CRDT and every peer converges on the same valid doc.
 *
 * The guard preventing detonation in the first place is covered by
 * tests/editor/table-guard.test.ts; the fuzzers now drive table ops
 * through it, exactly as the ribbon does.
 */

import { describe, it, expect } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { addRowAfter, addColumnAfter } from 'prosemirror-tables';
import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../../src/schema/index.js';
import { buildDocRepairTr, buildMarkRepairTr } from '../../src/doc-repair.js';
import {
  createLoroPeers,
  syncAll,
  settle,
  docOf,
  para,
  tableNode,
  type LoroPeer,
} from './_loro-helpers.js';

function cellPositionsIn(doc: PMNode): number[] {
  const cells: number[] = [];
  doc.descendants((node, cp) => {
    if (node.type.name === 'table_cell') {
      cells.push(cp + 2);
      return false;
    }
    return true;
  });
  return cells;
}

function rowShapes(doc: PMNode): string[][] {
  const rows: string[][] = [];
  doc.descendants((n) => {
    if (n.type.name === 'table_row') {
      const kids: string[] = [];
      n.forEach((c) => kids.push(c.type.name));
      rows.push(kids);
      return false;
    }
    return true;
  });
  return rows;
}

function selectCell(peer: LoroPeer, cellPos: number): void {
  peer.view.dispatch(
    peer.view.state.tr.setSelection(
      TextSelection.create(peer.view.state.doc, Math.min(cellPos, peer.view.state.doc.content.size)),
    ),
  );
}

/** Build the corrupt row-in-row doc directly (unchecked .create() —
 *  the same shape the detonation produces). */
function corruptTableDoc(opts: { nestedCellText?: string } = {}): PMNode {
  const cell = (label: string): PMNode =>
    schema.nodes['table_cell']!.create(null, [
      schema.nodes['paragraph']!.create(null, [schema.text(label)]),
    ]);
  const nested = opts.nestedCellText
    ? schema.nodes['table_row']!.create(null, [cell(opts.nestedCellText)])
    : schema.nodes['table_row']!.create(null, []);
  const rows = [
    schema.nodes['table_row']!.create(null, [cell('a1'), cell('a2')]),
    // .create (unchecked): a row holding cells AND a nested row.
    schema.nodes['table_row']!.create(null, [cell('b1'), cell('b2'), nested]),
  ];
  return schema.nodes['doc']!.create(null, [
    schema.nodes['paragraph']!.create(null, [schema.text('lead')]),
    schema.nodes['table']!.create(null, rows),
  ]);
}

describe('doc-repair: structural table normalization', () => {
  it('heals row-in-row instead of throwing; empty nested row is dropped', () => {
    const state = EditorState.create({ doc: corruptTableDoc() });
    expect(() => state.doc.check()).toThrow();
    const tr = buildDocRepairTr(state);
    expect(tr).not.toBeNull();
    const fixed = state.apply(tr!);
    expect(() => fixed.doc.check()).not.toThrow();
    expect(fixed.doc.textContent).toContain('b1'); // cells preserved
    expect(rowShapes(fixed.doc).every((r) => r.every((k) => k === 'table_cell'))).toBe(true);
    // Idempotent: the repaired doc needs no further repair.
    expect(buildDocRepairTr(fixed)).toBeNull();
  });

  it('a cell-bearing nested row is hoisted, not dropped', () => {
    const state = EditorState.create({ doc: corruptTableDoc({ nestedCellText: 'saved' }) });
    const tr = buildDocRepairTr(state);
    const fixed = state.apply(tr!);
    expect(() => fixed.doc.check()).not.toThrow();
    expect(fixed.doc.textContent).toContain('saved'); // nothing typed is lost
    expect(rowShapes(fixed.doc).length).toBe(3); // hoisted to its own row
  });

  it('the all-peer half (buildMarkRepairTr) heals it too', () => {
    const state = EditorState.create({ doc: corruptTableDoc() });
    const tr = buildMarkRepairTr(state);
    expect(tr).not.toBeNull();
    const fixed = state.apply(tr!);
    expect(() => fixed.doc.check()).not.toThrow();
    // And is a no-op on the healed doc.
    expect(buildMarkRepairTr(fixed)).toBeNull();
  });
});

describe('collab table clash (raw commands, 3 peers)', () => {
  it('salvage keeps remote peers deterministic; repair write-back converges the room', async () => {
    const peers = await createLoroPeers(docOf(para('lead'), tableNode(2, 3)), 3);
    const [p0, p1, p2] = peers as [LoroPeer, LoroPeer, LoroPeer];

    // Concurrent row + column inserts (each locally valid) ...
    selectCell(p0, cellPositionsIn(p0.doc()).at(-1)!);
    addRowAfter(p0.view.state, p0.view.dispatch.bind(p0.view));
    selectCell(p1, cellPositionsIn(p1.doc())[0]!);
    addColumnAfter(p1.view.state, p1.view.dispatch.bind(p1.view));
    await settle();
    await syncAll(peers);

    // ... merge to a ragged table on every peer.
    const widths = rowShapes(p0.doc()).map((r) => r.length);
    expect(new Set(widths).size).toBeGreaterThan(1);

    // Detonation: RAW addRowAfter from a short-row cell (a client
    // without the guard). The doc goes schema-invalid and the binding
    // writes it to the CRDT.
    selectCell(p0, cellPositionsIn(p0.doc()).at(-1)!);
    addRowAfter(p0.view.state, p0.view.dispatch.bind(p0.view));
    await settle();
    expect(() => p0.doc().check()).toThrow(/table_row/);

    await syncAll(peers);

    // Remote peers: materializer salvage — valid docs, the new row's
    // cells kept, and both remotes IDENTICAL (the original divergence
    // was remote-vs-remote nondeterminism plus originator drift).
    expect(() => p1.doc().check()).not.toThrow();
    expect(() => p2.doc().check()).not.toThrow();
    expect(p1.doc().toJSON()).toEqual(p2.doc().toJSON());
    expect(rowShapes(p1.doc()).length).toBe(4); // salvaged row survives

    // Production's all-peer repair pass reaches the originator: heal
    // locally, write back, sync — the whole room converges valid.
    for (const p of peers) {
      const tr = buildMarkRepairTr(p.view.state);
      if (tr) p.view.dispatch(tr);
    }
    await settle();
    await syncAll(peers);
    await syncAll(peers);

    for (const p of peers) expect(() => p.doc().check()).not.toThrow();
    expect(p0.doc().toJSON()).toEqual(p1.doc().toJSON());
    expect(p0.doc().toJSON()).toEqual(p2.doc().toJSON());

    peers.forEach((p) => p.destroy());
  }, 60_000);
});
