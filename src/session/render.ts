import { SESSION, setSession } from '../store/state';
import { chip } from '../utils/helpers';
import { getPrev } from '../utils/helpers';
import type { SetEntry } from '../types';

export function renderSP(): void {
  if (!SESSION) return;
  const tot = SESSION.exercises.length;
  const done = SESSION.exercises.filter(e => e.sets.every(s => (s as SetEntry).done)).length;
  const pfillEl = document.getElementById('spPFill');
  const plblEl = document.getElementById('spPLbl');
  if (pfillEl) pfillEl.style.width = `${tot ? (done / tot) * 100 : 0}%`;
  if (plblEl) plblEl.textContent = `${done}/${tot}`;

  const exListEl = document.getElementById('spExList');
  if (!exListEl) return;
  exListEl.innerHTML = SESSION.exercises.map((ex, ei) => {
    const sets = ex.sets as SetEntry[];
    const allDone = sets.every(s => s.done);
    const prev = getPrev(ex.name);
    const rows = sets.map((s, si) => `
      <div class="srow">
        <div class="sn">${si + 1}</div>
        <div class="sw">
          <input class="si${s.done ? ' dn' : ''}" type="number" value="${s.kg}" placeholder="${prev ? prev.kg : ''}"
            onchange="setV(${ei},${si},'kg',this.value)"
            onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth',block:'center'}),300)">
          <div class="ph">${prev ? 'prev ' + prev.kg : ''}</div>
        </div>
        <div class="sw">
          <input class="si${s.done ? ' dn' : ''}" type="number" value="${s.reps}" placeholder="${prev ? prev.reps : ''}"
            onchange="setV(${ei},${si},'reps',this.value)"
            onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth',block:'center'}),300)">
          <div class="ph">${prev ? 'prev ' + prev.reps : ''}</div>
        </div>
        <button class="tk${s.done ? ' dn' : ''}" onclick="tickSet(${ei},${si})">${s.done ? '✅' : '○'}</button>
        <button class="dx" onclick="delSet(${ei},${si})">×</button>
      </div>`).join('');
    return `<div class="exb${allDone ? ' done' : ''}" id="eb${ei}">
      <div class="eb-hdr">
        <div class="eb-top">
          <div>
            <div class="eb-num">Exercise ${ei + 1} of ${tot} · ${ex.muscle}</div>
            <div class="eb-name${ex.fst7 ? ' fst' : ''}">${ex.fst7 ? '★ ' : ''}${ex.name}</div>
          </div>
          ${allDone ? '<div class="eb-done">✅ Done</div>' : ''}
        </div>
        <div class="eb-meta">
          ${chip('Rx: ' + sets.length + '×' + ex.reps)}
          <button class="swpbtn" onclick="openSM(${ei})">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
            Swap
          </button>
        </div>
        ${ex.note ? `<div class="eb-note">${ex.note}</div>` : ''}
      </div>
      <div class="sth-row">
        <div class="sth">#</div><div class="sth">KG</div><div class="sth">REPS</div><div class="sth">✓</div><div></div>
      </div>
      ${rows}
      <button class="add-set" onclick="addSet(${ei})">+ Add Set</button>
    </div>`;
  }).join('');
}

export function setV(ei: number, si: number, f: 'kg' | 'reps', v: string): void {
  if (!SESSION || !SESSION.exercises[ei] || !SESSION.exercises[ei].sets[si]) return;
  (SESSION.exercises[ei].sets[si] as SetEntry)[f] = v;
}

export function tickSet(ei: number, si: number): void {
  if (!SESSION) return;
  const s = SESSION.exercises[ei].sets[si] as SetEntry;
  s.done = !s.done;
  renderSP();
}

export function addSet(ei: number): void {
  if (!SESSION) return;
  SESSION.exercises[ei].sets.push({ kg: '', reps: '', done: false });
  renderSP();
}

export function delSet(ei: number, si: number): void {
  if (!SESSION) return;
  SESSION.exercises[ei].sets.splice(si, 1);
  renderSP();
}
