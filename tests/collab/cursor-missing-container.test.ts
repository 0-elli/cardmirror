// @vitest-environment jsdom
/**
 * Field storm (beta.28, 2026-08-05): "The container does not exist in
 * the doc", repeating on every presence frame. A peer's stored cursor
 * can reference a Loro container this replica doesn't have — the block
 * was deleted here concurrently, or the cursor frame outran the doc
 * frame that creates the block (presence and doc updates are separate
 * channels with no cross-ordering). The vendored cursor plugin's
 * decoration rebuild resolved each peer's cursor with no per-peer
 * error containment, so ONE unresolvable cursor killed the whole
 * redraw, the presence transaction died uncaught, and the error
 * resurfaced on every subsequent frame until the store expired the
 * entry (45s).
 *
 * Patched (patches/loro-prosemirror+0.4.3.patch): each peer resolves
 * inside its own try/catch — an unresolvable cursor skips that peer
 * (their next frame, or the arriving doc update, heals it) and every
 * other peer still renders.
 */
import { describe, it, expect } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { installCursorPresence } from '../../src/editor/collab/collab-cursors.js';
import { createLoroPeers, settle, sleep, findText, type LoroPeer } from './_loro-helpers.js';

function card(tag: string, body: string): PMNode {
  return schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(tag)),
    schema.nodes['card_body']!.create(null, schema.text(body)),
  ]);
}

describe('cursor pointing at a missing container', () => {
  it('skips the unresolvable peer instead of killing the whole redraw', async () => {
    // Two replicas of a two-card doc. The SENDER creates a new card
    // and parks its cursor there; the presence frame reaches the
    // receiver before (here: without) the doc update that creates the
    // block, so the cursor references a container the receiver has
    // never seen.
    const doc = schema.nodes['doc']!.createChecked(null, [
      card('Alpha', 'alpha body text'),
      card('Beta', 'beta body text'),
    ]);
    const peers = await createLoroPeers(doc, 2);
    const [sender, receiver] = peers as [LoroPeer, LoroPeer];

    // Wire real presence layers over fake sessions (peer id + presence
    // send are all the cursor layer needs).
    const sentFrames: Uint8Array[] = [];
    const senderSession = {
      loroDoc: sender.ldoc,
      sendPresence: async (bytes: Uint8Array) => {
        sentFrames.push(bytes);
      },
    } as unknown as Parameters<typeof installCursorPresence>[0];
    const receiverSession = {
      loroDoc: receiver.ldoc,
      sendPresence: async () => {},
    } as unknown as Parameters<typeof installCursorPresence>[0];
    const senderCursors = installCursorPresence(senderSession, () => sender.view);
    const receiverCursors = installCursorPresence(receiverSession, () => receiver.view);
    // The cursor plugin reads loroSyncPluginKey state from the view it
    // decorates — rebuild both views' plugin sets to include it.
    sender.view.updateState(
      sender.view.state.reconfigure({
        plugins: [...sender.view.state.plugins, ...senderCursors.plugins()],
      }),
    );
    receiver.view.updateState(
      receiver.view.state.reconfigure({
        plugins: [...receiver.view.state.plugins, ...receiverCursors.plugins()],
      }),
    );
    await settle();

    // The race: the sender creates a NEW card and parks its cursor in
    // it, and the presence frame reaches the receiver BEFORE the doc
    // frame that creates the block (the channels have no cross-
    // ordering). The receiver's replica has never seen that text
    // container — resolving the cursor throws "The container does not
    // exist in the doc". Docs are deliberately NOT synced here.
    (sender.view as unknown as { hasFocus: () => boolean }).hasFocus = () => true;
    sender.view.dispatch(
      sender.view.state.tr.insert(sender.view.state.doc.content.size, card('Gamma', 'gamma body')),
    );
    await settle();
    const inGamma = findText(sender.doc(), 'gamma body');
    sender.view.dispatch(
      sender.view.state.tr.setSelection(
        TextSelection.create(sender.view.state.doc, inGamma.from + 2),
      ),
    );
    await sleep(400); // > the 250ms send throttle
    expect(sentFrames.length).toBeGreaterThan(0);

    // The stale cursor frame arrives and the redraw runs. Unpatched,
    // the decoration rebuild throws out of the plugin's apply and the
    // presence transaction dies uncaught in a timer — surface that
    // deterministically by trapping window errors.
    const uncaught: unknown[] = [];
    const onErr = (e: ErrorEvent): void => {
      uncaught.push(e.error ?? e.message);
      e.preventDefault();
    };
    window.addEventListener('error', onErr);
    try {
      for (const f of sentFrames) receiverCursors.applyRemote(f);
      await sleep(400); // drain (150ms) + the plugin's deferred redraw
    } finally {
      window.removeEventListener('error', onErr);
    }
    expect(uncaught).toEqual([]);
    // The frame still LANDED — the peer is in the presence store (the
    // roster shows them); only their cursor decoration was skipped.
    expect(receiverCursors.visiblePeers()).toContain(sender.ldoc.peerIdStr);

    senderCursors.dispose();
    receiverCursors.dispose();
    peers.forEach((p) => p.destroy());
  }, 30_000);
});
