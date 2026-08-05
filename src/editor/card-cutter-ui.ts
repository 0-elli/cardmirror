/**
 * Card-cutter launch sheet — the configuration flow.
 *
 * Asks only what the user knows up front: how long the read should be
 * (read-time) and what they're using the card for (intent). Then,
 * when enabled, runs the describe-then-generate clarifying step: the
 * engine proposes ≤3 candidate cuts (descriptions, not generations)
 * and the user picks one before anything is cut.
 *
 * Reuses the app's `pmd-route-overlay` / `pmd-route-dialog` chrome.
 */

import type { EditorView } from 'prosemirror-view';
import { settings } from './settings.js';
import { AiWorkingBox } from './ai/ai-working-box.js';
import { showToast } from './toast.js';
import {
  cutFocusedCard,
  focusedCardStatus,
  proposeFocusedOmissions,
  setSectionOmitted,
  previewOmissionSection,
  refineHighlightFocusedCard,
  addHighlightFocusedCard,
  hasCardSubSelection,
  ensureEngine,
  addCutterFlag,
  pendingCutterFlags,
  removeCutterFlag,
  clearCutterFlags,
  focusedPlainCard,
  resolveCardById,
  jumpToCard,
  cardLabel,
  cardReadStats,
  type CutFlag,
  type CutSession,
  type FocusedCard,
  type OmissionSection,
} from './card-cutter-port.js';

const READ_TIME_PRESETS = [8, 12, 20, 30];

export async function openCutLaunchSheet(view: EditorView): Promise<void> {
  if (!(await ensureEngine())) {
    showToast('Card-cutter engine not loaded.');
    return;
  }
  const status = focusedCardStatus(view);
  if (!status.cuttable) {
    showToast('Put the cursor in a card with body text first.');
    return;
  }
  if (status.hasHighlight) {
    // Already cut. A sub-selection means "add highlight here"; otherwise
    // offer the shorten / tighten / add sheet.
    if (hasCardSubSelection(view)) {
      void addHighlightFocusedCard(view);
    } else {
      // Capture the card NOW — the sheet outlives this moment and the
      // cursor can move before the user clicks Refine.
      const target = focusedPlainCard(view);
      if (!target) {
        showToast('Put the cursor in a card with body text first.');
        return;
      }
      openHighlightDownSheet(view, target);
    }
    return;
  }
  const highlightOnly = status.hasUnderline; // underlined → highlight only
  // The card this panel is FOR — captured now, so the cut targets it even
  // if the cursor wanders (or a stacked panel steals focus) meanwhile.
  const target = focusedPlainCard(view);
  if (!target) {
    showToast('Put the cursor in a card with body text first.');
    return;
  }

  // NON-MODAL panel: the doc stays interactive so the user can select
  // chunks of the card and annotate them (U = play up / green, D =
  // play down / red) while the panel is open. Escape cancels, the Cut
  // button (or ⌘↩) fires.
  const dialog = document.createElement('div');
  dialog.className = 'pmd-cardcutter-panel';

  const header = document.createElement('div');
  header.className = 'pmd-route-header';
  header.textContent = highlightOnly ? 'Highlight card' : 'Cut card';
  dialog.appendChild(header);
  dialog.appendChild(cardIdentityRow(view, target));

  // Dashed purple box around the card the panel will act on — the
  // "about to work here" counterpart to the solid working box. Tracks
  // the card's live position, so annotating or editing keeps it aligned.
  const targetBox = new AiWorkingBox('target');
  targetBox.show(view, { from: target.cardFrom, to: target.cardTo });
  const retrackBox = (): void => {
    const live = target.cardId ? resolveCardById(view, target.cardId) : null;
    if (live) targetBox.setRange({ from: live.cardFrom, to: live.cardTo });
  };

  const close = (discardFlags: boolean): void => {
    if (discardFlags) clearCutterFlags(view);
    targetBox.hide();
    dialog.remove();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('keyup', retrackBox, true);
    document.removeEventListener('mouseup', retrackBox, true);
  };
  const inPanelInput = (t: EventTarget | null): boolean =>
    t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      void onGo();
      return;
    }
    // Annotation hotkeys — single keys, so they must never fire while
    // typing intent text or with a modifier chord held.
    if (e.metaKey || e.ctrlKey || e.altKey || inPanelInput(e.target)) return;
    const k = e.key.toLowerCase();
    if (k !== 'u' && k !== 'd') return;
    e.preventDefault();
    e.stopPropagation();
    const flag = addCutterFlag(view, k === 'u' ? 'up' : 'down');
    if (!flag) {
      showToast(`Select text in the card, then press ${k.toUpperCase()}.`);
      return;
    }
    appendFlagRow(flag);
  };

  // ── Read length (optional cap; efficient by default) ──
  // null = no cap (cut as efficiently as possible). A time chip caps
  // the read via the secondary de-highlight; it never pads up to it.
  let readTimeSec: number | null = null;
  const rtSection = document.createElement('div');
  rtSection.className = 'pmd-cardcutter-section';
  rtSection.appendChild(label('Read length'));
  const rtRow = document.createElement('div');
  rtRow.className = 'pmd-cardcutter-chips';
  const wpm = firstReaderWpm();
  const press = (active: HTMLButtonElement): void =>
    rtRow.querySelectorAll('.pmd-cardcutter-chip').forEach((c) =>
      c.setAttribute('aria-pressed', String(c === active)),
    );
  const noCap = document.createElement('button');
  noCap.type = 'button';
  noCap.className = 'pmd-cardcutter-chip';
  noCap.textContent = 'Efficient (no limit)';
  noCap.setAttribute('aria-pressed', 'true');
  noCap.addEventListener('click', () => {
    readTimeSec = null;
    press(noCap);
  });
  rtRow.appendChild(noCap);
  const chipFor = (sec: number): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pmd-cardcutter-chip';
    b.textContent = `≤ ${sec}s · ~${Math.round((sec * wpm) / 60)}w`;
    b.addEventListener('click', () => {
      readTimeSec = sec;
      press(b);
    });
    return b;
  };
  for (const sec of READ_TIME_PRESETS) rtRow.appendChild(chipFor(sec));
  rtSection.appendChild(rtRow);
  dialog.appendChild(rtSection);

  // ── Intent (free-form) ──
  // Purpose is the #1 selection lever, and canned categories flatten
  // it — a prose line ("2AC answer to the courts CP", "impact card,
  // play up escalation") goes straight to the engine as this cut's
  // stated purpose. Optional: blank = infer from the file context.
  const intentSection = document.createElement('div');
  intentSection.className = 'pmd-cardcutter-section';
  intentSection.appendChild(label('What’s this cut for? (optional)'));
  const intentInput = document.createElement('textarea');
  intentInput.className = 'pmd-cardcutter-intent';
  intentInput.rows = 2;
  intentInput.placeholder =
    'e.g. “2AC answer to the courts counterplan — the delay warrant matters most”';
  intentSection.appendChild(intentInput);
  dialog.appendChild(intentSection);

  // ── Annotations (select in the card → U / D) ──
  // The doc stays live under this panel: select a chunk, press U to
  // tint it green (play up) or D to tint it red (play down). Each
  // annotation is listed here with a ✕; the engine receives them as
  // this cut's play-up / play-down directives.
  const flagSection = document.createElement('div');
  flagSection.className = 'pmd-cardcutter-section';
  flagSection.appendChild(label('Play up / play down (optional)'));
  const flagHint = document.createElement('div');
  flagHint.className = 'pmd-cardcutter-flag-hint';
  flagHint.innerHTML =
    'Select text in the card, then press <kbd>U</kbd> to play up (green) or <kbd>D</kbd> to play down (red).';
  flagSection.appendChild(flagHint);
  const flagList = document.createElement('div');
  flagSection.appendChild(flagList);
  const appendFlagRow = (f: CutFlag): void => {
    flagList.appendChild(flagRow(view, f));
  };
  // Stale flags from an earlier panel in this doc (e.g. it was closed
  // by a failed cut) are still pending — show them.
  for (const f of pendingCutterFlags()) appendFlagRow(f);
  dialog.appendChild(flagSection);

  // ── Buttons ──
  const buttons = document.createElement('div');
  buttons.className = 'pmd-text-prompt-buttons';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'pmd-route-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => close(true));
  buttons.appendChild(cancel);
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'pmd-text-prompt-ok';
  go.textContent = highlightOnly ? 'Highlight' : 'Cut';
  go.dataset['label'] = go.textContent;
  go.title = '⌘↩';
  go.addEventListener('click', () => {
    void onGo();
  });
  buttons.appendChild(go);
  dialog.appendChild(buttons);

  document.addEventListener('keydown', onKey, true);
  // Re-anchor after anything that can move the card (typing above it,
  // a selection change that scrolls). Cheap: one id lookup.
  document.addEventListener('keyup', retrackBox, true);
  document.addEventListener('mouseup', retrackBox, true);
  document.body.appendChild(dialog);

  async function onGo(): Promise<void> {
    // Keep the flags — cutFocusedCard consumes and clears them (and
    // their tints) itself.
    const intent = intentInput.value.trim();
    close(false);
    const session = await cutFocusedCard(view, {
      ...(intent ? { intent } : {}),
      ...(readTimeSec ? { readTimeSec } : {}),
    });
    if (!session) return;
    // Cap missed → the manual trim checklist first (its Done chains into
    // the review loop). Otherwise straight to review: accept, or point
    // at what to change and go around again.
    if (readTimeSec && session.shortfall) {
      showToast('Finding optional sections…');
      const sections = await proposeFocusedOmissions(session);
      if (sections.length > 0) {
        openTrimChecklist(view, session, sections, readTimeSec);
        return;
      }
      showToast(`Couldn't reach ≤${readTimeSec}s without dropping a warrant.`);
    }
    if (session.focused.cardId) openPostCutReview(view, session.focused.cardId);
  }
}

/** Apply-then-refine checklist: a floating panel listing the optional
 *  sections of a just-applied cut. Each row's count is engine-exact;
 *  unchecking removes that section's highlights live on the card. */
function openTrimChecklist(
  view: EditorView,
  session: CutSession,
  sections: OmissionSection[],
  capSec?: number | null,
): void {
  const wpm = firstReaderWpm();
  const secsFor = (words: number): number => Math.max(1, Math.round((words / wpm) * 60));

  const panel = document.createElement('div');
  panel.className = 'pmd-cardcutter-trim';

  const head = document.createElement('div');
  head.className = 'pmd-cardcutter-trim-head';
  const title = document.createElement('div');
  title.className = 'pmd-cardcutter-trim-title';
  title.textContent = capSec ? `Couldn't hit ≤${capSec}s — trim more?` : 'Trim the read (optional)';
  head.appendChild(title);
  // Cutting several cards in a row stacks these panels; name the card.
  head.appendChild(cardIdentityRow(view, session.focused));
  const total = document.createElement('div');
  total.className = 'pmd-cardcutter-trim-total';
  head.appendChild(total);
  panel.appendChild(head);

  let readWords = session.readWords;
  const renderTotal = (): void => {
    total.textContent = `Read now: ${readWords}w · ~${secsFor(readWords)}s`;
  };
  renderTotal();

  const list = document.createElement('div');
  list.className = 'pmd-cardcutter-trim-list';
  for (const sec of sections) {
    const row = document.createElement('label');
    row.className = 'pmd-cardcutter-trim-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true; // checked = kept
    cb.addEventListener('change', () => {
      const omit = !cb.checked;
      setSectionOmitted(view, session, sec, omit);
      readWords += omit ? -sec.words : sec.words;
      row.classList.toggle('pmd-cardcutter-trim-omitted', omit);
      renderTotal();
    });
    row.appendChild(cb);
    const box = document.createElement('span');
    box.className = 'pmd-cardcutter-trim-text';
    const lab = document.createElement('strong');
    lab.textContent = sec.label;
    const det = document.createElement('span');
    det.className = 'pmd-cardcutter-trim-detail';
    det.textContent = sec.description;
    box.appendChild(lab);
    box.appendChild(det);
    row.appendChild(box);
    const save = document.createElement('span');
    save.className = 'pmd-cardcutter-trim-save';
    save.textContent = `−${sec.words}w · ~${secsFor(sec.words)}s`;
    row.appendChild(save);
    // Hover preview: box the highlighted words this row would affect.
    row.addEventListener('mouseenter', () => previewOmissionSection(view, session, sec));
    row.addEventListener('mouseleave', () => previewOmissionSection(view, session, null));
    list.appendChild(row);
  }
  panel.appendChild(list);

  const foot = document.createElement('div');
  foot.className = 'pmd-cardcutter-trim-foot';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'pmd-text-prompt-ok';
  done.textContent = 'Done';
  const close = (): void => {
    previewOmissionSection(view, session, null);
    panel.remove();
    document.removeEventListener('keydown', onKey);
    // The cut is applied and trimmed — same review loop as the cap-met
    // path: accept it, or point at what to change.
    if (session.focused.cardId) openPostCutReview(view, session.focused.cardId);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  done.addEventListener('click', close);
  foot.appendChild(done);
  panel.appendChild(foot);

  document.addEventListener('keydown', onKey);
  document.body.appendChild(panel);
}

/** Refine the read — a compose-then-run dialog. Drop redundancy,
 *  skeletonize, and a target length are all OPTIONAL, composable
 *  settings; free-text guidance steers them, and can run on its own. */
function openHighlightDownSheet(view: EditorView, target: FocusedCard): void {
  // NON-MODAL, matching the cut panel: refining is an iterative act —
  // the user needs to read the live card, and to point at parts of it
  // with U / D, while deciding what to ask for. A modal overlay made
  // both impossible (it dimmed the card and swallowed every keystroke).
  const dialog = document.createElement('div');
  dialog.className = 'pmd-cardcutter-panel';

  const header = document.createElement('div');
  header.className = 'pmd-route-header';
  header.textContent = 'Refine highlighting';
  dialog.appendChild(header);
  dialog.appendChild(cardIdentityRow(view, target));

  // Same dashed "this is what I'll act on" box as the cut panel.
  const targetBox = new AiWorkingBox('target');
  targetBox.show(view, { from: target.cardFrom, to: target.cardTo });
  const retrackBox = (): void => {
    const live = target.cardId ? resolveCardById(view, target.cardId) : null;
    if (live) targetBox.setRange({ from: live.cardFrom, to: live.cardTo });
  };

  const close = (discardFlags = true): void => {
    if (discardFlags) clearCutterFlags(view);
    targetBox.hide();
    dialog.remove();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('keyup', retrackBox, true);
    document.removeEventListener('mouseup', retrackBox, true);
  };
  const inPanelInput = (t: EventTarget | null): boolean =>
    t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      run();
      return;
    }
    // U / D annotate the live card, exactly as in the cut panel — so a
    // refine can be steered by pointing as well as by typing.
    if (e.metaKey || e.ctrlKey || e.altKey || inPanelInput(e.target)) return;
    const k = e.key.toLowerCase();
    if (k !== 'u' && k !== 'd') return;
    e.preventDefault();
    e.stopPropagation();
    const flag = addCutterFlag(view, k === 'u' ? 'up' : 'down');
    if (!flag) {
      showToast(`Select text in the card, then press ${k.toUpperCase()}.`);
      return;
    }
    appendFlagRow(flag);
  };

  // ── Composable settings (all optional) ──
  let dropRedundancy = false;
  let skeletonize = false;
  let allowAdd = false;
  const toggleSection = document.createElement('div');
  toggleSection.className = 'pmd-cardcutter-section pmd-cardcutter-chips';
  const toggleChip = (text: string, onToggle: (on: boolean) => void): void => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pmd-cardcutter-chip';
    b.textContent = text;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      onToggle(on);
    });
    toggleSection.appendChild(b);
  };
  toggleChip('Drop redundancy', (on) => (dropRedundancy = on));
  toggleChip('Skeletonize', (on) => (skeletonize = on));
  toggleChip('Allow adding highlighting', (on) => (allowAdd = on));
  dialog.appendChild(toggleSection);

  // ── Target length (optional; None by default) ──
  let chosenSec: number | null = null;
  const section = document.createElement('div');
  section.className = 'pmd-cardcutter-section';
  section.appendChild(label('Target length (optional)'));
  const row = document.createElement('div');
  row.className = 'pmd-cardcutter-chips';
  const wpm = firstReaderWpm();
  const pressTarget = (active: HTMLButtonElement): void =>
    row.querySelectorAll('.pmd-cardcutter-chip').forEach((c) =>
      c.setAttribute('aria-pressed', String(c === active)),
    );
  const noneChip = document.createElement('button');
  noneChip.type = 'button';
  noneChip.className = 'pmd-cardcutter-chip';
  noneChip.textContent = 'None';
  noneChip.setAttribute('aria-pressed', 'true');
  noneChip.addEventListener('click', () => {
    chosenSec = null;
    pressTarget(noneChip);
  });
  row.appendChild(noneChip);
  for (const sec of READ_TIME_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pmd-cardcutter-chip';
    b.textContent = `${sec}s · ~${Math.round((sec * wpm) / 60)}w`;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      chosenSec = sec;
      pressTarget(b);
    });
    row.appendChild(b);
  }
  section.appendChild(row);
  dialog.appendChild(section);

  // ── Free-text guidance (optional; can run on its own) ──
  const fbSection = document.createElement('div');
  fbSection.className = 'pmd-cardcutter-section';
  fbSection.appendChild(label('Guidance (optional)'));
  const feedbackEl = document.createElement('textarea');
  feedbackEl.className = 'pmd-cardcutter-feedback';
  feedbackEl.rows = 2;
  feedbackEl.placeholder = 'e.g. keep the strongest impact phrasing; drop the China comparison';
  fbSection.appendChild(feedbackEl);
  dialog.appendChild(fbSection);

  // ── Point at parts of the card (U / D) ──
  const flagSection = document.createElement('div');
  flagSection.className = 'pmd-cardcutter-section';
  flagSection.appendChild(label('Play up / play down (optional)'));
  const flagHint = document.createElement('div');
  flagHint.className = 'pmd-cardcutter-flag-hint';
  flagHint.innerHTML =
    'Select text in the card, then press <kbd>U</kbd> to play up (green) or <kbd>D</kbd> to play down (red).';
  flagSection.appendChild(flagHint);
  const flagList = document.createElement('div');
  flagSection.appendChild(flagList);
  const appendFlagRow = (f: CutFlag): void => {
    flagList.appendChild(flagRow(view, f));
  };
  for (const f of pendingCutterFlags()) appendFlagRow(f);
  dialog.appendChild(flagSection);

  const buttons = document.createElement('div');
  buttons.className = 'pmd-text-prompt-buttons';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'pmd-route-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => close());
  buttons.appendChild(cancel);
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'pmd-text-prompt-ok';
  go.textContent = 'Refine';
  go.title = '⌘↩';
  go.addEventListener('click', run);
  buttons.appendChild(go);
  dialog.appendChild(buttons);

  function run(): void {
    const feedback = feedbackEl.value.trim();
    const flags = pendingCutterFlags();
    if (!dropRedundancy && !skeletonize && chosenSec === null && !feedback && flags.length === 0) {
      showToast('Pick a target or a setting, point at some text, or type guidance.');
      return;
    }
    // Keep the flags — refine consumes and clears them (and their tints).
    close(false);
    void refineHighlightFocusedCard(view, {
      ...(dropRedundancy ? { dropRedundancy: true } : {}),
      ...(skeletonize ? { skeletonize: true } : {}),
      ...(chosenSec !== null ? { readTimeSec: chosenSec } : {}),
      ...(feedback ? { feedback } : {}),
      ...(allowAdd ? { allowAdd: true } : {}),
      // Act on the card this sheet was opened for, not wherever the
      // cursor drifted while it was open (or while a sheet stacked
      // above it was being answered).
      ...(target.cardId ? { cardId: target.cardId } : {}),
    });
  }

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', retrackBox, true);
  document.addEventListener('mouseup', retrackBox, true);
  document.body.appendChild(dialog);
}

/** Post-cut review — the iteration loop. The cut is already applied;
 *  this panel offers the verdict on it. Accept (the default, ⌘↩ with
 *  nothing typed or flagged) simply closes. Otherwise the user points
 *  at regions with U / D — imprecise by design, the same feathered
 *  gesture as pre-cut — and/or types feedback, and Adjust sends ONE
 *  surgical model pass: smallest change that addresses the notes,
 *  everything else left exactly as highlighted. Then the panel reopens
 *  with fresh numbers, and the loop continues until Accept. (Exact
 *  by-the-character mark edits aren't this flow's job — that's just
 *  editing, available the moment the panel closes.) */
function openPostCutReview(view: EditorView, cardId: string): void {
  const target = resolveCardById(view, cardId);
  if (!target) return; // card gone (undo, delete) — nothing to review
  const stats = cardReadStats(view, cardId);

  const dialog = document.createElement('div');
  dialog.className = 'pmd-cardcutter-panel';

  const header = document.createElement('div');
  header.className = 'pmd-route-header';
  header.textContent = 'Review cut';
  dialog.appendChild(header);
  dialog.appendChild(cardIdentityRow(view, target));
  if (stats) {
    const statsRow = document.createElement('div');
    statsRow.className = 'pmd-cardcutter-stats';
    statsRow.textContent = `Read: ${stats.words}w \u00b7 ~${stats.seconds}s`;
    dialog.appendChild(statsRow);
  }

  const targetBox = new AiWorkingBox('target');
  targetBox.show(view, { from: target.cardFrom, to: target.cardTo });
  const retrackBox = (): void => {
    const live = resolveCardById(view, cardId);
    if (live) targetBox.setRange({ from: live.cardFrom, to: live.cardTo });
  };

  const close = (discardFlags = true): void => {
    if (discardFlags) clearCutterFlags(view);
    targetBox.hide();
    dialog.remove();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('keyup', retrackBox, true);
    document.removeEventListener('mouseup', retrackBox, true);
  };
  const inPanelInput = (t: EventTarget | null): boolean =>
    t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(); // accept-equivalent: the cut stays, notes are discarded
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Accept by default; with notes pending, ⌘↩ means "apply them".
      if (feedbackEl.value.trim() || pendingCutterFlags().length > 0) void adjust();
      else close();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || inPanelInput(e.target)) return;
    const k = e.key.toLowerCase();
    if (k !== 'u' && k !== 'd') return;
    e.preventDefault();
    e.stopPropagation();
    const flag = addCutterFlag(view, k === 'u' ? 'up' : 'down');
    if (!flag) {
      showToast(`Select text in the card, then press ${k.toUpperCase()}.`);
      return;
    }
    appendFlagRow(flag);
  };

  // ── Notes: point (U / D) and/or type ──
  const flagSection = document.createElement('div');
  flagSection.className = 'pmd-cardcutter-section';
  flagSection.appendChild(label('Not right? Point at it (optional)'));
  const flagHint = document.createElement('div');
  flagHint.className = 'pmd-cardcutter-flag-hint';
  flagHint.innerHTML =
    'Select roughly where, then press <kbd>U</kbd> to highlight more there or <kbd>D</kbd> to highlight less. Rough is fine \u2014 the model picks the words.';
  flagSection.appendChild(flagHint);
  const flagList = document.createElement('div');
  flagSection.appendChild(flagList);
  const appendFlagRow = (f: CutFlag): void => {
    flagList.appendChild(flagRow(view, f));
  };
  for (const f of pendingCutterFlags()) appendFlagRow(f);
  dialog.appendChild(flagSection);

  const fbSection = document.createElement('div');
  fbSection.className = 'pmd-cardcutter-section';
  fbSection.appendChild(label('Feedback (optional)'));
  const feedbackEl = document.createElement('textarea');
  feedbackEl.className = 'pmd-cardcutter-feedback';
  feedbackEl.rows = 2;
  feedbackEl.placeholder = 'e.g. the warrant about delay got lost \u2014 bring it back';
  fbSection.appendChild(feedbackEl);
  dialog.appendChild(fbSection);

  const buttons = document.createElement('div');
  buttons.className = 'pmd-text-prompt-buttons';
  const adjustBtn = document.createElement('button');
  adjustBtn.type = 'button';
  adjustBtn.className = 'pmd-route-cancel';
  adjustBtn.textContent = 'Adjust';
  adjustBtn.addEventListener('click', () => void adjust());
  buttons.appendChild(adjustBtn);
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'pmd-text-prompt-ok';
  accept.textContent = 'Accept';
  accept.title = '\u2318\u21a9';
  accept.addEventListener('click', () => close());
  buttons.appendChild(accept);
  dialog.appendChild(buttons);

  async function adjust(): Promise<void> {
    const feedback = feedbackEl.value.trim();
    if (!feedback && pendingCutterFlags().length === 0) {
      showToast('Point at a region (U / D) or type feedback \u2014 or Accept.');
      return;
    }
    // Keep the flags — the refine consumes and clears them.
    close(false);
    const ok = await refineHighlightFocusedCard(view, {
      cardId,
      surgical: true,
      // Adding must be possible: an "up" note is a request to read MORE.
      allowAdd: true,
      ...(feedback ? { feedback } : {}),
    });
    // Round again with fresh numbers — Accept is always the exit. On
    // failure reopen too (the notes are gone, but the loop survives).
    if (ok || resolveCardById(view, cardId)) openPostCutReview(view, cardId);
  }

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', retrackBox, true);
  document.addEventListener('mouseup', retrackBox, true);
  document.body.appendChild(dialog);
}

/** One annotation row: direction glyph, the quoted text, and a ✕ that
 *  removes both the row and its in-doc tint. Shared by the cut and
 *  refine panels — both point at text the same way. */
function flagRow(view: EditorView, f: CutFlag): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pmd-cardcutter-flag';
  const dir = document.createElement('span');
  dir.className = `pmd-cardcutter-flag-dir is-${f.kind}`;
  dir.textContent = f.kind === 'up' ? '▲' : '▼';
  row.appendChild(dir);
  const quote = document.createElement('span');
  quote.className = 'pmd-cardcutter-flag-text';
  const t = f.text.length > 90 ? `${f.text.slice(0, 87)}…` : f.text;
  quote.textContent = `“${t}”`;
  row.appendChild(quote);
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'pmd-cardcutter-flag-remove';
  x.textContent = '✕';
  x.title = 'Remove this annotation';
  x.addEventListener('click', () => {
    removeCutterFlag(view, f);
    row.remove();
  });
  row.appendChild(x);
  return row;
}

/** "Card: <tag> — Jump to card". Every panel that can outlive the
 *  moment it was opened (or stack with another) shows one, so which
 *  card a set of controls belongs to is never a guess. The jump button
 *  moves the cursor and scrolls, leaving the panel open. */
function cardIdentityRow(view: EditorView, target: FocusedCard): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pmd-cardcutter-card-id';
  const name = document.createElement('span');
  name.className = 'pmd-cardcutter-card-id-text';
  name.textContent = cardLabel(target);
  name.title = target.card.tag || '';
  row.appendChild(name);
  if (target.cardId) {
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'pmd-cardcutter-card-id-jump';
    jump.textContent = 'Jump to card';
    jump.addEventListener('click', () => {
      if (!jumpToCard(view, target.cardId!)) {
        showToast('That card is no longer in the document.');
      }
    });
    row.appendChild(jump);
  }
  return row;
}

function label(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'pmd-cardcutter-label';
  el.textContent = text;
  return el;
}

function firstReaderWpm(): number {
  const r = settings.get('readers');
  return r[0]?.wpm && r[0].wpm > 0 ? r[0].wpm : 350;
}
