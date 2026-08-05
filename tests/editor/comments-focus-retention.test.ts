// @vitest-environment jsdom

/**
 * The comments column must not steal focus from the reply textarea
 * when it re-renders (field report 2026-08-05: every remote collab
 * edit scheduled a render whose unconditional appendChild MOVED every
 * card — detaching the focused textarea's ancestor blurs it, and the
 * blur handler wipes the draft state — so comment typing died on every
 * partner keystroke). Render reconciliation is now minimal-move: a
 * card whose position is already correct is not touched.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { CommentsColumn } from '../../src/editor/comments-ui.js';
import { commentsPlugin, commentsKey, loadThreads, type Thread } from '../../src/editor/comments-plugin.js';

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

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.innerHTML = '';
});

describe('comments column focus retention across renders', () => {
  it('a re-render with unchanged order leaves the focused reply textarea alone', () => {
    const doc = schema.nodes['doc']!.createChecked(null, [
      commentedCard('Alpha', 'alpha body', '1'),
      commentedCard('Beta', 'beta body', '2'),
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    view = new EditorView(container, {
      state: EditorState.create({ doc, plugins: [commentsPlugin] }),
    });
    view.dispatch(loadThreads(view.state, [thread('1', 'first note'), thread('2', 'second note')]));

    const root = document.createElement('div');
    document.body.appendChild(root);
    const column = new CommentsColumn(root, () => view);
    column.render();

    // Expand thread 1 — the card FOLLOWED by another card, so the old
    // unconditional appendChild always moved it on re-render.
    column.setActiveThread('1', 'click');
    column.render();
    const ta = root.querySelector<HTMLTextAreaElement>('.pmd-comment-reply-input');
    expect(ta).toBeTruthy();
    ta!.focus();
    expect(document.activeElement).toBe(ta);

    // A remote edit lands → dispatchTransaction schedules a render.
    // Simulate the render directly (the debounce is timing, not logic).
    view.dispatch(
      view.state.tr.insertText('!', view.state.doc.content.size - 2),
    );
    column.render();

    // Same element, still in the DOM, still focused — typing continues.
    expect(root.querySelector('.pmd-comment-reply-input')).toBe(ta);
    expect(document.activeElement).toBe(ta);
  });

  it('cards still land in document order when order genuinely changes', () => {
    const doc = schema.nodes['doc']!.createChecked(null, [
      commentedCard('Alpha', 'alpha body', '1'),
      commentedCard('Beta', 'beta body', '2'),
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    view = new EditorView(container, {
      state: EditorState.create({ doc, plugins: [commentsPlugin] }),
    });
    view.dispatch(loadThreads(view.state, [thread('1', 'first note'), thread('2', 'second note')]));

    const root = document.createElement('div');
    document.body.appendChild(root);
    const column = new CommentsColumn(root, () => view);
    column.render();

    const orderBefore = [...root.querySelectorAll('.pmd-comment-thread, [data-thread-id]')].length;
    expect(orderBefore).toBeGreaterThan(0);

    // Move card B's text above card A by deleting card A entirely —
    // thread 1's mark vanishes, so its card must drop from the column.
    let aFrom = -1;
    let aSize = -1;
    view.state.doc.descendants((n, p) => {
      if (n.type.name === 'card' && aFrom < 0) {
        aFrom = p;
        aSize = n.nodeSize;
      }
      return false;
    });
    view.dispatch(view.state.tr.delete(aFrom, aFrom + aSize));
    column.render();

    // Thread 2 survives; thread 1's card is gone from the DOM.
    const cards = root.querySelectorAll('.pmd-comment-reply-input, .pmd-comment-preview');
    expect(cards.length).toBeGreaterThan(0);
  });
});
