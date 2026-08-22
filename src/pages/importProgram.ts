import { parseBundle, type BundleResult, type ImportResult } from '../services/programImport';
import { S, FST7 } from '../store/state';
import { saveS, KEYS } from '../services/storage';
import { cloudSave } from '../services/firebase';
import { ilToast, ilDatePick } from '../utils/ui';
import { todayYMD } from '../utils/date';

const $ = (id: string) => document.getElementById(id);

let _parsed: BundleResult | null = null;
let _startDate = todayYMD();

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
    _parsed.programs.forEach((r: ImportResult, i) => {
      const p = r.program!, s = r.summary!;
      const vol = Object.entries(s.weeklySets).sort((a, b) => b[1] - a[1])
        .map(([m, n]) => `<span class="imp-chip">${esc(m)} · ${n}</span>`).join('');
      h += `<div class="imp-block imp-good">
        <div class="imp-block-t">${esc(p.name)}${i === 0 ? ' <span class="imp-tag">activates</span>' : ' <span class="imp-tag imp-tag-q">to library</span>'}</div>
        <div class="imp-line">${p.weeks} weeks · ${s.days} days/week · ${s.exercises} exercises</div>
        ${s.overrideWeeks.length ? `<div class="imp-line">Week overrides: ${s.overrideWeeks.join(', ')}</div>` : ''}
        <div class="imp-chips">${vol}</div>
      </div>`;
    });
    h += `<div class="imp-note">Starts ${esc(_startDate)} — change it on the next screen.</div>`;
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
}

function doImport(): void {
  if (!_parsed || !_parsed.ok || !_parsed.programs.length) return;

  ilDatePick(ds => {
    _startDate = ds;

    // Everything lands in the library; the first also becomes active.
    _parsed!.programs.forEach(r => { r.program!.startDate = ds; saveToLibrary(r); });

    const main = _parsed!.programs[0];
    const p = main.program!;
    S.prog = p;

    FST7.length = 0;
    (p.dayPrograms || []).forEach((d, i) => {
      FST7.push({
        day: d.name || 'Day ' + (i + 1),
        name: d.name || 'Day ' + (i + 1),
        muscles: [...new Set(d.exercises.map(e => e.muscle))],
        exercises: d.exercises.map(e => ({ ...e })),
      });
    });

    saveS();
    cloudSave();
    closeImport();

    const extra = _parsed!.programs.length - 1;
    (window as unknown as { renderHome: () => void }).renderHome();
    (window as unknown as { renderCal: () => void }).renderCal();
    (window as unknown as { renderWorkouts: () => void }).renderWorkouts();
    (window as unknown as { renderStats: () => void }).renderStats();
    (window as unknown as { goPage: (n: number) => void }).goPage(0);

    setTimeout(() => ilToast(
      extra > 0 ? `"${p.name}" activated · ${extra} more saved` : `"${p.name}" activated!`,
      'success'), 200);
  }, _startDate);
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
