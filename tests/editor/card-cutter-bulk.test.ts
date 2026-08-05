// @vitest-environment jsdom

/**
 * Bulk card cutting — the multi-card selection flow.
 *
 * Running "Cut card with AI" over a selection spanning several cards
 * queues them: defaults only (no per-card questions), already-cut
 * cards left alone, partially-cut (underlined) cards finished rather
 * than re-cut. These tests pin the classifier (doc order, state
 * routing, id-stamping so every queued card is identity-addressable)
 * and the orchestrator (per-card engine routing, flag isolation,
 * mid-run skips, stop, auth fail-fast, the failure-streak breaker) —
 * plus the launch panel's cardId targeting, which the bulk single-card
 * narrowing rides on.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { schema, newHeadingId } from '../../src/schema/index.js';

vi.mock('../../src/editor/ribbon-commands.js', () => ({
  compileShrinkProtections: () => [],
  findProtectedRanges: () => [],
}));
vi.mock('../../src/editor/ai/llm.js', () => {
  class LlmError extends Error {
    constructor(
      msg: string,
      public readonly status: number | null,
      public readonly kind: string,
    ) {
      super(msg);
    }
  }
  return { callLlm: vi.fn(), activeApiKey: () => 'k', resolveAiModel: () => 'test-model', LlmError };
});
vi.mock('../../src/editor/toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../../src/editor/ai/ai-activity.js', () => ({
  AiActivity: class {
    start(): void {}
    stop(): void {}
    setStage(): void {}
  },
}));
vi.mock('../../src/editor/ai/edit-coordinator.js', () => ({ claimRegion: vi.fn() }));
vi.mock('../../src/editor/card-cutter-preview-plugin.js', () => ({
  setCardCutterPreview: vi.fn(),
  setCutterFlagDecorations: vi.fn(),
}));
vi.mock('../../src/editor/host/index.js', () => ({ getElectronHost: () => null }));
vi.mock('../../src/editor/learn-store-host.js', async () => {
  const { LearnStore } = await vi.importActual<typeof import('../../src/editor/learn-store.js')>(
    '../../src/editor/learn-store.js',
  );
  return { learnStore: new LearnStore(), localToday: () => '2026-08-04' };
});

import {
  selectionBulkTargets,
  bulkCutCards,
  cutFocusedCard,
  resolveCardById,
  installCardCutterRegistry,
  addCutterFlag,
  pendingCutterFlags,
  clearCutterFlags,
} from '../../src/editor/card-cutter-port.js';
import { LlmError } from '../../src/editor/ai/llm.js';
import { showToast } from '../../src/editor/toast.js';
import { claimRegion } from '../../src/editor/ai/edit-coordinator.js';

const n = schema.nodes;

/** A card whose body carries `marks` (none = plain / uncut). */
const cardWith = (tagText: string, body: string, marks: 'none' | 'u' | 'hl', id = newHeadingId()): PMNode =>
  n['card']!.create(null, [
    n['tag']!.create({ id }, schema.text(tagText)),
    n['card_body']!.create(
      null,
      schema.text(
        body,
        marks === 'none'
          ? []
          : marks === 'u'
            ? [schema.marks['underline_mark']!.create()]
            : [schema.marks['highlight']!.create({ color: 'yellow' })],
      ),
    ),
  ]);

function fakeView(doc: PMNode): EditorView & { state: EditorState } {
  const v = {
    state: EditorState.create({ doc }),
    dispatch(tr: unknown) {
      v.state = v.state.apply(tr as Parameters<EditorState['apply']>[0]);
    },
    focus() {},
  };
  return v as unknown as EditorView & { state: EditorState };
}

/** Doc position of the i-th top-level card. */
function cardPos(doc: PMNode, index: number): number {
  let i = 0;
  let found = -1;
  doc.forEach((child, offset) => {
    if (child.type.name === 'card') {
      if (i === index && found < 0) found = offset;
      i++;
    }
  });
  return found;
}

/** Select from inside card `a`'s body to inside card `b`'s body. */
function selectAcross(view: EditorView & { state: EditorState }, a: number, b: number): void {
  const from = cardPos(view.state.doc, a) + 3; // inside the tag text
  const to = cardPos(view.state.doc, b) + 3;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
}

/** Tag id of the i-th card, straight off the doc. */
function idOf(view: EditorView & { state: EditorState }, index: number): string {
  const cardNode = view.state.doc.nodeAt(cardPos(view.state.doc, index))!;
  let id = '';
  cardNode.forEach((child) => {
    if (child.type.name === 'tag') id = (child.attrs['id'] as string) ?? '';
  });
  return id;
}

/** Fake engine capturing every call; both methods return an empty cut. */
function installEngine(): {
  calls: { method: 'cutCard' | 'highlightCard'; paras: string; opts: Record<string, unknown> }[];
  impl: { cutCard?: () => Promise<never> };
} {
  const calls: { method: 'cutCard' | 'highlightCard'; paras: string; opts: Record<string, unknown> }[] = [];
  const impl: { cutCard?: () => Promise<never> } = {};
  const result = { spans: [], stats: {}, readWords: 2, warnings: [] };
  installCardCutterRegistry();
  window.__registerCardCutter!({
    version: 'test',
    detectTerminalImpact: () => false,
    cutCard: async (card: { paras: string[] }, opts: Record<string, unknown>) => {
      if (impl.cutCard) return impl.cutCard();
      calls.push({ method: 'cutCard', paras: card.paras.join(' '), opts });
      return result;
    },
    highlightCard: async (
      card: { paras: string[] },
      _existing: unknown,
      opts: Record<string, unknown>,
    ) => {
      calls.push({ method: 'highlightCard', paras: card.paras.join(' '), opts });
      return result;
    },
  } as never);
  return { calls, impl };
}

function passthroughLease(view: EditorView & { state: EditorState }): void {
  vi.mocked(claimRegion).mockReturnValue({
    id: 'l',
    region: () => ({ from: 0, to: 0 }),
    positions: () => [0, 0],
    delta: () => 0,
    apply: (tr: Parameters<EditorState['apply']>[0]) => view.dispatch(tr),
    release: () => {},
  } as unknown as ReturnType<typeof claimRegion>);
}

describe('bulk cutting', () => {
  beforeEach(() => {
    vi.mocked(showToast).mockClear();
  });

  describe('selectionBulkTargets', () => {
    it('null for an empty or within-one-card selection', () => {
      const view = fakeView(
        n['doc']!.createChecked(null, [cardWith('A', 'alpha', 'none'), cardWith('B', 'bravo', 'none')]),
      );
      expect(selectionBulkTargets(view)).toBeNull(); // empty selection
      const from = cardPos(view.state.doc, 0) + 3;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, from + 1)));
      expect(selectionBulkTargets(view)).toBeNull(); // one card only
    });

    it('classifies plain → cut, underlined → finish, highlighted → left alone, in doc order', () => {
      const view = fakeView(
        n['doc']!.createChecked(null, [
          cardWith('A', 'alpha', 'none'),
          cardWith('B', 'bravo', 'u'),
          cardWith('C', 'charlie', 'hl'),
          cardWith('D', 'delta', 'none'),
        ]),
      );
      selectAcross(view, 0, 3);
      const multi = selectionBulkTargets(view)!;
      expect(multi.spanned).toBe(4);
      expect(multi.alreadyCut).toBe(1);
      expect(multi.actionable.map((a) => a.kind)).toEqual(['cut', 'finish', 'cut']);
      expect(multi.actionable.map((a) => a.cardId)).toEqual([idOf(view, 0), idOf(view, 1), idOf(view, 3)]);
    });

    it('a selection clipping cards at both ends still counts them', () => {
      const view = fakeView(
        n['doc']!.createChecked(null, [
          cardWith('A', 'alpha', 'none'),
          cardWith('B', 'bravo', 'none'),
          cardWith('C', 'charlie', 'none'),
        ]),
      );
      selectAcross(view, 0, 2); // mid-A to mid-C
      expect(selectionBulkTargets(view)!.spanned).toBe(3);
      expect(selectionBulkTargets(view)!.actionable).toHaveLength(3);
    });

    it('stamps a missing tag id so the card is identity-addressable', () => {
      const view = fakeView(
        n['doc']!.createChecked(null, [
          cardWith('A', 'alpha', 'none', null as unknown as string),
          cardWith('B', 'bravo', 'none'),
        ]),
      );
      expect(idOf(view, 0)).toBe('');
      selectAcross(view, 0, 1);
      const multi = selectionBulkTargets(view)!;
      const stamped = idOf(view, 0);
      expect(stamped).toBeTruthy(); // written into the doc
      expect(multi.actionable[0]!.cardId).toBe(stamped);
      expect(resolveCardById(view, stamped)!.card.tag).toBe('A');
    });
  });

  describe('bulkCutCards', () => {
    it('full-cuts plain cards, finishes partial ones, each from its own body, quietly', async () => {
      const view = fakeView(
        n['doc']!.createChecked(null, [cardWith('A', 'alpha', 'none'), cardWith('B', 'bravo', 'u')]),
      );
      passthroughLease(view);
      const { calls } = installEngine();
      selectAcross(view, 0, 1);
      const multi = selectionBulkTargets(view)!;

      const s = await bulkCutCards(view, multi.actionable);
      expect(s).toMatchObject({ cut: 1, finished: 1, failed: 0, skipped: 0, halted: false });
      expect(calls.map((c) => c.method)).toEqual(['cutCard', 'highlightCard']);
      expect(calls[0]!.paras).toBe('alpha');
      expect(calls[1]!.paras).toBe('bravo');
      // Quiet: no per-card completion toasts in a bulk run.
      const toasts = vi.mocked(showToast).mock.calls.map(([m]) => m);
      expect(toasts).not.toContain('Card cut — ↶ to undo');
      expect(toasts).not.toContain('Card highlighted — ↶ to undo');
    });

    it('pending panel flags are neither sent to the engine nor consumed', async () => {
      const view = fakeView(
        n['doc']!.createChecked(null, [cardWith('A', 'alpha', 'none'), cardWith('B', 'bravo', 'none')]),
      );
      passthroughLease(view);
      const { calls } = installEngine();
      // A stray U flag from an abandoned panel, over card A's tag text.
      const from = cardPos(view.state.doc, 0) + 2;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, from + 1)));
      expect(addCutterFlag(view, 'up')).toBeTruthy();

      selectAcross(view, 0, 1);
      const multi = selectionBulkTargets(view)!;
      await bulkCutCards(view, multi.actionable);

      for (const c of calls) {
        expect(c.opts['playUp']).toBeUndefined();
        expect(c.opts['playDown']).toBeUndefined();
      }
      expect(pendingCutterFlags()).toHaveLength(1); // still there for its panel
      clearCutterFlags(view);
    });

    it('skips a card deleted mid-run and one cut mid-run, touching neither', async () => {
      const view = fakeView(
        n['doc']!.createChecked(null, [cardWith('A', 'alpha', 'none'), cardWith('B', 'bravo', 'none')]),
      );
      passthroughLease(view);
      const { calls } = installEngine();
      selectAcross(view, 0, 1);
      const multi = selectionBulkTargets(view)!;
      // Between classification and the run: card A gets highlighted
      // (say, by a collaborator), and card B's id will not resolve.
      const aPos = cardPos(view.state.doc, 0);
      const aNode = view.state.doc.nodeAt(aPos)!;
      view.dispatch(
        view.state.tr.addMark(
          aPos + 1,
          aPos + aNode.nodeSize - 1,
          schema.marks['highlight']!.create({ color: 'yellow' }),
        ),
      );
      const targets = [multi.actionable[0]!, { cardId: 'gone-id', kind: 'cut' as const }];

      const s = await bulkCutCards(view, targets);
      expect(s).toMatchObject({ cut: 0, finished: 0, skipped: 2, failed: 0 });
      expect(calls).toHaveLength(0);
    });

    it('shouldStop ends the run between cards', async () => {
      const view = fakeView(
        n['doc']!.createChecked(null, [cardWith('A', 'alpha', 'none'), cardWith('B', 'bravo', 'none')]),
      );
      passthroughLease(view);
      const { calls } = installEngine();
      selectAcross(view, 0, 1);
      const multi = selectionBulkTargets(view)!;

      let stop = false;
      const s = await bulkCutCards(view, multi.actionable, {
        shouldStop: () => stop,
        onProgress: () => {
          stop = true; // user pressed Stop while card 1 was cutting
        },
      });
      expect(s).toMatchObject({ cut: 1, stopped: true });
      expect(calls).toHaveLength(1);
    });

    it('an auth error halts the whole run at once', async () => {
      const view = fakeView(
        n['doc']!.createChecked(null, [
          cardWith('A', 'alpha', 'none'),
          cardWith('B', 'bravo', 'none'),
          cardWith('C', 'charlie', 'none'),
        ]),
      );
      passthroughLease(view);
      const { calls, impl } = installEngine();
      impl.cutCard = () => Promise.reject(new LlmError('bad key', 401, 'auth'));
      selectAcross(view, 0, 2);
      const multi = selectionBulkTargets(view)!;

      const s = await bulkCutCards(view, multi.actionable);
      expect(s).toMatchObject({ failed: 1, halted: true });
      expect(calls).toHaveLength(0); // recorder never reached — every call threw
    });

    it('three consecutive failures trip the breaker', async () => {
      const view = fakeView(
        n['doc']!.createChecked(
          null,
          ['A', 'B', 'C', 'D', 'E'].map((t) => cardWith(t, `${t.toLowerCase()} body`, 'none')),
        ),
      );
      passthroughLease(view);
      const { impl } = installEngine();
      let attempts = 0;
      impl.cutCard = () => {
        attempts++;
        return Promise.reject(new Error('engine exploded'));
      };
      selectAcross(view, 0, 4);
      const multi = selectionBulkTargets(view)!;

      const s = await bulkCutCards(view, multi.actionable);
      expect(attempts).toBe(3);
      expect(s).toMatchObject({ failed: 3, halted: true, cut: 0 });
    });
  });

  it('cutFocusedCard with cardId targets the captured card, not the cursor', async () => {
    const view = fakeView(
      n['doc']!.createChecked(null, [cardWith('A', 'alpha', 'none'), cardWith('B', 'bravo', 'none')]),
    );
    passthroughLease(view);
    const { calls } = installEngine();
    const aId = idOf(view, 0);
    // Cursor sits in card B — the panel was opened over A.
    const bPos = cardPos(view.state.doc, 1) + 3;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, bPos)));

    const session = await cutFocusedCard(view, { cardId: aId });
    expect(session).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.paras).toBe('alpha');
  });
});
