/**
 * Headless docx -> CardMirror-envelope CLI for the Scouting Assistant
 * doc viewer. Reads .docx bytes on stdin, writes minified envelope
 * JSON on stdout. Bundled with esbuild into a single Node-runnable
 * file vendored into the scouting repo (backend/vendor/) — rebuild:
 *   npx esbuild scripts/scouting-docx-import-cli.ts --bundle \
 *     --platform=node --target=node18 --format=cjs \
 *     --outfile=<scouting>/backend/vendor/cmir_import_cli.js
 */
import { fromDocxFull } from '../src/import/index.js';

const chunks: Buffer[] = [];
process.stdin.on('data', (c) => chunks.push(c as Buffer));
process.stdin.on('end', async () => {
  try {
    const bytes = new Uint8Array(Buffer.concat(chunks));
    const { doc, threads } = await fromDocxFull(bytes);
    const envelope = {
      format: 'cardmirror-doc',
      formatVersion: 1,
      createdBy: 'scouting-assistant cardmirror-importer',
      createdAt: new Date().toISOString(),
      doc: doc.toJSON(),
      threads,
    };
    process.stdout.write(JSON.stringify(envelope));
  } catch (e: any) {
    process.stderr.write(String(e?.stack || e));
    process.exit(1);
  }
});
