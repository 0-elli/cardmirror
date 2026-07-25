// @vitest-environment jsdom
// Fuzzy cite-token matching (field report, beta.22): the model's
// [[TOKENS]] can drift from its own [[CITE]] text (case, curly quotes,
// dashes, edge punctuation). Exact indexOf then marked NOTHING, the
// classifier had nothing to promote, and the "cite" stayed an ordinary
// card_body that shrink shrank. Matching is now folded 1:1 (offsets
// carry back to the real text) with an edge-punctuation-trim retry —
// and NO fallback: a cite whose tokens genuinely aren't present stays
// unmarked body text, loudly (the apply path toasts via the meta).
import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { schema, newHeadingId } from '../../src/schema/index.js';
import {
  buildCiteTransaction,
  CITE_TOKENS_MARKED_META,
  foldForTokenMatch,
} from '../../src/editor/ai/cite-creator.js';
import { citeClassifierPlugin } from '../../src/editor/cite-classifier-plugin.js';

const tag = (t: string) => schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(t));
const body = (t: string) => schema.nodes['card_body']!.create(null, schema.text(t));
const card = (...kids: unknown[]) => schema.nodes['card']!.create(null, kids as never);
const doc = (...kids: unknown[]) => schema.nodes['doc']!.create(null, kids as never);

const RAW = 'boudin 02 court of appeals raw pasted stuff';

function run(cite: string, tokens: string[]) {
  const d = doc(card(tag('TAG'), body(RAW), body('The district court granted.')));
  let from = -1;
  d.descendants((n, p) => {
    if (from >= 0) return false;
    if (n.isText && n.text!.includes(RAW)) from = p + n.text!.indexOf(RAW);
    return from < 0;
  });
  let s = EditorState.create({ doc: d, plugins: [citeClassifierPlugin] });
  s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, from, from + RAW.length)));
  const tr = buildCiteTransaction(s, from, from + RAW.length, { cite, tokens })!;
  const after = s.apply(tr);
  const citeBlock = after.doc.firstChild!.child(1);
  const markedText: string[] = [];
  citeBlock.descendants((n) => {
    if (n.isText && n.marks.some((m) => m.type.name === 'cite_mark')) markedText.push(n.text!);
    return true;
  });
  return { type: citeBlock.type.name, markedText, marked: tr.getMeta(CITE_TOKENS_MARKED_META) };
}

describe('fuzzy cite-token matching', () => {
  const CITE = 'Michael Boudin 02, JD, “Fraser v. MLS,” First Circuit, pp. 3–5, Westlaw.';

  it('exact tokens mark and the classifier promotes (the healthy path)', () => {
    const r = run(CITE, ['Boudin 02']);
    expect(r.markedText).toEqual(['Boudin 02']);
    expect(r.type).toBe('cite_paragraph');
    expect(r.marked).toBe(1);
  });

  it('case drift still marks', () => {
    const r = run(CITE, ['boudin 02']);
    expect(r.markedText).toEqual(['Boudin 02']);
    expect(r.type).toBe('cite_paragraph');
  });

  it('curly/straight quote drift still marks', () => {
    const r = run(CITE, ['"Fraser v. MLS,"']);
    expect(r.markedText.join('')).toContain('Fraser v. MLS');
    expect(r.type).toBe('cite_paragraph');
  });

  it('dash drift still marks', () => {
    const r = run(CITE, ['pp. 3-5']);
    expect(r.markedText.join('')).toContain('3–5');
    expect(r.type).toBe('cite_paragraph');
  });

  it('edge-punctuation drift retries trimmed', () => {
    const r = run(CITE, ['Boudin 02,']);
    // The comma IS in the cite, so the untrimmed candidate matches it;
    // a token with punctuation the cite lacks falls back to the trim.
    const r2 = run(CITE, ['(Boudin 02)']);
    expect(r.markedText.join('')).toContain('Boudin 02');
    expect(r2.markedText.join('')).toContain('Boudin 02');
    expect(r2.type).toBe('cite_paragraph');
  });

  it('a genuinely absent token marks nothing and the block stays body text', () => {
    const r = run(CITE, ['Nowhere 99']);
    expect(r.markedText).toEqual([]);
    expect(r.type).toBe('card_body'); // never a cite without a cite mark
    expect(r.marked).toBe(0); // the apply path toasts on this
  });

  it('two-author trailing-"& " token convention still works', () => {
    const cite = 'Adrien Rose & Christian Wilson 9/23, researchers, "Title," Journal.';
    const r = run(cite, ['Rose & ', 'Wilson 9/23']);
    expect(r.markedText.join('')).toBe('Rose & Wilson 9/23');
    expect(r.type).toBe('cite_paragraph');
  });
});

describe('foldForTokenMatch', () => {
  it('is strictly 1:1 on length', () => {
    const samples = ['“Curly” — dash', 'İstanbul', 'plain', 'a b'];
    for (const s of samples) expect(foldForTokenMatch(s).length).toBe(s.length);
  });
});
