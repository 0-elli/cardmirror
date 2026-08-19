/**
 * Collaboration-session feature gate.
 *
 * Co-editing ships DESKTOP-ONLY: on a browser host the gate stays closed
 * unless the WEB-COLLAB PROTOTYPE flag is set (console flip, below). On
 * any desktop host — Electron, or a future non-`browser` kind like
 * Tauri — co-editing is ON by default.
 *
 * WEB PROTOTYPE (2026-08-17, design notes in the web-collab decision
 * memo): `localStorage['pmd-collab-web'] = '1'` opens the gate in a
 * browser, and `pmd-collab-web-relay-url` / `pmd-collab-web-relay-token`
 * supply a runtime relay endpoint (the Collaboration settings tab is
 * desktop-only, so there is no web UI for these yet). Deliberately a
 * console flip, not a setting: the shipped web posture is unchanged
 * until the account-auth/guest-pass work lands. Same pattern as the
 * old `pmd-collab` development flip and the community-installs unlock.
 *
 * Zero heavy imports — this module is consulted from the main editor
 * path; `host` is already on that path (types-only wrappers), and
 * everything Loro/collab loads lazily only after the gate opens.
 */

import { getHost } from '../host/index.js';
import { isLiteBuild } from '../lite.js';

/** The web-collab prototype console flip. */
export function webCollabPrototypeEnabled(): boolean {
  try {
    return window.localStorage.getItem('pmd-collab-web') === '1';
  } catch {
    return false;
  }
}

/** Set (for THIS window only, never persisted) when the page was
 *  opened through a session invite link — the link IS the invitation,
 *  so a joiner needs no flag, no account, no setup. Without this, the
 *  account-less joiner story dies at the gate. */
let webJoinLinkOverride = false;

export function enableWebCollabForJoinLink(): void {
  webJoinLinkOverride = true;
}

export function collabEnabled(): boolean {
  // Lite builds have no collaboration at all — closing this gate is
  // what removes the pills, sessions list, join links, web account
  // wiring, and every collab command in one move.
  if (isLiteBuild()) return false;
  // On desktop (Electron / a future non-browser host) co-editing is on.
  // A browser host stays closed unless the prototype flip is set or
  // this window was opened via an invite link — the browser exclusion
  // remains the shipped-default guarantee for ordinary web visits.
  try {
    if (getHost().kind !== 'browser') return true;
    return webCollabPrototypeEnabled() || webJoinLinkOverride;
  } catch {
    /* no host resolvable → treat as not-desktop, stay closed */
    return false;
  }
}

/** Dev/prototype relay config for hosts without the Electron-only
 *  Collaboration settings fields. Two sources, runtime first:
 *  the web-prototype localStorage pair (set from the console, works in
 *  packaged web builds), then the vite build-time env vars. Falls
 *  through (null) when neither is set. */
export function collabDevRelay(): { url: string; token: string } | null {
  try {
    const url = (window.localStorage.getItem('pmd-collab-web-relay-url') ?? '').trim();
    const token = (window.localStorage.getItem('pmd-collab-web-relay-token') ?? '').trim();
    if (url && token) return { url, token };
  } catch {
    /* no localStorage (non-DOM host) */
  }
  try {
    const env = (import.meta as { env?: Record<string, string> }).env;
    const url = (env?.['VITE_COLLAB_RELAY'] ?? '').trim();
    const token = (env?.['VITE_COLLAB_TOKEN'] ?? '').trim();
    if (url && token) return { url, token };
  } catch {
    /* no import.meta.env outside vite */
  }
  return null;
}
