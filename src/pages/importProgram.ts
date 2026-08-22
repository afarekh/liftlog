import { parseBundle, type BundleResult, type ImportResult } from '../services/programImport';
import { S, FST7 } from '../store/state';
import { saveS, KEYS } from '../services/storage';
import { cloudSave } from '../services/firebase';
import { ilToast, ilConfirm } from '../utils/ui';

const $ = (id: string) => document.getElementById(id);

let _parsed: BundleResult | null = null;
const _startDate = '';

function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function renderPreview(): void {
  const box = $('impPreview');
  const actions = $('impActions');
  if (!box || !actions) return;

  if (!_parsed) { box.innerHTML = ''; actions.style.display = 'none'; return; }

  let h = '';

  if (_parsed.errors.length) {
    h += `<div class="imp-block imp-bad"><div class="imp-block-t">Can't import this yet</div>` +
      _parsed.errors.slice(0, 8).map(e => `<div class="imp-line">${esc(e)}</div>`).join('') +
      (_parsed.errors.length > 8 ? `<div class="imp-line">…and ${_parsed.errors.length - 8} more</div>` : '') +
      `</div>`;
  }

  if (_parsed.warnings.length) {
    h += `<div class="imp-block imp-warn"><div class="imp-block-t">Worth checking</div>` +
      _parsed.warnings.slice(0, 5).map(w => `<div class="imp-line">${esc(w)}</div>`).join('') + `</div>`;
  }

  if (_parsed.ok) {
    _parsed.programs.forEach((r: ImportResult) => {
      const p = r.program!, s = r.summary!;
      const vol = Object.entries(s.weeklySets).sort((a, b) => b[1] - a[1])
        .map(([m, n]) => `<span class="imp-chip">${esc(m)} · ${n}</span>`).join('');
      h += `<div class="imp-block imp-good">
        <div class="imp-block-t">${esc(p.name)} <span class="imp-tag">to library</span></div>
        <div class="imp-line">${p.weeks} weeks · ${s.days} days/week · ${s.exercises} exercises</div>
        ${s.overrideWeeks.length ? `<div class="imp-line">Week overrides: ${s.overrideWeeks.join(', ')}</div>` : ''}
        <div class="imp-chips">${vol}</div>
      </div>`;
    });
    h += `<div class="imp-note">Saved to your library — review it, then activate when you're ready.</div>`;
  }

  box.innerHTML = h;
  actions.style.display = _parsed.ok ? '' : 'none';
}

function validate(): void {
  const ta = $('impText') as HTMLTextAreaElement | null;
  const text = (ta?.value || '').trim();
  if (!text) { _parsed = null; renderPreview(); ilToast('Paste your program JSON first.', 'info'); return; }
  _parsed = parseBundle(text, _startDate);
  renderPreview();
}

/** Write a parsed program into the saved-program library, matching the wizard. */
function saveToLibrary(r: ImportResult): void {
  const p = r.program!;
  const saved = JSON.parse(localStorage.getItem(KEYS.savedProgs) || '[]');
  const entry = {
    name: p.name, weeks: p.weeks, days: p.days || (p.dayPrograms || []).length,
    startDate: '', schedule: p.schedule,
    dayPrograms: p.dayPrograms, weekOverrides: p.weekOverrides || {},
  };
  const idx = saved.findIndex((x: { name?: string }) => x.name === p.name);
  if (idx >= 0) saved[idx] = entry; else saved.push(entry);
  localStorage.setItem(KEYS.savedProgs, JSON.stringify(saved));

  // Importing a name that was deleted before revives it, so its tombstone has
  // to go — otherwise the next sync would quietly delete it again.
  const tombs = JSON.parse(localStorage.getItem(KEYS.deletedProgs) || '[]') as string[];
  if (tombs.includes(p.name)) {
    localStorage.setItem(KEYS.deletedProgs, JSON.stringify(tombs.filter(t => t !== p.name)));
  }
}

function doImport(): void {
  if (!_parsed || !_parsed.ok || !_parsed.programs.length) return;

  _parsed.programs.forEach(saveToLibrary);
  cloudSave();
  closeImport();

  const w = window as unknown as {
    renderWorkouts: () => void; switchWTab: (n: number) => void; goPage: (n: number) => void;
  };
  w.renderWorkouts();
  w.goPage(2);
  w.switchWTab(1);

  const n = _parsed.programs.length;
  const first = _parsed.programs[0].program!.name;
  setTimeout(() => ilToast(
    n > 1 ? `${n} programs imported — activate one when ready` : `"${first}" imported — activate it when ready`,
    'success'), 150);
}

export function openImport(): void {
  _parsed = null;
  const ta = $('impText') as HTMLTextAreaElement | null;
  if (ta) ta.value = '';
  renderPreview();
  $('ilImport')?.classList.add('open');
}

export function closeImport(): void { $('ilImport')?.classList.remove('open'); }

export function initImport(): void {
  $('impValidateBtn')?.addEventListener('click', validate);
  $('impImportBtn')?.addEventListener('click', doImport);
  $('impCloseBtn')?.addEventListener('click', closeImport);

  $('impFileBtn')?.addEventListener('click', () => ($('impFile') as HTMLInputElement | null)?.click());
  $('impFile')?.addEventListener('change', e => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const ta2 = $('impText') as HTMLTextAreaElement | null;
      if (ta2) ta2.value = String((ev.target as FileReader).result || '');
      validate();
    };
    reader.readAsText(f);
    (e.target as HTMLInputElement).value = '';
  });

  const bg = $('ilImport');
  bg?.addEventListener('click', e => { if (e.target === bg) closeImport(); });
}

/**
 * Drop an active program that has no exercises attached. Its library copy, its
 * logged workouts and everything else are left alone — only the broken active
 * pointer goes.
 */
export function clearEmptyProgram(): void {
  ilConfirm('Clear this empty program? Your workout history and saved programs are kept.', () => {
    S.prog = null;
    FST7.length = 0;
    saveS();
    const w = window as unknown as { renderHome: () => void; renderCal: () => void; renderStats: () => void };
    w.renderHome(); w.renderCal(); w.renderStats();
    ilToast('Cleared', 'success');
  }, 'Clear', true);
}
