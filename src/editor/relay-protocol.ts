/**
 * Constants shared by every client that talks to the relay — the main
 * process (card sharing, `pairing-ipc.ts`) and the renderer (co-editing,
 * `collab/room-client.ts`) alike.
 *
 * Deliberately dependency-free: this module is imported into BOTH the
 * Electron main bundle and the renderer bundle, so it must not pull in
 * `getHost()`, the DOM, or anything Electron.
 */

/**
 * Header naming the CardMirror build behind a relay request.
 *
 * Sent on every relay call so the server can tell versions apart. It is
 * advisory only — relays that don't know the header ignore it, which is
 * why the client can start sending it well before any relay reads it.
 * Custom request headers are preflighted by browsers for the web
 * edition, but every relay implementation allows them (`allow_headers`
 * is the wildcard in all three), and the existing `Authorization`
 * header already proves that path works.
 *
 * NOTE for a future minimum-version gate: absence of this header means
 * the client predates it, NOT that the request is anonymous — every
 * build shipped before this header existed will send nothing at all.
 */
export const RELAY_CLIENT_VERSION_HEADER = 'X-CardMirror-Version';
