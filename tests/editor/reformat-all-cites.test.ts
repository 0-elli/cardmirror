// @vitest-environment jsdom
/**
 * Reformat Every Cite (AI) — the whole-document sweep over the cite
 * creator.
 *
 * The load-bearing invariant is the cursor walk: the pass re-scans the
 * LIVE doc for the next `cite_paragraph` each iteration instead of
 * caching positions, because a rewritten cite changes length and can
 * even stop being a `cite_paragraph` (the classifier demotes a cite
 * whose author/date token found no home). Both cases would break a
 * precomputed position list or an ordinal index, and both are covered
 * here — every cite is visited exactly once, none twice, none skipped.
 *
 * `runReformatAllCites` returns the pass promise, so every assertion
 * below awaits the real completion instead of a timer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { settings } from '../../src/editor/settings.js';
import { editCoordinatorPlugin, claimRegion } from '../../src/editor/ai/edit-coordinator.js';
import { citeClassifierPlugin } from '../../src/editor/cite-classifier-plugin.js';
import { AiActivity } from '../../src/editor/ai/ai-activity.js';
import { LlmError, type LlmRequest, type LlmReply } from '../../src/editor/ai/llm.js';
import type { ConfirmOptions } from '../../src/editor/confirm-dialog.js';
import type { ToastOptions } from '../../src/editor/toast.js';
import {
  collectCiteParagraphs,
  nextCiteParagraph,
  runReformatAllCites,
} from '../../src/editor/ai/reformat-all-cites.js';

const callLlm = vi.fn<(req: LlmRequest) => Promise<LlmReply>>();
const showConfirm = vi.fn<(opts: ConfirmOptions) => Promise<boolean>>();
const showToast = vi.fn<(message: string, opts?: ToastOptions) => void>();

vi.mock('../../src/editor/ai/llm.js', async (importOriginal) => ({
  // Keep the real LlmError / settings-driven helpers; swap the network call
  // and the key lookup.
  ...(await importOriginal<typeof import('../../src/editor/ai/llm.js')>()),
  callLlm: (req: LlmRequest) => callLlm(req),
  activeApiKey: () => 'test-key',
  // The shared gate reads the REAL key internally (which tests don't
  // set) — honor the settings switch, skip the key check.
  aiGateToast: () => settings.get('aiFeaturesEnabled'),
}));
vi.mock('../../src/editor/confirm-dialog.js', () => ({
  showConfirm: (opts: ConfirmOptions) => showConfirm(opts),
}));
vi.mock('../../src/editor/toast.js', () => ({
  showToast: (...args: Parameters<typeof showToast>) => showToast(...args),
}));

const tag = (t: string) => schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(t));
const body = (t: string) => schema.nodes['card_body']!.create(null, schema.text(t));
const citeMark = schema.marks['cite_mark']!.create();
/** A cite paragraph: `marked` is the substring wearing `cite_mark` — the
 *  classifier keys cite-ness off the mark, so an unmarked paragraph
 *  wouldn't stay a `cite_paragraph`. */
const cite = (marked: string, rest: string) =>
  schema.nodes['cite_paragraph']!.create(null, [
    schema.text(marked, [citeMark]),
    schema.text(rest),
  ]);
const card = (...kids: PMNode[]) => schema.nodes['card']!.create(null, kids);
const doc = (...kids: PMNode[]) => schema.nodes['doc']!.createChecked(null, kids);

/** Minimal EditorView stand-in — the pass touches `.state`, `.dispatch`,
 *  `.isDestroyed` and (through the activity cues) `.dom`. dispatch runs
 *  the real apply pipeline so the coordinator's filterTransaction and the
 *  cite classifier both fire. */
interface FakeView {
  state: EditorState;
  isDestroyed: boolean;
  dom: HTMLElement;
  dispatch(tr: unknown): void;
}
function fakeView(d: PMNode): EditorView & FakeView {
  const v: FakeView = {
    state: EditorState.create({
      doc: d,
      plugins: [editCoordinatorPlugin, citeClassifierPlugin],
    }),
    isDestroyed: false,
    dom: document.createElement('div'),
    dispatch(tr) {
      // A fake view only ever receives transactions from the code under
      // test, which builds them off this very state.
      const step = tr as Parameters<EditorState['apply']>[0];
      v.state = v.state.apply(step);
    },
  };
  // Deliberate stand-in: the pass reads four members, and the DOM-facing
  // cues degrade to no-ops without real geometry (`rangeRect` returns
  // null when `coordsAtPos` isn't there).
  return v as unknown as EditorView & FakeView;
}

function reply(citeText: string, tokens: string[]): LlmReply {
  return { text: `[[CITE]]\n${citeText}\n[[TOKENS]]\n${tokens.join('\n')}\n[[END]]` };
}

/** Every cite_paragraph's text in the doc, in order. */
function citeTexts(d: PMNode): string[] {
  const out: string[] = [];
  d.descendants((n) => {
    if (n.type.name !== 'cite_paragraph') return true;
    out.push(n.textContent);
    return false;
  });
  return out;
}

/** The user text of every request the pass made, in order. */
function sentTexts(): string[] {
  return callLlm.mock.calls.map(([req]) => {
    const content = req.messages[0]!.content;
    return typeof content === 'string' ? content : '';
  });
}

/** The pass's end-of-run summary toast. */
function summary(): string | undefined {
  return showToast.mock.calls.map(([m]) => m).find((m) => m.startsWith('Reformatted'));
}

/** Route each request to a canned reply, keyed by the lastname the sent
 *  cite starts with. Every fixture cite is `Lastname NN, …` and every
 *  reply keeps that head, so the [[TOKENS]] line is its first two words.
 *  Throws on an unexpected request — a cite sent twice or out of order
 *  must fail the test, not silently reuse a reply. */
function replyPerLastname(replies: Record<string, string>) {
  return async (req: LlmRequest): Promise<LlmReply> => {
    const content = req.messages[0]!.content;
    const sent = typeof content === 'string' ? content : '';
    const lastname = Object.keys(replies).find((k) => sent.startsWith(k));
    if (!lastname) throw new Error(`unexpected request: ${sent}`);
    const citeText = replies[lastname]!;
    return reply(citeText, [citeText.split(' ').slice(0, 2).join(' ')]);
  };
}

beforeEach(() => {
  callLlm.mockReset();
  showConfirm.mockReset();
  showToast.mockReset();
  showConfirm.mockResolvedValue(true);
  settings.set('aiFeaturesEnabled', true);
  settings.set('aiCitePrompt', '');
});

describe('collectCiteParagraphs', () => {
  it('finds every cite paragraph in document order, across containers', () => {
    const d = doc(
      card(tag('A'), cite('Smith 24', ', first'), body('body')),
      schema.nodes['analytic_unit']!.create(null, [
        schema.nodes['analytic']!.create({ id: newHeadingId() }, schema.text('AN')),
        cite('Jones 23', ', second'),
      ]),
      cite('Lee 22', ', third'),
    );
    expect(collectCiteParagraphs(d).map((t) => t.text)).toEqual([
      'Smith 24, first',
      'Jones 23, second',
      'Lee 22, third',
    ]);
  });

  it('skips a blank cite paragraph — there is nothing to reformat', () => {
    const d = doc(
      card(tag('A'), schema.nodes['cite_paragraph']!.create(), cite('Smith 24', ', x')),
    );
    expect(collectCiteParagraphs(d).map((t) => t.text)).toEqual(['Smith 24, x']);
  });

  it('reports inline content bounds, not node bounds', () => {
    const d = doc(cite('Smith 24', ', x'));
    const t = collectCiteParagraphs(d)[0]!;
    expect(t.from).toBe(t.pos + 1);
    expect(d.textBetween(t.from, t.to)).toBe('Smith 24, x');
  });
});

describe('nextCiteParagraph', () => {
  const d = doc(cite('Smith 24', ', one'), body('x'), cite('Jones 23', ', two'));
  const targets = collectCiteParagraphs(d);

  it('returns the first cite at or after the cursor', () => {
    expect(nextCiteParagraph(d, 0)!.text).toBe('Smith 24, one');
    expect(nextCiteParagraph(d, targets[0]!.to)!.text).toBe('Jones 23, two');
  });

  it('returns null once the cursor is past the last cite', () => {
    expect(nextCiteParagraph(d, targets[1]!.to)).toBeNull();
  });
});

describe('runReformatAllCites', () => {
  it('does not even confirm when the document has no cites', async () => {
    await runReformatAllCites(fakeView(doc(card(tag('A'), body('no cites here')))));
    expect(showConfirm).not.toHaveBeenCalled();
    expect(callLlm).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('No cites in this document.');
  });

  it('refuses to run with AI features off', async () => {
    settings.set('aiFeaturesEnabled', false);
    await runReformatAllCites(fakeView(doc(card(tag('A'), cite('Smith 24', ', a')))));
    expect(showConfirm).not.toHaveBeenCalled();
    expect(callLlm).not.toHaveBeenCalled();
  });

  it('states the request count in the confirm prompt and runs nothing if declined', async () => {
    showConfirm.mockResolvedValue(false);
    const view = fakeView(
      doc(card(tag('A'), cite('Smith 24', ', a')), card(tag('B'), cite('Jones 23', ', b'))),
    );
    await runReformatAllCites(view);

    expect(showConfirm).toHaveBeenCalledTimes(1);
    const opts = showConfirm.mock.calls[0]![0];
    expect(opts.message).toContain('2 cites');
    expect(opts.message).toContain('2 model requests');
    expect(opts.confirmLabel).toBe('Reformat 2 cites');
    expect(callLlm).not.toHaveBeenCalled();
    expect(citeTexts(view.state.doc)).toEqual(['Smith 24, a', 'Jones 23, b']);
  });

  it('sends each cite once and rewrites it in place', async () => {
    const view = fakeView(
      doc(
        card(tag('A'), cite('Smith 24', ', old a'), body('body a')),
        card(tag('B'), cite('Jones 23', ', old b')),
      ),
    );
    callLlm.mockImplementation(
      replyPerLastname({
        Smith: 'Smith 24, NEW A, Journal.',
        Jones: 'Jones 23, NEW B, Journal.',
      }),
    );

    await runReformatAllCites(view);

    expect(sentTexts()).toEqual(['Smith 24, old a', 'Jones 23, old b']);
    expect(citeTexts(view.state.doc)).toEqual([
      'Smith 24, NEW A, Journal.',
      'Jones 23, NEW B, Journal.',
    ]);
    // No stray paragraph split off the cite, and body text is untouched.
    expect(view.state.doc.firstChild!.childCount).toBe(3);
    expect(view.state.doc.firstChild!.child(2).textContent).toBe('body a');
    expect(summary()).toBe('Reformatted 2 of 2 cites.');
  });

  it('keeps walking when a rewrite GROWS the cite — no cite is revisited', async () => {
    // Growth is what a cached-position walk gets wrong: rewriting the
    // first cite pushes every later cite forward in the doc.
    const long = ', '.padEnd(200, 'x');
    const view = fakeView(
      doc(card(tag('A'), cite('Smith 24', ', a')), card(tag('B'), cite('Jones 23', ', b'))),
    );
    callLlm.mockImplementation(
      replyPerLastname({ Smith: `Smith 24${long}`, Jones: `Jones 23${long}` }),
    );

    await runReformatAllCites(view);

    expect(sentTexts()).toEqual(['Smith 24, a', 'Jones 23, b']);
    expect(citeTexts(view.state.doc)).toEqual([`Smith 24${long}`, `Jones 23${long}`]);
  });

  it('keeps walking when a rewrite is DEMOTED out of cite_paragraph', async () => {
    // A token the model can't locate in its own cite leaves the paragraph
    // unmarked, so the classifier turns it into card_body. An ordinal
    // index over cite_paragraphs would then shift and skip a cite.
    const view = fakeView(
      doc(
        card(tag('A'), cite('Smith 24', ', a')),
        card(tag('B'), cite('Jones 23', ', b')),
        card(tag('C'), cite('Lee 22', ', c')),
      ),
    );
    callLlm.mockImplementation(async (req) => {
      const content = req.messages[0]!.content;
      const text = typeof content === 'string' ? content : '';
      if (text.startsWith('Smith')) return reply('Rewritten, no locatable token.', ['Nobody 99']);
      if (text.startsWith('Jones')) return reply('Jones 23, NEW B.', ['Jones 23']);
      return reply('Lee 22, NEW C.', ['Lee 22']);
    });

    await runReformatAllCites(view);

    expect(sentTexts()).toEqual(['Smith 24, a', 'Jones 23, b', 'Lee 22, c']);
    // The demoted paragraph is body text now; the other two stay cites.
    expect(view.state.doc.child(0).child(1).type.name).toBe('card_body');
    expect(view.state.doc.child(0).child(1).textContent).toBe('Rewritten, no locatable token.');
    expect(citeTexts(view.state.doc)).toEqual(['Jones 23, NEW B.', 'Lee 22, NEW C.']);
    expect(summary()).toContain('1 left unstyled');
  });

  it('numbers the progress readout over sent cites, not loop turns', async () => {
    // A blank `cite_paragraph` is skipped without a request, but it is
    // also absent from `total` (collectCiteParagraphs drops it). If the
    // ordinal counted loop turns, every cite after the blank one would
    // read past the total — "Cite 3 of 2".
    const view = fakeView(
      doc(
        card(tag('A'), schema.nodes['cite_paragraph']!.create(), cite('Smith 24', ', a')),
        card(tag('B'), cite('Jones 23', ', b')),
      ),
    );
    callLlm.mockImplementation(
      replyPerLastname({ Smith: 'Smith 24, NEW A.', Jones: 'Jones 23, NEW B.' }),
    );
    const setStage = vi.spyOn(AiActivity.prototype, 'setStage');

    await runReformatAllCites(view);

    const progress = setStage.mock.calls
      .map(([s]) => s)
      .filter((s): s is string => typeof s === 'string' && s.startsWith('reformatting cite '));
    setStage.mockRestore();
    // Gerund phrases, per the pill contract: the clod-mode template
    // wraps stages as "<persona> is <stage>…", so "Cite 1 of 2" would
    // render as the nonsense "Clod is Cite 1 of 2…".
    expect(progress).toEqual([
      'reformatting cite 1 of 2 · Esc to stop',
      'reformatting cite 2 of 2 · Esc to stop',
    ]);
    expect(sentTexts()).toEqual(['Smith 24, a', 'Jones 23, b']);
  });

  it('skips a cite another AI edit already holds, and still does the rest', async () => {
    const view = fakeView(
      doc(card(tag('A'), cite('Smith 24', ', a')), card(tag('B'), cite('Jones 23', ', b'))),
    );
    const held = collectCiteParagraphs(view.state.doc)[0]!;
    expect(claimRegion(view, { from: held.from, to: held.to }, { label: 'other' })).not.toBeNull();
    callLlm.mockImplementation(replyPerLastname({ Jones: 'Jones 23, NEW B.' }));

    await runReformatAllCites(view);

    expect(sentTexts()).toEqual(['Jones 23, b']);
    expect(citeTexts(view.state.doc)).toEqual(['Smith 24, a', 'Jones 23, NEW B.']);
    expect(summary()).toContain('1 skipped (busy)');
  });

  it('a single failed cite does not abort the pass', async () => {
    const view = fakeView(
      doc(card(tag('A'), cite('Smith 24', ', a')), card(tag('B'), cite('Jones 23', ', b'))),
    );
    callLlm.mockImplementation(async (req) => {
      const content = req.messages[0]!.content;
      if (typeof content === 'string' && content.startsWith('Smith')) throw new Error('boom');
      return reply('Jones 23, NEW B.', ['Jones 23']);
    });

    await runReformatAllCites(view);

    expect(callLlm).toHaveBeenCalledTimes(2);
    expect(citeTexts(view.state.doc)).toEqual(['Smith 24, a', 'Jones 23, NEW B.']);
    expect(summary()).toContain('1 failed');
  });

  it('stops the whole pass on an auth failure instead of repeating it per cite', async () => {
    const view = fakeView(
      doc(
        card(tag('A'), cite('Smith 24', ', a')),
        card(tag('B'), cite('Jones 23', ', b')),
        card(tag('C'), cite('Lee 22', ', c')),
      ),
    );
    callLlm.mockRejectedValue(new LlmError('bad key', 401, 'auth'));

    await runReformatAllCites(view);

    expect(callLlm).toHaveBeenCalledTimes(1);
    expect(summary()).toBe('Reformatted 0 of 3 cites · 1 failed.');
  });

  it('refuses a second pass over the same document, and frees the guard after', async () => {
    // Double-invoking (a stray palette re-entry) used to start a second
    // interleaved pass over the same doc: every cite sent — and billed —
    // twice, and a single Escape stopping both.
    const view = fakeView(
      doc(card(tag('A'), cite('Smith 24', ', a')), card(tag('B'), cite('Jones 23', ', b'))),
    );
    let reachedRequest!: () => void;
    const inFlight = new Promise<void>((r) => {
      reachedRequest = r;
    });
    let releaseRequest!: () => void;
    const held = new Promise<void>((r) => {
      releaseRequest = r;
    });
    const canned = replyPerLastname({
      Smith: 'Smith 24, NEW A, Journal.',
      Jones: 'Jones 23, NEW B, Journal.',
    });
    callLlm.mockImplementation(async (req) => {
      reachedRequest();
      await held;
      return canned(req);
    });

    const first = runReformatAllCites(view);
    await inFlight; // the pass is provably mid-request now

    await runReformatAllCites(view);
    expect(showConfirm).toHaveBeenCalledTimes(1); // never got as far as asking
    expect(showToast).toHaveBeenCalledWith(
      'A cite reformat pass is already running in this document.',
    );

    releaseRequest();
    await first;

    // Each cite sent exactly once, despite the second invocation.
    expect(sentTexts()).toEqual(['Smith 24, a', 'Jones 23, b']);
    expect(summary()).toBe('Reformatted 2 of 2 cites.');

    // The guard is released, not stuck — a later run still gets to ask.
    showConfirm.mockResolvedValue(false);
    await runReformatAllCites(view);
    expect(showConfirm).toHaveBeenCalledTimes(2);
  });

  it('runs concurrently in another pane — the guard is per document, not app-wide', async () => {
    // Panes hold distinct documents (the shell focuses an already-open
    // file rather than loading it twice), so a pass in one pane has no
    // business blocking a pass in another.
    const viewA = fakeView(doc(card(tag('A'), cite('Smith 24', ', a'))));
    const viewB = fakeView(doc(card(tag('B'), cite('Jones 23', ', b'))));
    let reachedA!: () => void;
    const inFlightA = new Promise<void>((r) => {
      reachedA = r;
    });
    let releaseA!: () => void;
    const heldA = new Promise<void>((r) => {
      releaseA = r;
    });
    callLlm.mockImplementation(async (req) => {
      const content = req.messages[0]!.content;
      const sent = typeof content === 'string' ? content : '';
      if (sent.startsWith('Smith')) {
        reachedA();
        await heldA;
        return reply('Smith 24, NEW A.', ['Smith 24']);
      }
      return reply('Jones 23, NEW B.', ['Jones 23']);
    });

    const passA = runReformatAllCites(viewA);
    await inFlightA; // pane A is mid-request

    // Pane B runs to completion while A is still in flight.
    await runReformatAllCites(viewB);
    expect(citeTexts(viewB.state.doc)).toEqual(['Jones 23, NEW B.']);

    releaseA();
    await passA;
    expect(citeTexts(viewA.state.doc)).toEqual(['Smith 24, NEW A.']);
    expect(showToast).not.toHaveBeenCalledWith(
      'A cite reformat pass is already running in this document.',
    );
  });

  it('Escape stops the pass in the pane it was pressed in, not the other one', async () => {
    // Both passes register a capture-phase listener on `window`, and
    // stopPropagation does not stop listeners on the same node — so
    // without scoping, one Escape would cancel every running pass.
    const viewA = fakeView(
      doc(card(tag('A'), cite('Smith 24', ', a')), card(tag('A2'), cite('Adams 24', ', a2'))),
    );
    const viewB = fakeView(
      doc(card(tag('B'), cite('Jones 23', ', b')), card(tag('B2'), cite('Brown 23', ', b2'))),
    );
    document.body.append(viewA.dom, viewB.dom);
    const held: Record<string, () => void> = {};
    const reached: Record<string, () => void> = {};
    const inFlight = {
      A: new Promise<void>((r) => (reached['A'] = r)),
      B: new Promise<void>((r) => (reached['B'] = r)),
    };
    callLlm.mockImplementation(async (req) => {
      const content = req.messages[0]!.content;
      const sent = typeof content === 'string' ? content : '';
      const head = sent.split(',')[0]!;
      const pane = sent.startsWith('Smith') || sent.startsWith('Adams') ? 'A' : 'B';
      // Hold only the FIRST cite of each pane, so Escape lands while both
      // passes are between cites.
      if (sent.startsWith('Smith') || sent.startsWith('Jones')) {
        reached[pane]!();
        await new Promise<void>((r) => (held[pane] = r));
      }
      return reply(`${head}, NEW.`, [head]);
    });

    const passA = runReformatAllCites(viewA);
    const passB = runReformatAllCites(viewB);
    await Promise.all([inFlight.A, inFlight.B]);

    // Escape inside pane A's editor.
    viewA.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    held['A']!();
    held['B']!();
    await Promise.all([passA, passB]);

    const summaries = showToast.mock.calls.map(([m]) => m).filter((m) => m.startsWith('Reformatted'));
    // A stopped after the cite in flight; B ran both of its own.
    expect(summaries).toContain('Reformatted 1 of 2 cites · stopped.');
    expect(summaries).toContain('Reformatted 2 of 2 cites.');
    viewA.dom.remove();
    viewB.dom.remove();
  });

  it('keeps its place when a FAILED cite shifts under a user edit', async () => {
    // The cursor was corrected from the lease only after a successful
    // rewrite. A cite that failed while the user deleted text above it
    // left the cursor at its pre-edit end — past the cites that followed,
    // which were then never visited and never reported.
    const filler = 'x'.repeat(400);
    const view = fakeView(
      doc(
        card(tag('A'), body(filler), cite('Smith 24', ', a')),
        card(tag('B'), cite('Jones 23', ', b')),
      ),
    );
    callLlm.mockImplementation(async (req) => {
      const content = req.messages[0]!.content;
      const sent = typeof content === 'string' ? content : '';
      if (sent.startsWith('Smith')) {
        // The user deletes the long paragraph ABOVE the in-flight cite:
        // every later position shifts left by its whole length.
        let from = -1;
        let to = -1;
        view.state.doc.descendants((node, pos) => {
          if (node.type.name === 'card_body' && node.textContent === filler) {
            from = pos;
            to = pos + node.nodeSize;
          }
          return true;
        });
        view.dispatch(view.state.tr.delete(from, to));
        throw new LlmError('overloaded', 529, 'server');
      }
      return reply('Jones 23, NEW B, Journal.', ['Jones 23']);
    });

    await runReformatAllCites(view);

    // The cite after the failure is still found and reformatted.
    expect(sentTexts()).toEqual(['Smith 24, a', 'Jones 23, b']);
    expect(citeTexts(view.state.doc)).toEqual(['Smith 24, a', 'Jones 23, NEW B, Journal.']);
    expect(summary()).toBe('Reformatted 1 of 2 cites · 1 failed.');
  });

  it('gives up after three failures in a row instead of grinding the document', async () => {
    const view = fakeView(
      doc(
        ...['Smith 24', 'Jones 23', 'Lee 22', 'Diaz 21', 'Okoye 20', 'Park 19'].map((c) =>
          card(tag('T'), cite(c, ', x')),
        ),
      ),
    );
    // A rate-limit is NOT in the auth/model fail-fast list, so before the
    // streak breaker this walked all six cites to fail on each one.
    callLlm.mockRejectedValue(new LlmError('rate limited', 429, 'rate-limit'));

    await runReformatAllCites(view);

    expect(callLlm).toHaveBeenCalledTimes(3);
    expect(summary()).toBe(
      'Reformatted 0 of 6 cites · 3 failed · stopped after repeated failures.',
    );
  });

  it('counts the streak from the last success, so scattered failures do not stop it', async () => {
    const names = ['Smith 24', 'Jones 23', 'Lee 22', 'Diaz 21', 'Okoye 20'];
    const view = fakeView(doc(...names.map((c) => card(tag('T'), cite(c, ', x')))));
    // Fail, succeed, fail, succeed, fail — never three in a row.
    let i = 0;
    callLlm.mockImplementation(async (req) => {
      const content = req.messages[0]!.content;
      const sent = typeof content === 'string' ? content : '';
      const head = sent.split(',')[0]!;
      if (i++ % 2 === 0) throw new LlmError('blip', 500, 'server');
      return reply(`${head}, NEW.`, [head]);
    });

    await runReformatAllCites(view);

    expect(callLlm).toHaveBeenCalledTimes(5);
    expect(summary()).toBe('Reformatted 2 of 5 cites · 3 failed.');
  });

  it('never sends more cites than the confirm authorized', async () => {
    const view = fakeView(
      doc(card(tag('A'), cite('Smith 24', ', a')), card(tag('B'), cite('Jones 23', ', b'))),
    );
    callLlm.mockImplementation(async (req) => {
      const content = req.messages[0]!.content;
      const sent = typeof content === 'string' ? content : '';
      if (sent.startsWith('Smith')) {
        // The user pastes another cite at the end of the doc mid-run. It
        // was never in the confirmed count, so it must not be billed.
        view.dispatch(
          view.state.tr.insert(view.state.doc.content.size, card(tag('C'), cite('Novak 18', ', c'))),
        );
      }
      return replyPerLastname({
        Smith: 'Smith 24, NEW A.',
        Jones: 'Jones 23, NEW B.',
        Novak: 'Novak 18, NEW C.',
      })(req);
    });

    await runReformatAllCites(view);

    expect(showConfirm.mock.calls[0]![0].message).toContain('2 model requests');
    expect(sentTexts()).toEqual(['Smith 24, a', 'Jones 23, b']);
    expect(citeTexts(view.state.doc)).toEqual([
      'Smith 24, NEW A.',
      'Jones 23, NEW B.',
      'Novak 18, c', // pasted mid-run, left for a second pass
    ]);
    expect(summary()).toBe(
      'Reformatted 2 of 2 cites · cites added during the run were left alone.',
    );
  });
});
