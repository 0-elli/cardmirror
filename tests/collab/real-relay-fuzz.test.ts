// @vitest-environment jsdom
/**
 * Real-relay session fuzz — the web-collab prototype's confirmation rig
 * (2026-08-17). The other fuzzers stress the CRDT in memory; this one
 * drives FULL sessions (real schema, LoroSyncPlugin, encrypted
 * transport, SSE stream + catch-up) against an actual relay process —
 * the same stack and wire path the web prototype uses, minus the
 * browser chrome.
 *
 * Skipped unless REAL_RELAY_URL is set, so the normal suite never
 * depends on an external process:
 *
 *   REAL_RELAY_URL=http://localhost:8410/relay \
 *   REAL_RELAY_TOKEN=<token> \
 *   npx vitest run tests/collab/real-relay-fuzz.test.ts
 *
 * Knobs: FUZZ_SEEDS (default 3), FUZZ_ROUNDS (default 6),
 * FUZZ_PEERS (default 3, host included). Each round every peer applies
 * a few random edits (typing, marks, splits, small deletes, card
 * inserts) through its EditorView, with random mid-round stream
 * restarts (reconnect churn). Invariants per seed: every peer
 * converges to the same doc, and that doc passes schema validation.
 */

import { describe, it, expect } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { RoomsClient } from '../../src/editor/collab/room-client.js';
import { CollabSession } from '../../src/editor/collab/collab-session.js';
import { decodeShareCode } from '../../src/editor/collab/collab-crypto.js';
import { mkView, settle, sleep, cardNode, docOf, docText } from './_loro-helpers.js';
import type { EditorView } from 'prosemirror-view';

const URL_ = (process.env['REAL_RELAY_URL'] ?? '').trim();
const TOKEN = (process.env['REAL_RELAY_TOKEN'] ?? '').trim();
const SEEDS = Number(process.env['FUZZ_SEEDS'] ?? 3);
const SEED_START = Number(process.env['FUZZ_SEED_START'] ?? 1);
const ROUNDS = Number(process.env['FUZZ_ROUNDS'] ?? 6);
const PEERS = Number(process.env['FUZZ_PEERS'] ?? 3);

const FAST = { flushMs: 25, minBackoffMs: 20, maxBackoffMs: 60, catchUpMs: 60_000 };

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

function seedDoc(): PMNode {
  return docOf(
    cardNode('Tag one', ['alpha bravo charlie delta', 'echo foxtrot golf']),
    cardNode('Tag two', ['hotel india juliet kilo lima']),
    cardNode('Tag three', ['mike november oscar papa']),
  );
}

/** A random position inside some textblock, or null when unlucky. */
function textPos(view: EditorView, rnd: () => number): number | null {
  const doc = view.state.doc;
  for (let tries = 0; tries < 12; tries++) {
    const pos = 1 + Math.floor(rnd() * Math.max(1, doc.content.size - 2));
    try {
      const $pos = doc.resolve(pos);
      if ($pos.parent.isTextblock && $pos.parent.content.size > 0) return pos;
    } catch {
      /* out-of-range resolve — retry */
    }
  }
  return null;
}

function applyRandomOp(view: EditorView, rnd: () => number): void {
  const roll = rnd();
  try {
    if (roll < 0.45) {
      const pos = textPos(view, rnd);
      if (pos == null) return;
      const word = ` ${WORDS[Math.floor(rnd() * WORDS.length)]}`;
      view.dispatch(view.state.tr.insertText(word, pos));
    } else if (roll < 0.65) {
      const pos = textPos(view, rnd);
      if (pos == null) return;
      const $pos = view.state.doc.resolve(pos);
      const end = Math.min($pos.end(), pos + 1 + Math.floor(rnd() * 8));
      if (end <= pos) return;
      const mark =
        rnd() < 0.5 ? schema.marks['underline']!.create() : schema.marks['em']!.create();
      view.dispatch(view.state.tr.addMark(pos, end, mark));
    } else if (roll < 0.8) {
      const pos = textPos(view, rnd);
      if (pos == null) return;
      const $pos = view.state.doc.resolve(pos);
      const end = Math.min($pos.end(), pos + 1 + Math.floor(rnd() * 4));
      if (end <= pos) return;
      view.dispatch(view.state.tr.delete(pos, end));
    } else if (roll < 0.92) {
      const pos = textPos(view, rnd);
      if (pos == null) return;
      view.dispatch(view.state.tr.split(pos));
    } else {
      const tag = `Fuzz ${Math.floor(rnd() * 1000)}`;
      const card = cardNode(tag, [`inserted ${WORDS[Math.floor(rnd() * WORDS.length)]}`]);
      const at = view.state.doc.content.size;
      view.dispatch(view.state.tr.insert(at, card));
    }
  } catch {
    /* a structurally impossible roll (split at a boundary, etc.) is a skip */
  }
}

async function waitForConvergence(views: EditorView[], deadlineMs: number): Promise<boolean> {
  const start = Date.now();
  for (;;) {
    await settle();
    const first = views[0]!.state.doc;
    if (views.every((v) => v.state.doc.eq(first))) return true;
    if (Date.now() - start > deadlineMs) return false;
    await sleep(200);
  }
}

describe.skipIf(!URL_ || !TOKEN)('real-relay session fuzz (web prototype stack)', () => {
  it(
    `converges valid across ${SEEDS} seeds (${PEERS} peers, ${ROUNDS} rounds)`,
    async () => {
      for (let seed = SEED_START; seed < SEED_START + SEEDS; seed++) {
        const rnd = mulberry32(seed);
        const mkClient = () =>
          new RoomsClient({ baseUrl: () => URL_.replace(/\/+$/, ''), token: () => TOKEN });

        const { session: host, shareCode } = await CollabSession.host({
          pmDoc: seedDoc(),
          client: mkClient(),
          ...FAST,
        });
        const sessions = [host];
        const views = [mkView(host.plugins())];
        await settle();
        host.start();

        const decoded = decodeShareCode(shareCode)!;
        for (let p = 1; p < PEERS; p++) {
          const joiner = await CollabSession.join({ ...decoded, client: mkClient(), ...FAST });
          sessions.push(joiner);
          views.push(mkView(joiner.plugins()));
          await settle();
          joiner.start();
        }
        await sleep(150);

        for (let round = 0; round < ROUNDS; round++) {
          for (let p = 0; p < PEERS; p++) {
            const ops = 1 + Math.floor(rnd() * 3);
            for (let k = 0; k < ops; k++) applyRandomOp(views[p]!, rnd);
            // Reconnect churn: the travel-day cycle, compressed.
            if (rnd() < 0.15) sessions[p]!.restart();
          }
          await sleep(60 + Math.floor(rnd() * 120));
        }

        const converged = await waitForConvergence(views, 20_000);
        if (!converged) {
          console.error(
            `[real-relay-fuzz] seed ${seed} diverged:`,
            views.map((v) => docText(v.state.doc).slice(0, 120)),
          );
        }
        expect(converged).toBe(true);
        views[0]!.state.doc.check(); // throws on schema-invalid content

        for (const s of sessions) await s.stop();
        const roomClient = mkClient();
        await roomClient.deleteRoom(decoded.roomId).catch(() => {});
        for (const v of views) v.destroy();
      }
    },
    240_000,
  );
});
