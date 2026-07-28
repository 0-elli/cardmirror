# cardmirror-read

A tiny, single-file command-line tool that turns a CardMirror `.cmir`
file — or a Word `.docx` — into a **temporary, read-only** copy that
anything can read: AI assistants, screen-reader pipelines, scripts,
or plain curiosity. The original file is never touched.

It reuses CardMirror's real parsers, so what it reads is exactly what
the editor reads (including the automatic repairs for lightly damaged
files).

## Get it

One file, no install, no dependencies beyond [Node.js](https://nodejs.org) 18+:

```sh
curl -fsSL -o cardmirror-read.cjs \
  https://raw.githubusercontent.com/ant981228/cardmirror/main/packaging/cardmirror-read/cardmirror-read.cjs
```

## Use it

```sh
node cardmirror-read.cjs "My File.cmir"
# → prints one line: the path of a fresh read-only .txt rendering

node cardmirror-read.cjs "My File.docx" --form json
# → same, but the full-fidelity uncompressed CardMirror JSON

node cardmirror-read.cjs "My File.cmir" --stdout        # print instead of writing
node cardmirror-read.cjs "My File.cmir" --out notes.txt # choose the destination
```

Two forms:

- **`--form text`** (default) — a markdown-flavored plain-text
  rendering: `#`/`##`/`###` for Pocket/Hat/Block, `####` for tags,
  `Cite:` lines for citations, and the debate layers kept legible —
  `==highlighted==` (read aloud), `__underlined__`, `*emphasis*`.
  This is the form to hand an AI assistant: small and self-describing
  (a header at the top explains the notation).
- **`--form json`** — the uncompressed CardMirror document envelope,
  pretty-printed. Full fidelity (every attribute, mark, and comment
  thread), works even on files the editor refuses as damaged, and for
  `.docx` inputs it is exactly what "Save As `.cmir`" would produce.
  Note: this can be *large* — a big backfile's pretty-printed JSON can
  run to tens of megabytes. Prefer `text` for reading.

Notes for AI assistants:

- The default output is exactly one stdout line — the absolute path of
  the temp file — so you can run the tool and read the file it names.
- The temp copy is `chmod 444` on purpose: it is a disposable view.
  Editing it does nothing to the real document.
- Errors go to stderr with exit code 1 (unsupported type,
  password-protected `.docx`, a `.cmir` damaged beyond repair — the
  last still works with `--form json`).

## Rebuilding from source

From the CardMirror repo root:

```sh
npm run build:readtool
```

which bundles `src/tools/cardmirror-read-cli.ts` into this directory's
`cardmirror-read.cjs`.
