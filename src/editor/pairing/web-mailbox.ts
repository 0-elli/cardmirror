/**
 * Web card-sharing transport + inbox (web-collab Phase 4) — the
 * renderer-side equivalent of the desktop MAIN process's pairing-ipc:
 * same wire protocol (sealed bundles to routing-id mailboxes, SSE push
 * + catch-up polling, DELETE acks), same inbox item shape, and the
 * same event surface, so the pills and settings editors can drive
 * either implementation through one provider seam.
 *
 * ACCOUNT-REQUIRED BOTH WAYS (user decision, 2026-08-18): every
 * request authenticates with the linked account's entitlement — a
 * browser holds no shared token, and a durable partner-directed
 * mailbox gets no guest analog. Send failures with 401/403 count as
 * `authFail` so the UI names the fix.
 *
 * Delivery model: ONE push stream per browser profile — the LEADER tab
 * (Web Locks; the lock dies with the tab, crash included) holds it and
 * every tab reads the shared IndexedDB inbox (cross-tab notify via
 * BroadcastChannel). Catch-up polls run on stream hello, visibility
 * return, and a slow interval. A fully closed browser receives nothing
 * until reopened; the relay's aggressive expiry is accepted
 * deliberately — sharing is a concurrent activity, "send again" is
 * the recovery story.
 */

import {
  webOwnPublicCode,
  webOwnRoutingId,
  webRegenerateKey,
  webRoutingId,
  webSeal,
  webOpen,
  type SealedBundle,
} from './web-pairing-crypto.js';
import { webEntitlementToken, webRoutingCodeSync } from '../collab/web-account.js';
import { relayBaseUrl } from '../collab/collab-relay.js';
import {
  RELAY_CLIENT_ROUTING_HEADER,
  RELAY_CLIENT_VERSION_HEADER,
  compareAppVersions,
} from '../relay-protocol.js';
import { appVersion } from '../install-info.js';
import type { PairingConfigIpc, PairingInboxItemIpc, PairingSendIpc } from '../host/electron-host.js';
import { inboxStore } from './inbox-store.js';

const LEADER_LOCK = 'cardmirror-mailbox-leader';

interface RelayMessage extends SealedBundle {
  msgId: string;
}

interface InnerPayload {
  schemaVersion?: string;
  minReceiverVersion?: string;
  senderCode?: string;
  senderName?: string;
  via?: string;
  item?: { label?: unknown; type?: unknown; sliceJson?: unknown };
}

let config: PairingConfigIpc | null = null;
let streamAbort: AbortController | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let leaderHeld = false;
let stopped = true;
const consumed = new Set<string>();

const mismatchListeners = new Set<
  (info: { partnerVersion: string; localVersion: string; requiredVersion: string }) => void
>();
const unauthorizedListeners = new Set<() => void>();
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = webEntitlementToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    [RELAY_CLIENT_VERSION_HEADER]: appVersion,
    ...extra,
  };
  const rc = webRoutingCodeSync();
  if (rc) headers[RELAY_CLIENT_ROUTING_HEADER] = rc;
  return headers;
}

function relayUrl(): string {
  return relayBaseUrl();
}

// ── Receive path ─────────────────────────────────────────────────────

function deleteMessage(msgId: string): void {
  void fetch(`${relayUrl()}/messages/${encodeURIComponent(msgId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).catch(() => {
    /* still on the relay next poll — the inbox dedupe absorbs it */
  });
}

async function processMessages(messages: RelayMessage[]): Promise<void> {
  const fresh: PairingInboxItemIpc[] = [];
  for (const m of messages) {
    if (!m || typeof m.msgId !== 'string' || consumed.has(m.msgId)) continue;
    consumed.add(m.msgId);
    if (!m.epk || !m.iv || !m.ct || !m.tag) {
      deleteMessage(m.msgId);
      continue;
    }
    let inner: InnerPayload;
    try {
      inner = (await webOpen(m)) as InnerPayload;
    } catch {
      deleteMessage(m.msgId); // not for us / stale key — same as desktop
      continue;
    }
    const partnerVersion = inner.schemaVersion || 'unknown';
    const requiredMin = (inner.minReceiverVersion ?? '').trim();
    if (requiredMin && compareAppVersions(appVersion, requiredMin) < 0) {
      for (const fn of mismatchListeners) {
        fn({ partnerVersion, localVersion: appVersion, requiredVersion: requiredMin });
      }
      deleteMessage(m.msgId);
      continue;
    }
    const item = inner.item;
    if (!item || typeof item !== 'object') {
      deleteMessage(m.msgId);
      continue;
    }
    const entry: PairingInboxItemIpc = {
      id: `rx-${m.msgId}`,
      label: typeof item.label === 'string' ? item.label : 'Card',
      type: typeof item.type === 'string' ? item.type : '',
      sliceJson: item.sliceJson,
      senderName: typeof inner.senderName === 'string' ? inner.senderName : '',
      senderCode: typeof inner.senderCode === 'string' ? inner.senderCode : '',
      via: typeof inner.via === 'string' && inner.via ? inner.via : undefined,
      receivedAt: Date.now(),
      read: false,
    };
    fresh.push(entry);
    deleteMessage(m.msgId);
  }
  // Delivery = the existing renderer inbox store, whose web-local mode
  // (localStorage + cross-tab storage events) already backs the pills.
  if (fresh.length > 0) inboxStore.addIncoming(fresh);
}

let pollInFlight = false;
async function pollOnce(): Promise<void> {
  if (pollInFlight || !config?.enabled || !webEntitlementToken()) return;
  pollInFlight = true;
  try {
    const recipient = await webOwnRoutingId();
    const res = await fetch(
      `${relayUrl()}/messages?recipient=${encodeURIComponent(recipient)}`,
      { method: 'GET', headers: authHeaders() },
    );
    if (res.status === 401 || res.status === 403) {
      for (const fn of unauthorizedListeners) fn();
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as { messages?: RelayMessage[] };
    if (data.messages?.length) await processMessages(data.messages);
  } catch {
    /* offline — the next cadence retries */
  } finally {
    pollInFlight = false;
  }
}

// ── Push stream (leader tab only) ────────────────────────────────────

async function streamLoop(): Promise<void> {
  let backoff = 1000;
  while (!stopped && config?.enabled) {
    if (!webEntitlementToken()) {
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    const ctl = new AbortController();
    streamAbort = ctl;
    try {
      const recipient = await webOwnRoutingId();
      const res = await fetch(
        `${relayUrl()}/stream?recipient=${encodeURIComponent(recipient)}`,
        { headers: authHeaders({ Accept: 'text/event-stream' }), signal: ctl.signal },
      );
      if (res.status === 401 || res.status === 403) {
        for (const fn of unauthorizedListeners) fn();
        await new Promise((r) => setTimeout(r, 60_000));
        continue;
      }
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
      backoff = 1000;
      void pollOnce(); // catch-up: anything that landed before the hello
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE frames are blank-line separated; `: hb` comments drop out.
        let sep: number;
        while ((sep = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            try {
              const msg = JSON.parse(line.slice(5).trim()) as RelayMessage;
              void processMessages([msg]);
            } catch {
              /* undecodable frame — ignore */
            }
          }
        }
      }
    } catch {
      /* dropped — fall through to backoff */
    } finally {
      streamAbort = null;
    }
    if (stopped || !config?.enabled) return;
    await new Promise((r) => setTimeout(r, backoff + Math.random() * 250));
    backoff = Math.min(backoff * 2, 60_000);
  }
}

function becomeLeaderWhenPossible(): void {
  if (leaderHeld || typeof navigator.locks?.request !== 'function') {
    // No Web Locks: run the stream anyway (worst case, N tabs = N
    // streams — correct, just chattier).
    void streamLoop();
    return;
  }
  void navigator.locks
    .request(LEADER_LOCK, { mode: 'exclusive' }, async () => {
      leaderHeld = true;
      await streamLoop(); // resolves when stopped/disabled → lock releases
      leaderHeld = false;
    })
    .catch(() => {
      leaderHeld = false;
    });
}

// ── Provider API (mirrors the desktop IPC surface) ───────────────────

export async function webPairingConfigure(cfg: PairingConfigIpc): Promise<{ ownCode: string }> {
  config = cfg;
  const ownCode = await webOwnPublicCode();
  if (cfg.enabled && stopped) {
    stopped = false;
    becomeLeaderWhenPossible();
    const cadence = Math.max(cfg.pollSeconds || 30, 300) * 1000;
    pollTimer = setInterval(() => void pollOnce(), cadence);
    document.addEventListener('visibilitychange', onVisible);
    void pollOnce();
  } else if (!cfg.enabled && !stopped) {
    stopped = true;
    streamAbort?.abort();
    if (pollTimer !== null) clearInterval(pollTimer);
    pollTimer = null;
    document.removeEventListener('visibilitychange', onVisible);
  }
  return { ownCode };
}

function onVisible(): void {
  if (document.visibilityState === 'visible') void pollOnce();
}

export async function webPairingRegenerateKey(): Promise<{ ownCode: string }> {
  return { ownCode: await webRegenerateKey() };
}

export async function webPairingSend(
  payload: PairingSendIpc,
): Promise<{ ok: number; fail: number; authFail: number }> {
  const senderCode = await webOwnPublicCode();
  let ok = 0;
  let fail = 0;
  let authFail = 0;
  await Promise.all(
    payload.recipientCodes.map(async (recipientPublicCode) => {
      try {
        const floor =
          typeof payload.minReceiverVersion === 'string' && payload.minReceiverVersion.trim()
            ? payload.minReceiverVersion.trim()
            : config?.minReceiverVersion;
        const inner: InnerPayload = {
          schemaVersion: config?.schemaVersion ?? appVersion,
          minReceiverVersion: floor || undefined,
          senderCode,
          senderName: config?.displayName ?? '',
          via: payload.via,
          item: {
            label: payload.item.label,
            type: payload.item.type,
            sliceJson: payload.item.sliceJson,
          },
        };
        const bundle = await webSeal(inner, recipientPublicCode);
        const body = {
          v: 1 as const,
          recipientCode: await webRoutingId(recipientPublicCode),
          sentAt: Date.now(),
          ...bundle,
        };
        const res = await fetch(`${relayUrl()}/messages`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(body),
        });
        if (res.ok) ok++;
        else {
          fail++;
          if (res.status === 401 || res.status === 403) authFail++;
        }
      } catch {
        fail++;
      }
    }),
  );
  return { ok, fail, authFail };
}

export function onWebPairingVersionMismatch(
  handler: (info: { partnerVersion: string; localVersion: string; requiredVersion: string }) => void,
): () => void {
  mismatchListeners.add(handler);
  return () => mismatchListeners.delete(handler);
}

export function onWebPairingUnauthorized(handler: () => void): () => void {
  unauthorizedListeners.add(handler);
  return () => unauthorizedListeners.delete(handler);
}

/** Test hook: reset module state (not stored data). */
export function __resetWebMailboxForTests(): void {
  stopped = true;
  streamAbort?.abort();
  streamAbort = null;
  if (pollTimer !== null) clearInterval(pollTimer);
  pollTimer = null;
  config = null;
  consumed.clear();
  mismatchListeners.clear();
  unauthorizedListeners.clear();
  leaderHeld = false;
}
