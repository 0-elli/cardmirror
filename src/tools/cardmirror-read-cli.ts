/**
 * cardmirror-read — CLI entry.
 *
 * A tiny utility an AI assistant (or anyone) can run to get a
 * temporary, read-only, machine-readable copy of a CardMirror `.cmir`
 * or Word `.docx` file — without the app, without a display, without
 * write access to the original.
 *
 *   node cardmirror-read.cjs <file> [--form text|json] [--stdout] [--out PATH]
 *
 *   --form text   (default) markdown-flavored plain text
 *   --form json   uncompressed CardMirror JSON envelope (full fidelity)
 *   --stdout      print the content instead of writing a temp file
 *   --out PATH    write to PATH instead of a temp file
 *
 * Default behavior prints exactly ONE line to stdout: the absolute
 * path of the freshly written read-only temp file — trivially
 * consumable by an agent. Errors go to stderr with exit code 1.
 */

import { readFileSync, writeFileSync, mkdtempSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { looksLikeNative, NativeDamagedError } from '../native/index.js';
import {
  toUncompressedJson,
  parseToDoc,
  renderPlainText,
  type ReadForm,
  type FileKind,
} from './cardmirror-read-lib.js';

function fail(msg: string): never {
  process.stderr.write(`cardmirror-read: ${msg}\n`);
  process.exit(1);
}

function usage(): never {
  process.stderr.write(
    'Usage: cardmirror-read <file.cmir|file.docx> [--form text|json] [--stdout] [--out PATH]\n',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let file: string | null = null;
  let form: ReadForm = 'text';
  let stdout = false;
  let outPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--form') {
      const v = args[++i];
      if (v !== 'text' && v !== 'json') fail(`--form must be "text" or "json", got "${v}"`);
      form = v;
    } else if (a === '--stdout') stdout = true;
    else if (a === '--out') {
      outPath = args[++i] ?? null;
      if (!outPath) fail('--out needs a path');
    } else if (a === '--help' || a === '-h') usage();
    else if (a.startsWith('--')) fail(`unknown flag ${a}`);
    else if (file) fail('only one input file is supported');
    else file = a;
  }
  if (!file) usage();

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(resolve(file)));
  } catch (err) {
    fail(`can't read "${file}": ${err instanceof Error ? err.message : err}`);
  }

  const ext = extname(file).toLowerCase();
  const kind: FileKind =
    ext === '.docx' ? 'docx' : ext === '.cmir' || looksLikeNative(bytes) ? 'cmir' : (fail(
      `unsupported file type "${ext || '(none)'}" — expected .cmir or .docx`,
    ) as never);

  let content: string;
  try {
    if (form === 'json') {
      content = await toUncompressedJson(bytes, kind);
    } else {
      const doc = await parseToDoc(bytes, kind);
      content = renderPlainText(doc, basename(file));
    }
  } catch (err) {
    if (err instanceof NativeDamagedError) {
      fail(
        `this .cmir is damaged beyond the automatic repairs (${err.message}); ` +
          `try --form json for the raw (uncompressed) envelope`,
      );
    }
    fail(`couldn't convert "${file}": ${err instanceof Error ? err.message : err}`);
  }

  if (stdout) {
    process.stdout.write(content);
    return;
  }

  const target =
    outPath ??
    join(
      mkdtempSync(join(tmpdir(), 'cardmirror-read-')),
      `${basename(file, extname(file))}.${form === 'json' ? 'json' : 'txt'}`,
    );
  writeFileSync(target, content);
  // Read-only: this is a disposable VIEW of the document, never a
  // thing to edit (edits would be silently lost — the original file
  // is untouched by design).
  chmodSync(target, 0o444);
  process.stdout.write(resolve(target) + '\n');
}

void main();
