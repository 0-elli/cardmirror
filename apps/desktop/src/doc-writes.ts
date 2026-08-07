/**
 * Document write pipeline — the hardened disk layer under every save.
 *
 * All four document-writing IPC handlers (`host:save-existing`,
 * `host:save-as`, `host:save-send-doc`, `host:write-file-at-path`)
 * route through here, which adds three protections a bare
 * `fs.writeFile` lacks:
 *
 *  1. EXISTENCE CHECK (in-place saves only): a save to a path whose
 *     file was renamed or deleted in Finder/Explorer used to silently
 *     recreate the file at the stale path — forking the document.
 *     `saveExistingDoc` stats first, so the miss surfaces as ENOENT
 *     and the renderer's "file location not found → Save As" rescue
 *     flow takes over.
 *
 *  2. CHANGED-ON-DISK GUARD (in-place saves only): we remember each
 *     document's on-disk mtime+size after every read and write. If the
 *     file changed underneath us — another machine editing through a
 *     synced Dropbox folder is the field case; Dropbox will NOT mint a
 *     "conflicted copy" when the remote version already synced down
 *     before our write — the save is refused with an EMODIFIED-marked
 *     error so the renderer can ask overwrite / Save As / cancel.
 *     Unknown paths (nothing recorded) skip the check: a doc restored
 *     from a journal after a restart behaves exactly as before.
 *
 *  3. ATOMIC WRITES + PER-PATH SERIALIZATION (all doc writes): bytes
 *     stage into a hidden sibling `.cmtmp` file, then rename over the
 *     real path — a crash mid-write can never leave a half-written
 *     document (same pattern as the crash-recovery journals). The
 *     atomicity is best-effort, not absolute: when the rename stays
 *     blocked by another process's hold on the target (a Dropbox
 *     upload on Windows can hold for many seconds), the write falls
 *     back to a plain in-place overwrite rather than failing the save
 *     — the Word model: safety when the filesystem cooperates,
 *     functionality always. Writes to the same path chain onto each
 *     other, so a manual ⌘S landing while an autosave write is still
 *     in flight can't interleave (see the kernel-race note above
 *     `host:write-journal` in main.ts).
 *
 * The state map is keyed by resolved path and shared across windows —
 * which matches the cross-window duplicate-open guard's invariant that
 * a document is open in at most one window. It deliberately tracks
 * "what CardMirror last saw on disk", not per-editing-session identity:
 * an in-app write to a path (send-doc export, bulk convert) refreshes
 * the entry, so only writes by OTHER programs trip the guard.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/** Marker embedded in the changed-on-disk error MESSAGE — the renderer
 *  classifies IPC failures by message text (Electron only preserves the
 *  message across the IPC boundary), same as its existing ENOENT check.
 *  Mirrored by `isFileChangedOnDiskError` in src/editor/error-surface.ts. */
export const CHANGED_ON_DISK_MARKER = 'EMODIFIED';

/** Marker for "the target file is transiently locked by another
 *  process" rename failures (same message-marker convention as
 *  EMODIFIED). Mirrored by `fileLockedMessage` in
 *  src/editor/error-surface.ts. */
export const FILE_LOCKED_MARKER = 'ELOCKED';

/** Windows refuses to rename over a file another process holds open
 *  (POSIX doesn't care) — and Dropbox/antivirus grab a freshly-saved
 *  file within milliseconds to sync/scan it. Field report 2026-07-16
 *  (Max U., Windows + Dropbox): two saves seconds apart — the second
 *  save's rename hit Dropbox's upload handle on the FIRST save's
 *  output → EPERM. Scanner holds are sub-second, so this backoff
 *  (~1.5s) absorbs nearly all of them and keeps the write atomic; a
 *  hold that outlives it (a Dropbox upload of a large doc on a slow
 *  uplink runs many seconds) routes to the in-place fallback in
 *  `writeAtomic` instead of failing the save. */
const RENAME_RETRY_DELAYS_MS = [50, 100, 200, 400, 800];

function isTransientRenameCode(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY';
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface DiskState {
  mtimeMs: number;
  size: number;
  /** sha256 of the bytes CardMirror last read from / wrote to the
   *  path, when the caller had them in hand. Lets the changed-on-disk
   *  guard distinguish metadata churn from real edits: cloud sync
   *  layers rewrite mtimes without touching content — rclone mounts
   *  restat after upload finalization, Dropbox touches timestamps
   *  during sync (field report 2026-08-06, Ethan, Linux + rclone:
   *  every second save refused as changed-on-disk with only
   *  CardMirror writing). */
  contentHash?: string;
}

function hashOf(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** Last-seen on-disk identity per resolved path. Populated by
 *  `recordDiskStateFromDisk` (after document reads) and by the two
 *  writers below (after their writes). Entries are refreshed on every
 *  read, so going stale is harmless — the next open overwrites them. */
const knownDiskState = new Map<string, DiskState>();

/** Per-path write tails — same serialization pattern as main.ts's
 *  `journalWriteTails`, for the same reason: two overlapping writes to
 *  one path interleave at the kernel level into a torn file. */
const writeTails = new Map<string, Promise<void>>();

function keyFor(filePath: string): string {
  return path.resolve(filePath);
}

/** Chain `task` onto the previous write to the same path. Returns the
 *  task's own promise (rejections propagate to THIS caller); the stored
 *  tail always settles fulfilled so one failed write can't dam the
 *  queue for the session. */
export function chainDocWrite<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const key = keyFor(filePath);
  const previous = writeTails.get(key) ?? Promise.resolve();
  const run = previous.then(task);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  writeTails.set(key, tail);
  // GC the chain entry when this write settles — only if we're still
  // the tail (a later write may have chained onto us already).
  void tail.then(() => {
    if (writeTails.get(key) === tail) writeTails.delete(key);
  });
  return run;
}

/** Remember `filePath`'s current on-disk mtime+size — plus a content
 *  hash when the caller passes the bytes it just read/wrote, which
 *  arms the guard's metadata-churn rescue (see DiskState.contentHash).
 *  Best-effort: a stat failure (file vanished between read and stat)
 *  just leaves no entry, which disables the changed-on-disk guard for
 *  that path — never breaks the read that called us. */
export async function recordDiskStateFromDisk(
  filePath: string,
  contentBytes?: Buffer,
): Promise<void> {
  try {
    const st = await fs.stat(filePath);
    knownDiskState.set(keyFor(filePath), {
      mtimeMs: st.mtimeMs,
      size: st.size,
      ...(contentBytes !== undefined ? { contentHash: hashOf(contentBytes) } : {}),
    });
  } catch {
    /* best-effort */
  }
}

/** Stage-then-rename write. The tmp file is dot-prefixed (hidden in
 *  Finder) and lives in the target's own directory so the rename stays
 *  on one filesystem (atomic on POSIX; MoveFileEx-replace on Windows).
 *
 *  When a transient sharing violation outlives the whole retry backoff,
 *  the write falls back to a plain in-place overwrite: replacing an open
 *  file's directory entry needs delete-sharing from EVERY holder of the
 *  file (which sync clients and scanners don't grant), but writing its
 *  bytes needs only write-sharing (which they do) — so the overwrite
 *  succeeds against the same hold that blocks the rename. The tmp file
 *  survives until the overwrite lands: it holds the complete new bytes,
 *  so a crash that tears the non-atomic overwrite still leaves a full
 *  copy on disk next to the (journal-covered) torn target. Only when
 *  even the overwrite fails is the save reported failed, with the
 *  ELOCKED-marked message. Non-transient rename errors clean the tmp
 *  and propagate unchanged. */
async function writeAtomic(filePath: string, buf: Buffer, mode?: number): Promise<void> {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.cmtmp`);
  await fs.writeFile(tmpPath, buf, mode !== undefined ? { mode } : {});
  try {
    // Retry transient sharing violations (see RENAME_RETRY_DELAYS_MS);
    // anything else — and anything that outlives the backoff — throws.
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(tmpPath, filePath);
        break;
      } catch (err) {
        if (attempt >= RENAME_RETRY_DELAYS_MS.length || !isTransientRenameCode(err)) {
          throw err;
        }
        await sleep(RENAME_RETRY_DELAYS_MS[attempt]!);
      }
    }
  } catch (err) {
    if (!isTransientRenameCode(err)) {
      await fs.unlink(tmpPath).catch(() => {});
      throw err;
    }
    try {
      // `mode` only applies if the overwrite has to CREATE the target
      // (possible on the saveNewDoc path); an existing file keeps its
      // own bits, which is the point of writing in place.
      await fs.writeFile(filePath, buf, mode !== undefined ? { mode } : {});
    } catch (fallbackErr) {
      const code =
        (fallbackErr as NodeJS.ErrnoException).code ??
        (err as NodeJS.ErrnoException).code;
      throw new Error(
        `${FILE_LOCKED_MARKER}: "${path.basename(filePath)}" is locked by ` +
          `another program — often Dropbox or an antivirus scanner still ` +
          `processing the previous save. Wait a few seconds and save ` +
          `again. (${code})`,
      );
    }
    // Best-effort: the same scanner hold that blocked the rename may
    // still pin the tmp; the next save rewrites the same tmp path, so
    // a leftover never accumulates.
    await fs.unlink(tmpPath).catch(() => {});
  }
}

/** In-place save to a file that must already exist on disk.
 *
 *  Throws ENOENT (from the stat) when the file was renamed/deleted —
 *  the renderer's `isFileGoneError` → Save-As rescue path. Throws an
 *  EMODIFIED-marked error when the file changed on disk since we last
 *  read or wrote it, unless `opts.force` (the renderer's explicit
 *  "Overwrite" choice) is set. */
export function saveExistingDoc(
  filePath: string,
  buf: Buffer,
  opts?: { force?: boolean },
): Promise<void> {
  return chainDocWrite(filePath, async () => {
    // Existence check — a bare writeFile would silently recreate a
    // renamed/deleted file at the stale path.
    const st = await fs.stat(filePath);
    const known = knownDiskState.get(keyFor(filePath));
    if (
      !opts?.force &&
      known &&
      (known.mtimeMs !== st.mtimeMs || known.size !== st.size)
    ) {
      // Metadata-churn rescue: when we know what the content SHOULD
      // be, a stat mismatch with identical bytes is a sync layer
      // rewriting timestamps (rclone upload finalization, Dropbox
      // touch) — not an edit. Read and compare before refusing; any
      // read failure falls through to the refusal.
      let identicalContent = false;
      if (known.contentHash) {
        try {
          identicalContent = hashOf(await fs.readFile(filePath)) === known.contentHash;
        } catch {
          /* unreadable — treat as changed */
        }
      }
      if (!identicalContent) {
        throw new Error(
          `${CHANGED_ON_DISK_MARKER}: "${path.basename(filePath)}" changed on disk ` +
            `after CardMirror last read or wrote it — another program, device, or ` +
            `sync service may have written it.`,
        );
      }
    }
    // Preserve the existing file's permission bits across the
    // tmp+rename (a plain in-place write would have kept them).
    await writeAtomic(filePath, buf, st.mode & 0o777);
    await recordDiskStateFromDisk(filePath, buf);
  });
}

/** `saveNewDoc({failIfExists})` found the path already occupied. A
 *  class (not a sentinel string) so the IPC layer can distinguish it
 *  from real write failures with instanceof. */
export class DocExistsError extends Error {
  constructor(filePath: string) {
    super(`refusing to overwrite existing file: ${filePath}`);
    this.name = 'DocExistsError';
  }
}

/** Write a document to a path that need not exist yet (Save As, the
 *  silent send-doc/marked-cards exports, bulk convert). No freshness
 *  guard — the user just picked the destination — but the write is
 *  still atomic, serialized, and recorded so a follow-up in-place save
 *  to the same path starts with a fresh baseline.
 *
 *  `failIfExists` (the new-speech-doc auto-save): rejects with
 *  DocExistsError instead of overwriting. The check runs INSIDE the
 *  per-path write chain — every window's writes funnel through this
 *  one serialization, so two rapid create-at-same-path calls cannot
 *  interleave between check and rename. (An unrelated external
 *  process racing the same instant can still win the rename;
 *  writeAtomic has no exclusive mode, and that's outside the guard's
 *  threat model.) */
export function saveNewDoc(
  filePath: string,
  buf: Buffer,
  opts?: { mkdir?: boolean; failIfExists?: boolean },
): Promise<void> {
  return chainDocWrite(filePath, async () => {
    if (opts?.failIfExists) {
      const occupied = await fs.access(filePath).then(
        () => true,
        () => false,
      );
      if (occupied) throw new DocExistsError(filePath);
    }
    if (opts?.mkdir) await fs.mkdir(path.dirname(filePath), { recursive: true });
    await writeAtomic(filePath, buf);
    await recordDiskStateFromDisk(filePath, buf);
  });
}

/** The deepest existing DIRECTORY on `fromPath`'s ancestor chain —
 *  `fromPath`'s own folder when the path is intact, or the nearest
 *  surviving parent after a rename/move/delete broke some segment.
 *  Used to open the Save-As dialog next to wherever the document's
 *  old location went (Word does the same on a stale-path save).
 *  Null only if nothing on the chain exists (unmounted volume). */
export async function nearestExistingDir(fromPath: string): Promise<string | null> {
  let dir = path.resolve(fromPath);
  for (;;) {
    try {
      // isDirectory guard: an existing FILE on the chain (fromPath
      // itself, or a file squatting on an ancestor name) is not a
      // place a save dialog can open.
      if ((await fs.stat(dir)).isDirectory()) return dir;
    } catch {
      /* segment gone — keep walking up */
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null; // hit the filesystem root
    dir = parent;
  }
}

/** Test seam — clears both maps so vitest cases start cold. */
export function resetDocWritesForTests(): void {
  knownDiskState.clear();
  writeTails.clear();
}
