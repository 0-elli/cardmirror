// @vitest-environment jsdom

/**
 * Card identity for the cutter's outlives-the-moment flows.
 *
 * Every cutter flow used to resolve its target with `focusedPlainCard`,
 * which reads the LIVE CURSOR. That is correct for an action fired and
 * finished in one gesture, and wrong for anything that outlives its
 * opening moment: the refine sheet stays open, and cutting several
 * cards in a row stacks panels the user answers one at a time. Answer
 * card B's panel while the cursor sits in card A and the refine landed
 * on card A — silently, with no error and no visible clue.
 *
 * The fix anchors those flows to the card's tag/analytic heading id (a
 * stable UUID, stamped on load for legacy docs), re-resolved to current
 * positions at use time. These tests pin the three properties that
 * makes correct: identity survives cursor movement, identity survives
 * position shifts from edits above the card, and a deleted card
 * resolves to null rather than to some other card.
 */

import { describe, expect, it, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { schema, newHeadingId } from '../../src/schema/index.js';

vi.mock('../../src/editor/ribbon-commands.js', () => ({
  compileShrinkProtections: () => [],
  findProtectedRanges: () => [],
}));
vi.mock('../../src/editor/ai/llm.js', () => ({
  callLlm: vi.fn(),
  activeApiKey: () => 'k',
  resolveAiModel: () => 'test-model',
}));
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
  focusedPlainCard,
  resolveCardById,
  cardLabel,
  installCardCutterRegistry,
  refineHighlightFocusedCard,
  addCutterFlag,
  clearCutterFlags,
  cardReadStats,
} from '../../src/editor/card-cutter-port.js';
import { claimRegion } from '../../src/editor/ai/edit-coordinator.js';

const n = schema.nodes;

const card = (tagText: string, body: string, id = newHeadingId()): PMNode =>
  n['card']!.create(null, [
    n['tag']!.create({ id }, schema.text(tagText)),
    n['card_body']!.create(null, schema.text(body)),
  ]);

function twoCardDoc(): PMNode {
  return n['doc']!.createChecked(null, [
    card('Card A tag', 'body of the first card'),
    card('Card B tag', 'body of the second card'),
  ]);
}

/** Minimal view stand-in over a real EditorState, so selection moves
 *  and transactions behave like the editor's. */
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

/** Put the cursor inside the i-th card. */
function putCursorIn(view: EditorView & { state: EditorState }, index: number): void {
  const pos = cardPos(view.state.doc, index) + 1;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

describe('card identity', () => {
  it('every card carries its tag heading id', () => {
    const view = fakeView(twoCardDoc());
    putCursorIn(view, 0);
    const a = focusedPlainCard(view)!;
    expect(a.cardId).toBeTruthy();
    expect(a.card.tag).toBe('Card A tag');

    putCursorIn(view, 1);
    const b = focusedPlainCard(view)!;
    expect(b.cardId).toBeTruthy();
    expect(b.cardId).not.toBe(a.cardId);
  });

  it('resolves the SAME card after the cursor moves elsewhere — the stacked-panel bug', () => {
    const view = fakeView(twoCardDoc());
    putCursorIn(view, 0);
    const captured = focusedPlainCard(view)!; // panel opened over card A

    // User clicks into card B while A's panel is still open / stacked.
    putCursorIn(view, 1);
    expect(focusedPlainCard(view)!.card.tag).toBe('Card B tag'); // cursor moved

    // Identity resolution still points at A — the whole point.
    const resolved = resolveCardById(view, captured.cardId!)!;
    expect(resolved.card.tag).toBe('Card A tag');
    expect(resolved.cardFrom).toBe(captured.cardFrom);
  });

  it('re-resolves to CURRENT positions after an edit above shifts the card', () => {
    const view = fakeView(twoCardDoc());
    putCursorIn(view, 1);
    const captured = focusedPlainCard(view)!; // card B
    const before = captured.cardFrom;

    // Insert text into card A's body — everything below shifts right.
    const aBodyPos = cardPos(view.state.doc, 0) + 1 + view.state.doc.child(0).child(0).nodeSize + 1;
    view.dispatch(view.state.tr.insertText('XXXXXXXXXX', aBodyPos));

    const resolved = resolveCardById(view, captured.cardId!)!;
    expect(resolved.card.tag).toBe('Card B tag');
    expect(resolved.cardFrom).toBeGreaterThan(before); // stale position would be wrong
    // And the re-extracted paragraph anchors track the shift too.
    expect(resolved.paraStarts[0]).toBeGreaterThan(captured.paraStarts[0]!);
  });

  it('returns null for a deleted card rather than silently hitting another', () => {
    const view = fakeView(twoCardDoc());
    putCursorIn(view, 0);
    const captured = focusedPlainCard(view)!;

    const from = cardPos(view.state.doc, 0);
    view.dispatch(view.state.tr.delete(from, from + view.state.doc.child(0).nodeSize));

    expect(resolveCardById(view, captured.cardId!)).toBeNull();
    // The surviving card is NOT returned in its place.
    expect(view.state.doc.childCount).toBe(1);
  });

  it('labels cards by tag, falling back to body text', () => {
    const view = fakeView(
      n['doc']!.createChecked(null, [
        card('A short tag', 'body'),
        n['card']!.create(null, [
          n['tag']!.create({ id: newHeadingId() }),
          n['card_body']!.create(null, schema.text('untagged card body leads the label')),
        ]),
      ]),
    );
    putCursorIn(view, 0);
    expect(cardLabel(focusedPlainCard(view)!)).toBe('A short tag');
    putCursorIn(view, 1);
    expect(cardLabel(focusedPlainCard(view)!)).toBe('untagged card body leads the label');
  });

  it('refineHighlightFocusedCard acts on its captured card, NOT the cursor', async () => {
    // The regression itself. Open a refine panel over card A, click into
    // card B (a stacked panel, a stray click), then run the refine: the
    // engine must be handed card A's body.
    const withHl = (tagText: string, body: string): PMNode =>
      n['card']!.create(null, [
        n['tag']!.create({ id: newHeadingId() }, schema.text(tagText)),
        n['card_body']!.create(null, [
          schema.text(body, [schema.marks['highlight']!.create({ color: 'yellow' })]),
        ]),
      ]);
    const view = fakeView(
      n['doc']!.createChecked(null, [
        withHl('Card A tag', 'alpha alpha alpha'),
        withHl('Card B tag', 'bravo bravo bravo'),
      ]),
    );

    putCursorIn(view, 0);
    const captured = focusedPlainCard(view)!; // panel opened over A
    putCursorIn(view, 1); // ...cursor now in B

    // Lease is a no-op passthrough for the test.
    vi.mocked(claimRegion).mockReturnValue({
      id: 'l',
      region: () => ({ from: 0, to: 0 }),
      positions: () => [0, 0],
      delta: () => 0,
      apply: (tr: Parameters<EditorState['apply']>[0]) => view.dispatch(tr),
      release: () => {},
    } as unknown as ReturnType<typeof claimRegion>);

    const seen: string[] = [];
    installCardCutterRegistry();
    window.__registerCardCutter!({
      version: 'test',
      refineHighlight: async (cardArg: { paras: string[] }, map: unknown) => {
        seen.push(cardArg.paras.join(' '));
        return { map, words: 3, warnings: [] };
      },
    } as never);

    await refineHighlightFocusedCard(view, { skeletonize: true, cardId: captured.cardId! });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('alpha'); // card A — the captured one
    expect(seen[0]).not.toContain('bravo'); // NOT wherever the cursor went
  });

  it('folds U/D annotations into the refine guidance', async () => {
    // refineHighlight has no play-up/down parameters (only the cut passes
    // do), so flags must reach the model through the free-text guidance
    // the refine prompt already reads — otherwise they vanish silently.
    const view = fakeView(
      n['doc']!.createChecked(null, [
        n['card']!.create(null, [
          n['tag']!.create({ id: newHeadingId() }, schema.text('Flagged card')),
          n['card_body']!.create(null, [
            schema.text('alpha bravo charlie delta', [
              schema.marks['highlight']!.create({ color: 'yellow' }),
            ]),
          ]),
        ]),
      ]),
    );
    putCursorIn(view, 0);
    const captured = focusedPlainCard(view)!;

    // Select "bravo" and flag it down. paraStarts[0] is the body
    // textblock's content start, so offsets into it are inline positions.
    const bodyStart = captured.paraStarts[0]!;
    const text = captured.card.paras[0]!;
    const at = text.indexOf('bravo');
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, bodyStart + at, bodyStart + at + 'bravo'.length),
      ),
    );
    expect(addCutterFlag(view, 'down')).toBeTruthy();

    vi.mocked(claimRegion).mockReturnValue({
      id: 'l',
      region: () => ({ from: 0, to: 0 }),
      positions: () => [0, 0],
      delta: () => 0,
      apply: (tr: Parameters<EditorState['apply']>[0]) => view.dispatch(tr),
      release: () => {},
    } as unknown as ReturnType<typeof claimRegion>);

    let sentFeedback = '';
    installCardCutterRegistry();
    window.__registerCardCutter!({
      version: 'test',
      refineHighlight: async (_c: unknown, map: unknown, opts: { feedback?: string }) => {
        sentFeedback = opts.feedback ?? '';
        return { map, words: 4, warnings: [] };
      },
    } as never);

    await refineHighlightFocusedCard(view, {
      feedback: 'keep the impact',
      cardId: captured.cardId!,
    });

    expect(sentFeedback).toContain('keep the impact'); // typed guidance survives
    expect(sentFeedback).toContain('Play DOWN');
    expect(sentFeedback).toContain('bravo'); // the flagged text itself
    clearCutterFlags(view);
  });

  it('surgical adjust: flags-only still goes THROUGH THE MODEL, with region-edit wording', async () => {
    // U/D are imprecise gestures at every stage — the model interprets
    // them; nothing applies marks mechanically. A flags-only adjustment
    // must therefore still be one refine call, carrying the surgical
    // rule and add/remove (not play-up/down) directives, with adding
    // allowed so an "up" note can actually add.
    const view = fakeView(
      n['doc']!.createChecked(null, [
        n['card']!.create(null, [
          n['tag']!.create({ id: newHeadingId() }, schema.text('Reviewed card')),
          n['card_body']!.create(null, [
            schema.text('alpha bravo charlie delta', [
              schema.marks['highlight']!.create({ color: 'yellow' }),
            ]),
          ]),
        ]),
      ]),
    );
    putCursorIn(view, 0);
    const captured = focusedPlainCard(view)!;

    const bodyStart = captured.paraStarts[0]!;
    const at = captured.card.paras[0]!.indexOf('charlie');
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, bodyStart + at, bodyStart + at + 'charlie'.length),
      ),
    );
    expect(addCutterFlag(view, 'up')).toBeTruthy();

    vi.mocked(claimRegion).mockReturnValue({
      id: 'l',
      region: () => ({ from: 0, to: 0 }),
      positions: () => [0, 0],
      delta: () => 0,
      apply: (tr: Parameters<EditorState['apply']>[0]) => view.dispatch(tr),
      release: () => {},
    } as unknown as ReturnType<typeof claimRegion>);

    let calls = 0;
    let sent: { feedback?: string; allowAdd?: boolean } = {};
    installCardCutterRegistry();
    window.__registerCardCutter!({
      version: 'test',
      refineHighlight: async (
        _c: unknown,
        map: unknown,
        opts: { feedback?: string; allowAdd?: boolean },
      ) => {
        calls++;
        sent = opts;
        return { map, words: 4, warnings: [] };
      },
    } as never);

    const ok = await refineHighlightFocusedCard(view, {
      cardId: captured.cardId!,
      surgical: true,
      allowAdd: true,
      // no feedback: the gesture is the whole instruction
    });

    expect(ok).toBe(true);
    expect(calls).toBe(1); // the model call happened
    expect(sent.allowAdd).toBe(true);
    expect(sent.feedback).toContain('SURGICAL ADJUSTMENT');
    expect(sent.feedback).toContain('smallest change');
    expect(sent.feedback).toContain('ADD highlighting in this region');
    expect(sent.feedback).toContain('charlie');
    expect(sent.feedback).not.toContain('Play UP'); // post-cut wording, not the pre-cut hint
    clearCutterFlags(view);
  });

  it('cardReadStats counts the highlighted words, and nulls for a gone card', () => {
    const view = fakeView(
      n['doc']!.createChecked(null, [
        n['card']!.create(null, [
          n['tag']!.create({ id: newHeadingId() }, schema.text('Stats card')),
          n['card_body']!.create(null, [
            schema.text('one two ', [schema.marks['highlight']!.create({ color: 'yellow' })]),
            schema.text('middle plain stretch '),
            schema.text('three', [schema.marks['highlight']!.create({ color: 'yellow' })]),
          ]),
        ]),
      ]),
    );
    putCursorIn(view, 0);
    const captured = focusedPlainCard(view)!;
    const stats = cardReadStats(view, captured.cardId!)!;
    expect(stats.words).toBe(3); // one, two, three — not the plain stretch
    expect(stats.seconds).toBeGreaterThanOrEqual(1);

    const from = cardPos(view.state.doc, 0);
    view.dispatch(view.state.tr.delete(from, from + view.state.doc.child(0).nodeSize));
    expect(cardReadStats(view, captured.cardId!)).toBeNull();
  });

  it('truncates a very long label', () => {
    const long = 'x'.repeat(200);
    const view = fakeView(n['doc']!.createChecked(null, [card(long, 'body')]));
    putCursorIn(view, 0);
    const l = cardLabel(focusedPlainCard(view)!);
    expect(l.length).toBeLessThanOrEqual(70);
    expect(l.endsWith('…')).toBe(true);
  });
});
