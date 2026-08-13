// @vitest-environment jsdom

/**
 * The v1.0 movable-list migration, client side.
 *
 * Three cooperating pieces make a no-flag-day rollout: (1) the binding
 * patch gives every NEW children container the same kind as the doc
 * ROOT's (rooms stay homogeneous no matter which build edits them);
 * (2) collab-session seeds NEW rooms movable once the app version
 * crosses MOVABLE_ROOMS_MIN_VERSION; (3) invites to movable rooms
 * carry that version as their compatibility floor, so older builds
 * decline cleanly instead of joining containers they cannot read.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { LoroList, LoroMap, LoroMovableList, type LoroDoc } from 'loro-crdt';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { compareAppVersions, MOVABLE_ROOMS_MIN_VERSION } from '../../src/editor/relay-protocol.js';
import { roomInviteFloor, ROOM_INVITE_MIN_VERSION } from '../../src/editor/pairing/room-invite.js';
import { CollabSession } from '../../src/editor/collab/collab-session.js';
import { createLoroPeers, settle, syncAll, docText, type LoroPeer } from './_loro-helpers.js';

declare global {
  // eslint-disable-next-line no-var
  var __CM_MOVABLE_LIST__: boolean | undefined;
}

afterEach(() => {
  globalThis.__CM_MOVABLE_LIST__ = undefined;
});

function card(label: string): PMNode {
  return schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(`Tag ${label}`)),
    schema.nodes['card_body']!.create(null, schema.text(`${label} body text`)),
  ]);
}
const seedDoc = (): PMNode =>
  schema.nodes['doc']!.createChecked(null, [card('A'), card('B'), card('C')]);

/** Kind of the children container on the card whose tag mentions `label`. */
function cardChildrenKind(ldoc: LoroDoc, label: string): string | null {
  const stack: LoroMap[] = [ldoc.getMap('doc') as LoroMap];
  while (stack.length) {
    const m = stack.pop()!;
    const kids = m.get('children');
    if (!(kids instanceof LoroList || kids instanceof LoroMovableList)) continue;
    for (const c of kids.toArray()) {
      if (c instanceof LoroMap) {
        const inner = c.get('children');
        if (inner instanceof LoroList || inner instanceof LoroMovableList) {
          for (const g of inner.toArray()) {
            if (
              typeof (g as { toString?: () => string }).toString === 'function' &&
              String(g) .includes(label)
            ) {
              return inner.kind();
            }
          }
        }
        stack.push(c);
      }
    }
  }
  return null;
}

function rootKind(ldoc: LoroDoc): string {
  return (ldoc.getMap('doc').get('children') as LoroList | LoroMovableList).kind();
}

describe('comparator', () => {
  it('orders the shapes CardMirror ships', () => {
    const order = ['0.1.0-alpha.1', '0.1.0-beta.8', '0.1.0-beta.32', '0.1.0-rc.1', '0.1.0', '1.0.0-beta.1', '1.0.0', '1.0.1'];
    for (let i = 1; i < order.length; i++) {
      expect(compareAppVersions(order[i - 1]!, order[i]!), `${order[i - 1]} < ${order[i]}`).toBeLessThan(0);
      expect(compareAppVersions(order[i]!, order[i - 1]!)).toBeGreaterThan(0);
    }
    expect(compareAppVersions('1.0.0', '1.0.0')).toBe(0);
    // Garbage never unlocks gated behavior.
    expect(compareAppVersions('not-a-version', MOVABLE_ROOMS_MIN_VERSION)).toBeLessThan(0);
  });
});

describe('invite floor', () => {
  it('movable rooms carry the movable floor; list rooms keep the legacy one', () => {
    expect(roomInviteFloor('movable')).toBe(MOVABLE_ROOMS_MIN_VERSION);
    expect(roomInviteFloor('list')).toBe(ROOM_INVITE_MIN_VERSION);
  });
});

describe('per-room inheritance', () => {
  it('a movable room stays movable even when a list-flag build adds cards', async () => {
    globalThis.__CM_MOVABLE_LIST__ = true;
    const peers = await createLoroPeers(seedDoc(), 2);
    const [a, b] = peers as [LoroPeer, LoroPeer];
    expect(rootKind(a.ldoc)).toBe('MovableList');

    // "Old-flag" build (flag off) adds a card into the movable room.
    globalThis.__CM_MOVABLE_LIST__ = false;
    b.view.dispatch(b.view.state.tr.insert(b.view.state.doc.content.size, card('NEWBIE')));
    await settle();
    await syncAll(peers);
    expect(docText(a.doc())).toContain('NEWBIE body text');
    expect(cardChildrenKind(a.ldoc, 'NEWBIE'), 'new card inherits the ROOM kind').toBe('MovableList');
    peers.forEach((p) => p.destroy());
  });

  it('a list room stays list even when a movable-flag build adds cards', async () => {
    globalThis.__CM_MOVABLE_LIST__ = false;
    const peers = await createLoroPeers(seedDoc(), 2);
    const [a, b] = peers as [LoroPeer, LoroPeer];
    expect(rootKind(a.ldoc)).toBe('List');

    globalThis.__CM_MOVABLE_LIST__ = true;
    b.view.dispatch(b.view.state.tr.insert(b.view.state.doc.content.size, card('NEWBIE')));
    await settle();
    await syncAll(peers);
    expect(cardChildrenKind(a.ldoc, 'NEWBIE'), 'new card inherits the ROOM kind').toBe('List');
    peers.forEach((p) => p.destroy());
  });
});

describe('childrenFormat', () => {
  it('reports the room format from the root container', async () => {
    globalThis.__CM_MOVABLE_LIST__ = true;
    const movable = await createLoroPeers(seedDoc(), 1);
    expect(
      CollabSession.prototype.childrenFormat.call({ loroDoc: movable[0]!.ldoc }),
    ).toBe('movable');
    movable.forEach((p) => p.destroy());

    globalThis.__CM_MOVABLE_LIST__ = false;
    const list = await createLoroPeers(seedDoc(), 1);
    expect(CollabSession.prototype.childrenFormat.call({ loroDoc: list[0]!.ldoc })).toBe('list');
    list.forEach((p) => p.destroy());
  });
});
