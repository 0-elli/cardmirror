// @vitest-environment jsdom
/**
 * A heading whose text is ONLY whitespace must render its nav row at
 * the same height as any other row. The CSS holds an EMPTY label open
 * with `:empty::before { content: '\00a0' }` — but a space-filled text
 * node defeats `:empty` while still collapsing to zero width, which
 * squashed the row. The panel therefore normalizes whitespace-only
 * label text to truly empty so the CSS fallback applies.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { NavigationPanel } from '../../src/editor/nav-panel.js';

function makeView(headingTexts: string[]): EditorView {
  const doc = schema.nodes['doc']!.create(
    null,
    headingTexts.map((text) =>
      schema.nodes['block']!.create(
        { id: newHeadingId() },
        text ? schema.text(text) : null,
      ),
    ),
  );
  const container = document.createElement('div');
  document.body.appendChild(container);
  return new EditorView(container, { state: EditorState.create({ doc }) });
}

function labelTexts(panel: NavigationPanel): string[] {
  const root = (panel as unknown as { root: HTMLElement }).root;
  return [...root.querySelectorAll('.pmd-nav-label')].map((el) => el.textContent ?? '');
}

describe('nav rows for whitespace-only headings', () => {
  it('renders a whitespace-only heading label as truly empty (CSS :empty height fallback applies)', () => {
    const view = makeView(['Real heading', '   ', '  ']);
    const panel = new NavigationPanel(document.createElement('div'));
    panel.attach(view);
    const labels = labelTexts(panel);
    expect(labels.length).toBe(3);
    expect(labels[0]).toBe('Real heading');
    // Whitespace-only → '' so `.pmd-nav-label:empty::before` holds the
    // row at full height, exactly like a genuinely blank heading.
    expect(labels[1]).toBe('');
    expect(labels[2]).toBe('');
    panel.destroy();
    view.destroy();
  });

  it('leaves real text untouched, including inner spaces', () => {
    const view = makeView(['  padded  heading  ']);
    const panel = new NavigationPanel(document.createElement('div'));
    panel.attach(view);
    expect(labelTexts(panel)[0]).toBe('  padded  heading  ');
    panel.destroy();
    view.destroy();
  });
});
