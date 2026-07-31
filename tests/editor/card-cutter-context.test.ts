// @vitest-environment jsdom

/**
 * Cutter-context assembly (buildCutterContext): the port's context
 * block for the engine — file guidance note (root + refinements),
 * designated section excerpts (live-resolved through their anchors),
 * the focused card's pocket › hat › block path, and neighbor tags in
 * the same block. Contract mirrors the bench's cutterContext; the
 * pack-1 study found missing purpose/context was the #1 cut killer.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { schema, newHeadingId } from '../../src/schema/index.js';

// The port pulls in the app's heavier UI modules; none matter for
// context assembly — stub them.
vi.mock('../../src/editor/ribbon-commands.js', () => ({
  compileShrinkProtections: () => [],
  findProtectedRanges: () => [],
}));
vi.mock('../../src/editor/ai/llm.js', () => ({
  callLlm: vi.fn(),
  activeApiKey: () => 'k',
  resolveAiModel: () => 'test-model',
}));
vi.mock('../../src/editor/toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../../src/editor/ai/ai-activity.js', () => ({
  AiActivity: class {
    start(): void {}
    stop(): void {}
    setStage(): void {}
  },
}));
vi.mock('../../src/editor/ai/edit-coordinator.js', () => ({ claimRegion: vi.fn() }));
vi.mock('../../src/editor/card-cutter-preview-plugin.js', () => ({
  setCardCutterPreview: vi.fn(),
}));
vi.mock('../../src/editor/host/index.js', () => ({ getElectronHost: () => null }));
vi.mock('../../src/editor/learn-store-host.js', async () => {
  const { LearnStore } = await vi.importActual<typeof import('../../src/editor/learn-store.js')>(
    '../../src/editor/learn-store.js',
  );
  return { learnStore: new LearnStore(), localToday: () => '2026-07-31' };
});

import { buildCutterContext, setCutterDocIdProvider } from '../../src/editor/card-cutter-port.js';
import { learnStore } from '../../src/editor/learn-store-host.js';

const DOC_ID = 'doc-cutter-test';

function contextDoc(): PMNode {
  const n = schema.nodes;
  return n['doc']!.createChecked(null, [
    n['pocket']!.create({ id: newHeadingId() }, schema.text('DA - Reconciliation')),
    n['hat']!.create({ id: newHeadingId() }, schema.text('Link')),
    n['block']!.create({ id: newHeadingId() }, schema.text('AT: Dems Solve')),
    n['card']!.create(null, [
      n['tag']!.create({ id: newHeadingId() }, schema.text('First answer tag')),
      n['card_body']!.create(
        null,
        schema.text('the treaty background section explains the vote math in detail'),
      ),
    ]),
    n['card']!.create(null, [
      n['tag']!.create({ id: newHeadingId() }, schema.text('Focused card tag')),
      n['card_body']!.create(null, schema.text('focused card body text')),
    ]),
    n['card']!.create(null, [
      n['tag']!.create({ id: newHeadingId() }, schema.text('Third answer tag')),
      n['card_body']!.create(null, schema.text('third card body text')),
    ]),
  ]);
}

/** Top-level offset of the i-th card node. */
function cardOffset(doc: PMNode, index: number): number {
  let i = 0;
  let found = -1;
  doc.forEach((child, offset) => {
    if (child.type.name === 'card' && found < 0) {
      if (i === index) found = offset;
      i++;
    }
  });
  return found;
}

function fakeView(doc: PMNode): EditorView {
  return { state: { doc } } as unknown as EditorView;
}

beforeEach(() => {
  // Fresh notes between tests — remove everything the doc accumulated.
  for (const note of learnStore.notesForDoc(DOC_ID)) learnStore.removeNote(note.noteId);
});

describe('buildCutterContext', () => {
  it('with no docId provider: structure only (section path + neighbor tags)', () => {
    setCutterDocIdProvider(() => null);
    const doc = contextDoc();
    const ctx = buildCutterContext(fakeView(doc), cardOffset(doc, 1));
    expect(ctx).toContain('SECTION: DA - Reconciliation › Link › AT: Dems Solve');
    expect(ctx).toContain('previous tag: First answer tag');
    expect(ctx).toContain('next tag: Third answer tag');
    expect(ctx).not.toContain('FILE GUIDANCE');
  });

  it('assembles guidance root + refinements, designated sections, and structure', () => {
    setCutterDocIdProvider(() => DOC_ID);
    learnStore.addNote({
      noteId: 'g1',
      docId: DOC_ID,
      comments: [
        { author: 'me', text: 'This file targets pre-defined price schedules.', at: '2026-07-31' },
        { author: 'Cutter', text: '"him" in tags means the president.', at: '2026-07-31', ai: true },
      ],
      anchor: null,
      createdAt: '2026-07-31',
      kind: 'cutter-guidance',
    });
    learnStore.addNote({
      noteId: 's1',
      docId: DOC_ID,
      comments: [{ author: 'me', text: 'vote math', at: '2026-07-31' }],
      anchor: {
        quote: 'the treaty background section',
        prefix: '',
        suffix: '',
        approxPos: 0,
      },
      createdAt: '2026-07-31',
      kind: 'cutter-section',
    });
    const doc = contextDoc();
    const ctx = buildCutterContext(fakeView(doc), cardOffset(doc, 1));
    expect(ctx).toContain('FILE GUIDANCE (how this file works):');
    expect(ctx).toContain('This file targets pre-defined price schedules.');
    expect(ctx).toContain('- "him" in tags means the president.');
    expect(ctx).toContain('DESIGNATED CONTEXT SECTIONS');
    expect(ctx).toContain('[vote math]');
    expect(ctx).toContain('the treaty background section');
    expect(ctx).toContain('SECTION: DA - Reconciliation › Link › AT: Dems Solve');
    // Stable ordering: guidance before sections before structure — the
    // [context prefix][card payload] split is prompt-cache-friendly.
    expect(ctx.indexOf('FILE GUIDANCE')).toBeLessThan(ctx.indexOf('DESIGNATED CONTEXT'));
    expect(ctx.indexOf('DESIGNATED CONTEXT')).toBeLessThan(ctx.indexOf('SECTION:'));
  });

  it('plain and guidance notes never leak into each other', () => {
    setCutterDocIdProvider(() => DOC_ID);
    learnStore.addNote({
      noteId: 'p1',
      docId: DOC_ID,
      comments: [{ author: 'me', text: 'a plain private note', at: '2026-07-31' }],
      anchor: null,
      createdAt: '2026-07-31',
    });
    const doc = contextDoc();
    const ctx = buildCutterContext(fakeView(doc), cardOffset(doc, 1));
    expect(ctx).not.toContain('a plain private note');
    expect(learnStore.cutterGuidanceNote(DOC_ID)).toBeUndefined();
    expect(learnStore.cutterSectionNotes(DOC_ID)).toHaveLength(0);
  });
});

describe('learn-store cutter accessors', () => {
  it('removeNoteComment deletes one refinement by index', () => {
    learnStore.addNote({
      noteId: 'g2',
      docId: DOC_ID,
      comments: [
        { author: 'me', text: 'root', at: 't' },
        { author: 'Cutter', text: 'refinement A', at: 't', ai: true },
        { author: 'Cutter', text: 'refinement B', at: 't', ai: true },
      ],
      anchor: null,
      createdAt: 't',
      kind: 'cutter-guidance',
    });
    learnStore.removeNoteComment('g2', 1);
    expect(learnStore.getNote('g2')?.comments.map((c) => c.text)).toEqual(['root', 'refinement B']);
    learnStore.removeNoteComment('g2', 5); // bad index — no-op
    expect(learnStore.getNote('g2')?.comments).toHaveLength(2);
  });
});
