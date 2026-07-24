// @vitest-environment jsdom

/**
 * Card numbers in the nav pane — the editor's numbering pass mirrored onto
 * the outline rows (field request 2026-07-13: the numbering toggle affected
 * the editor but not the nav). Each numbered card/analytic_unit's FIRST
 * heading row carries the computed glyph; display follows the same
 * `showCardNumbering` gate and format settings as the editor, via the nav's
 * own settings subscriber (no explicit re-render call needed on a toggle).
 */

import { describe, expect, it, afterEach } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { NavigationPanel } from '../../src/editor/nav-panel.js';
import { settings } from '../../src/editor/settings.js';
import type { NumRole } from '../../src/editor/numbering.js';

function card(tag: string, role: NumRole = 'none', restart = false): PMNode {
  return schema.nodes['card']!.createChecked({ numRole: role, numRestart: restart }, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(tag)),
    schema.nodes['card_body']!.create(null, schema.text('body')),
  ]);
}
function analytic(tag: string, role: NumRole = 'none'): PMNode {
  return schema.nodes['analytic_unit']!.createChecked({ numRole: role }, [
    schema.nodes['analytic']!.create({ id: newHeadingId() }, schema.text(tag)),
    schema.nodes['card_body']!.create(null, schema.text('body')),
  ]);
}

function setup(...children: PMNode[]) {
  const doc = schema.nodes['doc']!.create(null, children);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const view = new EditorView(container, { state: EditorState.create({ doc }) });
  const nav = new NavigationPanel(document.createElement('div'));
  nav.attach(view);
  nav.update(view.state.doc);
  return { view, nav };
}

/** [rowLabelText, glyphText|null] per rendered nav row, in order. */
function rows(nav: NavigationPanel): Array<[string, string | null]> {
  const root = (nav as unknown as Record<string, unknown>)['listEl'] as HTMLElement;
  return [...root.querySelectorAll('.pmd-nav-item')].map((li) => [
    li.querySelector('.pmd-nav-label')?.textContent ?? '',
    li.querySelector('.pmd-nav-card-number')?.textContent ?? null,
  ]);
}

afterEach(() => {
  // The suite flips display settings; restore the defaults for neighbors.
  settings.set('showCardNumbering', true);
  settings.set('cardNumberingFormat', 'period');
  settings.set('navMaxLevel', 3);
});

describe('NavigationPanel — card number glyphs', () => {
  it('numbered rows carry the computed glyph; skipped cards stay bare', () => {
    const { view, nav } = setup(
      card('First', 'number'),
      card('Skip'),
      card('Second', 'number'),
      analytic('Sub under second', 'sub'),
    );
    expect(rows(nav)).toEqual([
      ['First', '1.'],
      ['Skip', null],
      ['Second', '2.'],
      // Note the default separators differ by kind: number `period`, sub `paren`.
      ['Sub under second', 'a)'],
    ]);
    view.destroy();
  });

  it('live-view (self_ref) projected rows carry the same host-contextual numbers as the editor', () => {
    // Regression: windowed rows were skipped entirely, so a numbered card
    // inside a live view showed its number in the editor but not the nav.
    // The projection now carries each mirrored card's REAL doc position —
    // the key computeNumbering files the window's labels under.
    // Fully expand the outline — navMaxLevel defaults to 3, which starts
    // blocks collapsed and would hide every card row from this assertion.
    settings.set('navMaxLevel', 4);
    const srcId = newHeadingId();
    const srcBlock = schema.nodes['block']!.create({ id: srcId }, schema.text('Source'));
    const srcCards = [card('One', 'number'), card('Two', 'number')];
    // The live view holds MIRRORED copies as real children (the content
    // plugin's invariant: children ≡ the projection, which is the source
    // section's content WITHOUT the heading itself) — so shapes and
    // positions line up between the nav's projection walk and
    // computeNumbering's walk of the real children.
    const mirror = schema.nodes['self_ref']!.create({ source_heading_id: srcId }, [
      card('One', 'number'),
      card('Two', 'number'),
    ]);
    const { view, nav } = setup(srcBlock, ...srcCards, mirror);
    expect(rows(nav)).toEqual([
      ['Source', null],
      ['One', '1.'],
      ['Two', '2.'],
      // The projected window continues the HOST count (no block inside
      // the window to reset it): 3 and 4 — exactly what the editor
      // renders inside the window. The glyphs must appear on the
      // WINDOWED rows.
      ['One', '3.'],
      ['Two', '4.'],
    ]);
    view.destroy();
  });

  it('the display toggle removes / restores glyphs through the nav settings subscriber alone', () => {
    const { view, nav } = setup(card('Only', 'number'));
    expect(rows(nav)).toEqual([['Only', '1.']]);
    // No nav.update() calls — the panel's own subscriber must re-render.
    settings.set('showCardNumbering', false);
    expect(rows(nav)).toEqual([['Only', null]]);
    settings.set('showCardNumbering', true);
    expect(rows(nav)).toEqual([['Only', '1.']]);
    view.destroy();
  });

  it('a format change re-renders glyphs through the subscriber', () => {
    const { view, nav } = setup(card('Only', 'number'));
    settings.set('cardNumberingFormat', 'paren');
    expect(rows(nav)).toEqual([['Only', '1)']]);
    view.destroy();
  });
});

describe('NavigationPanel — selectedNumberingScope (numbering toggle scope)', () => {
  /** Force the panel's selection internals (private) to the given rows. */
  function forceSelection(nav: NavigationPanel, ids: string[], level: number): void {
    const p = nav as unknown as { selectedIds: Set<string>; selectionLevel: number | null };
    p.selectedIds = new Set(ids);
    p.selectionLevel = level;
  }
  /** Heading ids + wrapping positions of every top-level card/unit. */
  function cardsOf(view: EditorView): Array<{ id: string; pos: number }> {
    const out: Array<{ id: string; pos: number }> = [];
    view.state.doc.forEach((n, off) => {
      const id = n.firstChild?.attrs['id'];
      if (typeof id === 'string') out.push({ id, pos: off });
    });
    return out;
  }

  it('a multi-selection of tag/analytic rows maps to the wrapping card positions', () => {
    const { view, nav } = setup(card('A'), card('B'), analytic('C'));
    const all = cardsOf(view);
    forceSelection(nav, [all[0]!.id, all[2]!.id], 4);
    const scope = nav.selectedNumberingScope();
    expect(scope?.kind).toBe('cards');
    expect(scope?.positions.sort((a, b) => a - b)).toEqual([all[0]!.pos, all[2]!.pos]);
    view.destroy();
  });

  it('a multi-selection of block rows maps to the block node positions (restart scope)', () => {
    const b1 = newHeadingId();
    const b2 = newHeadingId();
    const { view, nav } = setup(
      schema.nodes['block']!.create({ id: b1 }, schema.text('One')),
      card('A'),
      schema.nodes['block']!.create({ id: b2 }, schema.text('Two')),
      card('B'),
    );
    forceSelection(nav, [b1, b2], 3);
    const scope = nav.selectedNumberingScope();
    expect(scope?.kind).toBe('blocks');
    const blockPositions: number[] = [];
    view.state.doc.forEach((n, off) => {
      if (n.type.name === 'block') blockPositions.push(off);
    });
    expect(scope?.positions.sort((a, b) => a - b)).toEqual(blockPositions);
    view.destroy();
  });

  it('a single selection defers to the editor caret (null)', () => {
    const { view, nav } = setup(card('A'), card('B'));
    forceSelection(nav, [cardsOf(view)[0]!.id], 4);
    expect(nav.selectedNumberingScope()).toBeNull();
    view.destroy();
  });

  it('a level-1/2 selection (pockets/hats) is not a numbering scope', () => {
    const { view, nav } = setup(card('A'), card('B'));
    const all = cardsOf(view);
    forceSelection(nav, [all[0]!.id, all[1]!.id], 2);
    expect(nav.selectedNumberingScope()).toBeNull();
    view.destroy();
  });
});
