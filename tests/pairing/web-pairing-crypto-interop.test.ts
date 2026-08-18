/**
 * Web ↔ desktop sealed-box INTEROP (web-collab Phase 4).
 *
 * The web port must be wire-identical to the desktop implementation:
 * these tests round-trip real bundles between the two — the Node
 * keystore (apps/desktop/src/pairing-crypto.ts, dependency-free by
 * design) seals to the web keystore's code and vice versa — and pin
 * the routing-id derivation byte-for-byte. Node ≥22 has WebCrypto
 * X25519, so both implementations run in this process.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import 'fake-indexeddb/auto';
import * as os from 'node:os';
import * as path from 'node:path';
import { mkdtempSync } from 'node:fs';
import {
  createPairingKeystore,
  routingId,
  type PairingKeystore,
} from '../../apps/desktop/src/pairing-crypto.js';
import {
  webOwnPublicCode,
  webOwnRoutingId,
  webRoutingId,
  webSeal,
  webOpen,
  webRegenerateKey,
} from '../../src/editor/pairing/web-pairing-crypto.js';

let nodeKs: PairingKeystore;

beforeAll(() => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cm-pairing-interop-'));
  nodeKs = createPairingKeystore(path.join(dir, 'keys.json'));
});

describe('sealed-box interop', () => {
  it('desktop seals → web opens', async () => {
    const webCode = await webOwnPublicCode();
    expect(webCode.startsWith('cmk1.')).toBe(true);
    const payload = { item: { label: 'Econ DA', sliceJson: { a: 1 } }, senderName: 'Desk' };
    const bundle = nodeKs.seal(payload, webCode);
    expect(await webOpen(bundle)).toEqual(payload);
  });

  it('web seals → desktop opens', async () => {
    const payload = { item: { label: 'K answers', sliceJson: [1, 2, 3] }, senderName: 'Web' };
    const bundle = await webSeal(payload, nodeKs.ownPublicCode());
    expect(nodeKs.open(bundle)).toEqual(payload);
  });

  it('routing ids agree byte-for-byte across implementations', async () => {
    const webCode = await webOwnPublicCode();
    expect(await webRoutingId(webCode)).toBe(routingId(webCode));
    expect(await webRoutingId(nodeKs.ownPublicCode())).toBe(routingId(nodeKs.ownPublicCode()));
    expect(await webOwnRoutingId()).toBe(routingId(webCode));
  });

  it('tampered bundles fail closed on the web side', async () => {
    const webCode = await webOwnPublicCode();
    const bundle = nodeKs.seal({ x: 1 }, webCode);
    const bent = { ...bundle, ct: bundle.ct.slice(0, -4) + 'AAAA' };
    await expect(webOpen(bent)).rejects.toThrow();
  });

  it('regenerate invalidates old shares (new code, old bundles unreadable)', async () => {
    const oldCode = await webOwnPublicCode();
    const bundle = nodeKs.seal({ old: true }, oldCode);
    const newCode = await webRegenerateKey();
    expect(newCode).not.toBe(oldCode);
    await expect(webOpen(bundle)).rejects.toThrow();
  });
});
