// @vitest-environment jsdom
/**
 * CRDT hollow-container merges — the silent-card-loss bug (2026-07-26
 * structural-integrity audit, finding: "CRDT silent card loss").
 *
 * Concurrent locally-valid edits can merge, element-wise in the CRDT,
 * into a container that violates the ProseMirror schema (a card whose
 * children list lost its tag, or lost everything) — a state no peer
 * ever saw. loro-prosemirror's materializer builds nodes with the
 * CHECKED constructor; before the heal, its catch dropped the whole
 * node (console.error → null → parent filter), silently deleting the
 * card AND any surviving content on every reconstructing peer.
 *
 * Target behavior locked in here:
 *  - headless-with-content → healed in DISPLAY on every peer
 *    (deterministic sentinel head derived from the stable container
 *    id, so peers can't diverge), content preserved, docs valid;
 *  - fully-empty → dropped (the union of deletes reads as "card
 *    gone"; nothing inside to lose) — convergent and valid;
 *  - the LEADER's repair pass canonicalizes the sentinel head and its
 *    ordinary synced transaction writes the head back into the CRDT,
 *    so a fresh joiner materializes cleanly with no heal at all.
 *
 * The hollow state is injected by editing the card's CRDT children
 * list directly — simulating the merged outcome without depending on
 * any particular PM-level interleaving to produce it.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { LoroMap, LoroList, LoroText, type LoroDoc } from 'loro-crdt';
import { schema } from '../../src/schema/index.js';
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
  type LoroPeer,
} from './_loro-helpers.js';

/** Depth-first search for a node container in the Loro tree. */
function findContainer(
  ldoc: LoroDoc,
  pred: (m: LoroMap) => boolean,
): LoroMap | null {
  const stack: LoroMap[] = [ldoc.getMap('doc') as unknown as LoroMap];
  while (stack.length) {
    const m = stack.pop()!;
    if (pred(m)) return m;
    const kids = m.get('children');
    if (kids instanceof LoroList) {
      for (let i = 0; i < kids.length; i++) {
        const c = kids.get(i);
        if (c instanceof LoroMap) stack.push(c);
      }
    }
  }
  return null;
}

function cardContainer(ldoc: LoroDoc): LoroMap {
  const m = findContainer(ldoc, (x) => x.get('nodeName') === 'card');
  if (!m) throw new Error('no card container found');
  return m;
}

/** Delete children of the card by node name ('*' = all). */
function hollowCard(ldoc: LoroDoc, which: 'tag' | '*'): void {
  const kids = cardContainer(ldoc).get('children') as LoroList;
  for (let i = kids.length - 1; i >= 0; i--) {
    const c = kids.get(i);
    if (!(c instanceof LoroMap)) continue;
    if (which === '*' || c.get('nodeName') === which) kids.delete(i, 1);
  }
  ldoc.commit();
}

const seed = () =>
  docOf(para('intro paragraph'), cardNode('Original tag', ['body evidence text']));

/** Insert a duplicate head element into the card's CRDT children list —
 *  the shape the degraded-leader corner produces (two "leaders" both
 *  writing their blank head back concurrently). `text` non-empty
 *  models a duplicate that somehow carries typed content. */
function insertDuplicateHead(
  ldoc: LoroDoc,
  index: number,
  id: string,
  text = '',
): void {
  const kids = cardContainer(ldoc).get('children') as LoroList;
  const m = kids.insertContainer(index, new LoroMap());
  m.set('nodeName', 'tag');
  const attrs = m.setContainer('attributes', new LoroMap());
  attrs.set('id', id);
  const inner = m.setContainer('children', new LoroList());
  if (text) {
    const t = inner.insertContainer(0, new LoroText());
    t.insert(0, text);
  }
  ldoc.commit();
}

let peers: LoroPeer[] = [];
afterEach(() => {
  for (const p of peers) p.destroy();
  peers = [];
});

describe('hollow-container CRDT merges', () => {
  it('headless card with surviving content is healed, not dropped', async () => {
    peers = await createLoroPeers(seed(), 2);
    const [a, b] = peers as [LoroPeer, LoroPeer];

    // Simulate the merged CRDT state: the tag element lost, bodies kept.
    hollowCard(a.ldoc, 'tag');
    await syncAll(peers);

    for (const p of peers) {
      // The surviving body must NOT silently vanish (the old behavior
      // dropped the entire card here).
      expect(docText(p.doc())).toContain('body evidence text');
      // And the doc must be schema-valid: the card was re-headed.
      expect(() => p.doc().check()).not.toThrow();
      const card = firstCard(p);
      expect(card.firstChild!.type.name).toBe('tag');
    }
    // Deterministic heal ⇒ identical docs (same sentinel head id).
    expect(a.doc().eq(b.doc())).toBe(true);
  });

  it('fully-emptied card converges to "card gone" on every peer', async () => {
    peers = await createLoroPeers(seed(), 2);
    const [a, b] = peers as [LoroPeer, LoroPeer];

    hollowCard(a.ldoc, '*');
    await syncAll(peers);

    for (const p of peers) {
      expect(docText(p.doc())).toContain('intro paragraph');
      expect(docText(p.doc())).not.toContain('Original tag');
      expect(() => p.doc().check()).not.toThrow();
    }
    expect(a.doc().eq(b.doc())).toBe(true);
  });

  it('duplicate BLANK heads (degraded-leader double write-back) normalize to one', async () => {
    peers = await createLoroPeers(seed(), 2);
    const [a, b] = peers as [LoroPeer, LoroPeer];

    insertDuplicateHead(a.ldoc, 1, 'dup-blank-1');
    await syncAll(peers);

    for (const p of peers) {
      const card = firstCard(p);
      // One head, the ORIGINAL one — the empty duplicate is dropped,
      // never the whole card (the pre-hardening behavior).
      const tags: string[] = [];
      card.forEach((n) => {
        if (n.type.name === 'tag') tags.push(n.textContent);
      });
      expect(tags).toEqual(['Original tag']);
      expect(docText(p.doc())).toContain('body evidence text');
      expect(() => p.doc().check()).not.toThrow();
    }
    expect(a.doc().eq(b.doc())).toBe(true);
  });

  it('a duplicate head carrying text demotes to a body — nothing typed is lost', async () => {
    peers = await createLoroPeers(seed(), 2);
    const [a, b] = peers as [LoroPeer, LoroPeer];

    insertDuplicateHead(a.ldoc, 1, 'dup-text-1', 'stray typed words');
    await syncAll(peers);

    for (const p of peers) {
      const card = firstCard(p);
      expect(card.firstChild!.textContent).toBe('Original tag');
      const tagCount = countType(card, 'tag');
      expect(tagCount).toBe(1);
      expect(card.textContent).toContain('stray typed words'); // demoted, kept
      expect(docText(p.doc())).toContain('body evidence text');
      expect(() => p.doc().check()).not.toThrow();
    }
    expect(a.doc().eq(b.doc())).toBe(true);
  });

  it("leader repair writes the healed head back into the CRDT — a fresh joiner materializes clean", async () => {
    // Peer 0 is the leader; peer 1 a follower.
    let leaderView: unknown = null;
    peers = await createLoroPeers(seed(), 2, () => [
      collabRepairPlugin(function (this: unknown) {
        // Leader = peer 0. collabRepairPlugin calls isLeader() with no
        // args; close over creation order via the array index below.
        return leaderView === null || peers[0]?.view === leaderView;
      } as () => boolean),
    ]);
    leaderView = peers[0]!.view;

    hollowCard(peers[0]!.ldoc, 'tag');
    await syncAll(peers);
    // Let the leader's repair appendTransaction fire and sync out.
    await settle(5);
    await syncAll(peers);

    // A FRESH peer joining from the leader's full state must see a
    // valid card with a REAL (non-sentinel) tag — i.e. the repair
    // reached the CRDT itself, not just the leader's display.
    const joiner = await joinPeerFromBlob(peers[0]!.exportAll());
    peers.push(joiner);

    const card = firstCard(joiner);
    expect(card.firstChild!.type.name).toBe('tag');
    expect(String(card.firstChild!.attrs['id'] ?? '')).not.toContain('crdt-heal');
    expect(docText(joiner.doc())).toContain('body evidence text');
    expect(() => joiner.doc().check()).not.toThrow();
  });

  it('write-back needs NO leader — followers canonicalize too (mixed-version hardening)', async () => {
    // Nobody is leader: the all-peer half (buildMarkRepairTr) must
    // still land the head in the CRDT, so old-version peers would
    // materialize a valid card as soon as possible.
    peers = await createLoroPeers(seed(), 2, () => [collabRepairPlugin(() => false)]);

    hollowCard(peers[0]!.ldoc, 'tag');
    await syncAll(peers);
    await settle(5);
    await syncAll(peers);

    const joiner = await joinPeerFromBlob(peers[1]!.exportAll());
    peers.push(joiner);

    const card = firstCard(joiner);
    expect(card.firstChild!.type.name).toBe('tag');
    expect(String(card.firstChild!.attrs['id'] ?? '')).not.toContain('crdt-heal');
    expect(docText(joiner.doc())).toContain('body evidence text');
    expect(() => joiner.doc().check()).not.toThrow();
  });
});

function countType(node: import('prosemirror-model').Node, type: string): number {
  let n = 0;
  node.forEach((c) => {
    if (c.type.name === type) n++;
  });
  return n;
}

function firstCard(p: LoroPeer) {
  let found: import('prosemirror-model').Node | null = null;
  p.doc().descendants((n) => {
    if (found) return false;
    if (n.type.name === 'card') {
      found = n;
      return false;
    }
    return true;
  });
  if (!found) throw new Error('no card in PM doc');
  return found as import('prosemirror-model').Node;
}
