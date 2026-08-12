import { describe, it, expect } from 'vitest';
import {
  cleanedRel,
  cleanOverwritesInPlace,
  matchesOverwriteConfirmPhrase,
  OVERWRITE_CONFIRM_PHRASE,
} from '../../src/editor/clean-ui.js';

describe('cleanedRel', () => {
  it('prefixes a bare filename with cleaned_', () => {
    expect(cleanedRel('Cards.docx')).toBe('cleaned_Cards.docx');
  });
  it('prefixes the BASENAME, preserving the subdirectory path', () => {
    expect(cleanedRel('Aff/Case/Cards.docx')).toBe('Aff/Case/cleaned_Cards.docx');
  });
  it('normalizes backslashes to forward slashes', () => {
    expect(cleanedRel('Aff\\Case\\Cards.docx')).toBe('Aff/Case/cleaned_Cards.docx');
  });
  it('handles a deeply nested path', () => {
    expect(cleanedRel('a/b/c/d.docx')).toBe('a/b/c/cleaned_d.docx');
  });
});

describe('cleanOverwritesInPlace', () => {
  // Prepending always writes NEW files, so it can never overwrite — regardless
  // of destination.
  it('is false whenever prepend is on', () => {
    for (const outputDir of [null, '/lib', '/out']) {
      expect(
        cleanOverwritesInPlace({ prepend: true, inputKind: 'folder', inputPath: '/lib', outputDir }),
      ).toBe(false);
    }
    expect(
      cleanOverwritesInPlace({
        prepend: true,
        inputKind: 'file',
        inputPath: '/lib/a.docx',
        outputDir: null,
      }),
    ).toBe(false);
  });

  describe('folder input, no prepend', () => {
    it('default (null) destination → overwrite (writes into the source folder)', () => {
      expect(
        cleanOverwritesInPlace({
          prepend: false,
          inputKind: 'folder',
          inputPath: '/lib',
          outputDir: null,
        }),
      ).toBe(true);
    });
    it('destination equal to the source folder → overwrite', () => {
      expect(
        cleanOverwritesInPlace({
          prepend: false,
          inputKind: 'folder',
          inputPath: '/lib',
          outputDir: '/lib',
        }),
      ).toBe(true);
    });
    it('a trailing-slash difference still counts as the same folder', () => {
      expect(
        cleanOverwritesInPlace({
          prepend: false,
          inputKind: 'folder',
          inputPath: '/lib',
          outputDir: '/lib/',
        }),
      ).toBe(true);
    });
    it('a DIFFERENT destination → not an overwrite', () => {
      expect(
        cleanOverwritesInPlace({
          prepend: false,
          inputKind: 'folder',
          inputPath: '/lib',
          outputDir: '/out',
        }),
      ).toBe(false);
    });
  });

  describe('file input, no prepend', () => {
    // The "source folder" is the file's containing directory.
    it('default (null) destination → overwrite (writes next to the original)', () => {
      expect(
        cleanOverwritesInPlace({
          prepend: false,
          inputKind: 'file',
          inputPath: '/lib/a.docx',
          outputDir: null,
        }),
      ).toBe(true);
    });
    it("destination equal to the file's own folder → overwrite", () => {
      expect(
        cleanOverwritesInPlace({
          prepend: false,
          inputKind: 'file',
          inputPath: '/lib/a.docx',
          outputDir: '/lib',
        }),
      ).toBe(true);
    });
    it('a different destination folder → not an overwrite', () => {
      expect(
        cleanOverwritesInPlace({
          prepend: false,
          inputKind: 'file',
          inputPath: '/lib/a.docx',
          outputDir: '/out',
        }),
      ).toBe(false);
    });
  });
});

describe('matchesOverwriteConfirmPhrase', () => {
  // The dialog's instruction label is uppercased by CSS, so the phrase the
  // user READS is all-caps while the constant is sentence case. Matching
  // exactly meant typing what the screen showed left "Confirm Overwrite"
  // permanently disabled with nothing on screen explaining why.
  it('accepts the phrase as the dialog visually presents it', () => {
    expect(matchesOverwriteConfirmPhrase('I ACCEPT THE RISK')).toBe(true);
  });

  it('accepts the phrase as written in the constant and placeholder', () => {
    expect(matchesOverwriteConfirmPhrase(OVERWRITE_CONFIRM_PHRASE)).toBe(true);
  });

  it('ignores casing, surrounding space, and doubled inner spaces', () => {
    expect(matchesOverwriteConfirmPhrase('i accept the risk')).toBe(true);
    expect(matchesOverwriteConfirmPhrase('  I Accept The Risk  ')).toBe(true);
    expect(matchesOverwriteConfirmPhrase('I  accept   the risk')).toBe(true);
  });

  it('still refuses anything that is not the phrase', () => {
    expect(matchesOverwriteConfirmPhrase('')).toBe(false);
    expect(matchesOverwriteConfirmPhrase('I accept')).toBe(false);
    expect(matchesOverwriteConfirmPhrase('I accept the risks')).toBe(false);
    expect(matchesOverwriteConfirmPhrase('yes')).toBe(false);
    expect(matchesOverwriteConfirmPhrase('Iaccepttherisk')).toBe(false);
  });
});
