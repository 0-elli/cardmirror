/**
 * Live enclosing-container read time — the second segment of the
 * word-count readouts (`liveContainerReadTime`, default on).
 *
 * With the cursor parked (no selection), the bars append the read time
 * of the SMALLEST container enclosing it: the card, the analytic unit,
 * or the block section (block heading through the next equal-or-
 * shallower heading — blocks aren't containers in the schema, so that
 * span is resolved positionally, same rule as the nav pane's
 * `computeHeadingRange`). Pocket/hat headings and content outside any
 * of the three deliberately show nothing — the whole-doc readout
 * already covers macro scales.
 *
 * With a selection, the segment shows the selection's time instead —
 * unless `liveSelectionWordCount` is on, in which case the PRIMARY
 * readout already is the selection and the segment is dropped.
 *
 * Shared by the single-pane status bar and the three-pane pane footers
 * so the two readouts cannot diverge. The container count is cached on
 * (doc identity, range): cursor moves WITHIN a container reuse it, so
 * per-keypress cost is an ancestor walk, and crossing into a different
 * container costs one O(container) count — never O(doc).
 */

import type { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { settings } from './settings.js';
import { countReadAloudWords, formatReadTime, formatNumber } from './word-count.js';
import { TYPE_TO_LEVEL, sectionEndFromHeading } from './headings.js';

export interface EnclosingContainer {
  label: 'Card' | 'Analytic' | 'Block';
  from: number;
  to: number;
}

/** The smallest card / analytic-unit / block-section enclosing the
 *  selection head, or null (pocket/hat headings, loose doc-level
 *  content, empty doc). Exported for tests. */
export function findEnclosingContainer(state: EditorState): EnclosingContainer | null {
  const $pos = state.selection.$from;

  // Card / analytic unit: the nearest wrapping node wins.
  for (let d = $pos.depth; d >= 1; d--) {
    const node = $pos.node(d);
    if (node.type.name === 'card') {
      const from = $pos.before(d);
      return { label: 'Card', from, to: from + node.nodeSize };
    }
    if (node.type.name === 'analytic_unit') {
      const from = $pos.before(d);
      return { label: 'Analytic', from, to: from + node.nodeSize };
    }
  }

  // No wrapping container: resolve the block SECTION positionally.
  // Scan top-level siblings backwards from the cursor's child for the
  // nearest heading; a cursor inside a heading counts as in its own
  // section. Only a BLOCK heading yields a segment (design call:
  // pocket/hat sections read as "macro" and stay silent).
  const doc = state.doc;
  if (doc.childCount === 0) return null;
  const index = Math.min($pos.index(0), doc.childCount - 1);
  let childPos = 0;
  const positions: number[] = [];
  for (let i = 0; i < doc.childCount; i++) {
    positions.push(childPos);
    childPos += doc.child(i).nodeSize;
  }
  for (let i = index; i >= 0; i--) {
    const child = doc.child(i);
    const level = TYPE_TO_LEVEL[child.type.name];
    if (level === undefined) continue;
    if (child.type.name !== 'block') return null; // pocket/hat: stay silent
    const from = positions[i]!;
    const to = sectionEndFromHeading(doc, i, from + child.nodeSize, level);
    return { label: 'Block', from, to };
  }
  return null;
}

let cache: { doc: PMNode; from: number; to: number; words: number } | null = null;

function countCached(doc: PMNode, from: number, to: number): number {
  if (cache && cache.doc === doc && cache.from === from && cache.to === to) {
    return cache.words;
  }
  const words = countReadAloudWords(doc, from, to);
  cache = { doc, from, to, words };
  return words;
}

/** The readout tail ("Card: 42 · Amy: 0:31 · Ben: 0:34"), or null when
 *  the feature is off or nothing applies. Callers join it to the
 *  primary readout with " | " — and label their whole-doc side "Doc:"
 *  while this feature is on, so the two sides read symmetrically. */
export function liveContainerSegment(state: EditorState): string | null {
  if (!settings.get('liveContainerReadTime')) return null;
  const sel = state.selection;
  let label: string;
  let words: number;
  if (!sel.empty) {
    // Primary readout already shows the selection when
    // liveSelectionWordCount is on — no duplicate segment.
    if (settings.get('liveSelectionWordCount')) return null;
    label = 'Sel';
    words = countReadAloudWords(state.doc, sel.from, sel.to);
  } else {
    const container = findEnclosingContainer(state);
    if (!container) return null;
    label = container.label;
    words = countCached(state.doc, container.from, container.to);
  }
  const parts = [`${label}: ${formatNumber(words)}`];
  for (const r of settings.get('readers').slice(0, 2)) {
    parts.push(`${r.name}: ${formatReadTime(words, r.wpm)}`);
  }
  return parts.join(' · ');
}
