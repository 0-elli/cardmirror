/**
 * EPIPE-proof stdio for the main process.
 *
 * On Linux the app's stdout/stderr are often pipes owned by whatever
 * launched it (a terminal since closed, a wrapper script, a desktop
 * shell). When the far end goes away, ANY console.log/error in the
 * main process — including Electron's own internal logging, e.g.
 * `replyWithError`'s console.error when an ipcMain.handle rejects —
 * raises EPIPE as an UNCAUGHT exception and pops the "A JavaScript
 * error occurred in the main process" dialog. Field report 2026-08-06
 * (Ethan, Linux + rclone): every refused save produced the EPIPE
 * dialog instead of the intended save-conflict prompt, masking the
 * real error entirely.
 *
 * A single 'error' listener consumes the stream error event, so
 * logging becomes best-effort: if stdio is writable it writes, if not
 * the app simply doesn't log there. An unwritable log stream must
 * never crash the app. (Same guard the cardmirror-read CLI ships for
 * piped stdout.)
 */

/** Attach the swallow-everything error listener to one stream.
 *  Exported for tests. */
export function swallowStreamErrors(stream: NodeJS.EventEmitter): void {
  stream.on('error', () => {
    /* logging is best-effort; see module comment */
  });
}

/** Call once, before anything can log. */
export function hardenStdio(): void {
  swallowStreamErrors(process.stdout);
  swallowStreamErrors(process.stderr);
}
