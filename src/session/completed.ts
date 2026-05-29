import { fmt, parseYMD } from '../utils/date';
import type { WorkoutLog } from '../types';

export function openCV(w: WorkoutLog): void {
  const date = parseYMD(w.date);
  const totalSets = (w.exercises || []).reduce((a, e) => {
    const sets = e.sets as Array<{ done: boolean }>;
    return a + sets.filter(s => s.done).length;
  }, 0);

  const titleEl = document.getElementById('cvTitle');
  const subEl = document.getElementById('cvSub');
  const durEl = document.getElementById('cvDur');
  const exCEl = document.getElementById('cvExC');
  const setCEl = document.getElementById('cvSetC');
  const rb = document.getElementById('cvRestartBtn') as HTMLButtonElement | null;

  if (titleEl) titleEl.textContent = w.dayLabel || 'Session';
  if (subEl) subEl.textContent = fmt(date);
  if (rb) { rb.dataset['date'] = w.date; rb.dataset['dayidx'] = String(w.dayIdx || 0); }
  if (durEl) durEl.textContent = w.duration || '—';
  if (exCEl) exCEl.textContent = `${(w.exercises || []).length} exercises`;
  if (setCEl) setCEl.textContent = `${totalSets} sets`;

  const exListEl = document.getElementById('cvExList');
  if (exListEl) {
    exListEl.innerHTML = (w.exercises || []).map(e => {
      const sets = e.sets as Array<{ kg: string; reps: string; done: boolean }>;
      const rows = sets.filter(s => s.done).map((s, i) =>
        `<div class="cex-row"><span>Set ${i + 1}</span><strong>${s.kg || 'BW'}kg</strong><span>×</span><strong>${s.reps || '?'} reps</strong></div>`
      ).join('');
      return `<div class="cex">
        <div class="cex-hdr">
          <div class="cex-n${e.fst7 ? ' fst' : ''}">${e.fst7 ? '★ ' : ''}${e.name}</div>
          <span class="cex-b">${sets.filter(s => s.done).length} sets</span>
        </div>${rows}
      </div>`;
    }).join('');
  }

  const cvEl = document.getElementById('CV');
  if (cvEl) { cvEl.classList.add('open'); cvEl.scrollTop = 0; }
  history.pushState({ v: 'cv' }, '');
}

export function closeCV(): void {
  const cvEl = document.getElementById('CV');
  if (cvEl) cvEl.classList.remove('open');
}
