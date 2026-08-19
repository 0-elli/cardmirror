/**
 * Web mailbox fuzz (web-collab Phase 4) — many DESKTOP senders (the
 * real Node keystore, so the wire is desktop-authentic) blasting one
 * WEB receiver (the actual web-mailbox singleton) through a real relay
 * process, with receiver churn (the delivery channel torn down and
 * rebuilt mid-flight, as tabs do). Invariants:
 *
 *   - EXACTLY-ONCE inbox delivery: every card lands once — no losses
 *     to churn, no duplicates from redelivery (a DELETE ack that loses
 *     the race with a reconnect catch-up redelivers; dedupe absorbs it)
 *   - the relay mailbox drains (acks actually happen)
 *
 * Skipped unless REAL_RELAY_URL is set (same contract as the rooms
 * fuzz):
 *
 *   REAL_RELAY_URL=http://127.0.0.1:8515/relay \
 *   REAL_RELAY_TOKEN=<token> \
 *   npx vitest run tests/pairing/web-mailbox-fuzz.test.ts
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import { mkdtempSync } from 'node:fs';

// ── Browser-shape stubs (node env; the mailbox touches these) ────────
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}
(globalThis as Record<string, unknown>)['window'] = {
  localStorage: makeStorage(),
  addEventListener: () => {},
  removeEventListener: () => {},
};
(globalThis as Record<string, unknown>)['document'] = {
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible',
};

import {
  createPairingKeystore,
  routingId,
  type PairingKeystore,
} from '../../apps/desktop/src/pairing-crypto.js';
import { webOwnPublicCode } from '../../src/editor/pairing/web-pairing-crypto.js';
import {
  webPairingConfigure,
  __resetWebMailboxForTests,
} from '../../src/editor/pairing/web-mailbox.js';
import { inboxStore } from '../../src/editor/pairing/inbox-store.js';
import { settings } from '../../src/editor/settings.js';
import { appVersion } from '../../src/editor/install-info.js';

const URL_ = (process.env['REAL_RELAY_URL'] ?? '').trim().replace(/\/+$/, '');
const TOKEN = (process.env['REAL_RELAY_TOKEN'] ?? '').trim();
const SENDERS = Number(process.env['FUZZ_SENDERS'] ?? 6);
const CARDS_EACH = Number(process.env['FUZZ_CARDS'] ?? 15);
const CHURNS = Number(process.env['FUZZ_CHURNS'] ?? 5);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mkSenders(n: number): PairingKeystore[] {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cm-mailbox-fuzz-'));
  return Array.from({ length: n }, (_, i) =>
    createPairingKeystore(path.join(dir, `sender-${i}.json`)),
  );
}

async function desktopSend(
  ks: PairingKeystore,
  recipientCode: string,
  label: string,
): Promise<boolean> {
  // Mirrors the desktop main process's wire shape (uncompressed —
  // Content-Encoding is optional; the relay gunzips conditionally).
  const inner = {
    schemaVersion: appVersion,
    senderCode: ks.ownPublicCode(),
    senderName: 'Fuzz sender',
    item: { label, type: 'card', sliceJson: { content: [label] } },
  };
  const bundle = ks.seal(inner, recipientCode);
  const body = { v: 1 as const, recipientCode: routingId(recipientCode), sentAt: Date.now(), ...bundle };
  const res = await fetch(`${URL_}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function relayMailboxCount(recipient: string): Promise<number> {
  const res = await fetch(`${URL_}/messages?recipient=${encodeURIComponent(recipient)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) return -1;
  const data = (await res.json()) as { messages?: unknown[] };
  return data.messages?.length ?? 0;
}

const CONFIG = {
  enabled: true,
  displayName: 'Web receiver',
  schemaVersion: appVersion,
  pollSeconds: 1,
  relayUrl: '',
  relayToken: '',
};

beforeAll(() => {
  settings.set('pairingRelayUrl', URL_);
  settings.set('pairingRelayToken', TOKEN);
});

afterAll(async () => {
  await webPairingConfigure({ ...CONFIG, enabled: false });
  __resetWebMailboxForTests();
});

describe.skipIf(!URL_ || !TOKEN)('web mailbox fuzz (desktop senders → web receiver)', () => {
  it(
    `exactly-once delivery: ${SENDERS} senders × ${CARDS_EACH} cards through ${CHURNS} channel churns`,
    async () => {
      const senders = mkSenders(SENDERS);
      const recipientCode = await webOwnPublicCode();
      await webPairingConfigure(CONFIG);
      await sleep(300); // stream up

      const expected = new Set<string>();
      const sendJobs: Promise<void>[] = [];
      for (let s = 0; s < SENDERS; s++) {
        sendJobs.push(
          (async () => {
            for (let c = 0; c < CARDS_EACH; c++) {
              const label = `s${s}-c${c}`;
              expected.add(label);
              const ok = await desktopSend(senders[s]!, recipientCode, label);
              if (!ok) throw new Error(`send failed: ${label}`);
              await sleep(10 + Math.random() * 40);
            }
          })(),
        );
      }

      // Channel churn while sends are in flight: tear the delivery
      // channel down and bring it back, like tabs closing/opening.
      const churnJob = (async () => {
        for (let i = 0; i < CHURNS; i++) {
          await sleep(150 + Math.random() * 250);
          await webPairingConfigure({ ...CONFIG, enabled: false });
          await sleep(50 + Math.random() * 150);
          await webPairingConfigure(CONFIG);
        }
      })();

      await Promise.all([...sendJobs, churnJob]);

      // Convergence: every card in the inbox exactly once.
      const total = SENDERS * CARDS_EACH;
      const deadline = Date.now() + 30_000;
      for (;;) {
        const items = inboxStore.list();
        if (items.length >= total) break;
        if (Date.now() > deadline) {
          const got = new Set(items.map((i) => i.label));
          const missing = [...expected].filter((l) => !got.has(l));
          throw new Error(
            `timed out at ${items.length}/${total}; missing: ${missing.slice(0, 8).join(', ')}…`,
          );
        }
        await sleep(300);
      }
      const items = inboxStore.list();
      expect(items.length).toBe(total); // no duplicates either
      const labels = new Set(items.map((i) => i.label));
      for (const l of expected) expect(labels.has(l)).toBe(true);
      // Sender identity survived the sealed box.
      expect(items.every((i) => i.senderName === 'Fuzz sender')).toBe(true);

      // The relay mailbox drains (DELETE acks land; give them a beat).
      const recipient = routingId(recipientCode);
      const drainDeadline = Date.now() + 10_000;
      for (;;) {
        const left = await relayMailboxCount(recipient);
        if (left === 0) break;
        if (Date.now() > drainDeadline) throw new Error(`relay mailbox not drained: ${left} left`);
        await sleep(500);
      }
    },
    120_000,
  );
});
