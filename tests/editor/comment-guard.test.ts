// @vitest-environment jsdom
/**
 * Comment integrity guard (comment-guard.ts): the range a comment
 * covers can only grow by typing inside it. Any transaction that
 * INSERTS comment-marked content — Alt-drag copies, nav-pane
 * option-drag section copies, dropzone re-inserts, self-sends, and
 * every future duplication path — either duplicates the thread under
 * a fresh id (thread known here) or strips the mark (thread unknown:
 * a phantom span). Moves, splits, creation, undo, and sync-origin
 * content are all left alone.
 */
import { describe, it, expect } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { Slice } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { commentGuardPlugin } from '../../src/editor/comment-guard.js';
import { commentClipboardPlugin } from '../../src/editor/comment-clipboard.js';
import { markSyncOrigin } from '../../src/editor/sync-origin.js';
import {
  commentsPlugin,
  commentsKey,
  loadThreads,
  getCommentsState,
  addThreadsMeta,
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

function plainCard(tag: string, body: string): PMNode {
  return schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(tag)),
    schema.nodes['card_body']!.create(null, schema.text(body)),
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

/** Plugin order matches buildEditorPlugins: comments, clipboard, guard. */
function mkView(...cards: PMNode[]): EditorView {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return new EditorView(el, {
    state: EditorState.create({
      doc: schema.nodes['doc']!.createChecked(null, cards),
      plugins: [commentsPlugin, commentClipboardPlugin(), commentGuardPlugin()],
    }),
  });
}

function spansOf(view: EditorView): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  view.state.doc.descendants((n) => {
    if (n.isText) {
      for (const m of n.marks) {
        if (m.type.name === 'comment_range') {
          out.push({ id: String(m.attrs['threadId']), text: n.text ?? '' });
        }
      }
    }
    return true;
  });
  return out;
}

describe('comment guard', () => {
  it('a drag-copy-style insert duplicates the thread under a fresh id', () => {
    const view = mkView(commentedCard('Alpha', 'commented body', 'G1'), plainCard('Dest', 'x'));
    view.dispatch(loadThreads(view.state, [thread('G1', 'the note')]));
    // Simulate any non-clipboard duplication (Alt-drag, nav option-drag,
    // dropzone → editor): a single transaction inserting a COPY of the
    // commented card while the original stays put.
    view.dispatch(
      view.state.tr.insert(
        view.state.doc.content.size,
        commentedCard('Alpha copy', 'commented body', 'G1'),
      ),
    );
    const state = getCommentsState(view.state);
    expect(state.threads.size).toBe(2);
    expect(state.threads.has('G1')).toBe(true);
    const dupe = [...state.threads.values()].find((t) => t.id !== 'G1')!;
    expect(dupe.comments[0]!.text).toBe('the note');
    expect(dupe.comments[0]!.id).toBe(dupe.id); // ids re-minted in the clone
    const spans = spansOf(view);
    expect(spans).toHaveLength(2);
    expect(spans[0]!.id).toBe('G1'); // original untouched
    expect(spans[1]!.id).toBe(dupe.id);
    view.destroy();
  });

  it('an insert butted against the original is trimmed off, never fused', () => {
    const view = mkView(commentedCard('Alpha', 'commented body', 'G2'));
    view.dispatch(loadThreads(view.state, [thread('G2', 'n')]));
    let end = -1;
    view.state.doc.descendants((n, p) => {
      if (n.isText && n.text === 'commented body') end = p + n.nodeSize;
      return end < 0;
    });
    // Insert marked text at the EXACT end of the original span.
    view.dispatch(
      view.state.tr.insert(
        end,
        schema.text(' extension', [schema.marks['comment_range']!.create({ threadId: 'G2' })]),
      ),
    );
    const state = getCommentsState(view.state);
    expect(state.threads.size).toBe(2);
    const dupe = [...state.threads.values()].find((t) => t.id !== 'G2')!;
    const spans = spansOf(view);
    expect(spans.find((s) => s.text === 'commented body')!.id).toBe('G2');
    expect(spans.find((s) => s.text === ' extension')!.id).toBe(dupe.id);
    view.destroy();
  });

  it('a move (delete + reinsert in one transaction) keeps the id', () => {
    const view = mkView(commentedCard('Alpha', 'commented body', 'G3'), plainCard('Dest', 'x'));
    view.dispatch(loadThreads(view.state, [thread('G3', 'n')]));
    const card = view.state.doc.child(0);
    const tr = view.state.tr;
    tr.delete(0, card.nodeSize);
    tr.insert(tr.doc.content.size, card);
    view.dispatch(tr);
    const state = getCommentsState(view.state);
    expect(state.threads.size).toBe(1);
    expect(state.threads.has('G3')).toBe(true);
    const spans = spansOf(view);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.id).toBe('G3');
    view.destroy();
  });

  it('a span with a thread NOBODY has is stripped (send-style phantom)', () => {
    const view = mkView(plainCard('Dest', 'x'));
    view.dispatch(
      view.state.tr.insert(
        view.state.doc.content.size,
        commentedCard('Sent', 'arrived body', 'UNKNOWN9'),
      ),
    );
    expect(getCommentsState(view.state).threads.size).toBe(0);
    expect(spansOf(view)).toHaveLength(0); // mark gone, text intact
    let has = false;
    view.state.doc.descendants((n) => {
      if (n.isText && n.text === 'arrived body') has = true;
      return !has;
    });
    expect(has).toBe(true);
    view.destroy();
  });

  it('comment creation (mark + thread in one transaction) is untouched', () => {
    const view = mkView(plainCard('Alpha', 'select me here'));
    let from = -1;
    view.state.doc.descendants((n, p) => {
      if (n.isText && n.text === 'select me here') from = p;
      return from < 0;
    });
    const tr = view.state.tr;
    tr.setSelection(TextSelection.create(view.state.doc, from, from + 6));
    tr.addMark(from, from + 6, schema.marks['comment_range']!.create({ threadId: 'NEW1' }));
    tr.setMeta(commentsKey, addThreadsMeta([thread('NEW1', 'fresh')]));
    view.dispatch(tr);
    const state = getCommentsState(view.state);
    expect(state.threads.size).toBe(1);
    expect(state.threads.has('NEW1')).toBe(true);
    expect(spansOf(view)[0]!.id).toBe('NEW1');
    view.destroy();
  });

  it('deleting the middle of a span splits it WITHOUT re-iding either half', () => {
    const view = mkView(commentedCard('Alpha', 'commented body', 'G5'));
    view.dispatch(loadThreads(view.state, [thread('G5', 'n')]));
    let from = -1;
    view.state.doc.descendants((n, p) => {
      if (n.isText && n.text === 'commented body') from = p;
      return from < 0;
    });
    view.dispatch(view.state.tr.delete(from + 4, from + 9));
    const state = getCommentsState(view.state);
    expect(state.threads.size).toBe(1);
    const spans = spansOf(view);
    expect(spans.every((s) => s.id === 'G5')).toBe(true);
    view.destroy();
  });

  it('sync-origin transactions are never rewritten', () => {
    const view = mkView(commentedCard('Alpha', 'commented body', 'G6'), plainCard('Dest', 'x'));
    view.dispatch(loadThreads(view.state, [thread('G6', 'n')]));
    view.dispatch(
      markSyncOrigin(
        view.state.tr.insert(
          view.state.doc.content.size,
          commentedCard('Remote copy', 'commented body', 'G6'),
        ),
      ),
    );
    const state = getCommentsState(view.state);
    expect(state.threads.size).toBe(1); // no clone minted
    const spans = spansOf(view);
    expect(spans).toHaveLength(2);
    expect(spans.every((s) => s.id === 'G6')).toBe(true); // remote content untouched
    view.destroy();
  });

  it('a tombstoned thread reappearing via insert becomes a duplicate, not a resurrection', () => {
    const view = mkView(commentedCard('Alpha', 'commented body', 'G7'), plainCard('Dest', 'x'));
    view.dispatch(loadThreads(view.state, [thread('G7', 'parked')]));
    // Capture the commented card (dropzone-style), then delete the
    // original and let the comments GC park the thread.
    const captured = view.state.doc.child(0);
    view.dispatch(view.state.tr.delete(0, captured.nodeSize));
    const afterDelete = getCommentsState(view.state);
    expect(afterDelete.threads.has('G7') || afterDelete.tombstone.has('G7')).toBe(true);
    // Drag the captured card back in.
    view.dispatch(view.state.tr.insert(view.state.doc.content.size, captured));
    const state = getCommentsState(view.state);
    const spans = spansOf(view);
    expect(spans).toHaveLength(1);
    if (afterDelete.tombstone.has('G7')) {
      // Parked → the reinsert is a copy of captured content: fresh id.
      expect(spans[0]!.id).not.toBe('G7');
      expect(state.threads.get(spans[0]!.id)!.comments[0]!.text).toBe('parked');
    } else {
      // GC hadn't parked it yet (still live, span-less) — duplicate too.
      expect(state.threads.has(spans[0]!.id)).toBe(true);
    }
    view.destroy();
  });
});
