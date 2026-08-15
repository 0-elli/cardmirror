// @vitest-environment jsdom

/**
 * Fallback Cut/Copy/Paste editor context menu (2026-08-15). Built
 * because right-click previously did nothing on plain editor text —
 * which trained users to right-click around, the posture behind the
 * paintbrush incident. Pinned here:
 *  - right-click opens the menu and suppresses the native one
 *  - enablement: Cut/Copy need a selection; Cut/Paste need an
 *    editable view
 *  - Copy serializes the selection (html + text) through the shared
 *    clipboard ladder
 *  - Cut deletes ONLY after the clipboard write succeeds; a failed
 *    write leaves the document intact
 *  - Paste feeds clipboard html/text through PM's paste pipeline
 *  - Escape and outside-mousedown close the menu
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { textContextMenuPlugin } from '../../src/editor/text-context-menu-plugin.js';

function docWith(text: string): PMNode {
  return schema.nodes['doc']!.createChecked(null, [
    schema.nodes['card']!.createChecked(null, [
      schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text('Tag')),
      schema.nodes['card_body']!.create(null, schema.text(text)),
    ]),
  ]);
}

let view: EditorView;

function mount(text: string, editable = true): void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  view = new EditorView(container, {
    state: EditorState.create({ doc: docWith(text), plugins: [textContextMenuPlugin] }),
    editable: () => editable,
  });
}

/** Select the doc range containing `needle` (collapsed to its end if
 *  `caretOnly`). Avoids hand-computed positions, which silently land
 *  in the tag node. */
function selectText(needle: string, caretOnly = false): void {
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
  const sel = caretOnly
    ? TextSelection.create(view.state.doc, to)
    : TextSelection.create(view.state.doc, from, to);
  view.dispatch(view.state.tr.setSelection(sel));
}

function rightClick(): MouseEvent {
  const e = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 30,
    clientY: 20,
  });
  view.dom.dispatchEvent(e);
  return e;
}

function menuEl(): HTMLElement | null {
  return document.querySelector('.pmd-nav-context-menu');
}

function menuItem(label: string): HTMLButtonElement {
  const items = [...document.querySelectorAll<HTMLButtonElement>('.pmd-nav-context-item')];
  const hit = items.find((b) => b.textContent?.startsWith(label));
  if (!hit) throw new Error(`menu item "${label}" not found`);
  return hit;
}

/** Install a recording async-clipboard stub; returns the record. */
function stubClipboard(opts: { failWrites?: boolean } = {}): {
  writes: Array<{ html: string; text: string }>;
} {
  const record = { writes: [] as Array<{ html: string; text: string }> };
  const clipboard = {
    write: async (items: Array<{ getType(t: string): Promise<Blob> }>) => {
      if (opts.failWrites) throw new Error('clipboard busy');
      for (const item of items) {
        record.writes.push({
          html: await (await item.getType('text/html')).text(),
          text: await (await item.getType('text/plain')).text(),
        });
      }
    },
    writeText: async (t: string) => {
      if (opts.failWrites) throw new Error('clipboard busy');
      record.writes.push({ html: '', text: t });
    },
  };
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
  if (typeof globalThis.ClipboardItem === 'undefined') {
    // Minimal stand-in: hold the blobs, hand them back by MIME type.
    class FakeClipboardItem {
      #items: Record<string, Blob>;
      constructor(items: Record<string, Blob>) {
        this.#items = items;
      }
      async getType(t: string): Promise<Blob> {
        const b = this.#items[t];
        if (!b) throw new Error(`no ${t}`);
        return b;
      }
    }
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = FakeClipboardItem;
  }
  return record;
}

function docText(): string {
  return view.state.doc.textContent;
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.useRealTimers();
  // PM's pasteHTML/pasteText construct a synthetic ClipboardEvent,
  // which jsdom doesn't define — stub the constructor only.
  if (typeof globalThis.ClipboardEvent === 'undefined') {
    (globalThis as { ClipboardEvent?: unknown }).ClipboardEvent = class extends Event {
      clipboardData = null;
    };
  }
});

afterEach(() => {
  view?.destroy();
  document.body.innerHTML = '';
  delete (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
});

describe('text context menu', () => {
  it('right-click opens the menu and suppresses the native one', () => {
    mount('some card body text');
    const e = rightClick();
    expect(e.defaultPrevented).toBe(true);
    expect(menuEl()).not.toBeNull();
    for (const label of ['Cut', 'Copy', 'Paste']) expect(() => menuItem(label)).not.toThrow();
  });

  it('empty selection: Cut and Copy disabled, Paste enabled', () => {
    mount('some card body text');
    rightClick();
    expect(menuItem('Cut').disabled).toBe(true);
    expect(menuItem('Copy').disabled).toBe(true);
    expect(menuItem('Paste').disabled).toBe(false);
  });

  it('read-only view: Copy enabled, Cut and Paste disabled', () => {
    mount('read only body text', false);
    selectText('only body');
    rightClick();
    expect(menuItem('Copy').disabled).toBe(false);
    expect(menuItem('Cut').disabled).toBe(true);
    expect(menuItem('Paste').disabled).toBe(true);
  });

  it('Copy writes the selection html + text through the clipboard', async () => {
    const clip = stubClipboard();
    mount('copy this body text');
    selectText('copy this');
    rightClick();
    menuItem('Copy').click();
    await flush();
    expect(clip.writes.length).toBe(1);
    expect(clip.writes[0]!.text).toBe('copy this');
    expect(clip.writes[0]!.html).toContain('copy this');
    expect(menuEl()).toBeNull(); // menu closed by the action
    expect(docText()).toContain('copy this'); // copy never mutates
  });

  it('Cut copies then deletes the selection', async () => {
    const clip = stubClipboard();
    mount('cut this body text');
    selectText('cut this');
    rightClick();
    menuItem('Cut').click();
    await flush();
    expect(clip.writes.length).toBe(1);
    expect(clip.writes[0]!.text).toBe('cut this');
    expect(docText()).not.toContain('cut this');
  });

  it('a failed clipboard write leaves the document intact on Cut', async () => {
    stubClipboard({ failWrites: true });
    mount('precious body text');
    selectText('precious');
    rightClick();
    menuItem('Cut').click();
    // The write ladder retries on a backoff before giving up.
    await new Promise((r) => setTimeout(r, 1200));
    expect(docText()).toContain('precious body text');
  }, 10_000);

  it('Paste feeds clipboard html through the paste pipeline', async () => {
    stubClipboard();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: async () => [
          {
            types: ['text/html'],
            getType: async () => new Blob(['<p>pasted rich</p>'], { type: 'text/html' }),
          },
        ],
      },
    });
    mount('target body text');
    selectText('target', true);
    rightClick();
    menuItem('Paste').click();
    await flush();
    expect(docText()).toContain('pasted rich');
  });

  it('Paste falls back to plain text when no html flavor exists', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: async () => [
          {
            types: ['text/plain'],
            getType: async () => new Blob(['plain pasted'], { type: 'text/plain' }),
          },
        ],
      },
    });
    mount('target body text');
    selectText('target', true);
    rightClick();
    menuItem('Paste').click();
    await flush();
    expect(docText()).toContain('plain pasted');
  });

  it('Escape closes the menu; outside mousedown closes the menu', async () => {
    mount('some card body text');
    rightClick();
    await flush(); // dismiss listeners attach on a deferred tick
    expect(menuEl()).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menuEl()).toBeNull();

    rightClick();
    await flush();
    expect(menuEl()).not.toBeNull();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menuEl()).toBeNull();
  });
});
