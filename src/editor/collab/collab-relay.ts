/**
 * Rooms-relay endpoint resolution, factored out of collab-ui so LIGHT
 * consumers (the invite seed prefetcher, fired from the always-loaded
 * Receive pill) can build a RoomsClient without pulling the Loro wasm
 * chunk. Resolution order: settings → dev env → baked desktop default
 * (same base + shared token card sharing uses).
 */

import { settings } from '../settings.js';
import { getElectronHost } from '../host/index.js';
import { collabDevRelay } from './collab-gate.js';
import { webEntitlementToken, webRoutingCodeSync } from './web-account.js';
import { RoomsClient, RoomsError } from './room-client.js';

/** Baked relay endpoint from the desktop main process — resolved once,
 *  used as the LAST fallback so packaged builds work with zero setup.
 *  '' fields mean web edition / old preload / nothing baked.
 *  `routingCode` is non-'' only when the baked token is an entitlement
 *  (machine binding — see relay-protocol.ts). */
let bakedRelay: { url: string; token: string; routingCode: string } | null = null;

export async function ensureBakedRelay(): Promise<void> {
  if (bakedRelay) return;
  try {
    const got = await getElectronHost()?.collabRelayDefaults();
    bakedRelay = { url: got?.url ?? '', token: got?.token ?? '', routingCode: got?.routingCode ?? '' };
  } catch {
    bakedRelay = { url: '', token: '', routingCode: '' };
  }
}

/** The resolved relay base URL ('' when nothing is configured) —
 *  shared by the rooms client and the web account-connect flow. */
export function relayBaseUrl(): string {
  const dev = collabDevRelay();
  return (
    settings.get('pairingRelayUrl').trim() ||
    dev?.url ||
    bakedRelay?.url ||
    ''
  ).replace(/\/+$/, '');
}

export function relayClient(): RoomsClient | null {
  const dev = collabDevRelay();
  const url = relayBaseUrl();
  // A linked web account's entitlement outranks the dev/prototype
  // token: it's the real credential class, and it carries the wk1
  // routing code the relay's machine binding expects. Settings-field
  // overrides (self-host) still win over everything.
  const webToken = webEntitlementToken();
  const settingsToken = settings.get('pairingRelayToken').trim();
  const token = settingsToken || webToken || dev?.token || bakedRelay?.token || '';
  // The routing code is bound to the ENTITLEMENT that minted it — the
  // web account's wk1 code, or the one the desktop main process handed
  // us. A settings/dev token override is never an entitlement, so the
  // header must not ride along there.
  const routingCode = settingsToken
    ? ''
    : webToken
      ? webRoutingCodeSync()
      : dev?.token
        ? ''
        : (bakedRelay?.routingCode ?? '');
  if (!url || !token) return null;
  return new RoomsClient({ baseUrl: () => url, token: () => token, routingCode: () => routingCode });
}

/** Tombstone a room on the relay — the home-screen Sessions list's host-side
 *  "End Session" (no live session object exists there, so this speaks to the
 *  relay directly). A room that is already ended (410) or expired/GC'd (404)
 *  counts as success: the goal — nobody can rejoin — already holds. Throws on
 *  anything else (offline, auth) so the caller can KEEP the record and let
 *  the host retry; deleting it without the tombstone would strand a live room
 *  that invited participants can silently rejoin. */
export async function endRoomOnRelay(roomId: string): Promise<void> {
  await ensureBakedRelay();
  const client = relayClient();
  if (!client) throw new Error('no relay configured');
  try {
    await client.deleteRoom(roomId);
  } catch (err) {
    if (err instanceof RoomsError && (err.status === 410 || err.status === 404)) return;
    throw err;
  }
}
