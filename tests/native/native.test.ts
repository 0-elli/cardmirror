import { describe, expect, it } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import {
  serializeNative,
  parseNative,
  looksLikeNative,
  NATIVE_FILE_EXTENSION,
} from '../../src/native/index.js';
import type { Thread } from '../../src/editor/comments-plugin.js';

const { nodes, marks } = schema;

function makeSampleDoc(): PMNode {
  return nodes['doc']!.createChecked(null, [
    nodes['pocket']!.create({ id: newHeadingId() }, schema.text('Pocket title')),
    nodes['card']!.create(null, [
      nodes['tag']!.create({ id: newHeadingId() }, schema.text('Card tag')),
      nodes['cite_paragraph']!.create(null, [
        schema.text('Smith 24', [marks['cite_mark']!.create()]),
        schema.text(', professor, '),
        schema.text('Title', [marks['italic']!.create()]),
      ]),
      nodes['card_body']!.create(null, [
        schema.text('Plain text plus '),
        schema.text('underlined', [marks['underline_mark']!.create()]),
        schema.text(' and '),
        schema.text('highlighted', [marks['highlight']!.create({ color: 'yellow' })]),
        schema.text(' content.'),
      ]),
    ]),
    nodes['paragraph']!.create(null, schema.text('Loose paragraph after the card.')),
  ]);
}

describe('native format (.cmir)', () => {
  it('exposes the canonical extension', () => {
    expect(NATIVE_FILE_EXTENSION).toBe('cmir');
  });

  it('serializes + parses back to a structurally-equal doc', () => {
    const original = makeSampleDoc();
    const bytes = serializeNative(original);
    const { doc, threads } = parseNative(bytes);
    expect(threads).toEqual([]);
    // Compare via toJSON — PMNode.eq cares about marks too and is
    // the right semantic equality check for round-trip.
    expect(doc.toJSON()).toEqual(original.toJSON());
    expect(doc.eq(original)).toBe(true);
  });

  it('writes gzip-compressed bytes (magic 0x1f 0x8b), smaller than the JSON', () => {
    const original = makeSampleDoc();
    const bytes = serializeNative(original);
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);
    // The compressed payload is well under the uncompressed JSON size.
    const rawJsonLen = JSON.stringify({
      format: 'cardmirror-doc',
      formatVersion: 1,
      createdBy: 'CardMirror',
      createdAt: '',
      doc: original.toJSON(),
    }).length;
    expect(bytes.length).toBeLessThan(rawJsonLen);
  });

  it('still parses a legacy (uncompressed) .cmir file', () => {
    const original = makeSampleDoc();
    // A pre-compression file: the plaintext envelope, exactly as old
    // builds wrote it (pretty-printed, begins with `{`).
    const legacy = new TextEncoder().encode(
      JSON.stringify(
        {
          format: 'cardmirror-doc',
          formatVersion: 1,
          createdBy: 'CardMirror 0.1.0-alpha.12',
          createdAt: '2026-06-01T00:00:00.000Z',
          doc: original.toJSON(),
        },
        null,
        2,
      ),
    );
    expect(legacy[0]).toBe(0x7b); // `{` — not gzip
    const { doc } = parseNative(legacy);
    expect(doc.eq(original)).toBe(true);
  });

  it('preserves heading IDs', () => {
    const original = makeSampleDoc();
    const bytes = serializeNative(original);
    const { doc } = parseNative(bytes);
    const originalIds: string[] = [];
    original.descendants((n) => {
      const id = n.attrs['id'];
      if (typeof id === 'string' && id) originalIds.push(id);
      return true;
    });
    const roundTripped: string[] = [];
    doc.descendants((n) => {
      const id = n.attrs['id'];
      if (typeof id === 'string' && id) roundTripped.push(id);
      return true;
    });
    expect(roundTripped).toEqual(originalIds);
  });

  it('round-trips threads', () => {
    const original = makeSampleDoc();
    const threads: Thread[] = [
      {
        id: 'thread-1',
        comments: [
          {
            id: 'thread-1',
            author: 'Anthony',
            initials: 'AT',
            date: '2026-05-15T20:00:00.000Z',
            text: 'Solid card',
            kind: 'human',
            parentId: null,
          },
          {
            id: 'thread-1-reply',
            author: 'Coach',
            initials: 'C',
            date: '2026-05-15T20:01:00.000Z',
            text: 'Agree',
            kind: 'human',
            parentId: 'thread-1',
          },
        ],
      },
    ];
    const bytes = serializeNative(original, { threads });
    const parsed = parseNative(bytes);
    expect(parsed.threads).toEqual(threads);
  });

  it('preserves AI comment kind through round-trip', () => {
    // The whole point of the native format vs docx: kind: 'ai'
    // survives. Docx export drops it (Word has no concept).
    const original = makeSampleDoc();
    const threads: Thread[] = [
      {
        id: 't-ai',
        comments: [
          {
            id: 't-ai',
            author: 'AI',
            initials: 'AI',
            date: '2026-05-15T20:00:00.000Z',
            text: 'Synthesis comment',
            kind: 'ai',
            parentId: null,
          },
        ],
      },
    ];
    const bytes = serializeNative(original, { threads });
    const parsed = parseNative(bytes);
    expect(parsed.threads[0]!.comments[0]!.kind).toBe('ai');
  });

  it('refuses non-CardMirror JSON', () => {
    const bytes = new TextEncoder().encode('{"hello": "world"}');
    expect(() => parseNative(bytes)).toThrow(/not a cardmirror file/i);
  });

  it('gives an actionable message for an empty read (undownloaded cloud file)', () => {
    // A Dropbox / iCloud "online only" placeholder reads back as 0 bytes; the
    // message must point at the real cause, not "failed to parse JSON".
    expect(() => parseNative(new Uint8Array())).toThrow(/online only|make it available offline/i);
    expect(() => parseNative(new Uint8Array())).not.toThrow(/parse JSON/i);
  });

  it('refuses non-JSON bytes', () => {
    const bytes = new TextEncoder().encode('plain text, no JSON');
    expect(() => parseNative(bytes)).toThrow(/cardmirror/i);
  });

  it('refuses files from a newer format version', () => {
    const payload = JSON.stringify({
      format: 'cardmirror-doc',
      formatVersion: 99,
      createdBy: 'future-cardmirror',
      createdAt: '2999-01-01T00:00:00.000Z',
      doc: { type: 'doc', content: [] },
    });
    const bytes = new TextEncoder().encode(payload);
    expect(() => parseNative(bytes)).toThrow(/newer than this build/i);
  });

  it('looksLikeNative recognizes valid bytes and rejects others', () => {
    const valid = serializeNative(makeSampleDoc());
    expect(looksLikeNative(valid)).toBe(true);
    expect(looksLikeNative(new TextEncoder().encode('plain text'))).toBe(false);
    expect(looksLikeNative(new TextEncoder().encode('{"other": true}'))).toBe(false);
  });

  // ── Journal envelope round-trip ───────────────────────────────
  // Journals store the doc bytes as serializeNative + a small
  // envelope (uid / filename / handle / format / savedAt). The
  // envelope is platform-specific (Electron writes a JSON file,
  // Browser writes to IndexedDB), but the doc-content round-trip
  // via the native format is the same in both. This test covers
  // that critical path.
  it('round-trips a journal-entry-shaped envelope', () => {
    const original = makeSampleDoc();
    const threads: Thread[] = [
      {
        id: 't-journal',
        comments: [
          {
            id: 't-journal',
            author: 'Anthony',
            initials: 'AT',
            date: '2026-05-15T20:00:00.000Z',
            text: 'mid-edit',
            kind: 'human',
            parentId: null,
          },
        ],
      },
    ];
    // Simulate what a host would store: the doc bytes plus the
    // envelope fields the recovery modal reads.
    const bytes = serializeNative(original, { threads });
    const envelope = {
      uid: 'doc-42',
      filename: 'Aff - Climate.cmir',
      handle: '/Users/example/Documents/Aff - Climate.cmir',
      format: 'cmir' as const,
      savedAt: '2026-05-15T20:00:00.000Z',
      bytes,
    };

    // Pretend the envelope went through a JSON round-trip (Electron
    // writes it as a JSON file, Browser stores in IndexedDB which
    // structured-clones — both preserve the Uint8Array bytes).
    const restored = {
      ...envelope,
      bytes: new Uint8Array(envelope.bytes),
    };

    expect(restored.uid).toBe('doc-42');
    expect(restored.filename).toBe('Aff - Climate.cmir');
    expect(restored.handle).toBe('/Users/example/Documents/Aff - Climate.cmir');
    expect(restored.format).toBe('cmir');

    const parsed = parseNative(restored.bytes);
    expect(parsed.doc.eq(original)).toBe(true);
    expect(parsed.threads).toEqual(threads);
  });

  // ── Heading-id stamping at load ────────────────────────────────
  // Old files (pre-alpha.6) can carry tag/analytic/etc. nodes with
  // `id: null` — synthesized by the F2 schema-fitter bubble-up
  // before that path was closed. An id-less heading is invisible to
  // the nav-pane highlight, so `parseNative` stamps a fresh id at
  // load to repair the doc in place.
  it('stamps a fresh id on a heading whose id is null in the file', () => {
    const payload = JSON.stringify({
      format: 'cardmirror-doc',
      formatVersion: 1,
      createdBy: 'cardmirror-test',
      createdAt: '2026-05-30T00:00:00.000Z',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'card',
            content: [
              { type: 'tag', attrs: { id: null }, content: [{ type: 'text', text: 'orphan' }] },
              { type: 'card_body', content: [{ type: 'text', text: 'body' }] },
            ],
          },
        ],
      },
    });
    const bytes = new TextEncoder().encode(payload);
    const { doc } = parseNative(bytes);
    const tag = doc.firstChild!.firstChild!;
    expect(tag.type.name).toBe('tag');
    const id = tag.attrs['id'];
    expect(typeof id).toBe('string');
    expect(id).toMatch(/[0-9a-f-]{30,}/);
  });

  it('leaves existing heading ids alone (round-trip preserves them)', () => {
    const original = makeSampleDoc();
    const bytes = serializeNative(original);
    const { doc } = parseNative(bytes);
    expect(doc.eq(original)).toBe(true);
  });
});

describe('parseNative structural validation (reject-invalid)', () => {
  // A .cmir reaches this parser with one double-click via the OS file
  // association, and nodeFromJSON builds invalid structure of KNOWN types
  // without complaint — so a crafted/corrupted file must fail cleanly at
  // parse, not load broken state (PR #25 review hardening).
  const envelope = (doc: unknown): Uint8Array =>
    new TextEncoder().encode(
      JSON.stringify({ format: 'cardmirror-doc', formatVersion: 1, doc }),
    );

  it('rejects invalid structure of known types (tagless card)', () => {
    const bad = envelope({
      type: 'doc',
      content: [
        {
          type: 'card',
          content: [
            { type: 'card_body', content: [{ type: 'text', text: 'no tag first' }] },
          ],
        },
      ],
    });
    expect(() => parseNative(bad)).toThrow(/damaged/);
  });

  it('rejects a non-doc top-level node', () => {
    const bad = envelope({ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] });
    expect(() => parseNative(bad)).toThrow(/damaged/);
  });

  it('rejects unknown node types with the same clean error shape', () => {
    const bad = envelope({ type: 'doc', content: [{ type: 'totally-made-up' }] });
    expect(() => parseNative(bad)).toThrow(/damaged/);
  });

  it('still accepts every legacy shape the heal passes exist for', () => {
    // A null heading id (alpha.6-era) heals via stampMissingHeadingIds and
    // must keep loading — check() runs AFTER the heals, not instead.
    const legacy = envelope({
      type: 'doc',
      content: [
        {
          type: 'card',
          content: [
            { type: 'tag', attrs: { id: null }, content: [{ type: 'text', text: 'Tag' }] },
            { type: 'card_body', content: [{ type: 'text', text: 'body' }] },
          ],
        },
      ],
    });
    const parsed = parseNative(legacy);
    expect(parsed.doc.firstChild!.firstChild!.attrs['id']).toBeTruthy();
  });
});

describe('healAnalyticUnits (beta.22 field report: empty analytic_unit)', () => {
  // Files written by older builds can carry analytic_units that violate
  // `analytic (card_body | undertag | cite_paragraph | table)*`. beta.17
  // opened them silently; the beta.21 reject-invalid check refused the
  // whole file ("Invalid content for node analytic_unit: <>"). Known
  // legacy shapes heal losslessly; check() still guards everything else.
  const envelope = (doc: unknown): Uint8Array =>
    new TextEncoder().encode(
      JSON.stringify({ format: 'cardmirror-doc', formatVersion: 1, doc }),
    );
  const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
  const analytic = (text: string) => ({
    type: 'analytic',
    attrs: { id: 'a-1' },
    content: [{ type: 'text', text }],
  });
  const body = (text: string) => ({ type: 'card_body', content: [{ type: 'text', text }] });

  it('drops a completely empty analytic_unit (the reported file shape)', () => {
    const file = envelope({
      type: 'doc',
      content: [para('before'), { type: 'analytic_unit', content: [] }, para('after')],
    });
    const { doc } = parseNative(file);
    expect(doc.childCount).toBe(2);
    expect(doc.textContent).toBe('beforeafter');
  });

  it('floats headless-unit children up to the parent level', () => {
    const file = envelope({
      type: 'doc',
      content: [{ type: 'analytic_unit', content: [body('stranded body')] }],
    });
    const { doc } = parseNative(file);
    expect(doc.firstChild!.type.name).toBe('card_body');
    expect(doc.textContent).toBe('stranded body');
  });

  it('re-heads a mid-tail analytic into its own unit', () => {
    const file = envelope({
      type: 'doc',
      content: [
        {
          type: 'analytic_unit',
          content: [body('floats up'), analytic('the head'), body('absorbed')],
        },
      ],
    });
    const { doc } = parseNative(file);
    expect(doc.childCount).toBe(2);
    expect(doc.child(0).type.name).toBe('card_body');
    const unit = doc.child(1);
    expect(unit.type.name).toBe('analytic_unit');
    expect(unit.childCount).toBe(2);
    expect(unit.firstChild!.type.name).toBe('analytic');
    expect(doc.textContent).toBe('floats upthe headabsorbed');
  });

  it('heals an empty unit inside a live zone too', () => {
    const file = envelope({
      type: 'doc',
      content: [
        {
          type: 'transclusion_ref',
          attrs: { src: 'x.cmir', base: 'doc' },
          content: [para('zone text'), { type: 'analytic_unit', content: [] }],
        },
      ],
    });
    const { doc } = parseNative(file);
    const zone = doc.firstChild!;
    expect(zone.type.name).toBe('transclusion_ref');
    expect(zone.childCount).toBe(1);
    expect(zone.textContent).toBe('zone text');
  });

  it('leaves a well-formed analytic_unit byte-identical', () => {
    const file = envelope({
      type: 'doc',
      content: [{ type: 'analytic_unit', content: [analytic('fine'), body('tail')] }],
    });
    const { doc } = parseNative(file);
    expect(doc.firstChild!.type.name).toBe('analytic_unit');
    expect(doc.firstChild!.childCount).toBe(2);
  });
});
