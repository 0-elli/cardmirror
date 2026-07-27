// @vitest-environment jsdom
/**
 * Adversarial convergence suite for the hollow-container heal —
 * scenarios DESIGNED to produce desync or data loss: partitioned
 * double-sabotage, sabotage racing live edits, degraded-leader
 * write-back races, re-hollowing an already-healed card, triple
 * heads, and late joiners at the messiest moments. Every scenario
 * asserts the invariant triple: all-peer convergence (`doc.eq`),
 * schema validity (`check()`), and content preservation where content
 * should survive.
 *
 * Sabotage is delivered via `sabotageBlob` — forked-doc mutations
 * imported as genuine REMOTE updates — so every peer (including the
 * "author" of the sabotage) processes it through the binding's real
 * event path. See _hollow-helpers.ts for why mutating a live peer's
 * own ldoc is a harness artifact.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { collabRepairPlugin } from '../../src/editor/collab/collab-repair.js';
import {
  createLoroPeers,
  joinPeerFromBlob,
  syncAll,
  settle,
  docOf,
  para,
  cardNode,
  docText,
  typeAfter,
  type LoroPeer,
} from './_loro-helpers.js';
import {
  containerOf,
  hollowContainer,
  insertDuplicateHead,
  sabotageBlob,
} from './_hollow-helpers.js';
import type { Node as PMNode } from 'prosemirror-model';

let peers: LoroPeer[] = [];
afterEach(() => {
  for (const p of peers) p.destroy();
  peers = [];
});

const seed = () =>
  docOf(
    para('intro paragraph'),
    cardNode('Alpha tag', ['alpha body evidence']),
    cardNode('Beta tag', ['beta body evidence']),
  );

/** All-leader (degraded presence) repair plugins for every peer. */
const degradedRepair = () => [collabRepairPlugin(() => true)];

function assertInvariants(
  ps: LoroPeer[],
  mustContain: string[],
  mustNotContain: string[] = [],
): void {
  for (const p of ps) {
    expect(() => p.doc().check()).not.toThrow();
    for (const s of mustContain) expect(docText(p.doc())).toContain(s);
    for (const s of mustNotContain) expect(docText(p.doc())).not.toContain(s);
  }
  for (let i = 1; i < ps.length; i++) {
    expect(ps[0]!.doc().eq(ps[i]!.doc())).toBe(true);
  }
}

/** Sync + let repairs fire + sync the repairs, a few rounds. */
async function converge(ps: LoroPeer[]): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await syncAll(ps);
    await settle(5);
  }
  await syncAll(ps);
}

function tagCount(doc: PMNode): number {
  let n = 0;
  doc.descendants((node) => {
    if (node.type.name === 'tag') n++;
    return true;
  });
  return n;
}

describe('adversarial hollow-merge convergence', () => {
  it('partitioned double-sabotage: one side hollows the tag, the other hollows everything', async () => {
    peers = await createLoroPeers(seed(), 2, degradedRepair);
    const [a, b] = peers as [LoroPeer, LoroPeer];
    // Partition: each side receives a DIFFERENT sabotage of the same card.
    a.import(
      sabotageBlob(a.exportAll(), (d) =>
        hollowContainer(d, containerOf(d, 'card', 'Alpha tag'), 'tag'),
      ),
    );
    b.import(
      sabotageBlob(b.exportAll(), (d) =>
        hollowContainer(d, containerOf(d, 'card', 'Alpha tag'), '*'),
      ),
    );
    await settle(3);
    await converge(peers);
    // Union of deletes = fully empty → card gone; Beta untouched.
    assertInvariants(peers, ['beta body evidence'], ['alpha body evidence', 'Alpha tag']);
  });

  it('sabotage races a live edit: the tag vanishes while the other peer types into the body', async () => {
    peers = await createLoroPeers(seed(), 2, degradedRepair);
    const [a, b] = peers as [LoroPeer, LoroPeer];
    a.import(
      sabotageBlob(a.exportAll(), (d) =>
        hollowContainer(d, containerOf(d, 'card', 'Alpha tag'), 'tag'),
      ),
    );
    typeAfter(b.view, 'alpha body evidence', ' FRESH WORK');
    await settle(3);
    await converge(peers);
    // B's typing must survive inside the healed (blank-tagged) card.
    assertInvariants(peers, ['alpha body evidence FRESH WORK', 'beta body evidence']);
    expect(tagCount(peers[0]!.doc())).toBe(2); // Alpha healed blank + Beta original
  });

  it('degraded-leader write-back race: both peers canonicalize the same heal concurrently', async () => {
    peers = await createLoroPeers(seed(), 2, degradedRepair);
    const [a, b] = peers as [LoroPeer, LoroPeer];
    // Same hollow blob lands on BOTH peers at once: both display the
    // heal and both (all-leader) write back concurrently on next sync.
    const blob = sabotageBlob(a.exportAll(), (d) =>
      hollowContainer(d, containerOf(d, 'card', 'Alpha tag'), 'tag'),
    );
    a.import(blob);
    b.import(blob);
    await settle(5);
    await converge(peers);
    assertInvariants(peers, ['alpha body evidence', 'beta body evidence']);
    // Exactly one head per card survives the concurrent write-backs.
    expect(tagCount(peers[0]!.doc())).toBe(2);
  });

  it('re-hollowing an already-healed card converges again', async () => {
    peers = await createLoroPeers(seed(), 2, degradedRepair);
    const [a] = peers as [LoroPeer, LoroPeer];
    a.import(
      sabotageBlob(a.exportAll(), (d) =>
        hollowContainer(d, containerOf(d, 'card', 'Alpha tag'), 'tag'),
      ),
    );
    await settle(3);
    await converge(peers);
    assertInvariants(peers, ['alpha body evidence']);
    // Round 2: delete the written-back blank head too.
    a.import(
      sabotageBlob(a.exportAll(), (d) =>
        hollowContainer(d, containerOf(d, 'card', 'alpha body'), 'tag'),
      ),
    );
    await settle(3);
    await converge(peers);
    assertInvariants(peers, ['alpha body evidence', 'beta body evidence']);
    expect(tagCount(peers[0]!.doc())).toBe(2);
  });

  it('triple head: original + blank duplicate + text-carrying duplicate', async () => {
    peers = await createLoroPeers(seed(), 2, degradedRepair);
    const [a] = peers as [LoroPeer, LoroPeer];
    const blob = sabotageBlob(a.exportAll(), (d) => {
      const card = containerOf(d, 'card', 'Alpha tag');
      insertDuplicateHead(d, card, 'tag', 1, 'dup-blank');
      insertDuplicateHead(d, card, 'tag', 2, 'dup-text', 'stray heading words');
    });
    for (const p of peers) p.import(blob);
    await settle(3);
    await converge(peers);
    // One head; the text-carrying duplicate demoted, not lost.
    assertInvariants(peers, ['Alpha tag', 'stray heading words', 'alpha body evidence']);
    // Displays converge on ONE Alpha head even while the CRDT still
    // holds the duplicates (reconciliation happens on next card edit).
    expect(tagCount(peers[0]!.doc())).toBe(2);
  });

  it('analytic unit: hollowed head heals and converges identically', async () => {
    const analytic = schema.nodes['analytic_unit']!.createChecked(null, [
      schema.nodes['analytic']!.create({ id: newHeadingId() }, schema.text('Analytic head')),
      schema.nodes['card_body']!.create(null, schema.text('analytic body text')),
    ]);
    peers = await createLoroPeers(docOf(para('intro'), analytic), 2, degradedRepair);
    const [a] = peers as [LoroPeer, LoroPeer];
    a.import(
      sabotageBlob(a.exportAll(), (d) =>
        hollowContainer(d, containerOf(d, 'analytic_unit'), 'analytic'),
      ),
    );
    await settle(3);
    await converge(peers);
    assertInvariants(peers, ['analytic body text'], ['Analytic head']);
    let analytics = 0;
    peers[0]!.doc().descendants((n) => {
      if (n.type.name === 'analytic') analytics++;
      return true;
    });
    expect(analytics).toBe(1); // healed blank head
  });

  it('emptied card + concurrent insert into it converges validly', async () => {
    peers = await createLoroPeers(seed(), 2, degradedRepair);
    const [a, b] = peers as [LoroPeer, LoroPeer];
    a.import(
      sabotageBlob(a.exportAll(), (d) =>
        hollowContainer(d, containerOf(d, 'card', 'Alpha tag'), '*'),
      ),
    );
    typeAfter(b.view, 'alpha body evidence', ' SURVIVOR');
    await settle(3);
    await converge(peers);
    // Loro semantics: B's typing lives inside a body TEXT whose
    // containing element A's sabotage deleted — the container delete
    // wins, so this converges to card-gone. The point of this test is
    // the invariant PAIR: however the CRDT resolves it, no peer may
    // diverge or hold an invalid doc.
    for (let i = 1; i < peers.length; i++) {
      expect(peers[0]!.doc().eq(peers[i]!.doc())).toBe(true);
    }
    for (const p of peers) expect(() => p.doc().check()).not.toThrow();
  });

  it('late joiner lands mid-chaos; an ordinary edit reconciles everyone', async () => {
    peers = await createLoroPeers(seed(), 2, degradedRepair);
    const [a, b] = peers as [LoroPeer, LoroPeer];
    const hollowAlpha = sabotageBlob(a.exportAll(), (d) =>
      hollowContainer(d, containerOf(d, 'card', 'Alpha tag'), 'tag'),
    );
    const dupBeta = sabotageBlob(b.exportAll(), (d) =>
      insertDuplicateHead(d, containerOf(d, 'card', 'Beta tag'), 'tag', 1, 'chaos-dup', 'stray'),
    );
    a.import(hollowAlpha);
    a.import(dupBeta);
    b.import(hollowAlpha);
    b.import(dupBeta);
    // Joiner boots from the RAW pre-repair chaos state.
    const joiner = await joinPeerFromBlob(a.exportAll(), degradedRepair);
    peers.push(joiner);
    await settle(5);
    await converge(peers);
    // All displays healed identically: blank-headed Alpha, demoted
    // 'stray' in Beta. The demotion is display-layer until a real
    // edit inside Beta lets the sync diff rewrite the CRDT children.
    assertInvariants(peers, ['alpha body evidence', 'beta body evidence', 'stray']);
    typeAfter(a.view, 'beta body evidence', ' RECONCILE');
    await converge(peers);
    assertInvariants(peers, [
      'alpha body evidence',
      'beta body evidence RECONCILE',
      'stray',
    ]);
    expect(tagCount(peers[0]!.doc())).toBe(2);
  });
});
