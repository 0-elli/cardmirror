/**
 * Direct Loro-tree manipulation helpers for the hollow-container
 * suites: reach into a peer's CRDT and produce the merged shapes the
 * schema can't represent (headless containers, duplicate heads) —
 * simulating concurrent-merge outcomes without depending on any
 * particular PM-level interleaving to produce them. Prefixed `_` so
 * the vitest glob skips it.
 */

import { LoroDoc, LoroMap, LoroList, LoroText } from 'loro-crdt';

/**
 * Build a sabotage blob: fork the given exported state, mutate the fork
 * directly, and return the fork's full update. Import the blob into
 * peers to deliver the invalid shape as a genuine REMOTE update — the
 * realistic arrival path. (Mutating a live peer's own ldoc out-of-band
 * leaves that peer's display refresh at the mercy of event timing —
 * an artifact no real client can produce, and a flake source.)
 */
export function sabotageBlob(
  source: Uint8Array,
  mutate: (fork: LoroDoc) => void,
): Uint8Array {
  const fork = new LoroDoc();
  fork.import(source);
  mutate(fork);
  fork.commit();
  return fork.export({ mode: 'update' });
}

/** Depth-first search for node containers in the Loro tree. */
export function findContainers(
  ldoc: LoroDoc,
  pred: (m: LoroMap) => boolean,
): LoroMap[] {
  const out: LoroMap[] = [];
  const stack: LoroMap[] = [ldoc.getMap('doc') as unknown as LoroMap];
  while (stack.length) {
    const m = stack.pop()!;
    if (pred(m)) out.push(m);
    const kids = m.get('children');
    if (kids instanceof LoroList) {
      for (let i = 0; i < kids.length; i++) {
        const c = kids.get(i);
        if (c instanceof LoroMap) stack.push(c);
      }
    }
  }
  return out;
}

/** The container for the node whose head text contains `headText`
 *  (tag/analytic child's text), else the first container of `name`. */
export function containerOf(
  ldoc: LoroDoc,
  name: 'card' | 'analytic_unit',
  headText?: string,
): LoroMap {
  const all = findContainers(ldoc, (x) => x.get('nodeName') === name);
  if (!headText) {
    if (!all.length) throw new Error(`no ${name} container`);
    return all[0]!;
  }
  for (const m of all) {
    const kids = m.get('children');
    if (!(kids instanceof LoroList)) continue;
    for (let i = 0; i < kids.length; i++) {
      const c = kids.get(i);
      if (c instanceof LoroMap && headTextOf(c).includes(headText)) return m;
    }
  }
  throw new Error(`no ${name} with head text "${headText}"`);
}

function headTextOf(m: LoroMap): string {
  const kids = m.get('children');
  if (!(kids instanceof LoroList)) return '';
  let text = '';
  for (let i = 0; i < kids.length; i++) {
    const c = kids.get(i);
    if (c instanceof LoroText) text += c.toString();
  }
  return text;
}

/** Delete children of `container` by node name ('*' = all). Commits. */
export function hollowContainer(
  ldoc: LoroDoc,
  container: LoroMap,
  which: 'tag' | 'analytic' | '*',
): void {
  const kids = container.get('children') as LoroList;
  for (let i = kids.length - 1; i >= 0; i--) {
    const c = kids.get(i);
    if (!(c instanceof LoroMap)) continue;
    if (which === '*' || c.get('nodeName') === which) kids.delete(i, 1);
  }
  ldoc.commit();
}

/** Insert a duplicate head element into `container`'s children — the
 *  shape concurrent blank-head write-backs merge into. Non-empty
 *  `text` models a duplicate that somehow carries typed content. */
export function insertDuplicateHead(
  ldoc: LoroDoc,
  container: LoroMap,
  headName: 'tag' | 'analytic',
  index: number,
  id: string,
  text = '',
): void {
  const kids = container.get('children') as LoroList;
  const m = kids.insertContainer(Math.min(index, kids.length), new LoroMap());
  m.set('nodeName', headName);
  const attrs = m.setContainer('attributes', new LoroMap());
  attrs.set('id', id);
  const inner = m.setContainer('children', new LoroList());
  if (text) {
    const t = inner.insertContainer(0, new LoroText());
    t.insert(0, text);
  }
  ldoc.commit();
}
