import { SESSION } from '../store/state';
import { getPrev } from '../utils/helpers';
import type { SetEntry } from '../types';

// Tracks which exercise cards are manually expanded. null = not yet initialised.
let expanded: Set<number> | null = null;
let lastActiveIdx = -2;

export function resetSPExpanded(): void {
  expanded = null;
  lastActiveIdx = -2;
}

function setTable(ei: number, ex: any, showNext: boolean, isLast: boolean): string {
  const sets = ex.sets as SetEntry[];
  const prev = getPrev(ex.name);
  const prevStr = prev ? `${prev.kg}×${prev.reps}` : '—';
  const firstNonDoneIdx = sets.findIndex(s => !s.done);

  const rows = sets.map((s, si) => {
    const isDone = s.done;
    const isActive = si === firstNonDoneIdx;
    const snCls = isDone ? 'sn c-done' : isActive ? 'sn c-active' : 'sn';
    const inputCls = isDone ? 'si dn' : isActive ? 'si c-active' : 'si';
    const tickCls = isDone ? 'tk dn' : isActive ? 'tk c-active' : 'tk';
    const checkColor = isDone ? 'var(--ink)' : isActive ? 'var(--lime)' : 'var(--ink3)';
    return `<div class="srow">
      <div class="${snCls}">${si + 1}</div>
      <div class="sprev">${prevStr}</div>
      <input class="${inputCls}" type="number" inputmode="decimal" value="${s.kg}" placeholder="—"
        onchange="setV(${ei},${si},'kg',this.value)"
        onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth',block:'center'}),300)">
      <input class="${inputCls}" type="number" inputmode="decimal" value="${s.reps}" placeholder="—"
        onchange="setV(${ei},${si},'reps',this.value)"
        onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth',block:'center'}),300)">
      <button class="${tickCls}" onclick="tickSet(${ei},${si})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${checkColor}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5 11-11"/></svg>
      </button>
    </div>`;
  }).join('');

  const nextBtn = showNext ? `<button class="ex-next-btn" onclick="nextExercise(${ei})">
      ${isLast ? 'FINISH EXERCISE' : 'DONE · NEXT EXERCISE'}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    </button>` : '';

  return `<div class="eb-body">
    ${ex.note ? `<div class="eb-note">${ex.note}</div>` : ''}
    <div class="sth-row">
      <div>SET</div><div>PREV</div><div style="text-align:center">KG</div><div style="text-align:center">REPS</div><div></div>
    </div>
    ${rows}
    <div class="set-adj-row">
      <button class="rm-set-btn" onclick="delSet(${ei},${sets.length - 1})" ${sets.length <= 1 ? 'disabled style="opacity:0.4"' : ''}>
        <div style="width:14px;height:2.4px;border-radius:2px;background:var(--ink2)"></div>
      </button>
      <button class="add-set" onclick="addSet(${ei})">+ ADD SET</button>
    </div>
    ${nextBtn}
    <button class="swpbtn" onclick="openSM(${ei})">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
      Swap exercise
    </button>
  </div>`;
}

function exCard(ei: number, ex: any, state: 'done' | 'active' | 'upcoming', isOpen: boolean, isLast: boolean): string {
  const sets = ex.sets as SetEntry[];
  const doneSets = sets.filter(s => s.done).length;

  // Leading chip: check for done, number otherwise
  const lead = state === 'done'
    ? `<div class="eb-lead lead-done"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5 11-11"/></svg></div>`
    : `<div class="eb-lead lead-${state}">${ei + 1}</div>`;

  // Collapsed summary line
  let sub = '';
  if (state === 'done') {
    const filled = sets.filter(s => s.kg || s.reps);
    sub = filled.length > 0
      ? `${filled.length} set${filled.length > 1 ? 's' : ''} · ${filled.slice(0, 3).map(s => `${s.kg || '—'}×${s.reps || '—'}`).join(', ')}`
      : `${sets.length} sets logged`;
  } else if (state === 'active') {
    sub = `${doneSets}/${sets.length} sets done`;
  } else {
    const prev = getPrev(ex.name);
    sub = `${sets.length} × ${ex.reps}${prev ? ` · last ${prev.kg}×${prev.reps}` : ''}`;
  }

  const body = isOpen ? setTable(ei, ex, state === 'active', isLast) : '';

  return `<div class="exb exb-${state}${isOpen ? ' open' : ''}" id="eb${ei}">
    <button class="eb-hdr" onclick="toggleEx(${ei})">
      ${lead}
      <div class="eb-hdr-txt">
        <div class="eb-num">${ex.muscle}</div>
        <div class="eb-name${ex.fst7 ? ' fst' : ''}">${ex.fst7 ? '★ ' : ''}${ex.name}</div>
        <div class="eb-sub">${sub}</div>
      </div>
      <svg class="eb-chev${isOpen ? ' open' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    ${body}
  </div>`;
}

export function renderSP(): void {
  if (!SESSION) return;
  const tot = SESSION.exercises.length;
  const activeIdx = SESSION.exercises.findIndex(e => !(e.sets as SetEntry[]).every(s => s.done));

  // Initialise / auto-expand the active exercise
  if (expanded === null) {
    expanded = new Set();
    if (activeIdx !== -1) expanded.add(activeIdx);
  }
  if (activeIdx !== lastActiveIdx) {
    if (activeIdx !== -1) expanded.add(activeIdx);
    lastActiveIdx = activeIdx;
  }

  // Update progress dots
  const pfillEl = document.getElementById('spPFill');
  if (pfillEl) {
    pfillEl.innerHTML = SESSION.exercises.map((_, i) => {
      const allDone = (SESSION!.exercises[i].sets as SetEntry[]).every(s => s.done);
      let cls = 'sp-dot-seg';
      if (allDone) cls += ' done';
      else if (i === activeIdx) cls += ' active';
      return `<div class="${cls}"></div>`;
    }).join('');
  }

  // Update header title with exercise progress
  const titleEl = document.getElementById('spTitle');
  if (titleEl) {
    titleEl.textContent = activeIdx === -1
      ? `All ${tot} done`
      : `Exercise ${activeIdx + 1} / ${tot}`;
  }

  const exListEl = document.getElementById('spExList');
  if (!exListEl) return;

  const doneCount = activeIdx === -1 ? tot : activeIdx;
  let html = '';

  // DONE section
  if (doneCount > 0) {
    html += `<div class="sp-sec-lbl">DONE · ${doneCount}</div>`;
    for (let ei = 0; ei < doneCount; ei++) {
      html += exCard(ei, SESSION.exercises[ei], 'done', expanded.has(ei), ei === tot - 1);
    }
  }

  // IN PROGRESS section
  if (activeIdx !== -1) {
    html += `<div class="sp-sec-lbl active-lbl" style="margin-top:${doneCount > 0 ? '16px' : '0'}">IN PROGRESS</div>`;
    html += exCard(activeIdx, SESSION.exercises[activeIdx], 'active', expanded.has(activeIdx), activeIdx === tot - 1);
  }

  // UP NEXT section
  const upNextStart = activeIdx === -1 ? tot : activeIdx + 1;
  if (upNextStart < tot) {
    const remaining = tot - upNextStart;
    html += `<div class="sp-sec-lbl" style="margin-top:16px">UP NEXT · ${remaining} LEFT</div>`;
    for (let ei = upNextStart; ei < tot; ei++) {
      html += exCard(ei, SESSION.exercises[ei], 'upcoming', expanded.has(ei), ei === tot - 1);
    }
  }

  exListEl.innerHTML = html;
}

export function toggleEx(ei: number): void {
  if (!expanded) expanded = new Set();
  if (expanded.has(ei)) expanded.delete(ei);
  else expanded.add(ei);
  renderSP();
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
  const sets = SESSION.exercises[ei].sets as SetEntry[];
  const last = sets[sets.length - 1];
  SESSION.exercises[ei].sets.push({ kg: last?.kg || '', reps: last?.reps || '', done: false });
  renderSP();
}

export function delSet(ei: number, si: number): void {
  if (!SESSION) return;
  const sets = SESSION.exercises[ei].sets as SetEntry[];
  if (sets.length <= 1) return;
  sets.splice(si, 1);
  renderSP();
}

export function nextExercise(ei: number): void {
  if (!SESSION) return;
  const sets = SESSION.exercises[ei].sets as SetEntry[];
  sets.forEach(s => { s.done = true; });
  expanded?.delete(ei);
  renderSP();
  document.getElementById('spExList')?.scrollTo({ top: 0, behavior: 'smooth' });
}
