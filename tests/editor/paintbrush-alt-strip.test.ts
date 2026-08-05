// @vitest-environment jsdom

/**
 * Alt/Option strip-pen override for paint mode (field request
 * 2026-07-26): while a COLORED paintbrush is armed, a stroke released
 * with Alt held paints "no color" (strips the mark) instead; the
 * custom cursor swatch flips to the red-slash "none" glyph while Alt
 * is down and reverts on release (or on window blur, which eats the
 * keyup). A pen already set to "none" ignores Alt — it strips either
 * way. The apply decision reads e.altKey off the mouseup itself, so
 * cursor-tracking state can never make the wrong pen fire.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { wireColorPanel, type ColorPanelHandle } from '../../src/editor/color-panel.js';
import { settings } from '../../src/editor/settings.js';

/** The ribbon button stubs wireColorPanel wires against. */
function buildRibbonStubs(): void {
  const ids = [
    'highlight-btn', 'highlight-picker-btn', 'highlight-bar',
    'shading-btn', 'shading-picker-btn', 'shading-bar',
    'fontcolor-btn', 'fontcolor-picker-btn', 'fontcolor-bar', 'fontcolor-glyph',
  ];
  for (const id of ids) {
    const el = document.createElement(id.endsWith('-btn') ? 'button' : 'div');
    el.id = id;
    document.body.appendChild(el);
  }
}

function cardWith(body: PMNode[]): PMNode {
  return schema.nodes['doc']!.createChecked(null, [
    schema.nodes['card']!.createChecked(null, [
      schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text('Tag')),
      schema.nodes['card_body']!.create(null, body),
    ]),
  ]);
}

let view: EditorView;
let handle: ColorPanelHandle;

function mount(doc: PMNode): void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  view = new EditorView(container, { state: EditorState.create({ doc }) });
  handle = wireColorPanel({
    get view() {
      return view;
    },
  });
}

/** Select the doc range containing `needle`, then release a paint
 *  stroke (mouseup inside the editor), with optional modifiers. */
function stroke(needle: string, alt: boolean, ctrl = false): void {
  let from = -1;
  let to = -1;
  view.state.doc.descendants((node, pos) => {
    if (from >= 0) return false;
    if (node.isText && (node.text ?? '').includes(needle)) {
      from = pos + (node.text ?? '').indexOf(needle);
      to = from + needle.length;
      return false;
    }
    return true;
  });
  if (from < 0) throw new Error(`"${needle}" not found`);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
  view.dom.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, altKey: alt, ctrlKey: ctrl }));
}

/** Does any text node containing `needle` carry the highlight mark? */
function highlighted(needle: string): boolean {
  let found = false;
  view.state.doc.descendants((node) => {
    if (node.isText && (node.text ?? '').includes(needle)) {
      found = node.marks.some((m) => m.type.name === 'highlight');
    }
    return !found;
  });
  return found;
}

beforeEach(() => {
  buildRibbonStubs();
  settings.set('lastHighlightColor', 'yellow');
});

afterEach(() => {
  view?.destroy();
  document.body.innerHTML = '';
  settings.set('lastHighlightColor', 'yellow');
});

/** Pretend to be a Mac (or not) for one test; restore after. */
function withPlatform(platform: string, run: () => void): void {
  Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });
  try {
    run();
  } finally {
    delete (window.navigator as { platform?: string }).platform;
  }
}

describe('paintbrush Alt strip-pen', () => {
  const hl = schema.marks['highlight']!.create({ color: 'yellow' });

  it('a plain stroke paints; an Alt stroke strips', () => {
    mount(cardWith([schema.text('plain words '), schema.text('marked words', [hl])]));
    handle.togglePaintbrush('highlight');

    stroke('plain', false);
    expect(highlighted('plain')).toBe(true);

    stroke('marked', true);
    expect(highlighted('marked')).toBe(false);
  });

  it('an Alt stroke over unmarked text adds nothing', () => {
    mount(cardWith([schema.text('untouched words')]));
    handle.togglePaintbrush('highlight');
    stroke('untouched', true);
    expect(highlighted('untouched')).toBe(false);
  });

  it('on macOS the override is ⌃ — ⌥ is ignored, since ⌥-drag moves the window there', () => {
    withPlatform('MacIntel', () => {
      mount(cardWith([schema.text('plain words '), schema.text('marked words', [hl])]));
      handle.togglePaintbrush('highlight');

      // ⌥ must NOT strip on a Mac: the OS claims ⌥-drag, so a stroke
      // that somehow lands with altKey still paints the armed color.
      stroke('plain', true);
      expect(highlighted('plain')).toBe(true);

      // ⌃ is the strip override.
      stroke('marked', false, true);
      expect(highlighted('marked')).toBe(false);
    });
  });

  it('off macOS, ⌃ does not strip — Alt remains the override', () => {
    mount(cardWith([schema.text('untouched words')]));
    handle.togglePaintbrush('highlight');
    stroke('untouched', false, true); // ctrl on a non-mac platform
    // A strip-pen stroke over unmarked text adds nothing (see above),
    // so paint landing here proves ⌃ was NOT treated as the override.
    expect(highlighted('untouched')).toBe(true);
  });

  it('a "none" pen strips with or without Alt', () => {
    mount(cardWith([schema.text('marked words', [hl])]));
    settings.set('lastHighlightColor', null);
    handle.togglePaintbrush('highlight');
    stroke('marked', false);
    expect(highlighted('marked')).toBe(false);
  });

  it('pane switch moves the visuals; disarming from another pane cleans the armed one', () => {
    // Two views behind a mutable ref — the three-pane shape.
    const mkView = (): EditorView => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      return new EditorView(el, {
        state: EditorState.create({ doc: cardWith([schema.text('words')]) }),
      });
    };
    const a = mkView();
    const b = mkView();
    const ref = { view: a as EditorView | null };
    const h = wireColorPanel({
      get view() {
        return ref.view;
      },
    });

    h.togglePaintbrush('highlight');
    expect(a.dom.style.cursor).not.toBe('');
    expect(a.dom.classList.contains('pmd-paintbrush-highlight')).toBe(true);

    // Focus pane B (setActiveView path calls syncPaintbrushView).
    ref.view = b;
    h.syncPaintbrushView();
    expect(a.dom.style.cursor).toBe(''); // visuals left pane A…
    expect(a.dom.classList.contains('pmd-paintbrush-highlight')).toBe(false);
    expect(b.dom.style.cursor).not.toBe(''); // …and follow to pane B
    expect(b.dom.classList.contains('pmd-paintbrush-highlight')).toBe(true);

    // Disarm while B is focused: nothing anywhere keeps brush chrome.
    h.togglePaintbrush('highlight');
    expect(a.dom.style.cursor).toBe('');
    expect(b.dom.style.cursor).toBe('');
    expect(b.dom.classList.contains('pmd-paintbrush-highlight')).toBe(false);

    a.destroy();
    b.destroy();
  });

  it('cursor swatch flips to the slash glyph while Alt is held, reverts on keyup and blur', () => {
    mount(cardWith([schema.text('words')]));
    handle.togglePaintbrush('highlight');
    const colored = view.dom.style.cursor;
    expect(colored).toContain('FFFF00'); // yellow swatch

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
    const stripping = view.dom.style.cursor;
    expect(stripping).not.toContain('FFFF00');
    expect(stripping).toContain(encodeURIComponent('#d21')); // red slash

    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }));
    expect(view.dom.style.cursor).toBe(colored);

    // Blur clears a stuck override (Cmd-Tab eats the keyup).
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
    expect(view.dom.style.cursor).toBe(stripping);
    window.dispatchEvent(new Event('blur'));
    expect(view.dom.style.cursor).toBe(colored);
  });
});
