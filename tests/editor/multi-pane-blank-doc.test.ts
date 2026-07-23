/**
 * Three-pane New must produce the same blank as single-pane New: exactly
 * one empty paragraph. Regression for the undocumented pocket("Untitled")
 * that the shell's blank used to seed — it duplicated the pane chip's
 * name, diverged from single-pane, and broke the speech-doc pocket-OFF
 * branch (whose cursor math and setting description both assume a
 * one-paragraph doc). Both modes now share this one builder, so the
 * shapes cannot drift.
 */
import { describe, expect, it } from 'vitest';
import { makeBlankDoc } from '../../src/editor/blank-doc.js';

describe('makeBlankDoc (three-pane New)', () => {
  it('is exactly one empty paragraph — no seeded headings', () => {
    const doc = makeBlankDoc();
    expect(doc.childCount).toBe(1);
    expect(doc.firstChild!.type.name).toBe('paragraph');
    expect(doc.firstChild!.content.size).toBe(0);
    expect(doc.textContent).toBe('');
  });
});
