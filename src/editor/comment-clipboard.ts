/**
 * Comments travel with copied text.
 *
 * The `comment_range` mark always survived the clipboard (its toDOM
 * carries the threadId — that's why the faint yellow background
 * pasted), but the thread CONTENT lives in plugin state, not the doc,
 * so a paste into another document produced an anchored highlight with
 * no comment behind it (field report 2026-08-05). This plugin makes the
 * thread ride along:
 *
 *  - COPY: a custom clipboard serializer inlines the thread as JSON in
 *    a `data-pmd-thread` attribute on the comment span, read live from
 *    the copying view's comments state. The OS clipboard is the
 *    carrier, so cross-window and cross-document pastes work; an older
 *    build pasting this HTML simply ignores the attribute (today's
 *    behavior, gracefully).
 *  - PASTE: `transformPastedHTML` extracts the payloads into a
 *    short-lived stash and strips the attribute (the payload must
 *    never become doc content). An appendTransaction then restores any
 *    referenced thread the TARGET doc's comments state lacks, via the
 *    ordinary add-thread meta — undo, the collab mirror, and every
 *    serialization path see it like any user-created thread.
 *
 * A paste whose thread ALREADY EXISTS in the target doc (pasting a
 * commented span within one document, or pasting the same copy twice)
 * DUPLICATES the comment under a fresh id — Word's behavior — with
 * every comment id in the clone re-minted so exporter id maps stay
 * globally unique. Only genuine paste/drop transactions get this
 * treatment (gated on the transaction's uiEvent meta AND a clipboard
 * payload for that id), so ordinary typing inside a commented range
 * can never re-id the original. Same-doc CUT + paste still resurrects
 * the parked thread via the comments GC's tombstone path, untouched.
 */

import { Plugin } from 'prosemirror-state';
import { DOMSerializer } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';
import type { Mark } from 'prosemirror-model';
import { schema } from '../schema/index.js';
import {
  commentsKey,
  getCommentsState,
  addThreadsMeta,
  newCommentId,
  type Thread,
} from './comments-plugin.js';

export const THREAD_PAYLOAD_ATTR = 'data-pmd-thread';

/** Threads lifted off pasted HTML, awaiting the restore pass. Keyed by
 *  threadId; TTL'd so a stale stash can't resurrect long-gone content
 *  if the same id ever reappears by other means. */
const pastedThreads = new Map<string, { thread: Thread; at: number }>();
const STASH_TTL_MS = 60_000;

function pruneStash(): void {
  const cutoff = Date.now() - STASH_TTL_MS;
  for (const [id, v] of pastedThreads) if (v.at < cutoff) pastedThreads.delete(id);
}

/** The view whose selection is being copied RIGHT NOW. transformCopied
 *  runs before the clipboard serializer in ProseMirror's copy path, so
 *  this is always current when the serializer needs it. */
let copyingState: EditorState | null = null;

/** Clipboard serializer: stock schema serialization, except a
 *  comment_range span also carries its thread as JSON. Built once —
 *  the thread lookup closes over the copy-in-progress state above. */
function buildClipboardSerializer(): DOMSerializer {
  const base = DOMSerializer.fromSchema(schema);
  const marks = { ...base.marks };
  marks['comment_range'] = (mark: Mark) => {
    const threadId = String(mark.attrs['threadId'] ?? '');
    const thread = copyingState ? getCommentsState(copyingState).threads.get(threadId) : undefined;
    return [
      'span',
      {
        class: 'pmd-comment-range',
        'data-comment-id': threadId,
        ...(thread ? { [THREAD_PAYLOAD_ATTR]: JSON.stringify(thread) } : {}),
      },
      0,
    ];
  };
  return new DOMSerializer(base.nodes, marks);
}

export function commentClipboardPlugin(): Plugin {
  return new Plugin({
    props: {
      clipboardSerializer: buildClipboardSerializer(),
      transformCopied(slice, view) {
        // Only a bookmark: the serializer (which runs next, same copy)
        // reads the thread content off this state.
        copyingState = view.state;
        return slice;
      },
      transformPastedHTML(html) {
        if (!html.includes(THREAD_PAYLOAD_ATTR)) return html;
        try {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const spans = doc.querySelectorAll(`span[${THREAD_PAYLOAD_ATTR}]`);
          if (spans.length === 0) return html;
          pruneStash();
          for (const span of spans) {
            const raw = span.getAttribute(THREAD_PAYLOAD_ATTR);
            span.removeAttribute(THREAD_PAYLOAD_ATTR);
            if (!raw) continue;
            try {
              const thread = JSON.parse(raw) as Thread;
              if (thread && typeof thread.id === 'string' && Array.isArray(thread.comments)) {
                pastedThreads.set(thread.id, { thread, at: Date.now() });
              }
            } catch {
              /* malformed payload — the mark still pastes, threadless */
            }
          }
          return doc.body.innerHTML;
        } catch {
          return html; // parse failure — paste proceeds without restore
        }
      },
    },
    appendTransaction(trs, _oldState, newState) {
      if (pastedThreads.size === 0) return null;
      // Paste/drop transactions only: the uiEvent gate means ordinary
      // typing inside a commented range — even seconds after copying
      // it, with its payload still in the stash — can never trigger a
      // re-id of the original.
      const pasteTrs = trs.filter(
        (tr) =>
          tr.docChanged &&
          (tr.getMeta('uiEvent') === 'paste' || tr.getMeta('uiEvent') === 'drop'),
      );
      if (pasteTrs.length === 0) return null;

      const state = getCommentsState(newState);
      const markType = schema.marks['comment_range']!;
      // threadId → fresh id, decided once per pass so a paste split
      // across several text nodes still yields ONE duplicated comment
      // spanning all of them (Word's shape).
      const rename = new Map<string, string>();
      const toAdd: Thread[] = [];
      const tr = newState.tr;

      const cloneUnder = (thread: Thread, newId: string): Thread => {
        // Re-mint EVERY comment id in the clone (exporter id maps are
        // keyed by comment id globally); remap reply parent links.
        const idMap = new Map<string, string>([[thread.id, newId]]);
        for (const c of thread.comments) {
          if (!idMap.has(c.id)) idMap.set(c.id, newCommentId());
        }
        return {
          id: newId,
          comments: thread.comments.map((c) => ({
            ...c,
            id: idMap.get(c.id)!,
            parentId: c.parentId == null ? null : (idMap.get(c.parentId) ?? null),
          })),
        };
      };

      for (const ptr of pasteTrs) {
        ptr.steps.forEach((step, i) => {
          const rest = ptr.mapping.slice(i + 1);
          step.getMap().forEach((_os, _oe, newStart, newEnd) => {
            let from = Math.max(0, Math.min(rest.map(newStart, -1), newState.doc.content.size));
            let to = Math.max(from, Math.min(rest.map(newEnd, 1), newState.doc.content.size));
            // Later paste trs in the batch shift earlier ranges — map
            // through them so positions address newState.doc.
            for (const later of trs.slice(trs.indexOf(ptr) + 1)) {
              from = later.mapping.map(from, -1);
              to = later.mapping.map(to, 1);
            }
            newState.doc.nodesBetween(from, to, (node, pos) => {
              if (!node.isText) return true;
              for (const m of node.marks) {
                if (m.type.name !== 'comment_range') continue;
                const id = String(m.attrs['threadId'] ?? '');
                const stashed = id ? pastedThreads.get(id) : undefined;
                if (!stashed) continue; // not clipboard-borne — leave alone
                const exists = state.threads.has(id) || state.tombstone.has(id);
                if (!exists) {
                  // First landing in this doc: restore under its own id.
                  if (!toAdd.some((t) => t.id === id)) {
                    toAdd.push(JSON.parse(JSON.stringify(stashed.thread)) as Thread);
                  }
                  continue;
                }
                // Thread already lives here → DUPLICATE under a fresh
                // id and re-point just the pasted span's mark.
                let newId = rename.get(id);
                if (!newId) {
                  newId = newCommentId();
                  rename.set(id, newId);
                  toAdd.push(cloneUnder(stashed.thread, newId));
                }
                const segFrom = Math.max(pos, from);
                const segTo = Math.min(pos + node.nodeSize, to);
                tr.removeMark(segFrom, segTo, markType);
                tr.addMark(segFrom, segTo, markType.create({ threadId: newId }));
              }
              return true;
            });
          });
        });
      }
      if (toAdd.length === 0) return null;
      // Restored-under-own-id entries are consumed; renamed sources
      // stay stashed so the NEXT paste of the same copy duplicates
      // again (each paste = its own comment, Word-style).
      for (const t of toAdd) {
        if (!rename.has(t.id)) {
          const orig = [...rename.entries()].find(([, v]) => v === t.id)?.[0];
          if (!orig) pastedThreads.delete(t.id);
        }
      }
      return tr.setMeta(commentsKey, addThreadsMeta(toAdd));
    },
  });
}
