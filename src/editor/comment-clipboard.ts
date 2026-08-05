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
 * Same-document pastes where the thread still exists share the thread
 * (two anchored ranges, one card) rather than minting a duplicate —
 * and same-doc CUT + paste already resurrects the parked thread via
 * the comments GC's tombstone path, which this plugin leaves alone.
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
      if (!trs.some((tr) => tr.docChanged)) return null;
      // Which stashed threads did this paste actually anchor? Scan the
      // changed ranges for comment_range marks whose thread is missing
      // from THIS doc's state and present in the stash.
      const state = getCommentsState(newState);
      const toAdd: Thread[] = [];
      for (const tr of trs) {
        if (!tr.docChanged) continue;
        tr.steps.forEach((step, i) => {
          const rest = tr.mapping.slice(i + 1);
          step.getMap().forEach((_os, _oe, newStart, newEnd) => {
            const from = Math.max(0, Math.min(rest.map(newStart, -1), newState.doc.content.size));
            const to = Math.max(from, Math.min(rest.map(newEnd, 1), newState.doc.content.size));
            newState.doc.nodesBetween(from, to, (node) => {
              if (!node.isText) return true;
              for (const m of node.marks) {
                if (m.type.name !== 'comment_range') continue;
                const id = String(m.attrs['threadId'] ?? '');
                if (!id || state.threads.has(id) || state.tombstone.has(id)) continue;
                const stashed = pastedThreads.get(id);
                if (stashed && !toAdd.some((t) => t.id === id)) toAdd.push(stashed.thread);
              }
              return true;
            });
          });
        });
      }
      if (toAdd.length === 0) return null;
      for (const thread of toAdd) pastedThreads.delete(thread.id);
      // One batch meta carries every restored thread (a copied section
      // can hold several comments). Structured-clone so later mutations
      // never alias the stash.
      const clones = toAdd.map((t) => JSON.parse(JSON.stringify(t)) as Thread);
      return newState.tr.setMeta(commentsKey, addThreadsMeta(clones));
    },
  });
}
