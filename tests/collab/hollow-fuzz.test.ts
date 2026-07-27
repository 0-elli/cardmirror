// @vitest-environment jsdom
/**
 * Seeded convergence fuzz for the hollow-container heal: 3 Loro-bound
 * peers, rounds of ordinary concurrent edits (insert/delete/marks)
 * interleaved with randomly-injected CRDT sabotage (hollowed heads,
 * fully-emptied containers, duplicate blank/text heads — delivered as
 * remote imports via sabotageBlob), under all three leader
 * configurations (single leader, degraded all-leader, no leader).
 * Invariants per seed after quiescence: every peer's doc identical,
 * schema-valid, and no display-heal sentinel left uncanonicalized
 * (the all-peer write-back completed).
 */

import { describe, it, expect } from 'vitest';
import type { LoroDoc } from 'loro-crdt';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { collabRepairPlugin } from '../../src/editor/collab/collab-repair.js';
import {
  createLoroPeers,
  syncAll,
  settle,
  docOf,
  para,
  cardNode,
  type LoroPeer,
} from './_loro-helpers.js';
import {
  findContainers,
  hollowContainer,
  insertDuplicateHead,
  sabotageBlob,
} from './_hollow-helpers.js';
import { LoroMap } from 'loro-crdt';

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

const WORDS = ['impact', 'link', 'warrant', 'uniqueness', 'solvency'];

function randomEdit(rnd: () => number, p: LoroPeer): void {
  const view = p.view;
  const blocks: Array<{ start: number; end: number }> = [];
  p.doc().descendants((node, pos) => {
    if (node.isTextblock) {
      blocks.push({ start: pos + 1, end: pos + 1 + node.content.size });
      return false;
    }
    return true;
  });
  if (!blocks.length) return;
  const b = blocks[Math.floor(rnd() * blocks.length)]!;
  const pos = b.start + Math.floor(rnd() * Math.max(1, b.end - b.start));
  try {
    const roll = rnd();
    if (roll < 0.5) {
      view.dispatch(
        view.state.tr.insertText(` ${WORDS[Math.floor(rnd() * WORDS.length)]}`, pos),
      );
    } else if (roll < 0.8) {
      const to = Math.min(b.end, pos + 1 + Math.floor(rnd() * 5));
      if (to > pos) view.dispatch(view.state.tr.delete(pos, to));
    } else {
      const to = Math.min(b.end, pos + 2 + Math.floor(rnd() * 8));
      if (to > pos) {
        view.dispatch(
          view.state.tr.addMark(pos, to, schema.marks['highlight']!.create({ color: 'yellow' })),
        );
      }
    }
  } catch {
    /* op landed on a stale position — irrelevant to the invariants */
  }
}

function randomSabotage(rnd: () => number, d: LoroDoc): void {
  const targets = findContainers(d, (m) => {
    const n = m.get('nodeName');
    return n === 'card' || n === 'analytic_unit';
  });
  if (!targets.length) return;
  const t = targets[Math.floor(rnd() * targets.length)]!;
  const headName = (t as LoroMap).get('nodeName') === 'card' ? ('tag' as const) : ('analytic' as const);
  const roll = rnd();
  if (roll < 0.35) hollowContainer(d, t, headName);
  else if (roll < 0.55) hollowContainer(d, t, '*');
  else if (roll < 0.8) insertDuplicateHead(d, t, headName, 1, `fz-blank-${Math.floor(rnd() * 1e6)}`);
  else insertDuplicateHead(d, t, headName, 1, `fz-text-${Math.floor(rnd() * 1e6)}`, 'fuzz stray');
}

function sentinelFree(p: LoroPeer): boolean {
  let clean = true;
  p.doc().descendants((node) => {
    if (node.type.name === 'tag' || node.type.name === 'analytic') {
      if (String(node.attrs['id'] ?? '').startsWith('crdt-heal-')) clean = false;
      return false;
    }
    return true;
  });
  return clean;
}

const seedDoc = () =>
  docOf(
    para('Opening analysis paragraph for the fuzz document.'),
    cardNode('First tag heading', ['first body evidence text with words to edit.']),
    cardNode('Second tag heading', ['second body evidence text, also editable.']),
    schema.nodes['analytic_unit']!.createChecked(null, [
      schema.nodes['analytic']!.create({ id: newHeadingId() }, schema.text('Analytic heading')),
      schema.nodes['card_body']!.create(null, schema.text('analytic body content here.')),
    ]),
    para('Closing paragraph.'),
  );

describe('hollow-container convergence fuzz', () => {
  const SEEDS = 12;
  for (let seed = 1; seed <= SEEDS; seed++) {
    it(`seed ${seed} converges valid with sabotage under leader config ${seed % 3}`, async () => {
      const rnd = mulberry32(seed * 7919);
      const leaderCfg = seed % 3; // 0: single leader, 1: all leaders, 2: none
      let peerIndex = 0;
      const peers = await createLoroPeers(seedDoc(), 3, () => {
        const mine = peerIndex++;
        return [
          collabRepairPlugin(() => (leaderCfg === 0 ? mine === 0 : leaderCfg === 1)),
        ];
      });
      try {
        for (let round = 0; round < 6; round++) {
          for (const p of peers) {
            const ops = 1 + Math.floor(rnd() * 3);
            for (let i = 0; i < ops; i++) randomEdit(rnd, p);
          }
          if (rnd() < 0.45) {
            const victim = peers[Math.floor(rnd() * peers.length)]!;
            const blob = sabotageBlob(victim.exportAll(), (d) => randomSabotage(rnd, d));
            // Deliver to a random subset (at least one peer) — partial
            // delivery models partition timing.
            for (const p of peers) {
              if (p === victim || rnd() < 0.6) p.import(blob);
            }
            await settle(2);
          }
          if (rnd() < 0.5) {
            await syncAll(peers);
            await settle(3);
          }
        }
        // Quiescence: full exchanges + repair settling.
        for (let i = 0; i < 4; i++) {
          await syncAll(peers);
          await settle(5);
        }
        await syncAll(peers);
        await settle(3);

        for (const p of peers) {
          expect(() => p.doc().check()).not.toThrow();
          expect(sentinelFree(p)).toBe(true);
        }
        for (let i = 1; i < peers.length; i++) {
          expect(peers[0]!.doc().eq(peers[i]!.doc())).toBe(true);
        }
      } finally {
        for (const p of peers) p.destroy();
      }
    });
  }
});
