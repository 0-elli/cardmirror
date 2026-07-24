// @vitest-environment jsdom
/**
 * Nav-pane depth semantics (field request 2026-07-14): `navMaxLevel` is
 * the DEFAULT depth for newly opened documents ("Default navigation
 * depth", Settings → General), while the pane's 1–4 buttons are a
 * transient per-doc view change that never writes the setting. Both
 * layouts share this: every panel is per-instance now (the old
 * single-pane behavior wrote every button click through to settings,
 * making the last click the de-facto default).
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { NavigationPanel } from '../../src/editor/nav-panel.js';
import { settings } from '../../src/editor/settings.js';

function makeView(): EditorView {
  const doc = schema.nodes['doc']!.create(null, [
    schema.nodes['block']!.create({ id: newHeadingId() }, schema.text('Block')),
    schema.nodes['card']!.create(null, [
      schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text('Tag')),
      schema.nodes['card_body']!.create(null, schema.text('body')),
    ]),
  ]);
  const container = document.createElement('div');
  document.body.appendChild(container);
  return new EditorView(container, { state: EditorState.create({ doc }) });
}

const depthOf = (p: NavigationPanel): number =>
  (p as unknown as { localMaxLevel: number }).localMaxLevel;

function clickLevel(p: NavigationPanel, level: number): void {
  const root = (p as unknown as { root: HTMLElement }).root;
  const btn = root.querySelector<HTMLButtonElement>(
    `.pmd-nav-level-btn[data-level="${level}"]`,
  );
  btn!.click();
}

beforeEach(() => settings.set('navMaxLevel', 2));
afterEach(() => settings.set('navMaxLevel', 3));

describe('nav-pane depth: default-for-new-docs semantics', () => {
  it('a newly attached doc opens at the configured default', () => {
    const view = makeView();
    const panel = new NavigationPanel(document.createElement('div'));
    panel.attach(view);
    expect(depthOf(panel)).toBe(2);
    panel.destroy();
    view.destroy();
  });

  it('level clicks are transient: the setting is never written', () => {
    const view = makeView();
    const panel = new NavigationPanel(document.createElement('div'));
    panel.attach(view);
    clickLevel(panel, 4);
    expect(depthOf(panel)).toBe(4); // the view changed…
    expect(settings.get('navMaxLevel')).toBe(2); // …the default did not
    panel.destroy();
    view.destroy();
  });

  it('re-attach (a new doc) resets the depth to the default', () => {
    const view = makeView();
    const panel = new NavigationPanel(document.createElement('div'));
    panel.attach(view);
    clickLevel(panel, 4);
    const view2 = makeView();
    panel.attach(view2); // open a different doc into the same panel
    expect(depthOf(panel)).toBe(2);
    panel.destroy();
    view.destroy();
    view2.destroy();
  });

  it('changing the setting affects NEW docs only, not the open one', () => {
    const view = makeView();
    const panel = new NavigationPanel(document.createElement('div'));
    panel.attach(view);
    clickLevel(panel, 4);
    settings.set('navMaxLevel', 1);
    expect(depthOf(panel)).toBe(4); // open doc untouched
    const view2 = makeView();
    panel.attach(view2);
    expect(depthOf(panel)).toBe(1); // next doc picks it up
    panel.destroy();
    view.destroy();
    view2.destroy();
  });
});

describe('nav-pane depth: content dropped in from another pane', () => {
  /** Labels of the currently RENDERED nav rows. */
  function renderedLabels(panel: NavigationPanel): string[] {
    const list = (panel as unknown as { listEl: HTMLElement }).listEl;
    return [...list.querySelectorAll('.pmd-nav-label')].map((el) => el.textContent ?? '');
  }
  /** A block section (block heading + one card) as insertable nodes. */
  function blockSection(name: string) {
    return [
      schema.nodes['block']!.create({ id: newHeadingId() }, schema.text(name)),
      schema.nodes['card']!.create(null, [
        schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(`${name} card`)),
        schema.nodes['card_body']!.create(null, schema.text('body')),
      ]),
    ];
  }

  it('applyMaxLevelToNewHeadings collapses freshly arrived headings to the pane depth', () => {
    // The cross-pane drop contract (field report 2026-07-24: dragged
    // headers landed fully expanded, ignoring the destination pane's
    // depth). navMaxLevel 3 = blocks collapsed by default.
    settings.set('navMaxLevel', 3);
    const view = makeView();
    const panel = new NavigationPanel(document.createElement('div'));
    panel.attach(view);
    // Simulate the drop: a new block section lands in the doc.
    const tr = view.state.tr.insert(
      view.state.doc.content.size,
      blockSection('Dropped'),
    );
    view.updateState(view.state.apply(tr));
    panel.applyMaxLevelToNewHeadings();
    // The dropped block renders collapsed: its card row is hidden.
    const labels = renderedLabels(panel);
    expect(labels).toContain('Dropped');
    expect(labels).not.toContain('Dropped card');
    panel.destroy();
    view.destroy();
  });

  it('an intervening render eats the diff — the reason the shell must apply BEFORE flushing', () => {
    // Pins the hazard the drop handler's ordering comment describes:
    // every render refreshes the seen-ids baseline, so render-then-apply
    // is a silent no-op and the drop lands expanded. If this test ever
    // "fixes itself", the baseline semantics changed — revisit the
    // shell's ordering constraint.
    settings.set('navMaxLevel', 3);
    const view = makeView();
    const panel = new NavigationPanel(document.createElement('div'));
    panel.attach(view);
    const tr = view.state.tr.insert(
      view.state.doc.content.size,
      blockSection('Dropped'),
    );
    view.updateState(view.state.apply(tr));
    panel.update(view.state.doc); // the intervening render (e.g. a flushed debounce)
    panel.applyMaxLevelToNewHeadings();
    expect(renderedLabels(panel)).toContain('Dropped card'); // expanded — diff was eaten
    panel.destroy();
    view.destroy();
  });

  it('a user-expanded existing block stays expanded across a drop', () => {
    settings.set('navMaxLevel', 3);
    const view = makeView();
    const panel = new NavigationPanel(document.createElement('div'));
    panel.attach(view);
    // Expand the pre-existing block by toggling its collapse off.
    const blockId = view.state.doc.firstChild!.attrs['id'] as string;
    (panel as unknown as { collapsed: Set<string> }).collapsed.delete(blockId);
    panel.update(view.state.doc);
    const tr = view.state.tr.insert(
      view.state.doc.content.size,
      blockSection('Dropped'),
    );
    view.updateState(view.state.apply(tr));
    panel.applyMaxLevelToNewHeadings();
    const labels = renderedLabels(panel);
    expect(labels).toContain('Tag'); // existing block still expanded
    expect(labels).not.toContain('Dropped card'); // newcomer collapsed
    panel.destroy();
    view.destroy();
  });
});
