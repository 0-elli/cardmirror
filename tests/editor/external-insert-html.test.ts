// @vitest-environment jsdom
/**
 * Rich (`html`) payloads on the external-insert bridge.
 *
 * The contract under test:
 *  - CardMirror-native HTML (our own toDOM serialization) round-trips
 *    at full fidelity — structure, highlight color, cite/underline
 *    marks — because it parses through the schema's own parseDOM.
 *  - Whole cards land at a valid outline slot (never splitting the
 *    cursor's card into a phantom-tag sibling).
 *  - Hostile markup is inert: scripts never execute and their source
 *    text never leaks into the document.
 *  - Unusable html returns null so the caller falls back to the text
 *    path — the same rendering an older CardMirror produces.
 */
import { describe, expect, it } from 'vitest';
import { DOMSerializer } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { buildExternalRichInsertTransaction } from '../../src/editor/external-insert.js';
import { absorbPlugin } from '../../src/editor/absorb-plugin.js';

const tag = (t: string) => schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(t));
import type { Node as PMNode } from 'prosemirror-model';
const cardBody = (kids: PMNode[]) => schema.nodes['card_body']!.create(null, kids);
const card = (...k: PMNode[]) => schema.nodes['card']!.createChecked(null, k);
const paragraph = (t: string) =>
  schema.nodes['paragraph']!.create(null, t ? schema.text(t) : []);

function stateWith(kids: ReturnType<typeof paragraph>[], cursorPos = 1): EditorState {
  const doc = schema.nodes['doc']!.createChecked(null, kids);
  const state = EditorState.create({ doc, plugins: [absorbPlugin] });
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, cursorPos)));
}

/** Serialize nodes with CardMirror's own toDOM — what a cooperating
 *  app (or a copy from CardMirror itself) emits. */
function nativeHtml(...nodes: ReturnType<typeof paragraph>[]): string {
  const holder = document.createElement('div');
  const frag = DOMSerializer.fromSchema(schema).serializeFragment(
    schema.nodes['doc']!.createChecked(null, nodes).content,
  );
  holder.appendChild(frag);
  return holder.innerHTML;
}

const topTypes = (doc: EditorState['doc']): string[] => {
  const out: string[] = [];
  doc.forEach((c) => out.push(c.type.name));
  return out;
};

describe('rich external insert — native round-trip', () => {
  it('a whole card with marks survives structure- and mark-intact', () => {
    const highlight = schema.marks['highlight']!.create({ color: 'green' });
    const cite = schema.marks['cite_mark']!.create();
    const src = card(
      tag('TAG TEXT'),
      cardBody([
        schema.text('plain '),
        schema.text('spoken', [highlight]),
        schema.text(' and '),
        schema.text('Smith 24', [cite]),
      ]),
    );
    const html = nativeHtml(src);
    const state = stateWith([paragraph('existing')], 3);
    const tr = buildExternalRichInsertTransaction(state, { html, newParagraph: true });
    expect(tr).not.toBeNull();
    const doc = state.apply(tr!).doc;
    expect(topTypes(doc)).toContain('card');
    let sawHighlight = false;
    let sawCite = false;
    let tagText = '';
    doc.descendants((n) => {
      if (n.type.name === 'tag') tagText = n.textContent;
      if (n.isText && n.marks.some((m) => m.type.name === 'highlight' && m.attrs['color'] === 'green')) {
        sawHighlight = n.text === 'spoken';
      }
      if (n.isText && n.marks.some((m) => m.type.name === 'cite_mark')) {
        sawCite = n.text === 'Smith 24';
      }
      return true;
    });
    expect(tagText).toBe('TAG TEXT');
    expect(sawHighlight).toBe(true);
    expect(sawCite).toBe(true);
  });

  it('a card inserted at a caret INSIDE another card lands as a sibling, not a split', () => {
    const dest = card(tag('DEST'), cardBody([schema.text('destination body')]));
    const doc = schema.nodes['doc']!.createChecked(null, [dest]);
    const state = EditorState.create({ doc, plugins: [absorbPlugin] });
    // Cursor mid-body of the destination card.
    let bodyPos = -1;
    state.doc.descendants((n, p) => {
      if (bodyPos === -1 && n.type.name === 'card_body') bodyPos = p + 3;
      return bodyPos === -1;
    });
    const withCursor = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, bodyPos)),
    );
    const html = nativeHtml(card(tag('INCOMING'), cardBody([schema.text('incoming body')])));
    const tr = buildExternalRichInsertTransaction(withCursor, { html, newParagraph: true });
    const after = withCursor.apply(tr!).doc;
    expect(topTypes(after)).toEqual(['card', 'card']);
    // No phantom card: both cards carry real tag text.
    const tags: string[] = [];
    after.descendants((n) => {
      if (n.type.name === 'tag') tags.push(n.textContent);
      return true;
    });
    expect(tags.sort()).toEqual(['DEST', 'INCOMING']);
  });
});

describe('rich external insert — arbitrary + hostile html', () => {
  it('generic formatted html maps through parseDOM', () => {
    const state = stateWith([paragraph('')]);
    const tr = buildExternalRichInsertTransaction(state, {
      html: '<p>hello <strong>bold</strong> world</p>',
      newParagraph: true,
    });
    expect(tr).not.toBeNull();
    expect(state.apply(tr!).doc.textContent).toContain('hello bold world');
  });

  it('script/style/iframe content never leaks into the document', () => {
    const state = stateWith([paragraph('')]);
    const tr = buildExternalRichInsertTransaction(state, {
      html:
        '<p>safe</p><script>window.__pwned = true; "SCRIPT-BODY"</script>' +
        '<style>.x{color:red}</style><iframe src="https://evil.example"></iframe>',
      newParagraph: true,
    });
    expect(tr).not.toBeNull();
    const text = state.apply(tr!).doc.textContent;
    expect(text).toContain('safe');
    expect(text).not.toContain('SCRIPT-BODY');
    expect(text).not.toContain('color:red');
    expect((window as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('purely inline html honors newParagraph: false as an inline marked run', () => {
    const state = stateWith([paragraph('ab')], 2); // between a and b
    const tr = buildExternalRichInsertTransaction(state, {
      html: 'plain <strong>strong</strong>',
      newParagraph: false,
    });
    expect(tr).not.toBeNull();
    const doc = state.apply(tr!).doc;
    expect(topTypes(doc)).toEqual(['paragraph']);
    expect(doc.textContent).toBe('aplain strongb');
  });
});

describe('rich external insert — fallback contract', () => {
  it('returns null on empty and on unusable html (caller falls back to text)', () => {
    const state = stateWith([paragraph('')]);
    expect(buildExternalRichInsertTransaction(state, { html: '', newParagraph: true })).toBeNull();
    expect(
      buildExternalRichInsertTransaction(state, {
        html: '<script>only()</script>',
        newParagraph: true,
      }),
    ).toBeNull();
  });

  it('returns null over the size cap', () => {
    const state = stateWith([paragraph('')]);
    const huge = '<p>' + 'x'.repeat(2 * 1024 * 1024 + 1) + '</p>';
    expect(
      buildExternalRichInsertTransaction(state, { html: huge, newParagraph: true }),
    ).toBeNull();
  });
});
