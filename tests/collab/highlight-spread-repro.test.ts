// @vitest-environment jsdom
/**
 * INVESTIGATION ARTIFACT (2026-08-05 field report) — not a regression
 * suite for a fix; a scripted repro hunt for "large stretches of text
 * came out highlighted and nobody remembers highlighting them," reported
 * from a ~5-student co-editing session, fixed locally each time by undo.
 *
 * Modeled on tests/collab/collab-session.test.ts (P1 highlight-union
 * regression) and tests/collab/collab-invariants.test.ts (the
 * shrink×underline fusion heal, which documents the SAME Peritext
 * interior-inheritance mechanism this file targets, just for a
 * different mark — there is no equivalent heal for `highlight`).
 *
 * Known, by-design mechanism (not investigated here): `highlight` is
 * `inclusive: true` -> Peritext `expand: 'after'`
 * (collab-session.ts configTextStyle), so a concurrent insertion
 * EXACTLY at the right edge of a highlighted run inherits the
 * highlight. Scenario (a) measures how far that can carry when the
 * concurrent typist keeps going well past the boundary. Scenarios (b)
 * and (c) probe the mechanism collab-invariants.ts's doc comment
 * names explicitly: "Peritext range marks cover text concurrently
 * inserted INSIDE their range" (not just at the boundary), and Loro's
 * UndoManager "re-marking drifted ranges across interleaved remote
 * ops."
 *
 * Each scenario prints the resulting mark layout so a spread is
 * visible even when assertions are loose.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';
import { LoroUndoPlugin, undo as loroUndo, redo as loroRedo } from 'loro-prosemirror';
import { schema } from '../../src/schema/index.js';
import { collabInvariantHealPlugin } from '../../src/editor/collab/collab-invariants.js';
import { RoomsClient } from '../../src/editor/collab/room-client.js';
import { CollabSession } from '../../src/editor/collab/collab-session.js';
import { decodeShareCode } from '../../src/editor/collab/collab-crypto.js';
import { startRoomsMock, type RoomsMock } from './_rooms-mock.js';
import {
  createLoroPeers,
  syncAll,
  settle,
  sleep,
  mkView,
  docOf,
  para,
  simpleDoc,
  findText,
  rangeFullyMarked,
  addMarkOn,
  type LoroPeer,
} from './_loro-helpers.js';

const hlType = schema.marks['highlight']!;
const hl = () => hlType.create({ color: 'yellow' });

/** Print the highlight run-length-encoding of a doc's (single) paragraph
 *  text — visualizes exactly how far a highlight spread. */
function highlightRuns(d: PMNode): string {
  const out: string[] = [];
  d.descendants((n) => {
    if (n.isText) {
      const marked = hlType.isInSet(n.marks);
      out.push(`${marked ? '[HL]' : '[--]'}"${n.text}"`);
    }
    return true;
  });
  return out.join(' ');
}

/** Number of highlighted characters in the doc (sum over text nodes). */
function highlightedCharCount(d: PMNode): number {
  let n = 0;
  d.descendants((node) => {
    if (node.isText && hlType.isInSet(node.marks)) n += node.text!.length;
    return true;
  });
  return n;
}

/** Session-shaped peers: sync + undo + the (font_size-only) invariant
 *  heal, mirroring the production plugin stack (installSeams). */
async function sessionPeers(seed: PMNode, n: number): Promise<LoroPeer[]> {
  return createLoroPeers(seed, n, (ldoc) => [
    LoroUndoPlugin({ doc: ldoc as never }),
    collabInvariantHealPlugin(),
  ]);
}

describe('highlight-spread repro hunt', () => {
  it('(a) concurrent insert at + PAST the highlighted right edge', async () => {
    // A highlights "bravo charlie" (a two-word span). B, concurrently
    // (offline), types a long continuation starting exactly at that
    // span's right edge and keeps going — the way a student continues
    // drafting immediately after a card's highlighted quote ends.
    const seed = docOf(para('alpha bravo charlie delta echo foxtrot golf'));
    const [a, b] = await createLoroPeers(seed, 2);

    const span = findText(a!.doc(), 'bravo charlie');
    a!.view.dispatch(a!.view.state.tr.addMark(span.from, span.to, hl()));
    await settle();

    // B, unaware A is highlighting anything (offline), positions the
    // cursor right after "charlie" (before the space + "delta") and
    // types a full sentence — 60+ characters, well past a single
    // boundary character.
    const insertAt = findText(b!.doc(), 'charlie').to;
    const longRun = ' MOREOVER the subsequent analysis extends this warrant considerably';
    b!.view.dispatch(b!.view.state.tr.insertText(longRun, insertAt));
    await settle();

    await syncAll([a!, b!]);
    console.log('(a) runs:', highlightRuns(a!.doc()));
    console.log('(a) highlighted chars:', highlightedCharCount(a!.doc()));

    expect(a!.doc().eq(b!.doc())).toBe(true);
    // What A actually selected: "bravo charlie" = 13 chars.
    const deliberate = findText(a!.doc(), 'bravo charlie');
    expect(rangeFullyMarked(a!.doc(), deliberate.from, deliberate.to, hlType, { color: 'yellow' })).toBe(
      true,
    );
    // Measure the spread: how many of B's 70 inserted chars got pulled
    // into the highlight because the insertion landed at the
    // expand:'after' edge. Walk text nodes starting at the insertion
    // point and count a highlighted prefix.
    const insertPos = findText(a!.doc(), 'MOREOVER the subsequent').from;
    let inheritedPrefixLen = 0;
    let counting = true;
    a!.doc().nodesBetween(insertPos, a!.doc().content.size, (node, pos) => {
      if (!node.isText || !counting) return true;
      const nodeStart = Math.max(pos, insertPos);
      const text = (node.text ?? '').slice(nodeStart - pos);
      if (hlType.isInSet(node.marks)) {
        inheritedPrefixLen += text.length;
      } else {
        counting = false;
      }
      return true;
    });
    console.log('(a) chars of B\'s insertion inherited into the highlight:', inheritedPrefixLen, '/', longRun.length);
    a!.destroy();
    b!.destroy();
  });

  it('(b) concurrent insert STRICTLY INSIDE the highlighted range (not at a boundary)', async () => {
    // A highlights the whole connective span. B, concurrently, inserts
    // new text in the MIDDLE of that span (not touching either edge) —
    // ordinary typing/editing that happens to land inside the highlight
    // once positions are re-resolved after merge.
    const seed = docOf(para('intro CONNECTIVE MIDDLE SPAN TEXT outro'));
    const [a, b] = await createLoroPeers(seed, 2);

    const span = findText(a!.doc(), 'CONNECTIVE MIDDLE SPAN TEXT');
    a!.view.dispatch(a!.view.state.tr.addMark(span.from, span.to, hl()));
    await settle();

    // Strictly interior: inside "MIDDLE", nowhere near either edge of
    // the highlighted span.
    const at = findText(b!.doc(), 'MIDDLE').from + 3;
    b!.view.dispatch(b!.view.state.tr.insertText('XXINSERTEDXX', at));
    await settle();

    await syncAll([a!, b!]);
    await syncAll([a!, b!]);
    console.log('(b) runs:', highlightRuns(a!.doc()));

    expect(a!.doc().eq(b!.doc())).toBe(true);
    // Does the interior-inserted text carry the highlight mark neither
    // peer explicitly applied to it?
    const inserted = findText(a!.doc(), 'XXINSERTEDXX');
    const insertedIsHighlighted = rangeFullyMarked(a!.doc(), inserted.from, inserted.to, hlType, {
      color: 'yellow',
    });
    console.log('(b) interior insert inherited highlight:', insertedIsHighlighted);
    // No assertion forced here (this IS the open question) — but record
    // the finding unambiguously for the report.
    expect(typeof insertedIsHighlighted).toBe('boolean');
    a!.destroy();
    b!.destroy();
  });

  it('(c) session undo/redo of an UNRELATED edit re-marks a drifted highlight range', async () => {
    // Mirrors collab-invariants.test.ts's "heals undo/redo range drift"
    // scenario exactly, but with `highlight` (which has no heal) instead
    // of the protected font_size case.
    const seed = docOf(para('intro CONNECTIVE TEXT HERE outro, and a second clause follows'));
    const [a, b] = await sessionPeers(seed, 2);

    // A highlights the connective span.
    const span = findText(a!.doc(), 'CONNECTIVE TEXT HERE');
    a!.view.dispatch(a!.view.state.tr.addMark(span.from, span.to, hl()));
    await settle();
    await syncAll([a!, b!]);

    // B concurrently inserts text inside the highlighted span (as in
    // scenario b) — this is what the undo/redo cycle will interact with.
    const at = findText(b!.doc(), 'TEXT').from;
    b!.view.dispatch(b!.view.state.tr.insertText('INSERTED ', at));
    await settle();
    await syncAll([a!, b!]);
    console.log('(c) after merge, before undo:', highlightRuns(a!.doc()));

    // A now does something UNRELATED — types in the second clause — and
    // undoes THAT via the session's Loro undo manager. Per the
    // collab-invariants.ts doc comment, "Loro's UndoManager re-marks
    // drifted ranges across interleaved remote ops" for range marks in
    // general; this checks whether `highlight` (unprotected) drifts.
    const clause = findText(a!.doc(), 'second clause');
    a!.view.dispatch(a!.view.state.tr.insertText('UNRELATED ', clause.from));
    await settle();
    await syncAll([a!, b!]);

    loroUndo(a!.view.state, a!.view.dispatch);
    await settle();
    loroRedo(a!.view.state, a!.view.dispatch);
    await settle();
    await syncAll([a!, b!]);
    await syncAll([a!, b!]);

    console.log('(c) after undo/redo of the UNRELATED edit:', highlightRuns(a!.doc()));
    console.log('(c) highlighted chars before vs threshold check follows');

    expect(a!.doc().eq(b!.doc())).toBe(true);
    a!.destroy();
    b!.destroy();
  });

  it('(c2) undo/redo of the HIGHLIGHT OP ITSELF, interleaved with a concurrent interior insert', async () => {
    // Sharper version of (c): collab-invariants.test.ts's own comment
    // says redo "re-marks the full current extent INCLUDING the remote
    // insert" for font_size — this applies the identical undo(highlight)
    // -> concurrent-interior-insert -> redo(highlight) interleaving from
    // that suite's "heals undo/redo range drift" test, but on `highlight`
    // (unprotected — no heal exists for it).
    const seed = docOf(para('intro CONNECTIVE TEXT HERE outro'));
    const [a, b] = await sessionPeers(seed, 2);

    const span = findText(a!.doc(), 'CONNECTIVE TEXT HERE');
    a!.view.dispatch(a!.view.state.tr.addMark(span.from, span.to, hl()));
    await settle();
    await syncAll([a!, b!]);
    console.log('(c2) after initial highlight, both peers:', highlightRuns(a!.doc()));

    // Remote interior insert lands inside the highlighted span.
    const at = findText(b!.doc(), 'TEXT').from;
    b!.view.dispatch(b!.view.state.tr.insert(at, schema.text('INSERTED ')));
    await settle();
    await syncAll([a!, b!]);
    console.log('(c2) after remote interior insert:', highlightRuns(a!.doc()));

    // A undoes then redoes THEIR OWN highlight op via the session undo
    // manager (not an unrelated edit this time).
    loroUndo(a!.view.state, a!.view.dispatch);
    await settle();
    console.log('(c2) after undo of the highlight op:', highlightRuns(a!.doc()));
    loroRedo(a!.view.state, a!.view.dispatch);
    await settle();
    await syncAll([a!, b!]);
    await syncAll([a!, b!]);

    console.log('(c2) after redo:', highlightRuns(a!.doc()));
    console.log('(c2) highlighted chars after redo:', highlightedCharCount(a!.doc()));
    expect(a!.doc().eq(b!.doc())).toBe(true);
    a!.destroy();
    b!.destroy();
  });

  it('(d) offline concurrent highlight vs a full paragraph retyped inside it', async () => {
    // Bigger-magnitude version of (b): B doesn't just insert a few
    // characters inside A's highlighted range — B deletes a chunk of
    // the highlighted span and retypes a full replacement sentence
    // while offline, then reconnects.
    const seed = docOf(
      para(
        'The uncontested empirical warrant establishes causation beyond reasonable doubt in every credible study.',
      ),
    );
    const [a, b] = await createLoroPeers(seed, 2);

    const span = findText(
      a!.doc(),
      'empirical warrant establishes causation beyond reasonable doubt',
    );
    a!.view.dispatch(a!.view.state.tr.addMark(span.from, span.to, hl()));
    await settle();

    // B deletes "establishes causation" (interior of the span) and
    // retypes a longer replacement — offline, unaware of A's highlight.
    const del = findText(b!.doc(), 'establishes causation');
    const tr = b!.view.state.tr.delete(del.from, del.to);
    tr.insertText('proves definitively the direct link between', del.from);
    b!.view.dispatch(tr);
    await settle();

    await syncAll([a!, b!]);
    await syncAll([a!, b!]);
    console.log('(d) runs:', highlightRuns(a!.doc()));
    console.log('(d) highlighted chars:', highlightedCharCount(a!.doc()));

    expect(a!.doc().eq(b!.doc())).toBe(true);
    const replacement = findText(a!.doc(), 'proves definitively the direct link between');
    const replacementHighlighted = rangeFullyMarked(
      a!.doc(),
      replacement.from,
      replacement.to,
      hlType,
      { color: 'yellow' },
    );
    console.log('(d) B\'s retyped replacement inherited highlight:', replacementHighlighted);
    expect(typeof replacementHighlighted).toBe('boolean');
    a!.destroy();
    b!.destroy();
  });
});

describe('highlight-spread repro hunt — full CollabSession stack (cross-check of scenario a)', () => {
  // Scenario (a) above, run through createLoroPeers, showed ZERO chars of
  // B's boundary-adjacent insertion inherited into A's highlight — despite
  // `highlight` being configured `expand: 'after'`. That is surprising
  // given the stated by-design boundary-inherit mechanism, and
  // createLoroPeers's peer docs get `configTextStyle` only indirectly (via
  // LoroSyncPlugin's lazy init, AFTER `ldoc.import(snapshot)`), unlike
  // production's `CollabSession`, which calls `configTextStyle` before any
  // content exists on the doc. This block re-runs the same boundary
  // scenario through the REAL `CollabSession` + encrypted-relay-mock stack
  // (identical harness to the P1 regression test) to rule out a
  // createLoroPeers-harness artifact before concluding anything about the
  // by-design mechanism's real-world reach.
  let mock: RoomsMock;
  let client: RoomsClient;
  const FAST = { flushMs: 25, minBackoffMs: 20, maxBackoffMs: 60, catchUpMs: 60_000 };

  beforeAll(async () => {
    mock = await startRoomsMock();
    client = new RoomsClient({ baseUrl: () => mock.url, token: () => mock.token });
  });
  afterAll(async () => {
    await mock.close();
  });

  it('(a2) boundary insert through the production CollabSession stack', async () => {
    const { session: host, shareCode } = await CollabSession.host({
      pmDoc: simpleDoc('alpha bravo charlie delta echo foxtrot golf'),
      client,
      ...FAST,
    });
    const hostView = mkView(host.plugins());
    await settle();
    host.start();
    const joiner = await CollabSession.join({ ...decodeShareCode(shareCode)!, client, ...FAST });
    const joinView = mkView(joiner.plugins());
    await settle();
    joiner.start();
    await sleep(80);

    // Go offline (mirrors the P1 test and the travel-day test).
    mock.pause();
    host.restart();
    joiner.restart();
    await sleep(60);

    const green = schema.marks['highlight']!.create({ color: 'green' });
    addMarkOn(hostView, 'bravo charlie', green);
    // Joiner concurrently types a long run starting exactly at the
    // highlighted span's right edge, unaware A is highlighting anything.
    const insertAt = findText(joinView.state.doc, 'charlie').to;
    const longRun = ' MOREOVER the subsequent analysis extends this warrant considerably';
    joinView.dispatch(joinView.state.tr.insertText(longRun, insertAt));
    await sleep(120);

    mock.resume();
    await sleep(500);

    expect(joinView.state.doc.eq(hostView.state.doc)).toBe(true);
    console.log('(a2) runs:', highlightRuns(hostView.state.doc));
    const deliberate = findText(hostView.state.doc, 'bravo charlie');
    expect(
      rangeFullyMarked(hostView.state.doc, deliberate.from, deliberate.to, hlType, {
        color: 'green',
      }),
    ).toBe(true);

    const insertPos = findText(hostView.state.doc, 'MOREOVER the subsequent').from;
    let inheritedPrefixLen = 0;
    let counting = true;
    hostView.state.doc.nodesBetween(insertPos, hostView.state.doc.content.size, (node, pos) => {
      if (!node.isText || !counting) return true;
      const nodeStart = Math.max(pos, insertPos);
      const text = (node.text ?? '').slice(nodeStart - pos);
      if (hlType.isInSet(node.marks)) inheritedPrefixLen += text.length;
      else counting = false;
      return true;
    });
    console.log(
      "(a2) chars of B's insertion inherited into the highlight (full stack):",
      inheritedPrefixLen,
      '/',
      longRun.length,
    );

    await joiner.stop();
    await host.stop();
    hostView.destroy();
    joinView.destroy();
  });
});
