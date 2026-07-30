/**
 * File-index service core (2026-07-30) — the out-of-process owner of the
 * palette's file index + search. Exercised against real temp dirs: scan
 * discovery, windowed ranked queries (shared matcher), exclusion/format
 * filters, pin flag/partition split, prune-on-configure, change
 * notifications on revalidation, and disk persistence round-trips.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fsp from 'node:fs/promises';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createFileIndexCore, type FileIndexQuery } from '../../apps/desktop/src/file-index-core.js';

let tmp: string;
let dataDir: string;
let rootA: string;
let changed: string[];

function write(p: string, content = 'x'): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function makeCore() {
  // revalidateDelayMs 0: tests flush revalidation via idle(), never by
  // waiting out the production launch-burst delay.
  return createFileIndexCore({
    dataDir,
    onChanged: (root) => changed.push(root),
    revalidateDelayMs: 0,
  });
}

function q(over: Partial<FileIndexQuery> = {}): FileIndexQuery {
  return {
    query: '',
    roots: [rootA],
    exclusions: [],
    formats: 'both',
    tiebreak: 'alphabetical',
    pins: [],
    partitionPins: true,
    limit: 50,
    ...over,
  };
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fdx-'));
  dataDir = path.join(tmp, 'data');
  fs.mkdirSync(dataDir);
  rootA = path.join(tmp, 'rootA');
  write(path.join(rootA, 'Warming Aff.cmir'));
  write(path.join(rootA, 'Neg', 'Warming Neg.docx'));
  write(path.join(rootA, 'Neg', '~$Warming Neg.docx')); // Word lock file — skipped
  write(path.join(rootA, 'notes.txt')); // not openable — skipped
  changed = [];
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('file-index core', () => {
  it('scans a cold root, notifies, and answers ranked queries', async () => {
    const core = makeCore();
    await core.configure([rootA]);
    await core.idle();
    expect(changed).toEqual([rootA]);

    const res = await core.query(q());
    expect(res.total).toBe(2);
    expect(res.rows.map((r) => r.name)).toEqual(['Warming Aff', 'Warming Neg']);
    expect(res.rows[0]!.relPath).toBe('Warming Aff.cmir');
  });

  it('windows the ranked list and reports the full total', async () => {
    const core = makeCore();
    await core.configure([rootA]);
    await core.idle();
    const res = await core.query(q({ limit: 1 }));
    expect(res.rows).toHaveLength(1);
    expect(res.total).toBe(2);
  });

  it('filters exclusions and formats service-side', async () => {
    const core = makeCore();
    await core.configure([rootA]);
    await core.idle();
    const excluded = await core.query(q({ exclusions: [path.join(rootA, 'Neg')] }));
    expect(excluded.rows.map((r) => r.name)).toEqual(['Warming Aff']);
    const docxOnly = await core.query(q({ formats: 'docx' }));
    expect(docxOnly.rows.map((r) => r.name)).toEqual(['Warming Neg']);
  });

  it('flags pins always; partitions only when asked', async () => {
    const core = makeCore();
    await core.configure([rootA]);
    await core.idle();
    const pin = path.join(rootA, 'Neg', 'Warming Neg.docx');
    const partitioned = await core.query(q({ pins: [pin] }));
    expect(partitioned.rows.map((r) => r.name)).toEqual(['Warming Neg', 'Warming Aff']);
    expect(partitioned.rows[0]!.pinned).toBe(true);
    const flat = await core.query(q({ pins: [pin], partitionPins: false }));
    expect(flat.rows.map((r) => r.name)).toEqual(['Warming Aff', 'Warming Neg']);
    expect(flat.rows[1]!.pinned).toBe(true);
  });

  it('entriesForPaths serves pin mtimes, omitting excluded paths', async () => {
    const core = makeCore();
    await core.configure([rootA]);
    await core.idle();
    const aff = path.join(rootA, 'Warming Aff.cmir');
    const neg = path.join(rootA, 'Neg', 'Warming Neg.docx');
    const all = await core.entriesForPaths({ paths: [aff, neg], roots: [rootA], exclusions: [] });
    expect(all.map((e) => e.path).sort()).toEqual([aff, neg].sort());
    const excl = await core.entriesForPaths({
      paths: [aff, neg],
      roots: [rootA],
      exclusions: [path.join(rootA, 'Neg')],
    });
    expect(excl.map((e) => e.path)).toEqual([aff]);
  });

  it('persists to disk and a fresh core answers without a rescan', async () => {
    const core = makeCore();
    await core.configure([rootA]);
    await core.idle();

    const reborn = makeCore();
    // No configure: a pure query must be answerable from the disk index.
    const res = await reborn.query(q());
    expect(res.total).toBe(2);
  });

  it('configure prunes departed roots from memory AND disk', async () => {
    const core = makeCore();
    await core.configure([rootA]);
    await core.idle();
    await core.configure([]); // root removed from settings
    await core.idle();

    const reborn = makeCore();
    const res = await reborn.query(q());
    expect(res.total).toBe(0);
    const onDisk = JSON.parse(
      await fsp.readFile(path.join(dataDir, 'cmir-file-index.json'), 'utf8'),
    ) as { roots: Record<string, unknown[]> };
    expect(Object.keys(onDisk.roots)).toEqual([]);
  });

  it('revalidation notices new files and notifies again', async () => {
    const core = makeCore();
    await core.configure([rootA]);
    await core.idle();
    changed = [];

    write(path.join(rootA, 'Fresh Add.cmir'));
    await core.configure([rootA]); // the palette-open cadence
    await core.idle();
    expect(changed).toEqual([rootA]);
    const res = await core.query(q());
    expect(res.total).toBe(3);
  });
});
