// @vitest-environment jsdom

/**
 * Share-code format versioning — the join-by-code fence.
 *
 * Invites carry a minReceiverVersion floor, but "Join Collaboration
 * Session" with a pasted code bypassed it entirely: an old build could
 * walk into a movable room and crash on the first move op (found live,
 * 2026-08-14). Old builds can't be patched, so the fence is the code
 * FORMAT itself: movable rooms mint `cmshare2.<roomId>.<key>.<floor>`,
 * which every pre-1.0 parser rejects (exactly three dot-parts with the
 * literal `cmshare1` prefix), landing on their existing "does not look
 * like a share code" message. List rooms keep minting v1 so old builds
 * can still join them.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encodeShareCode, decodeShareCode } from '../../src/editor/collab/collab-crypto.js';
import { roomIdFromShareCode } from '../../src/editor/collab/collab-prefetch.js';
import { MOVABLE_ROOMS_MIN_VERSION } from '../../src/editor/relay-protocol.js';
import { CollabSession } from '../../src/editor/collab/collab-session.js';
import { RoomsClient } from '../../src/editor/collab/room-client.js';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { startRoomsMock, type RoomsMock } from './_rooms-mock.js';

declare global {
  // eslint-disable-next-line no-var
  var __CM_MOVABLE_LIST__: boolean | undefined;
}

const ROOM_ID = 'a'.repeat(32);
const KEY = new Uint8Array(32).map((_, i) => i);

describe('share-code codec', () => {
  it('v1 codes round-trip unchanged (old rooms stay old-joinable)', () => {
    const code = encodeShareCode(ROOM_ID, KEY);
    expect(code.startsWith('cmshare1.')).toBe(true);
    expect(code.split('.')).toHaveLength(3);
    const d = decodeShareCode(code)!;
    expect(d.roomId).toBe(ROOM_ID);
    expect([...d.keyBytes]).toEqual([...KEY]);
    expect(d.minVersion).toBeUndefined();
  });

  it('v2 codes carry the floor and round-trip', () => {
    const code = encodeShareCode(ROOM_ID, KEY, '1.0.0');
    expect(code.startsWith(`cmshare2.${ROOM_ID}.`)).toBe(true);
    expect(code.endsWith('.1.0.0')).toBe(true);
    const d = decodeShareCode(code)!;
    expect(d.roomId).toBe(ROOM_ID);
    expect([...d.keyBytes]).toEqual([...KEY]);
    expect(d.minVersion).toBe('1.0.0');
  });

  it('a v2 code FAILS the pre-1.0 parser (the fence itself)', () => {
    // Verbatim beta.32 parse precondition: exactly 3 parts, cmshare1.
    const code = encodeShareCode(ROOM_ID, KEY, MOVABLE_ROOMS_MIN_VERSION);
    const parts = code.trim().split('.');
    const oldParserAccepts = parts.length === 3 && parts[0] === 'cmshare1';
    expect(oldParserAccepts).toBe(false);
  });

  it('rejects malformed v2 shapes', () => {
    expect(decodeShareCode(`cmshare2.${ROOM_ID}.AAAA`)).toBeNull(); // missing floor
    expect(decodeShareCode(`cmshare2.${ROOM_ID}.!!!.1.0.0`)).toBeNull(); // bad key
    const good = encodeShareCode(ROOM_ID, KEY, '1.0.0');
    expect(decodeShareCode(good.replace(/1\.0\.0$/, 'not-a-version'))).toBeNull();
  });

  it('roomIdFromShareCode reads both formats', () => {
    expect(roomIdFromShareCode(encodeShareCode(ROOM_ID, KEY))).toBe(ROOM_ID);
    expect(roomIdFromShareCode(encodeShareCode(ROOM_ID, KEY, '1.0.0'))).toBe(ROOM_ID);
    expect(roomIdFromShareCode('nonsense')).toBeNull();
  });
});

describe('share-code minting by room format', () => {
  let mock: RoomsMock;
  let client: RoomsClient;
  beforeAll(async () => {
    mock = await startRoomsMock();
    client = new RoomsClient({ baseUrl: () => mock.url, token: () => mock.token });
  });
  afterAll(async () => {
    await mock.close();
  });

  function tinyDoc(): ReturnType<typeof schema.node> {
    return schema.nodes['doc']!.createChecked(null, [
      schema.nodes['card']!.createChecked(null, [
        schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text('Tag')),
        schema.nodes['card_body']!.create(null, schema.text('body')),
      ]),
    ]);
  }

  it('movable hosts mint v2 with the movable floor; list hosts mint v1', async () => {
    globalThis.__CM_MOVABLE_LIST__ = true;
    try {
      const { session, shareCode } = await CollabSession.host({ pmDoc: tinyDoc(), client });
      expect(session.childrenFormat()).toBe('movable');
      expect(decodeShareCode(shareCode)?.minVersion).toBe(MOVABLE_ROOMS_MIN_VERSION);
      await session.stop();
    } finally {
      globalThis.__CM_MOVABLE_LIST__ = undefined;
    }

    globalThis.__CM_MOVABLE_LIST__ = false;
    try {
      const { session, shareCode } = await CollabSession.host({ pmDoc: tinyDoc(), client });
      expect(session.childrenFormat()).toBe('list');
      expect(shareCode.startsWith('cmshare1.')).toBe(true);
      expect(decodeShareCode(shareCode)?.minVersion).toBeUndefined();
      await session.stop();
    } finally {
      globalThis.__CM_MOVABLE_LIST__ = undefined;
    }
  }, 60_000);
});
