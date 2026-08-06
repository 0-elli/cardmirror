/**
 * INVESTIGATION ARTIFACT (2026-08-05/06 highlight interior-inheritance spike)
 * — not a regression test; delete after the heal design lands.
 *
 * Question: can a receiving peer distinguish (a) text a collaborator typed
 * while SEEING a highlight (keep highlighted) from (b) text typed with no
 * knowledge of a concurrent highlight (inheritance — strip)?
 *
 * Probes, on raw LoroText configured exactly like the app
 * (expand:'after' for highlight):
 *   1. SEEN case op stream: does applyDelta(insert with attributes) inside
 *      an existing identical mark emit a `mark` op, or a bare insert?
 *   2. Import bracketing: does exportJsonUpdates(preVV, postVV) around an
 *      import yield exactly the imported changes (the heal's decode path)?
 *   3. Causality: do the decoded change `deps` + frontiersToVV let us test
 *      "this insert causally descends from the covering mark op"?
 *   4. UNSEEN case: confirm inheritance in final state + absence of both
 *      mark op and causal dependency.
 */
import { describe, it, expect } from 'vitest';
import { LoroDoc, VersionVector } from 'loro-crdt';

function mkDoc(peer: number): LoroDoc {
  const doc = new LoroDoc();
  doc.setPeerId(BigInt(peer));
  doc.configTextStyle({ highlight: { expand: 'after' } });
  return doc;
}

function sync(from: LoroDoc, to: LoroDoc): void {
  to.import(from.export({ mode: 'update', from: to.version() }));
}

type JsonUpdates = {
  changes: {
    id: string;
    deps: string[];
    ops: { container: string; content: Record<string, unknown> }[];
  }[];
};

function opsOf(j: unknown): { type: string; [k: string]: unknown }[] {
  return (j as JsonUpdates).changes.flatMap((c) =>
    c.ops.map((o) => o.content as { type: string }),
  );
}

describe('loro attributed-insert provenance spike', () => {
  it('1+3: SEEN — typed-with-attributes inside a visible mark: op stream + causality', () => {
    const a = mkDoc(1);
    a.getText('t').insert(0, 'alpha bravo charlie delta');
    a.getText('t').mark({ start: 6, end: 19 }, 'highlight', { color: 'yellow' });
    a.commit();

    const b = mkDoc(2);
    sync(a, b); // B has SEEN the mark
    const preInsert = b.version();

    // What loro-prosemirror does for text typed with inclusive marks:
    b.getText('t').applyDelta([
      { retain: 12 },
      { insert: 'TYPED', attributes: { highlight: { color: 'yellow' } } },
    ]);
    b.commit();

    const frame = b.exportJsonUpdates(preInsert, b.version());
    console.log('[spike] SEEN-case ops:', JSON.stringify(opsOf(frame)));
    console.log(
      '[spike] SEEN-case deps of first change:',
      JSON.stringify((frame as unknown as JsonUpdates).changes.map((c) => ({ id: c.id, deps: c.deps }))),
    );

    // Causality: does the insert change's deps-frontier include A's mark op?
    const change = (frame as unknown as JsonUpdates).changes[0]!;
    const frontier = change.deps.map((d) => {
      const [counter, peer] = d.split('@');
      return { peer: peer as `${number}`, counter: Number(counter) };
    });
    const vv: VersionVector = b.frontiersToVV(frontier);
    // A's ops: text insert (counters 0..24) then the mark op. Find the mark
    // op's exact id from A's own history.
    const aHist = a.exportJsonUpdates() as unknown as JsonUpdates;
    const aOps = aHist.changes.flatMap((c) =>
      c.ops.map((o, i) => ({ ...o.content, counter: (o as unknown as { counter: number }).counter })),
    );
    console.log('[spike] A history ops:', JSON.stringify(aOps));
    const vvMap = vv.toJSON();
    console.log('[spike] SEEN insert deps-VV covers A peer1 through counter:', vvMap.get('1'));
    expect(true).toBe(true);
  });

  it('2+4: UNSEEN — concurrent plain insert inherits; frame shows bare insert + no causal dep', () => {
    const a = mkDoc(1);
    a.getText('t').insert(0, 'alpha bravo charlie delta');
    a.commit();
    const b = mkDoc(2);
    sync(a, b);

    // Diverge: A marks; B (never seeing it) types plain inside the range.
    a.getText('t').mark({ start: 6, end: 19 }, 'highlight', { color: 'yellow' });
    a.commit();
    const bPre = b.version();
    b.getText('t').insert(12, 'PLAIN');
    b.commit();

    // The frame B would send:
    const frame = b.exportJsonUpdates(bPre, b.version()) as unknown as JsonUpdates;
    console.log('[spike] UNSEEN-case ops:', JSON.stringify(opsOf(frame)));
    console.log(
      '[spike] UNSEEN-case deps:',
      JSON.stringify(frame.changes.map((c) => ({ id: c.id, deps: c.deps }))),
    );

    // Merge both ways; confirm inheritance in the final state.
    sync(a, b);
    sync(b, a);
    const delta = a.getText('t').toDelta() as { insert: string; attributes?: Record<string, unknown> }[];
    console.log('[spike] merged delta:', JSON.stringify(delta));
    const plainRun = delta.find((d) => d.insert.includes('PLAIN'));
    console.log('[spike] PLAIN run attributes:', JSON.stringify(plainRun?.attributes ?? null));

    // Import bracketing on the RECEIVER (A imports B's frame): decode
    // exactly what an import delivered via pre/post VV bracket.
    const a2 = mkDoc(3);
    const b2 = mkDoc(4);
    a2.getText('t').insert(0, 'alpha bravo charlie delta');
    a2.commit();
    sync(a2, b2);
    a2.getText('t').mark({ start: 6, end: 19 }, 'highlight', { color: 'yellow' });
    a2.commit();
    b2.getText('t').insert(12, 'PLAIN');
    b2.commit();
    const pre = a2.version();
    sync(b2, a2); // the import whose content the heal must classify
    const imported = a2.exportJsonUpdates(pre, a2.version()) as unknown as JsonUpdates;
    console.log('[spike] import-bracket decoded ops:', JSON.stringify(opsOf(imported)));
    console.log(
      '[spike] import-bracket changes:',
      JSON.stringify(imported.changes.map((c) => ({ id: c.id, deps: c.deps }))),
    );
    expect(true).toBe(true);
  });
});
