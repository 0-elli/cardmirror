// @vitest-environment jsdom
//
// Closing the find bar must clean the pane it OPENED on. In multi-pane the
// shell closes the bar the moment focus moves to another pane
// (setActiveView), at which point the bar's lazy "current view" resolver may
// already answer with the INCOMING pane — cleanup must therefore target the
// captured opened view/nav, or the outgoing pane keeps its match decorations
// and nav hit markers forever (field report 2026-07-24: search in pane A,
// click into pane B, close find there — A's highlights are stuck).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from '../../src/schema/index.js';
import { FindReplaceBar } from '../../src/editor/find-replace-ui.js';
import {
  findReplacePlugin,
  findReplaceKey,
} from '../../src/editor/find-replace-plugin.js';
import { settings } from '../../src/editor/settings.js';
import type { NavigationPanel } from '../../src/editor/nav-panel.js';

function makeView(text: string): EditorView {
  const doc = schema.nodes['doc']!.create(null, [
    schema.nodes['paragraph']!.create(null, schema.text(text)),
  ]);
  const el = document.createElement('div');
  document.body.appendChild(el);
  return new EditorView(el, {
    state: EditorState.create({ doc, plugins: [findReplacePlugin()] }),
  });
}

/** Populate match state directly — the bar's own input path is debounced. */
function runQuery(view: EditorView, query: string): void {
  view.dispatch(
    view.state.tr.setMeta(findReplaceKey, {
      type: 'setQuery',
      query,
      caseSensitive: false,
      wholeWord: false,
      anchor: 0,
      sortMode: 'uncategorized',
      categoryOrder: settings.get('findCategoryOrder'),
    }),
  );
}

const matchCount = (view: EditorView): number =>
  findReplaceKey.getState(view.state)?.matches.length ?? 0;

/** Nav-panel stand-in recording every setFindHitPositions call. */
function makeNavStub(): { nav: NavigationPanel; calls: Array<number[] | null> } {
  const calls: Array<number[] | null> = [];
  const nav = {
    setFindHitPositions: (p: number[] | null) => {
      calls.push(p);
    },
  } as unknown as NavigationPanel;
  return { nav, calls };
}

const OPEN = { mode: 'find', sortMode: 'categorized' } as const;

beforeEach(() => {
  document.body.innerHTML = '';
  settings.set('findRememberLastQuery', false);
  settings.set('findLastQuery', '');
  settings.set('findResultsExpanded', false);
});

describe('find bar: close cleans the pane it opened on', () => {
  it('clears the OPENED pane after the current-view resolver has moved to another pane', () => {
    const viewA = makeView('alpha alpha');
    const viewB = makeView('alpha beta');
    let current = viewA;
    const navA = makeNavStub();
    const navB = makeNavStub();
    let currentNav = navA.nav;
    const bar = new FindReplaceBar(
      () => current,
      () => currentNav,
    );
    bar.open(OPEN);
    runQuery(viewA, 'alpha');
    expect(matchCount(viewA)).toBe(2);
    // Focus moves: the resolvers now answer with pane B (the shell swaps its
    // focused slot before setActiveView runs the close).
    current = viewB;
    currentNav = navB.nav;
    const focusA = vi.spyOn(viewA, 'focus');
    bar.close({ refocusEditor: false });
    expect(matchCount(viewA)).toBe(0); // outgoing pane's matches cleared…
    expect(matchCount(viewB)).toBe(0); // …and the incoming pane untouched
    expect(focusA).not.toHaveBeenCalled(); // focus is already moving — no yank-back
    expect(navA.calls[navA.calls.length - 1]).toBeNull(); // opened nav's markers cleared
    expect(navB.calls.length).toBe(0); // the other pane's nav never touched
    viewA.destroy();
    viewB.destroy();
  });

  it('a plain close (no focus change) still clears and refocuses the editor', () => {
    const viewA = makeView('alpha');
    const bar = new FindReplaceBar(
      () => viewA,
      () => null,
    );
    bar.open(OPEN);
    runQuery(viewA, 'alpha');
    expect(matchCount(viewA)).toBe(1);
    const focusA = vi.spyOn(viewA, 'focus');
    bar.close();
    expect(matchCount(viewA)).toBe(0);
    expect(focusA).toHaveBeenCalled();
    viewA.destroy();
  });

  it('closing after the opened view was destroyed is a safe no-op', () => {
    // Doc closed under the open bar, focus handed to the surviving pane: the
    // decorations died with the view — close must not dispatch into it.
    const viewA = makeView('alpha');
    const viewB = makeView('beta');
    let current = viewA;
    const bar = new FindReplaceBar(
      () => current,
      () => null,
    );
    bar.open(OPEN);
    runQuery(viewA, 'alpha');
    viewA.destroy();
    current = viewB;
    expect(() => bar.close({ refocusEditor: false })).not.toThrow();
    expect(matchCount(viewB)).toBe(0);
    viewB.destroy();
  });
});
