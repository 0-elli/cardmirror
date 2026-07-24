/**
 * Exotic-whitespace folding (PDF/OCR paste artifacts). Field case: a
 * libgen PDF pasted with U+2007 FIGURE SPACE as its word gaps — a
 * NON-breaking space, so the card wrapped mid-word / at stray spaces,
 * rendering fake line breaks that survive backspace. The shared
 * predicates/regexes drive the three cleanup commands (F2 plain paste,
 * Condense, Repair OCR/PDF pass 0); nothing folds globally. Characters
 * appear as \u escapes throughout — literals would be invisible.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { schema, newHeadingId } from '../../src/schema/index.js';
import {
  FOLDABLE_SPACES_RE,
  STRIPPABLE_INVISIBLES_RE,
  UNICODE_BREAKS_RE,
  collectExoticWhitespaceFixes,
  isFoldableSpace,
  isStrippableInvisible,
  isUnicodeBreak,
} from '../../src/editor/exotic-whitespace.js';
import { buildRepairTransaction } from '../../src/editor/ai/repair-text.js';

const FOLDABLE = [
  '\u00A0', // NBSP (non-breaking)
  '\u1680', // ogham space mark
  '\u2002', // en space
  '\u2003', // em space
  '\u2007', // FIGURE SPACE (non-breaking; the field case)
  '\u2009', // thin space
  '\u200A', // hair space
  '\u202F', // narrow NBSP (non-breaking)
  '\u205F', // medium mathematical space
  '\u3000', // ideographic space
];
const BREAKS = ['\u000B', '\u000C', '\u0085', '\u2028', '\u2029'];
const INVISIBLES = ['\u00AD', '\u200B', '\u200C', '\u200D', '\uFEFF'];

describe('character classes', () => {
  it('classifies the fold / break / strip sets disjointly', () => {
    for (const ch of FOLDABLE) {
      expect(isFoldableSpace(ch)).toBe(true);
      expect(isUnicodeBreak(ch)).toBe(false);
      expect(isStrippableInvisible(ch)).toBe(false);
    }
    for (const ch of BREAKS) {
      expect(isUnicodeBreak(ch)).toBe(true);
      expect(isFoldableSpace(ch)).toBe(false);
      expect(isStrippableInvisible(ch)).toBe(false);
    }
    for (const ch of INVISIBLES) {
      expect(isStrippableInvisible(ch)).toBe(true);
      expect(isFoldableSpace(ch)).toBe(false);
      expect(isUnicodeBreak(ch)).toBe(false);
    }
  });

  it('leaves ordinary text alone — space, tab, newline, pilcrow, letters', () => {
    for (const ch of [' ', '\t', '\n', '¶', 'a', '’', '—']) {
      expect(isFoldableSpace(ch)).toBe(false);
      expect(isUnicodeBreak(ch)).toBe(false);
      expect(isStrippableInvisible(ch)).toBe(false);
    }
  });

  it('keeps the regexes in lockstep with the predicates', () => {
    // Sweep the BMP: every char a regex matches must satisfy its
    // predicate and vice versa, so the two forms can never drift.
    for (let c = 0; c <= 0xffff; c++) {
      const ch = String.fromCharCode(c);
      expect(new RegExp(FOLDABLE_SPACES_RE.source).test(ch)).toBe(isFoldableSpace(ch));
      expect(new RegExp(UNICODE_BREAKS_RE.source).test(ch)).toBe(isUnicodeBreak(ch));
      expect(new RegExp(STRIPPABLE_INVISIBLES_RE.source).test(ch)).toBe(
        isStrippableInvisible(ch),
      );
    }
  });
});

// ---- collectExoticWhitespaceFixes over a real doc ----

function cardBody(text: string) {
  return schema.nodes['card_body']!.create(null, text ? schema.text(text) : null);
}
function tag(text: string, id = newHeadingId()) {
  return schema.nodes['tag']!.create({ id }, text ? schema.text(text) : []);
}
function makeDoc(children: ReturnType<typeof cardBody>[]) {
  return schema.nodes['doc']!.create(null, children);
}

describe('collectExoticWhitespaceFixes', () => {
  it('finds figure spaces and merges adjacent artifacts into runs', () => {
    // a<2007><2007>b<SHY>c — the two figure spaces are one run, the
    // soft hyphen its own strip fix.
    const doc = makeDoc([cardBody('a\u2007\u2007b\u00ADc')]);
    const fixes = collectExoticWhitespaceFixes(doc, 0, doc.content.size);
    expect(fixes).toEqual([
      { from: 2, to: 4, replace: '  ' },
      { from: 5, to: 6, replace: '' },
    ]);
  });

  it('clamps to the requested range', () => {
    const doc = makeDoc([cardBody('\u2007a\u2007b\u2007')]);
    // Text runs at positions 1..6; restrict to the middle three chars.
    const fixes = collectExoticWhitespaceFixes(doc, 2, 5);
    expect(fixes).toEqual([{ from: 3, to: 4, replace: ' ' }]);
  });

  it('returns nothing for clean text', () => {
    const doc = makeDoc([cardBody('perfectly ordinary spacing')]);
    expect(collectExoticWhitespaceFixes(doc, 0, doc.content.size)).toEqual([]);
  });

  it('feeds buildRepairTransaction: folds the nora paragraph and preserves marks', () => {
    // The field shape: highlighted card text whose word gaps are
    // figure spaces. After the fix pass the words are separated by
    // plain spaces and the highlight mark still covers them.
    const highlight = schema.marks['highlight']
      ? [schema.marks['highlight']!.create()]
      : [];
    const body = schema.nodes['card_body']!.create(
      null,
      schema.text('offensive\u2007mari time\u2007power', highlight),
    );
    const doc = makeDoc([tag('T'), body]);
    const fixes = collectExoticWhitespaceFixes(doc, 0, doc.content.size);
    expect(fixes).toHaveLength(2);
    const state = EditorState.create({ schema, doc });
    const { tr } = buildRepairTransaction(state, fixes);
    const next = state.apply(tr);
    const fixedBody = next.doc.child(1);
    expect(fixedBody.textContent).toBe('offensive mari time power');
    if (highlight.length) {
      // Every text child of the fixed body still carries the mark.
      fixedBody.forEach((child) => {
        expect(child.marks.some((m) => m.type.name === 'highlight')).toBe(true);
      });
    }
  });
});
