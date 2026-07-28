// @vitest-environment jsdom
/**
 * An EMPTY doc's nav section must still offer the end-of-doc drop slot.
 *
 * Field bug 2026-07-27 (three-pane): dragging onto an empty pane's nav
 * showed only the "No headings." placeholder with no drop targets —
 * the empty state hides `listEl`, and the drop indicators (including
 * the always-valid end-of-doc slot) are appended INTO it, so they had
 * no hit-test rects. During a drag the panel now surfaces the list;
 * afterwards the empty state comes back.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from '../../src/schema/index.js';
import { NavigationPanel } from '../../src/editor/nav-panel.js';

type Internals = {
  listEl: HTMLElement;
  emptyEl: HTMLElement;
  dropIndicators: HTMLElement[];
  renderDropIndicators(level: number): void;
  removeDropIndicators(): void;
};

function makeEmptyView(): EditorView {
  // A blank doc: one empty paragraph, zero headings.
  const doc = schema.nodes['doc']!.create(null, [schema.nodes['paragraph']!.create()]);
  const container = document.createElement('div');
  document.body.appendChild(container);
  return new EditorView(container, { state: EditorState.create({ doc }) });
}

describe('empty-outline drop targets', () => {
  it('drag surfaces the hidden list so the end-of-doc slot is hittable, then restores', () => {
    const view = makeEmptyView();
    const panel = new NavigationPanel(document.createElement('div'));
    panel.attach(view);
    const p = panel as unknown as Internals;

    // Empty state: placeholder shown, list hidden.
    expect(p.listEl.style.display).toBe('none');
    expect(p.emptyEl.style.display).toBe('');

    p.renderDropIndicators(4);
    expect(p.listEl.style.display).toBe(''); // surfaced for the drag
    expect(p.dropIndicators.length).toBe(1); // the end-of-doc slot
    expect(p.dropIndicators[0]!.dataset['insertPos']).toBe(
      String(view.state.doc.content.size),
    );

    p.removeDropIndicators();
    expect(p.listEl.style.display).toBe('none'); // empty state restored

    panel.destroy();
    view.destroy();
  });

  it('a non-empty outline is untouched by the surface/restore dance', () => {
    const view = makeEmptyView();
    const panel = new NavigationPanel(document.createElement('div'));
    panel.attach(view);
    const p = panel as unknown as Internals;
    // Simulate the non-empty case: list already visible.
    p.listEl.style.display = '';
    p.renderDropIndicators(4);
    p.removeDropIndicators();
    expect(p.listEl.style.display).toBe(''); // not force-hidden
    panel.destroy();
    view.destroy();
  });
});
