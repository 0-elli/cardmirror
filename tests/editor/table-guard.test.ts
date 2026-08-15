// @vitest-environment jsdom

/**
 * Ragged-table guard (seed-51 soak find, 2026-08-15).
 *
 * A ragged table — rows of unequal effective width — is the legal,
 * reachable product of concurrent collab row+column inserts. Raw
 * prosemirror-tables `addRowAfter` from a short-row cell on that shape
 * inserts an EMPTY table_row INSIDE the trailing row, and ProseMirror's
 * replace fitter accepts the schema-invalid document. Pinned here:
 *  - the raw command really does corrupt (the repro stays honest)
 *  - every guarded command from every cell of several ragged shapes
 *    yields a doc that passes doc.check()
 *  - the padding and the command land as ONE dispatch (one undo step)
 *  - guarded addRowAfter on a ragged table adds the row AND un-rags
 *  - availability queries stay dispatch-free
 */

import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import { addRowAfter } from 'prosemirror-tables';
import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../../src/schema/index.js';
import {
  guardedAddRowAfter,
  guardedAddRowBefore,
  guardedDeleteRow,
  guardedAddColumnAfter,
  guardedAddColumnBefore,
  guardedDeleteColumn,
} from '../../src/editor/table-guard.js';

function para(text: string): PMNode {
  return schema.nodes['paragraph']!.create(null, [schema.text(text)]);
}
function cell(label: string): PMNode {
  return schema.nodes['table_cell']!.create(null, [para(label)]);
}
function raggedTable(widths: number[]): PMNode {
  return schema.nodes['table']!.create(
    null,
    widths.map((w, r) =>
      schema.nodes['table_row']!.create(
        null,
        Array.from({ length: w }, (_, c) => cell(`r${r}c${c}`)),
      ),
    ),
  );
}
function docOf(t: PMNode): PMNode {
  return schema.nodes['doc']!.create(null, [para('lead'), t]);
}

function cellPositions(doc: PMNode): number[] {
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

function stateAt(doc: PMNode, cellPos: number): EditorState {
  const s = EditorState.create({ doc });
  return s.apply(s.tr.setSelection(TextSelection.create(s.doc, cellPos)));
}

function rowWidths(doc: PMNode): number[] {
  const widths: number[] = [];
  doc.descendants((n) => {
    if (n.type.name === 'table_row') {
      let w = 0;
      n.forEach((c) => {
        w += (c.attrs['colspan'] as number) ?? 1;
      });
      widths.push(w);
      return false;
    }
    return true;
  });
  return widths;
}

const GUARDED: Array<[string, Command]> = [
  ['addRowAfter', guardedAddRowAfter],
  ['addRowBefore', guardedAddRowBefore],
  ['deleteRow', guardedDeleteRow],
  ['addColumnAfter', guardedAddColumnAfter],
  ['addColumnBefore', guardedAddColumnBefore],
  ['deleteColumn', guardedDeleteColumn],
];

const RAGGED_SHAPES = [
  [4, 4, 3],
  [5, 5, 4],
  [3, 4],
  [4, 3],
];

describe('ragged-table guard', () => {
  it('the raw command really corrupts (honest repro)', () => {
    const doc = docOf(raggedTable([4, 4, 3]));
    const lastCell = cellPositions(doc).at(-1)!;
    let state = stateAt(doc, lastCell);
    addRowAfter(state, (tr) => {
      state = state.apply(tr);
    });
    expect(() => state.doc.check()).toThrow(/table_row/);
  });

  it('every guarded command from every cell of every ragged shape stays valid', () => {
    for (const widths of RAGGED_SHAPES) {
      const doc = docOf(raggedTable(widths));
      for (const cellPos of cellPositions(doc)) {
        for (const [name, cmd] of GUARDED) {
          let state = stateAt(doc, cellPos);
          cmd(state, (tr) => {
            state = state.apply(tr);
          });
          expect(
            () => state.doc.check(),
            `[${widths.join(',')}] ${name}@cell${cellPos}`,
          ).not.toThrow();
        }
      }
    }
  });

  it('padding + command land as one dispatch, and the row really lands', () => {
    const doc = docOf(raggedTable([4, 4, 3]));
    let state = stateAt(doc, cellPositions(doc).at(-1)!);
    let dispatches = 0;
    const ok = guardedAddRowAfter(state, (tr) => {
      dispatches++;
      state = state.apply(tr);
    });
    expect(ok).toBe(true);
    expect(dispatches).toBe(1);
    expect(() => state.doc.check()).not.toThrow();
    const widths = rowWidths(state.doc);
    expect(widths.length).toBe(4); // 3 rows + the added one
    expect(new Set(widths).size).toBe(1); // un-ragged
  });

  it('a non-ragged table passes through untouched semantics', () => {
    const doc = docOf(raggedTable([3, 3]));
    let state = stateAt(doc, cellPositions(doc)[0]!);
    const ok = guardedAddRowAfter(state, (tr) => {
      state = state.apply(tr);
    });
    expect(ok).toBe(true);
    expect(rowWidths(state.doc)).toEqual([3, 3, 3]);
    expect(() => state.doc.check()).not.toThrow();
  });

  it('availability queries never dispatch', () => {
    const doc = docOf(raggedTable([4, 4, 3]));
    const state = stateAt(doc, cellPositions(doc).at(-1)!);
    expect(guardedAddRowAfter(state, undefined)).toBe(true);
    // No way to observe a dispatch that wasn't offered — the assertion
    // is that the call neither throws nor needs one.
  });
});
