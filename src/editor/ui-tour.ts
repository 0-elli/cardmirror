/**
 * UI tour — spotlight onboarding for the editor chrome.
 *
 * A coach-marks overlay: dimmed viewport with a rounded cutout over
 * the current target and a floating card beside it (Back / Next /
 * Skip, step dots, ←/→/Esc). Sequenced as a first session's arc:
 * editor → styles → nav → files → read mode → speech → timer → learn
 * → settings → command bar (the one interactive step) → finish.
 *
 * Availability adapter (the ribbon clips at narrow widths, and some
 * clusters are structurally absent — the speech stack renders only in
 * three-pane): every step resolves its target at entry. A missing or
 * invisible target NEVER dead-ends or silently skips the step — the
 * card renders centered with adapted copy so the user still learns
 * the feature exists, and a resize listener upgrades it to a real
 * spotlight if the element becomes visible mid-step. A renamed id
 * degrades the same way (plus a console warning), so ribbon
 * refactors can't crash the tour.
 *
 * Auto-runs once per FRESH profile (recent-files empty); existing
 * profiles are marked seen without touring — they rerun it via the
 * `startUiTour` ribbon command. Desktop layout only: the mobile UI
 * has no ribbon to tour.
 */

import { settings } from './settings.js';
import { formatKeyForDisplay } from './ribbon-commands.js';
import { quickCardSearchUI, onQuickCardSearchOpen } from './quick-card-search-ui.js';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Resolve the spotlight target; null = centered card. Re-resolved
   *  on resize. */
  target?: () => HTMLElement | null;
  /** Copy used when the target is structurally absent (e.g. the
   *  speech stack outside three-pane). Falls back to `hiddenBody`. */
  absentBody?: string;
  /** Copy used when the target exists but can't be shown (clipped by
   *  a narrow window). Defaults to a generic widen-the-window note. */
  hiddenBody?: string;
  /** Side effect on entering the step (e.g. reveal the nav pane). */
  prepare?: () => void;
  /** Secondary highlight ring inside/near the main target. */
  ring?: () => HTMLElement | null;
  /** Interactive step: advance automatically on this hook. */
  interactive?: boolean;
}

function el(id: string): () => HTMLElement | null {
  return () => document.getElementById(id);
}

function buildSteps(): TourStep[] {
  const mod = (k: string) => formatKeyForDisplay(k);
  return [
    {
      id: 'welcome',
      title: 'Welcome to CardMirror',
      body:
        'A quick tour of the interface — about a minute. Use the buttons or ← → to move, ' +
        'and Esc to skip. You can rerun it any time: it lives in the command bar as ' +
        '"Take the UI Tour".',
    },
    {
      id: 'editor',
      title: 'The editor',
      body:
        'This is a live document — everything in it can be typed in, styled, and ' +
        'rearranged. Right-click for cut, copy, and paste.',
      target: () => document.querySelector<HTMLElement>('.ProseMirror'),
    },
    {
      id: 'styles',
      title: 'Structural styles',
      body:
        'The heart of cutting: turn a paragraph into a Pocket, Hat, Block, Tag, Analytic, ' +
        'or Undertag with one click — or one keystroke (F4–F7 and friends; the 📖 button ' +
        'lists them all).',
      target: el('formatting-panel'),
    },
    {
      id: 'nav',
      title: 'The outline',
      body:
        'Every heading those styles create shows up here. Click to jump, double-click to ' +
        'fold, drag to reorder — and the 1 · 2 · 3 · 4 buttons set how deep the outline goes.',
      target: el('nav-panel'),
      ring: () => document.querySelector<HTMLElement>('.pmd-nav-level-group'),
      prepare: () => {
        if (!settings.get('navPaneVisible')) settings.set('navPaneVisible', true);
      },
    },
    {
      id: 'files',
      title: 'Open, new, save',
      body:
        'CardMirror reads and writes the same .docx files as Verbatim. Open a real file, ' +
        'start a new one, save — and the fourth button toggles autosave.',
      target: el('file-stack'),
    },
    {
      id: 'read-mode',
      title: 'Read mode',
      body:
        'The eye reads at the podium: everything but tags, cites, analytics, and ' +
        'highlighted text hides, and typing is locked so a stray key can’t edit the doc.',
      target: el('read-mode-btn'),
    },
    {
      id: 'speech',
      title: 'Speech docs',
      body:
        'Build the doc you’ll actually read: start a speech, then send cards into it ' +
        'from your prep as you go.',
      absentBody:
        'One more thing lives here when the three-pane workspace is on: the Speech ' +
        'cluster — start a speech doc and send cards into it from your prep as you go. ' +
        'Turn on three panes in ⚙ → General → "Three-pane workspace" to see it.',
      target: el('speech-stack'),
    },
    {
      id: 'timer',
      title: 'Timer',
      body:
        'Speech and prep timers, with presets. It pops out into its own always-on-top ' +
        'window too, for reading off one screen while timing on another.',
      target: el('timer-toggle-btn'),
    },
    {
      id: 'learn',
      title: 'Study your evidence',
      body:
        'Turn evidence into spaced-repetition flashcards: create one from a selection, ' +
        'manage the deck, and watch for the red dot when reviews are due.',
      target: () => document.getElementById('manage-flashcards-btn')?.parentElement ?? null,
    },
    {
      id: 'settings',
      title: 'Settings',
      body:
        'Everything is adjustable — appearance, editing behavior, keybindings, ' +
        'collaboration. Worth a browse once you’ve settled in.',
      target: el('settings-btn'),
    },
    {
      id: 'command-bar',
      title: 'One shortcut to rule them all',
      body:
        `Press ${mod('Mod-Shift-Space')} now. It opens the command bar — it searches ` +
        'commands, settings, files, and your quick cards from one box. (Or press Next ' +
        'to move on.)',
      interactive: true,
    },
    {
      id: 'finish',
      title: 'That’s the tour',
      body:
        'The document below walks the editing side — styles, cards, shortcuts — and 📖 ' +
        'opens the full keyboard reference. Rerun this tour any time from the command ' +
        'bar: "Take the UI Tour". Welcome aboard!',
    },
  ];
}

/** Visible-enough to spotlight: rendered, non-zero, and inside the
 *  viewport (the ribbon clips clusters at narrow widths). */
function measurable(target: HTMLElement): DOMRect | null {
  const r = target.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  if (r.right < 0 || r.bottom < 0 || r.left > window.innerWidth || r.top > window.innerHeight) {
    return null;
  }
  return r;
}

const GENERIC_HIDDEN_NOTE =
  ' (Your window is currently too narrow to show it — widen the window and it appears in the ribbon.)';

export class UiTourController {
  private steps: TourStep[];
  private index = 0;
  private root: HTMLElement | null = null;
  private shade: HTMLElement | null = null;
  private ring: HTMLElement | null = null;
  private card: HTMLElement | null = null;
  private offPaletteOpen: (() => void) | null = null;
  private paletteOpened = false;
  private readonly onResize = () => this.position();
  private readonly onKey = (e: KeyboardEvent) => {
    if (!this.root) return;
    if (e.key === 'Escape') {
      // On the interactive step, Esc first belongs to the palette.
      if (this.steps[this.index]?.interactive && quickCardSearchUI.isOpen()) return;
      e.preventDefault();
      this.end();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.back();
    }
  };

  constructor(steps: TourStep[] = buildSteps()) {
    this.steps = steps;
  }

  get running(): boolean {
    return this.root !== null;
  }

  start(): void {
    if (this.root) this.end();
    this.index = 0;
    const root = document.createElement('div');
    root.className = 'pmd-tour';
    // Click-catcher: swallows app clicks while touring. Disabled on
    // the interactive step so the palette stays reachable.
    const catcher = document.createElement('div');
    catcher.className = 'pmd-tour-catcher';
    root.appendChild(catcher);
    this.shade = document.createElement('div');
    this.shade.className = 'pmd-tour-shade';
    root.appendChild(this.shade);
    this.ring = document.createElement('div');
    this.ring.className = 'pmd-tour-ring';
    this.ring.hidden = true;
    root.appendChild(this.ring);
    this.card = document.createElement('div');
    this.card.className = 'pmd-tour-card';
    root.appendChild(this.card);
    document.body.appendChild(root);
    this.root = root;
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey, { capture: true });
    this.enter();
  }

  end(): void {
    if (!this.root) return;
    this.offPaletteOpen?.();
    this.offPaletteOpen = null;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey, { capture: true });
    this.root.remove();
    this.root = this.shade = this.ring = this.card = null;
  }

  next(): void {
    if (this.index >= this.steps.length - 1) {
      this.end();
      return;
    }
    this.index++;
    this.enter();
  }

  back(): void {
    if (this.index === 0) return;
    this.index--;
    this.enter();
  }

  /** Render the current step. */
  private enter(): void {
    if (!this.root || !this.card) return;
    const step = this.steps[this.index]!;
    this.offPaletteOpen?.();
    this.offPaletteOpen = null;
    this.paletteOpened = false;
    try {
      step.prepare?.();
    } catch (err) {
      console.warn('[ui-tour] step prepare failed:', err);
    }
    if (step.interactive) {
      this.offPaletteOpen = onQuickCardSearchOpen(() => {
        // The user pressed the shortcut — celebrate and let them see
        // the palette, then Next closes it.
        this.paletteOpened = true;
        this.renderCard(step, 'interactive-open');
        this.position();
      });
    }
    this.root.classList.toggle('pmd-tour-interactive', !!step.interactive);
    this.renderCard(step, 'normal');
    this.position();
  }

  /** Compute target visibility and lay out shade + card. */
  private position(): void {
    if (!this.root || !this.card || !this.shade || !this.ring) return;
    const step = this.steps[this.index]!;

    // Interactive follow-up anchors to the open palette.
    const paletteEl =
      step.interactive && this.paletteOpened
        ? document.querySelector<HTMLElement>('.pmd-qcs')
        : null;

    let target: HTMLElement | null = null;
    let state: 'visible' | 'hidden' | 'absent' | 'center' = 'center';
    if (paletteEl) {
      target = paletteEl;
      state = 'visible';
    } else if (step.target) {
      target = step.target();
      if (target === null) {
        state = 'absent';
        console.warn(`[ui-tour] step "${step.id}": target missing — showing adapted card`);
      } else {
        let rect = measurable(target);
        if (!rect) {
          try {
            target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          } catch {
            /* non-scrollable context */
          }
          rect = measurable(target);
        }
        state = rect ? 'visible' : 'hidden';
      }
    }

    this.root.dataset['state'] = state;
    const pad = 6;
    if (state === 'visible' && target) {
      const r = target.getBoundingClientRect();
      Object.assign(this.shade.style, {
        display: '',
        left: `${r.left - pad}px`,
        top: `${r.top - pad}px`,
        width: `${r.width + pad * 2}px`,
        height: `${r.height + pad * 2}px`,
      });
      const ringTarget = step.ring?.() ?? null;
      const rr = ringTarget ? measurable(ringTarget) : null;
      this.ring.hidden = !rr;
      if (rr) {
        Object.assign(this.ring.style, {
          left: `${rr.left - 3}px`,
          top: `${rr.top - 3}px`,
          width: `${rr.width + 6}px`,
          height: `${rr.height + 6}px`,
        });
      }
      this.placeCardNear(r);
    } else {
      // Centered card over a uniform dim (shade collapses to nothing
      // off-screen so its shadow still paints the dim).
      this.shade.style.display = '';
      Object.assign(this.shade.style, { left: '-20px', top: '-20px', width: '0px', height: '0px' });
      this.ring.hidden = true;
      // Adapted copy first, THEN center — the card's size depends on it.
      if (state === 'hidden' || state === 'absent') this.renderCard(step, state);
      Object.assign(this.card.style, {
        left: `${Math.max(12, (window.innerWidth - this.card.offsetWidth) / 2)}px`,
        top: `${Math.max(12, (window.innerHeight - this.card.offsetHeight) / 2)}px`,
      });
    }
  }

  /** Card below the target when it fits, above otherwise; clamped. */
  private placeCardNear(r: DOMRect): void {
    if (!this.card) return;
    const cw = this.card.offsetWidth;
    const ch = this.card.offsetHeight;
    const margin = 14;
    let top = r.bottom + margin;
    if (top + ch > window.innerHeight - 12) top = r.top - margin - ch;
    if (top < 12) top = 12;
    let left = r.left + r.width / 2 - cw / 2;
    left = Math.min(Math.max(12, left), window.innerWidth - cw - 12);
    this.card.style.left = `${left}px`;
    this.card.style.top = `${top}px`;
  }

  private renderCard(
    step: TourStep,
    mode: 'normal' | 'hidden' | 'absent' | 'interactive-open',
  ): void {
    if (!this.card) return;
    let body = step.body;
    if (mode === 'absent') body = step.absentBody ?? step.hiddenBody ?? step.body + GENERIC_HIDDEN_NOTE;
    else if (mode === 'hidden') body = step.hiddenBody ?? step.body + GENERIC_HIDDEN_NOTE;
    else if (mode === 'interactive-open') {
      body =
        'That’s the command bar. Plain text searches everything; prefixes narrow it — ' +
        '"c " commands, "s " settings, "f " files, "q " quick cards. Esc closes it.';
    }

    this.card.replaceChildren();
    const title = document.createElement('div');
    title.className = 'pmd-tour-title';
    title.textContent = step.title;
    this.card.appendChild(title);
    const bodyEl = document.createElement('div');
    bodyEl.className = 'pmd-tour-body';
    bodyEl.textContent = body;
    this.card.appendChild(bodyEl);

    const dots = document.createElement('div');
    dots.className = 'pmd-tour-dots';
    this.steps.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'pmd-tour-dot' + (i === this.index ? ' pmd-tour-dot-active' : '');
      dots.appendChild(d);
    });
    this.card.appendChild(dots);

    const row = document.createElement('div');
    row.className = 'pmd-tour-buttons';
    const mkBtn = (label: string, cls: string, fn: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pmd-settings-btn ${cls}`;
      b.textContent = label;
      b.addEventListener('click', fn);
      row.appendChild(b);
      return b;
    };
    if (this.index < this.steps.length - 1) {
      mkBtn('Skip tour', 'pmd-tour-skip', () => this.end());
    }
    if (this.index > 0) mkBtn('Back', 'pmd-tour-back', () => this.back());
    const last = this.index === this.steps.length - 1;
    const nextBtn = mkBtn(last ? 'Done' : 'Next', 'pmd-tour-next', () => {
      if (step.interactive && quickCardSearchUI.isOpen()) quickCardSearchUI.close();
      this.next();
    });
    this.card.appendChild(row);
    nextBtn.focus({ preventScroll: true });
    // The interactive step needs the app to receive the shortcut, so
    // hand focus back to the document body instead of the card.
    if (step.interactive && mode === 'normal') nextBtn.blur();
  }
}

let controller: UiTourController | null = null;

/** Start (or restart) the tour. */
export function startUiTour(): void {
  if (!controller) controller = new UiTourController();
  settings.set('hasSeenUiTour', true);
  controller.start();
}

/** Auto-start once for fresh profiles. Existing profiles (anything in
 *  the recent-files list) are marked seen without touring — the tour
 *  postdates them, and unprompted overlays on upgrade are rude. Waits
 *  for the editor chrome to exist (first boot may land on the home
 *  screen; the tour begins when a document does). */
export function maybeAutoStartUiTour(): void {
  if (settings.get('hasSeenUiTour')) return;
  try {
    const recents = JSON.parse(localStorage.getItem('pmd-recent-files') ?? '[]') as unknown[];
    if (Array.isArray(recents) && recents.length > 0) {
      settings.set('hasSeenUiTour', true);
      return;
    }
  } catch {
    /* unreadable recents — treat as fresh */
  }
  let tries = 0;
  const poll = window.setInterval(() => {
    tries++;
    if (settings.get('hasSeenUiTour')) {
      window.clearInterval(poll);
      return;
    }
    const ready =
      document.querySelector('.ProseMirror') !== null &&
      document.getElementById('formatting-panel') !== null;
    if (ready) {
      window.clearInterval(poll);
      startUiTour();
    } else if (tries > 240) {
      // ~2 minutes on the home screen — stop polling; the next boot
      // (or the ribbon command) can still start it.
      window.clearInterval(poll);
    }
  }, 500);
}
