/**
 * Every relay request must name the running build.
 *
 * The relay cannot otherwise tell versions apart — the app version that
 * travels with a shared card lives INSIDE the sealed envelope, so the
 * server can't read it. This header is the only channel, and a planned
 * minimum-version gate depends on it being present on every call. Losing
 * it would be invisible until the gate started refusing real users, so
 * it is pinned here.
 */

import { describe, it, expect } from 'vitest';
import { RoomsClient } from '../../src/editor/collab/room-client.js';
import { RELAY_CLIENT_VERSION_HEADER } from '../../src/editor/relay-protocol.js';
import { appVersion } from '../../src/editor/install-info.js';

/** Capture the headers of every request the client makes. */
function recordingClient(): { client: RoomsClient; sent: Record<string, string>[] } {
  const sent: Record<string, string>[] = [];
  const client = new RoomsClient({
    baseUrl: () => 'https://relay.example/relay',
    token: () => 'test-token',
    fetchImpl: (_input, init) => {
      sent.push({ ...((init?.headers ?? {}) as Record<string, string>) });
      return Promise.resolve(
        new Response(JSON.stringify({ roomId: 'room-1', seq: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    },
  });
  return { client, sent };
}

describe('relay client version header', () => {
  it('is sent on a rooms request, carrying the running app version', async () => {
    const { client, sent } = recordingClient();
    await client.createRoom();
    expect(sent).toHaveLength(1);
    expect(sent[0]![RELAY_CLIENT_VERSION_HEADER]).toBe(appVersion);
  });

  it('survives calls that add their own headers', async () => {
    // postUpdate passes a Content-Type through the same helper — the
    // spread must not drop the version on the way.
    const { client, sent } = recordingClient();
    await client.postUpdate('room-1', new Uint8Array([1, 2, 3]));
    expect(sent[0]!['Content-Type']).toBe('application/octet-stream');
    expect(sent[0]![RELAY_CLIENT_VERSION_HEADER]).toBe(appVersion);
  });

  it('keeps sending the Authorization header alongside it', async () => {
    const { client, sent } = recordingClient();
    await client.createRoom();
    expect(sent[0]!['Authorization']).toBe('Bearer test-token');
  });

  it('names a header the relay can read (ASCII, no spaces)', () => {
    expect(RELAY_CLIENT_VERSION_HEADER).toMatch(/^[A-Za-z0-9-]+$/);
  });
});
