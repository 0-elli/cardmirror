/**
 * Every referenced icon class must have a mask definition.
 *
 * The icon system paints `background-color: currentColor` through
 * `mask: var(--pmd-icon)`; a class with no `--pmd-icon` definition
 * doesn't render "no icon" — it renders a SOLID SQUARE (the mask
 * property fails, the box paints unmasked). Field bug 2026-07-27: the
 * web GitHub button shipped as a black square from beta.22 on, because
 * its hand-added rule in the GENERATED icons.css was silently dropped
 * by the next `gen-icons.mjs` regeneration.
 *
 * TS-side uses go through the typed `icon()`/`setIcon()` helpers, but
 * raw-HTML classes (index.html) and hand-built className strings are
 * unchecked — this test closes that gap by scanning every referenced
 * `pmd-icon-<name>` literal against the union of definitions in
 * icons.css (generated) and style.css (hand-maintained extras).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** All .ts files under src/, recursively. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${ent.name}`;
    if (ent.isDirectory()) out.push(...tsFiles(rel));
    else if (ent.isFile() && ent.name.endsWith('.ts')) out.push(rel);
  }
  return out;
}

/** Icon names with a `--pmd-icon` mask defined for `.pmd-icon-<name>`. */
function definedIcons(): Set<string> {
  const defined = new Set<string>();
  for (const css of [read('src/editor/icons.css'), read('src/editor/style.css')]) {
    for (const m of css.matchAll(/\.pmd-icon-([a-z0-9-]+)[^{]*\{[^}]*--pmd-icon\s*:/g)) {
      defined.add(m[1]!);
    }
  }
  return defined;
}

/** Icon names referenced as literal `pmd-icon-<name>` classes. */
function referencedIcons(): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  const sources = ['index.html', ...tsFiles('src')];
  for (const rel of sources) {
    const text = read(rel);
    for (const m of text.matchAll(/pmd-icon-([a-z0-9][a-z0-9-]*)/g)) {
      const name = m[1]!;
      const at = refs.get(name) ?? [];
      at.push(rel);
      refs.set(name, at);
    }
  }
  return refs;
}

describe('icon mask coverage', () => {
  it('every referenced pmd-icon-<name> class has a --pmd-icon definition', () => {
    const defined = definedIcons();
    const missing = [...referencedIcons()]
      .filter(([name]) => !defined.has(name))
      .map(([name, files]) => `${name} (used in ${[...new Set(files)].join(', ')})`);
    expect(missing).toEqual([]);
  });

  it('the web GitHub button icon is defined (the beta.22 regression)', () => {
    expect(definedIcons().has('github')).toBe(true);
  });
});
