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

## MCP server mode (for AI assistants with MCP support)

If your assistant supports the Model Context Protocol, point it at
this file as a local (stdio) MCP server and it can browse and read
your debate files **on demand** — no pre-converted copies:

```sh
node cardmirror-read.cjs --mcp --root "$HOME/Dropbox/Debate"
```

Typical client configuration (the JSON shape most MCP clients use):

```json
{
  "mcpServers": {
    "cardmirror-read": {
      "command": "node",
      "args": [
        "/absolute/path/to/cardmirror-read.cjs",
        "--mcp",
        "--root", "/Users/you/Dropbox/Debate"
      ]
    }
  }
}
```

**If your assistant's custom-MCP setup asks for a URL instead of a
command** (some only take URLs), run the HTTP variant and paste the
URL it prints:

```sh
node cardmirror-read.cjs --mcp-http --root "$HOME/Dropbox/Debate"
# → cardmirror-read MCP server listening on http://127.0.0.1:3323/mcp
```

(`--port N` to change the port. The server must be left running for
the assistant to reach it — see the launchd template below to make it
start at login.) It binds to 127.0.0.1 only — it is never reachable
from your network — and browser-origin requests are rejected.

Either way, the server exposes two tools — `list_debate_files` (with
an optional substring filter) and `read_debate_file` (text or JSON
form) — and it only ever reads inside the `--root` folders you
configured: requests for anything outside them (including via
symlinks or `..`) are refused. `--root` is repeatable. Large results
are capped so a single file can't blow out the assistant's context.

## Mirror mode (for assistants that can only read files)

If your assistant can't run MCP servers but can read a folder (say,
through a Dropbox integration), mirror mode maintains an
always-current plain-text shadow of your files:

```sh
node cardmirror-read.cjs \
  --mirror ~/Dropbox/Debate/Backfiles \
  --mirror ~/Dropbox/Debate/2026-2027 \
  --out-dir ~/Dropbox/Debate\ Text\ Exports
```

It sweeps once (skipping anything already current), then watches for
changes: new and edited `.cmir`/`.docx` files re-render within a couple
of seconds, and shadows of deleted files are removed. With several
`--mirror` folders, each mirrors into its own subfolder of the
out-dir. Point it at the specific folders you want readable — not the
whole Dropbox.

To keep a long-running mode (`--mirror` or `--mcp-http`) running
across logins on macOS, save this as
`~/Library/LaunchAgents/com.cardmirror.read-mirror.plist` (adjust the
three paths), then `launchctl load` it:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.cardmirror.read-mirror</string>
  <key>ProgramArguments</key><array>
    <string>/usr/local/bin/node</string>
    <string>/Users/you/cardmirror-read.cjs</string>
    <string>--mirror</string><string>/Users/you/Dropbox/Debate</string>
    <string>--out-dir</string><string>/Users/you/Dropbox/Debate Text Exports</string>
    <!-- for the MCP URL server instead, replace the two lines above with:
    <string>--mcp-http</string>
    <string>--root</string><string>/Users/you/Dropbox/Debate</string> -->
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/cardmirror-read-mirror.log</string>
  <key>StandardErrorPath</key><string>/tmp/cardmirror-read-mirror.log</string>
</dict></plist>
```

(`which node` tells you the right node path for the first entry.)

## Rebuilding from source

From the CardMirror repo root:

```sh
npm run build:readtool
```

which bundles `src/tools/cardmirror-read-cli.ts` into this directory's
`cardmirror-read.cjs`.
