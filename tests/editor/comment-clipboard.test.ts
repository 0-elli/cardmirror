// @vitest-environment jsdom
/**
 * Comments travel with copied text (comment-clipboard.ts). The
 * comment_range mark always survived the clipboard — the faint yellow
 * background pasted — but the thread content lives in plugin state, so
 * a cross-document paste produced an anchored highlight with no
 * comment behind it. These tests walk the real clipboard pipeline:
 * copy serializes the thread into the HTML, paste extracts + strips,
 * and the restore pass adds missing threads to the target doc.
 */
import { describe, it, expect } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { DOMParser as PMDOMParser } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { commentClipboardPlugin, THREAD_PAYLOAD_ATTR } from '../../src/editor/comment-clipboard.js';
import { commentGuardPlugin } from '../../src/editor/comment-guard.js';
import {
  commentsPlugin,
  loadThreads,
  getCommentsState,
  type Thread,
} from '../../src/editor/comments-plugin.js';
import { buildPastePlugin, type PastePluginCtx } from '../../src/editor/paste-plugin.js';

function commentedCard(tag: string, body: string, threadId: string): PMNode {
  return schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(tag)),
    schema.nodes['card_body']!.create(
      null,
      schema.text(body, [schema.marks['comment_range']!.create({ threadId })]),
    ),
  ]);
}

function thread(id: string, text: string): Thread {
  return {
    id,
    comments: [
      {
        id,
        author: 'Teacher',
        initials: 'T',
        date: '2026-08-05T00:00:00Z',
        text,
        kind: 'human',
        parentId: null,
      },
    ],
  };
}

function mkView(doc: PMNode): EditorView {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return new EditorView(el, {
    state: EditorState.create({ doc, plugins: [commentsPlugin, commentClipboardPlugin(), commentGuardPlugin()] }),
  });
}

/** Serialize `view`'s current selection the way a real copy does:
 *  transformCopied (all plugins), then the clipboardSerializer. */
function copySelectionHtml(view: EditorView): string {
  let slice = view.state.selection.content();
  view.someProp('transformCopied', (f) => {
    slice = f(slice, view);
  });
  const serializer = view.someProp('clipboardSerializer')!;
  const div = document.createElement('div');
  div.appendChild(serializer.serializeFragment(slice.content));
  return div.innerHTML;
}

/** Feed `html` through the paste pipeline into `view`: the
 *  transformPastedHTML hook, the transformPasted slice hook (where the
 *  duplicate-vs-restore rewrite happens), then a paste-shaped
 *  insertion of the transformed slice at the selection. */
function pasteHtml(view: EditorView, html: string): void {
  let transformed = html;
  view.someProp('transformPastedHTML', (f) => {
    transformed = f(transformed, view);
  });
  const dom = new DOMParser().parseFromString(transformed, 'text/html');
  let slice = PMDOMParser.fromSchema(schema).parseSlice(dom.body);
  view.someProp('transformPasted', (f) => {
    slice = f(slice, view, false);
  });
  view.dispatch(view.state.tr.replaceSelection(slice).setMeta('uiEvent', 'paste'));
}

describe('comments travel with copied text', () => {
  it('copy embeds the thread; cross-doc paste restores it', () => {
    const source = mkView(
      schema.nodes['doc']!.createChecked(null, [commentedCard('Alpha', 'commented body', 'T1')]),
    );
    source.dispatch(loadThreads(source.state, [thread('T1', 'fix this warrant')]));
    // Select the commented text and copy.
    let from = -1;
    source.state.doc.descendants((n, p) => {
      if (n.isText && n.text === 'commented body') from = p;
      return from < 0;
    });
    source.dispatch(
      source.state.tr.setSelection(TextSelection.create(source.state.doc, from, from + 14)),
    );
    const html = copySelectionHtml(source);
    expect(html).toContain('data-comment-id="T1"');
    expect(html).toContain(THREAD_PAYLOAD_ATTR);
    expect(html).toContain('fix this warrant');

    // A DIFFERENT document with no threads pastes it.
    const target = mkView(
      schema.nodes['doc']!.createChecked(null, [
        schema.nodes['card']!.createChecked(null, [
          schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text('Dest')),
          schema.nodes['card_body']!.create(null, schema.text('dest body')),
        ]),
      ]),
    );
    const inDest = (() => {
      let p = -1;
      target.state.doc.descendants((n, pos) => {
        if (n.isText && n.text === 'dest body') p = pos;
        return p < 0;
      });
      return p;
    })();
    target.dispatch(target.state.tr.setSelection(TextSelection.create(target.state.doc, inDest + 4)));
    pasteHtml(target, html);

    // The mark pasted AND the thread came with it.
    const state = getCommentsState(target.state);
    expect(state.threads.has('T1')).toBe(true);
    expect(state.threads.get('T1')!.comments[0]!.text).toBe('fix this warrant');
    // The payload attribute never became doc content (stripped pre-parse).
    expect(target.dom.innerHTML).not.toContain(THREAD_PAYLOAD_ATTR);

    source.destroy();
    target.destroy();
  });

  it('same-doc paste DUPLICATES the comment under a fresh id (Word behavior)', () => {
    const view = mkView(
      schema.nodes['doc']!.createChecked(null, [commentedCard('Alpha', 'commented body', 'T2')]),
    );
    view.dispatch(loadThreads(view.state, [thread('T2', 'original text')]));
    let from = -1;
    view.state.doc.descendants((n, p) => {
      if (n.isText && n.text === 'commented body') from = p;
      return from < 0;
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, from + 14)));
    const html = copySelectionHtml(view);

    // Paste at the end of the same doc.
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, view.state.doc.content.size - 2),
      ),
    );
    pasteHtml(view, html);

    const state = getCommentsState(view.state);
    expect(state.threads.size).toBe(2); // original + duplicate
    expect(state.threads.get('T2')!.comments[0]!.text).toBe('original text');
    const dupe = [...state.threads.values()].find((t) => t.id !== 'T2')!;
    expect(dupe.comments[0]!.text).toBe('original text');
    expect(dupe.comments[0]!.id).toBe(dupe.id); // root id re-minted with the thread
    // The PASTED span carries the duplicate's id; the original keeps T2.
    const idsInDoc = new Set<string>();
    view.state.doc.descendants((n) => {
      for (const m of n.marks) {
        if (m.type.name === 'comment_range') idsInDoc.add(String(m.attrs['threadId']));
      }
      return true;
    });
    expect(idsInDoc).toEqual(new Set(['T2', dupe.id]));
    view.destroy();
  });

  it('typing inside a commented range never re-ids it, even with the payload stashed', () => {
    const view = mkView(
      schema.nodes['doc']!.createChecked(null, [commentedCard('Alpha', 'commented body', 'T5')]),
    );
    view.dispatch(loadThreads(view.state, [thread('T5', 'stay put')]));
    let from = -1;
    view.state.doc.descendants((n, p) => {
      if (n.isText && n.text === 'commented body') from = p;
      return from < 0;
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, from + 14)));
    // Copy (stash gets the payload via a paste elsewhere-in-spirit: run
    // the HTML through the paste hook without dispatching, as a
    // clipboard would); then TYPE inside the original range.
    const html = copySelectionHtml(view);
    view.someProp('transformPastedHTML', (f) => f(html, view));
    view.dispatch(view.state.tr.insertText('X', from + 3)); // ordinary typing, no uiEvent
    const state = getCommentsState(view.state);
    expect(state.threads.size).toBe(1);
    expect(state.threads.has('T5')).toBe(true);
    view.destroy();
  });

  it('a multi-comment selection restores every thread in one pass', () => {
    const source = mkView(
      schema.nodes['doc']!.createChecked(null, [
        commentedCard('A', 'first commented', 'M1'),
        commentedCard('B', 'second commented', 'M2'),
      ]),
    );
    source.dispatch(
      loadThreads(source.state, [thread('M1', 'note one'), thread('M2', 'note two')]),
    );
    source.dispatch(
      source.state.tr.setSelection(
        TextSelection.create(source.state.doc, 0, source.state.doc.content.size),
      ),
    );
    const html = copySelectionHtml(source);

    const target = mkView(
      schema.nodes['doc']!.createChecked(null, [
        schema.nodes['card']!.createChecked(null, [
          schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text('Dest')),
          schema.nodes['card_body']!.create(null, schema.text('x')),
        ]),
      ]),
    );
    pasteHtml(target, html);
    const state = getCommentsState(target.state);
    expect(state.threads.get('M1')?.comments[0]?.text).toBe('note one');
    expect(state.threads.get('M2')?.comments[0]?.text).toBe('note two');
    source.destroy();
    target.destroy();
  });
});

// ---- The REAL paste path (regression, field report 2026-08-05) ------
//
// The app's handlePaste has a custom insertion ladder (card-fit /
// split-container / body-then-structural / smart-paste) whose
// branches dispatch their own transactions. Those dispatches
// originally lacked the `uiEvent: 'paste'` meta PM's default path
// sets, so a same-doc paste of commented body text card-fitted
// WITHOUT triggering the duplicate pass: the pasted span kept the
// original threadId and the comment UI bridged the two ranges into
// one long span. The ladder now stamps the meta; this walks the
// card-fit branch end to end.
describe('comments duplicate through the custom paste ladder', () => {
  const ctx: PastePluginCtx = {
    condenseOnPaste: () => false,
    paragraphIntegrity: () => false,
    usePilcrows: () => false,
    headingMode: () => 'respect',
    smartPasteConversion: () => false,
  };

  function fakePasteEvent(flavors: Record<string, string>): ClipboardEvent {
    return {
      clipboardData: {
        getData: (type: string) => flavors[type] ?? '',
        files: { length: 0 },
      },
      preventDefault: () => {},
    } as unknown as ClipboardEvent;
  }

  it('same-doc card-fit paste duplicates the comment instead of extending it', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const view = new EditorView(el, {
      state: EditorState.create({
        doc: schema.nodes['doc']!.createChecked(null, [
          commentedCard('Alpha', 'commented body', 'R1'),
          schema.nodes['card']!.createChecked(null, [
            schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text('Dest')),
            schema.nodes['card_body']!.create(null, schema.text('dest body')),
          ]),
        ]),
        plugins: [buildPastePlugin(ctx), commentsPlugin, commentClipboardPlugin(), commentGuardPlugin()],
      }),
    });
    view.dispatch(loadThreads(view.state, [thread('R1', 'the note')]));

    // Clipboard HTML as the copy path writes it: the comment span
    // carries its thread payload. TWO paragraphs, so handlePaste's
    // card-fit branch (not PM's default path) takes the paste.
    const payload = JSON.stringify(thread('R1', 'the note')).replace(/"/g, '&quot;');
    const html =
      `<p><span class="pmd-comment-range" data-comment-id="R1" ` +
      `${THREAD_PAYLOAD_ATTR}="${payload}">carried text</span></p><p>plain trailer</p>`;

    // Caret inside the SECOND card's body.
    let destPos = -1;
    view.state.doc.descendants((n, p) => {
      if (n.isText && n.text === 'dest body') destPos = p;
      return destPos < 0;
    });
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, destPos + 4)),
    );

    // The genuine pipeline: transformPastedHTML → parse → transformPasted
    // → handlePaste. The ladder must take it (returns true) — if this
    // ever starts returning false the test is exercising nothing.
    let transformed = html;
    view.someProp('transformPastedHTML', (f) => {
      transformed = f(transformed, view);
    });
    const dom = new DOMParser().parseFromString(transformed, 'text/html');
    let slice = PMDOMParser.fromSchema(schema).parseSlice(dom.body);
    view.someProp('transformPasted', (f) => {
      slice = f(slice, view, false);
    });
    const handled = view.someProp('handlePaste', (f) =>
      f(view, fakePasteEvent({ 'text/html': transformed }), slice),
    );
    expect(handled).toBe(true);

    // Duplicated, not extended: two threads, and the pasted span
    // carries the fresh id while the original keeps R1.
    const state = getCommentsState(view.state);
    expect(state.threads.size).toBe(2);
    const dupe = [...state.threads.values()].find((t) => t.id !== 'R1')!;
    expect(dupe.comments[0]!.text).toBe('the note');
    const spans: { id: string; text: string }[] = [];
    view.state.doc.descendants((n) => {
      if (n.isText) {
        for (const m of n.marks) {
          if (m.type.name === 'comment_range') {
            spans.push({ id: String(m.attrs['threadId']), text: n.text ?? '' });
          }
        }
      }
      return true;
    });
    expect(spans).toHaveLength(2);
    expect(spans.find((x) => x.text === 'commented body')!.id).toBe('R1');
    expect(spans.find((x) => x.text === 'carried text')!.id).toBe(dupe.id);
    view.destroy();
  });

  it('pasting into the SAME card never re-ids the original span (field bug #2)', () => {
    // The card-fit path can rebuild the whole card_body as ONE replace
    // step, so any doc-side "rename what the paste touched" walk sees
    // the pre-existing span inside the pasted range and re-ids it too
    // — the original thread orphans, gets GC'd, and both spans render
    // as one long comment. The slice-level rewrite can't do that.
    const el = document.createElement('div');
    document.body.appendChild(el);
    const view = new EditorView(el, {
      state: EditorState.create({
        doc: schema.nodes['doc']!.createChecked(null, [
          commentedCard('Alpha', 'commented body', 'S1'),
        ]),
        plugins: [buildPastePlugin(ctx), commentsPlugin, commentClipboardPlugin(), commentGuardPlugin()],
      }),
    });
    view.dispatch(loadThreads(view.state, [thread('S1', 'the note')]));

    const payload = JSON.stringify(thread('S1', 'the note')).replace(/"/g, '&quot;');
    const html =
      `<p><span class="pmd-comment-range" data-comment-id="S1" ` +
      `${THREAD_PAYLOAD_ATTR}="${payload}">carried text</span></p><p>plain trailer</p>`;

    // Caret at the END of the same commented card's body.
    let from = -1;
    view.state.doc.descendants((n, p) => {
      if (n.isText && n.text === 'commented body') from = p;
      return from < 0;
    });
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, from + 'commented body'.length),
      ),
    );

    let transformed = html;
    view.someProp('transformPastedHTML', (f) => {
      transformed = f(transformed, view);
    });
    const dom = new DOMParser().parseFromString(transformed, 'text/html');
    let slice = PMDOMParser.fromSchema(schema).parseSlice(dom.body);
    view.someProp('transformPasted', (f) => {
      slice = f(slice, view, false);
    });
    const handled = view.someProp('handlePaste', (f) =>
      f(view, fakePasteEvent({ 'text/html': transformed }), slice),
    );
    expect(handled).toBe(true);

    const state = getCommentsState(view.state);
    expect(state.threads.size).toBe(2);
    expect(state.threads.has('S1')).toBe(true); // original SURVIVES under its id
    const dupe = [...state.threads.values()].find((t) => t.id !== 'S1')!;
    const spans: { id: string; text: string }[] = [];
    view.state.doc.descendants((n) => {
      if (n.isText) {
        for (const m of n.marks) {
          if (m.type.name === 'comment_range') {
            spans.push({ id: String(m.attrs['threadId']), text: n.text ?? '' });
          }
        }
      }
      return true;
    });
    expect(spans).toHaveLength(2);
    expect(spans.find((x) => x.text === 'commented body')!.id).toBe('S1');
    expect(spans.find((x) => x.text === 'carried text')!.id).toBe(dupe.id);
    view.destroy();
  });
});
