// @vitest-environment jsdom

/**
 * Canonical mark equality (binding patch hardening, 2026-08-14).
 *
 * Three verified variance sources made the binding's equality checks
 * call identical state "different" and hand redundant re-marks to the
 * write path:
 *  1. The wasm round-trip reorders object keys ({halfPoints, origin} in
 *     -> {origin, halfPoints} out) and the attr diff compared with
 *     JSON.stringify — every null-default-carrying mark re-diffed on
 *     every updateLoroText pass (trace-verified live).
 *  2. Peritext leaves permanent segmentation splits behind any
 *     mark-boundary history, while PM normalizes adjacent identical
 *     runs — eqLoroTextNodes' run-count precondition false-negatived
 *     forever, feeding unchanged texts into updateLoroText during
 *     reconciliation walks (and, via eqLoroObjNode, false-failing the
 *     reorder detector's content-equality residue matching).
 *  3. Null-valued attr keys vs absent keys (schema defaults make them
 *     semantically identical).
 *
 * Honest scope note: loro's applyDelta DEDUPES semantically-equal mark
 * re-application (verified — even key-reordered values emit no op), so
 * the pre-fix comparator's redundant output was absorbed at the wire
 * for value-equal ranges; `text.mark()` does NOT dedupe. The fix
 * removes the wasted diffing, the false-negative equality (with its
 * reorder-residue consequence), and the latent hazard should the
 * write path ever bypass applyDelta — it is hardening, not the proven
 * root cause of the 2026-08-14 mass-highlight burst, whose emitted
 * ops required genuine PM<->Loro divergence and remain under
 * investigation.
 *
 * The invariant pinned here: an edit emits mark ops ONLY for marks the
 * edit actually changed, across all three variance shapes.
 */

import { describe, it, expect } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import {
  createLoroPeers,
  syncAll,
  docText,
  settle,
  findText,
  type LoroPeer,
} from './_loro-helpers.js';

function markedCard(i: number): PMNode {
  return schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(`Tag ${i}`)),
    schema.nodes['card_body']!.create(null, [
      schema.text(`ANCHOR${i} plain lead `),
      // font_size carries a null-defaulted `origin` attr — the exact
      // shape whose key order the wasm round-trip flips.
      schema.text('minimized run ', [schema.marks['font_size']!.create({ halfPoints: 16 })]),
      schema.text('highlighted run ', [schema.marks['highlight']!.create({ color: 'yellow' })]),
      schema.text(`tail${i} text`),
    ]),
  ]);
}

const seedDoc = (n: number): PMNode =>
  schema.nodes['doc']!.createChecked(null, Array.from({ length: n }, (_, i) => markedCard(i)));

/** Mark ops this peer emitted since `from` (a version snapshot). */
function markOpsSince(peer: LoroPeer, from: unknown): number {
  const u = peer.ldoc.exportJsonUpdates(from as never) as {
    changes?: Array<{ ops?: Array<{ content?: { type?: string } }> }>;
  };
  let marks = 0;
  for (const c of u.changes ?? []) {
    for (const op of c.ops ?? []) if (op.content?.type === 'mark') marks++;
  }
  return marks;
}

function typeAt(peer: LoroPeer, needle: string, text: string): void {
  const r = findText(peer.view.state.doc, needle);
  peer.view.dispatch(peer.view.state.tr.insertText(text, r.to));
}

describe('canonical mark equality (no collateral re-marks)', () => {
  it('typing near null-default marks emits zero mark ops (key-order variance)', async () => {
    const peers = await createLoroPeers(seedDoc(1), 1);
    const a = peers[0]!;
    await settle();
    const before = a.ldoc.version();
    // Type into the unmarked tail of the SAME text container that holds
    // the font_size and highlight runs — pre-fix, this pass re-emitted
    // both marks because the stored values stringify key-order-flipped.
    typeAt(a, 'tail0', 'X');
    await settle();
    a.ldoc.commit();
    expect(markOpsSince(a, before), 'collateral mark ops from plain typing').toBe(0);
    peers.forEach((p) => p.destroy());
  }, 60_000);

  it('typing in a Peritext-fragmented text emits zero mark ops (segmentation variance)', async () => {
    const peers = await createLoroPeers(seedDoc(1), 1);
    const a = peers[0]!;
    // Create permanent segmentation splits: highlight part of the plain
    // lead, then unhighlight it. Content and marks end up IDENTICAL to
    // before, but Peritext keeps the split points forever.
    const r = findText(a.view.state.doc, 'plain lead');
    a.view.dispatch(
      a.view.state.tr.addMark(r.from, r.to, schema.marks['highlight']!.create({ color: 'yellow' })),
    );
    await settle();
    a.view.dispatch(a.view.state.tr.removeMark(r.from, r.to, schema.marks['highlight']!));
    await settle();
    a.ldoc.commit();

    const before = a.ldoc.version();
    typeAt(a, 'tail0', 'Y');
    await settle();
    a.ldoc.commit();
    expect(markOpsSince(a, before), 'collateral mark ops after fragmentation').toBe(0);
    peers.forEach((p) => p.destroy());
  }, 60_000);

  it('a local edit after remote churn emits zero collateral mark ops (the burst shape)', async () => {
    // The live burst: remote imports invalidate the mapping table, the
    // next local dispatch re-walks the tree, and every text with
    // representational variance re-emitted its whole layout.
    const peers = await createLoroPeers(seedDoc(8), 2);
    const [a, b] = peers as [LoroPeer, LoroPeer];
    await syncAll(peers);

    // Remote churn from B across several cards.
    for (const i of [1, 3, 5, 7]) typeAt(b, `tail${i}`, 'remote');
    await settle();
    await syncAll(peers);

    // A's next local edit must emit ops for ITS edit only.
    const before = a.ldoc.version();
    typeAt(a, 'tail0', 'Z');
    await settle();
    a.ldoc.commit();
    expect(markOpsSince(a, before), 'mass re-mark after remote churn').toBe(0);

    await syncAll(peers);
    expect(docText(a.doc())).toBe(docText(b.doc()));
    peers.forEach((p) => p.destroy());
  }, 60_000);

  it('genuine mark edits still emit exactly their ops', async () => {
    const peers = await createLoroPeers(seedDoc(1), 1);
    const a = peers[0]!;
    await settle();
    const before = a.ldoc.version();
    const r = findText(a.view.state.doc, 'plain lead');
    a.view.dispatch(
      a.view.state.tr.addMark(r.from, r.to, schema.marks['emphasis_mark']!.create()),
    );
    await settle();
    a.ldoc.commit();
    const emitted = markOpsSince(a, before);
    expect(emitted, 'the real mark op still flows').toBeGreaterThanOrEqual(1);
    expect(emitted, 'and nothing beyond the edited range').toBeLessThanOrEqual(3);
    peers.forEach((p) => p.destroy());
  }, 60_000);

  it('null-attr and key-order variants render as identical marks cross-peer', async () => {
    // End-to-end round trip: canonical writes + canonical compares must
    // not change what a peer SEES. Convergence with full mark fidelity.
    const peers = await createLoroPeers(seedDoc(2), 2);
    const [a, b] = peers as [LoroPeer, LoroPeer];
    await syncAll(peers);
    let sizes = 0;
    let highlights = 0;
    b.doc().descendants((n) => {
      for (const m of n.marks) {
        if (m.type.name === 'font_size' && m.attrs['halfPoints'] === 16) sizes++;
        if (m.type.name === 'highlight' && m.attrs['color'] === 'yellow') highlights++;
      }
    });
    expect(sizes, 'font_size marks survive the round trip').toBe(2);
    expect(highlights, 'highlight marks survive the round trip').toBe(2);
    expect(docText(a.doc())).toBe(docText(b.doc()));
    peers.forEach((p) => p.destroy());
  }, 60_000);
});
