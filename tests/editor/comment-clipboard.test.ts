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
import {
  commentsPlugin,
  loadThreads,
  getCommentsState,
  type Thread,
} from '../../src/editor/comments-plugin.js';

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
    state: EditorState.create({ doc, plugins: [commentsPlugin, commentClipboardPlugin()] }),
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
 *  transformPastedHTML hook, then a paste-shaped insertion of the
 *  parsed content at the selection. */
function pasteHtml(view: EditorView, html: string): void {
  let transformed = html;
  view.someProp('transformPastedHTML', (f) => {
    transformed = f(transformed, view);
  });
  const dom = new DOMParser().parseFromString(transformed, 'text/html');
  const slice = PMDOMParser.fromSchema(schema).parseSlice(dom.body);
  view.dispatch(view.state.tr.replaceSelection(slice));
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

  it('same-doc paste shares the existing thread — no duplicate, no clobber', () => {
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
    expect(state.threads.size).toBe(1); // still ONE thread, shared anchor
    expect(state.threads.get('T2')!.comments[0]!.text).toBe('original text');
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
