// @vitest-environment jsdom

/**
 * Nav-pane context menu "Cut heading and contents" (field request
 * 2026-07-26): copy the subtree to the clipboard, then delete it — with
 * the delete gated on (a) the clipboard write succeeding, so a busy
 * clipboard never destroys content, and (b) the doc being unchanged
 * across the async write, so a collab edit landing mid-cut can't shift
 * the deleted span onto the wrong content.
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';

const writeClipboardHtml = vi.fn(async (_html: string, _text: string) => true);
vi.mock('../../src/editor/clipboard-write.js', () => ({
  writeClipboardHtml: (html: string, text: string) => writeClipboardHtml(html, text),
  CLIPBOARD_BUSY_MESSAGE: 'busy',
}));

import { NavigationPanel } from '../../src/editor/nav-panel.js';

function card(tag: string, body: string): PMNode {
  return schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(tag)),
    schema.nodes['card_body']!.create(null, schema.text(body)),
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

/** The nav's heading entry whose label matches `label`. */
function entryFor(nav: NavigationPanel, label: string): unknown {
  const entries = [
    ...((nav as unknown as Record<string, unknown>)['liEntries'] as Map<HTMLElement, unknown>).values(),
  ];
  const hit = entries.find(
    (e) => ((e as { text?: string }).text ?? '').includes(label),
  );
  if (!hit) throw new Error(`no nav entry labeled "${label}"`);
  return hit;
}

async function cut(nav: NavigationPanel, entry: unknown): Promise<void> {
  await (
    nav as unknown as { cutHeadingAndContents: (e: unknown) => Promise<void> }
  ).cutHeadingAndContents(entry);
}

afterEach(() => {
  writeClipboardHtml.mockClear();
  writeClipboardHtml.mockImplementation(async () => true);
  document.body.innerHTML = '';
});

describe('nav-pane cut heading', () => {
  it('copies the subtree to the clipboard and deletes it from the doc', async () => {
    const { view, nav } = setup(card('Alpha tag', 'alpha body'), card('Beta tag', 'beta body'));
    await cut(nav, entryFor(nav, 'Alpha tag'));

    expect(writeClipboardHtml).toHaveBeenCalledTimes(1);
    const [html, text] = writeClipboardHtml.mock.calls[0]!;
    expect(html).toContain('Alpha tag');
    expect(text).toContain('alpha body');

    const docText = view.state.doc.textContent;
    expect(docText).not.toContain('Alpha tag');
    expect(docText).toContain('Beta tag'); // neighbors untouched
  });

  it('deletes nothing when the clipboard write fails', async () => {
    writeClipboardHtml.mockImplementation(async () => false);
    const { view, nav } = setup(card('Alpha tag', 'alpha body'));
    await cut(nav, entryFor(nav, 'Alpha tag'));
    expect(view.state.doc.textContent).toContain('Alpha tag');
  });

  it('aborts the delete when the doc changes during the async write', async () => {
    const { view, nav } = setup(card('Alpha tag', 'alpha body'), card('Beta tag', 'beta body'));
    // Simulate a collab edit landing while the clipboard write is in
    // flight: insert text at the doc start before the write resolves.
    writeClipboardHtml.mockImplementation(async () => {
      view.dispatch(view.state.tr.insertText('X', 2));
      return true;
    });
    await cut(nav, entryFor(nav, 'Alpha tag'));
    // Copy half happened, delete half aborted — both cards survive.
    expect(view.state.doc.textContent).toContain('Alpha tag');
    expect(view.state.doc.textContent).toContain('Beta tag');
  });
});
