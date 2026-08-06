// @vitest-environment jsdom
/**
 * INVESTIGATION ARTIFACT (2026-08-05 coediting-latency study) — not a
 * regression test. Measures the per-remote-frame main-thread cost of the
 * session + binding layer on a realistically sized doc, with MINIMAL
 * ProseMirror plugins — so the split between "sync machinery" and "the
 * app's full plugin pipeline" can be attributed. Delete after the study.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { RoomsClient } from '../../src/editor/collab/room-client.js';
import { CollabSession } from '../../src/editor/collab/collab-session.js';
import { decodeShareCode } from '../../src/editor/collab/collab-crypto.js';
import { startRoomsMock, type RoomsMock } from './_rooms-mock.js';
import { settle, sleep, typeAfter, docText } from './_loro-helpers.js';

let mock: RoomsMock;
let client: RoomsClient;

beforeAll(async () => {
  mock = await startRoomsMock();
  client = new RoomsClient({ baseUrl: () => mock.url, token: () => mock.token });
});
afterAll(async () => {
  await mock.close();
});

function card(i: number): PMNode {
  const words = Array.from({ length: 80 }, (_, w) => `w${i}x${w}`).join(' ');
  return schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(`Tag number ${i} for the card`)),
    schema.nodes['card_body']!.create(null, schema.text(`ANCHOR${i} ${words}`)),
  ]);
}

function bigDoc(cards: number): PMNode {
  return schema.nodes['doc']!.createChecked(null, Array.from({ length: cards }, (_, i) => card(i)));
}

interface Timing {
  count: number;
  totalMs: number;
  maxMs: number;
}

function mkTimedView(plugins: Plugin[], timing: Timing): EditorView {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const view: EditorView = new EditorView(el, {
    state: EditorState.create({ schema, plugins }),
    dispatchTransaction(tx) {
      const t0 = performance.now();
      view.updateState(view.state.apply(tx));
      const dt = performance.now() - t0;
      timing.count++;
      timing.totalMs += dt;
      if (dt > timing.maxMs) timing.maxMs = dt;
    },
  });
  return view;
}

describe('coediting per-frame cost bench', () => {
  it('measures session+binding cost per remote frame on a 300-card doc', async () => {
    const doc = bigDoc(300);
    const { session: host, shareCode } = await CollabSession.host({
      pmDoc: doc,
      client,
      flushMs: 50,
      catchUpMs: 600_000,
    });
    const hostTiming: Timing = { count: 0, totalMs: 0, maxMs: 0 };
    const hostView = mkTimedView(host.plugins(), hostTiming);
    await settle();
    host.start();

    const joiner = await CollabSession.join({
      ...decodeShareCode(shareCode)!,
      client,
      flushMs: 50,
      catchUpMs: 600_000,
    });
    const joinTiming: Timing = { count: 0, totalMs: 0, maxMs: 0 };
    const joinView = mkTimedView(joiner.plugins(), joinTiming);
    await settle();
    joiner.start();
    await sleep(400);
    expect(docText(joinView.state.doc)).toContain('ANCHOR299');

    // Reset timers after the initial sync (join import is expected to be big).
    const joinInitial = { ...joinTiming };
    joinTiming.count = 0;
    joinTiming.totalMs = 0;
    joinTiming.maxMs = 0;

    // Host types 120 chars in bursts; frames flush every 50ms.
    for (let i = 0; i < 120; i++) {
      typeAfter(hostView, 'ANCHOR150', 'x');
      if (i % 6 === 5) await sleep(55); // ~6 chars per frame
    }
    await sleep(400);
    expect(docText(joinView.state.doc)).toContain('xxxxxx');

    // Joiner-side: transactions dispatched by the binding for remote frames.
    console.log('[bench] initial join import:', JSON.stringify(joinInitial));
    console.log(
      '[bench] joiner remote-frame dispatches:',
      JSON.stringify(joinTiming),
      'avg ms:',
      (joinTiming.totalMs / Math.max(1, joinTiming.count)).toFixed(3),
    );

    // Now measure the raw session-layer steps on the joiner: flush() with a
    // clean doc (per-frame pre-import call) and an importBatch of a typical
    // typing frame, plus version-vector churn (markImportedSent analog).
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) joiner.flush();
    const flushCleanMs = (performance.now() - t0) / 200;

    const diff = (() => {
      // Build a typing-sized update frame from the host: type 6 chars, export.
      typeAfter(hostView, 'ANCHOR150', 'qqqqqq');
      return host.exportSince(joiner.encodedVersion());
    })();
    console.log('[bench] typical frame bytes:', diff.bytes.length);
    const t1 = performance.now();
    // Import is idempotent for already-known ops — measure re-import cost.
    const jl = (joiner as unknown as { loroDoc: { importBatch(b: Uint8Array[]): unknown } }).loroDoc;
    for (let i = 0; i < 50; i++) jl.importBatch([diff.bytes]);
    const reimportMs = (performance.now() - t1) / 50;

    console.log(
      '[bench] flush(clean) per call ms:',
      flushCleanMs.toFixed(4),
      '| re-importBatch(1 frame) ms:',
      reimportMs.toFixed(4),
    );

    // Quantify the collab-repair full-doc walks (the suspected dominant
    // per-frame cost in the real app — collab-repair.ts appendTransaction).
    const { buildMarkRepairTr, buildDocRepairTr } = await import('../../src/doc-repair.js');
    const { EditorState: ES } = await import('prosemirror-state');
    const bigState = ES.create({ doc: joinView.state.doc });
    let t = performance.now();
    for (let i = 0; i < 20; i++) buildMarkRepairTr(bigState);
    const markRepairMs = (performance.now() - t) / 20;
    t = performance.now();
    for (let i = 0; i < 20; i++) buildDocRepairTr(bigState);
    const docRepairMs = (performance.now() - t) / 20;
    // Post-fix leader path: a typing-sized oldState delta puts
    // prosemirror-tables on its changed-regions fast path.
    const oldForBench = bigState;
    const newForBench = bigState.apply(bigState.tr.insertText('x', 20));
    t = performance.now();
    for (let i = 0; i < 20; i++) buildDocRepairTr(newForBench, oldForBench);
    const docRepairBoundedMs = (performance.now() - t) / 20;
    t = performance.now();
    for (let i = 0; i < 20; i++) {
      joinView.state.doc.descendants((node) => {
        if (node.type.name === 'tag' || node.type.name === 'analytic') return false;
        return true;
      });
    }
    const healScanMs = (performance.now() - t) / 20;
    console.log(
      '[bench] repair costs on 300-card doc — healScan (now cooldown-gated):',
      healScanMs.toFixed(3),
      'ms | markRepair (follower):',
      markRepairMs.toFixed(3),
      'ms | docRepair full (import path):',
      docRepairMs.toFixed(3),
      'ms | docRepair BOUNDED (leader, post-fix):',
      docRepairBoundedMs.toFixed(3),
      'ms',
    );

    // Periodic catch-up spike: the fetch cursor deliberately lags the
    // stream, so every 5-min catchUp re-fetches + decrypts + re-imports
    // everything since the previous one. Accumulate ~200 frames of
    // stream-delivered typing, then time catchUp() at parity.
    for (let i = 0; i < 200; i++) {
      typeAfter(hostView, 'ANCHOR150', 'z');
      if (i % 1 === 0) await sleep(52); // one ~1-char frame per flush tick
    }
    await sleep(300);
    const tCatch = performance.now();
    await joiner.catchUp();
    const catchUpMs = performance.now() - tCatch;
    console.log('[bench] catchUp at parity after ~200 stream frames:', catchUpMs.toFixed(1), 'ms');

    // Self-ref rederive: the always-on appendTransaction cost. (a) walk-only
    // on a doc with NO live views; (b) with 3 live views mirroring sections.
    const { makeSelfRefPlugin } = await import('../../src/editor/self-transclusion-plugin.js');
    const { createSelfRefNode } = await import('../../src/editor/self-transclusion.js');
    const plugin = makeSelfRefPlugin() as unknown as {
      spec: { appendTransaction: (trs: unknown[], o: unknown, s: unknown) => unknown };
    };
    const fakeTr = [{ docChanged: true, getMeta: () => undefined }];
    const noViewState = ES.create({ doc: joinView.state.doc });
    let t2 = performance.now();
    for (let i = 0; i < 50; i++) plugin.spec.appendTransaction(fakeTr, null, noViewState);
    const rederiveNoViewsMs = (performance.now() - t2) / 50;

    // Build a doc with 3 self_refs pointing at real tag ids.
    const ids: string[] = [];
    joinView.state.doc.descendants((node) => {
      if (node.type.name === 'tag' && ids.length < 3) ids.push(String(node.attrs['id']));
      return ids.length < 3;
    });
    const withViews = schema.nodes['doc']!.create(null, [
      ...(joinView.state.doc.content as unknown as { content: PMNode[] }).content,
      ...ids.map((id, i) => createSelfRefNode(schema, id, `view ${i}`)),
    ]);
    const viewState = ES.create({ doc: withViews });
    // Fill the views once (mount behavior), then measure steady-state rederive.
    const fill = plugin.spec.appendTransaction(fakeTr, null, viewState) as { doc?: PMNode } | null;
    const filledState = fill ? ES.create({ doc: (fill as unknown as { doc: PMNode }).doc }) : viewState;
    let t3 = performance.now();
    for (let i = 0; i < 50; i++) plugin.spec.appendTransaction(fakeTr, null, filledState);
    const rederiveViewsMs = (performance.now() - t3) / 50;
    console.log(
      '[bench] selfRef rederive per docChanged tx — no views:',
      rederiveNoViewsMs.toFixed(3),
      'ms | 3 views (steady):',
      rederiveViewsMs.toFixed(3),
      'ms',
    );

    // Presence dispatch frequency: burst 20 cursor frames (the 5-typist
    // worst case, one second's worth) at a receiver and count editor
    // dispatches before/after coalescing semantics.
    const { installCursorPresence } = await import('../../src/editor/collab/collab-cursors.js');
    const { CursorEphemeralStore } = await import('loro-prosemirror');
    const encodeFrom = (peer: string): Promise<Uint8Array> =>
      new Promise((resolve) => {
        const st = new CursorEphemeralStore(peer as never, 45_000);
        const un = st.subscribeLocalUpdates((b: Uint8Array) => {
          un();
          resolve(b);
        });
        st.setLocal({ user: { name: `P${peer}`, color: '#123456' } } as never);
      });
    const fakeSession = {
      loroDoc: { peerIdStr: '1' },
      sendPresence: async () => {},
    } as unknown as Parameters<typeof installCursorPresence>[0];
    let pView: EditorView;
    const cursors = installCursorPresence(fakeSession, () => pView);
    let dispatches = 0;
    pView = mkTimedView(cursors.plugins(), { count: 0, totalMs: 0, maxMs: 0 });
    const orig = pView.dispatch.bind(pView);
    (pView as { dispatch: (tr: unknown) => void }).dispatch = (tr) => {
      dispatches++;
      orig(tr as never);
    };
    const payloads = await Promise.all(
      Array.from({ length: 20 }, (_, i) => encodeFrom(String(2 + (i % 5)))),
    );
    for (const pl of payloads) {
      const framed = new Uint8Array(pl.length + 1);
      framed[0] = 0x01;
      framed.set(pl, 1);
      cursors.applyRemote(framed);
      await sleep(45); // ~one second of 5-typist arrivals (20 frames)
    }
    await sleep(300);
    console.log(
      '[bench] presence: 20 frames over ~1s → editor dispatches:',
      dispatches,
      '(pre-fix: one per frame = 20)',
    );
    cursors.dispose();
    pView.destroy();

    await joiner.stop();
    await host.stop();
    hostView.destroy();
    joinView.destroy();
  }, 120_000);
});
