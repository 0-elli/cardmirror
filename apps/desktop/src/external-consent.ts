/**
 * Consent gate for the fast-paste bridge's mutating/attention routes
 * (`POST /insert`, `POST /jump`). Enforcement lives in MAIN — one
 * authority, so multi-window renderers can never disagree — while the
 * durable state (per-app allow/deny, the master toggle) is a renderer
 * SETTING: the renderer mirrors it here via `host:sync-external-consent`
 * on boot and on every change, and the first-contact prompt runs in the
 * focused renderer (route-style dialog), which records the decision in
 * settings and replies. This is consent/legibility UX for cooperating
 * local apps, NOT a security boundary: identity is self-declared and
 * any same-user process is inside the trust line anyway.
 *
 * Wire disposition per request (identity = `X-App-Id` header):
 *   - no/malformed appId  → 'unidentified'  (rejected outright — no
 *     grandfathering; CardMirror itself explains, in place of the
 *     consent prompt, that the sending app needs an update — the
 *     route layer owns that notification, since it can fingerprint
 *     which legacy app is likely knocking)
 *   - policy 'off'        → 'off'   (policy 'open' → everything 'allow')
 *   - remembered deny     → 'deny'
 *   - remembered allow    → 'allow'
 *   - unknown app         → 'ask' — the caller queues the action (cap
 *     per app) and answers `{ok:true, …:false, pending:"consent"}`;
 *     Allow (always or once) runs the queue in arrival order, so the
 *     user's click IS the redo. Deny/dismiss discards it.
 */

export const APP_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Parse an `X-App-Id` header value; null = unidentified. */
export function parseAppId(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && APP_ID_RE.test(v) ? v : null;
}

export type ConsentDisposition = 'allow' | 'deny' | 'off' | 'unidentified' | 'ask';
export type PromptOutcome = 'allow-always' | 'allow-once' | 'deny' | 'dismissed';

export type ExternalInsertPolicy = 'off' | 'ask' | 'open';

export interface ConsentMirror {
  /** `ask` (default): per-app consent, unidentified rejected. `open`:
   *  everything allowed, identification optional — keeps legacy
   *  senders (pre-X-App-Id Fast Debate Paste) working. `off`: the
   *  whole gated surface is closed. */
  policy: ExternalInsertPolicy;
  /** appId → remembered decision (consulted in `ask` mode). */
  apps: Record<string, 'allow' | 'deny'>;
}

export interface ConsentGateHooks {
  /** Run the consent prompt in the focused renderer. Resolves
   *  'dismissed' on timeout / no renderer / closed window. */
  prompt(appId: string): Promise<PromptOutcome>;
  /** Fire-and-forget: a permitted request from `appId` was served —
   *  the renderer stamps lastSeen in the settings registry. */
  recordSeen(appId: string): void;
}

/** Per-app actions queued while that app's consent prompt is open. */
const MAX_PENDING_ACTIONS = 10;

interface PendingApp {
  actions: Array<() => void>;
}

export class ConsentGate {
  private mirror: ConsentMirror = { policy: 'ask', apps: {} };
  private pending = new Map<string, PendingApp>();

  constructor(private hooks: ConsentGateHooks) {}

  /** Replace the mirrored settings state (renderer sync). */
  setState(state: ConsentMirror): void {
    this.mirror = state;
  }

  /** Pure disposition — no side effects. Callers fire the lastSeen
   *  stamp themselves once a permitted request actually SUCCEEDS, so
   *  the timestamp means "last served insert/jump", not "last knock". */
  check(appId: string | null): ConsentDisposition {
    if (this.mirror.policy === 'off') return 'off';
    if (this.mirror.policy === 'open') return 'allow';
    if (appId === null) return 'unidentified';
    const decision = this.mirror.apps[appId];
    if (decision === 'deny') return 'deny';
    if (decision === 'allow') return 'allow';
    return 'ask';
  }

  /** Queue `action` behind the app's consent prompt (raising the prompt
   *  on first contact). Returns false when the queue is full — the
   *  caller should answer `not-allowed` instead of `pending`. */
  enqueue(appId: string, action: () => void): boolean {
    const existing = this.pending.get(appId);
    if (existing) {
      if (existing.actions.length >= MAX_PENDING_ACTIONS) return false;
      existing.actions.push(action);
      return true;
    }
    const entry: PendingApp = { actions: [action] };
    this.pending.set(appId, entry);
    void this.hooks
      .prompt(appId)
      .catch((): PromptOutcome => 'dismissed')
      .then((outcome) => this.resolvePrompt(appId, outcome));
    return true;
  }

  private resolvePrompt(appId: string, outcome: PromptOutcome): void {
    const entry = this.pending.get(appId);
    this.pending.delete(appId);
    if (!entry) return;
    // Optimistic mirror update so a request racing the renderer's
    // settings-sync round trip doesn't re-prompt (or slip through).
    // The authoritative sync arrives moments later and agrees.
    if (outcome === 'allow-always') this.mirror.apps[appId] = 'allow';
    if (outcome === 'deny') this.mirror.apps[appId] = 'deny';
    if (outcome === 'allow-always' || outcome === 'allow-once') {
      for (const action of entry.actions) {
        try {
          action();
        } catch (err) {
          console.error('[external-consent] queued action failed:', err);
        }
      }
      this.hooks.recordSeen(appId);
    }
    // deny / dismissed: the queue is discarded. 'dismissed' records
    // nothing — the next request asks again.
  }

  resetForTests(): void {
    this.mirror = { policy: 'ask', apps: {} };
    this.pending.clear();
  }
}
