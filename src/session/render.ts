import { SESSION, setSession } from '../store/state';
import { getPrev } from '../utils/helpers';
import type { SetEntry } from '../types';

export function renderSP(): void {
  if (!SESSION) return;
  const tot = SESSION.exercises.length;
  const activeIdx = SESSION.exercises.findIndex(e => !(e.sets as SetEntry[]).every(s => s.done));

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

  let html = '';

  // DONE section
  const doneCount = activeIdx === -1 ? tot : activeIdx;
  if (doneCount > 0) {
    html += `<div class="sp-sec-lbl">DONE · ${doneCount}</div>`;
    for (let ei = 0; ei < doneCount; ei++) {
      const ex = SESSION.exercises[ei];
      const sets = ex.sets as SetEntry[];
      const filled = sets.filter(s => s.kg || s.reps);
      const summary = filled.length > 0
        ? `${filled.length} set${filled.length > 1 ? 's' : ''} · ${filled.slice(0, 3).map(s => `${s.kg || '—'} × ${s.reps || '—'}`).join(', ')}`
        : `${sets.length} sets logged`;
      html += `<div class="exb-done-row">
        <div class="exb-done-check">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5 11-11"/></svg>
        </div>
        <div class="exb-done-info">
          <div class="exb-done-name">${ex.name}</div>
          <div class="exb-done-sub">${summary}</div>
        </div>
        <div class="exb-done-chev">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>`;
    }
  }

  // IN PROGRESS section
  if (activeIdx !== -1) {
    html += `<div class="sp-sec-lbl active-lbl">IN PROGRESS</div>`;
    const ex = SESSION.exercises[activeIdx];
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
          onchange="setV(${activeIdx},${si},'kg',this.value)"
          onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth',block:'center'}),300)">
        <input class="${inputCls}" type="number" inputmode="decimal" value="${s.reps}" placeholder="—"
          onchange="setV(${activeIdx},${si},'reps',this.value)"
          onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth',block:'center'}),300)">
        <button class="${tickCls}" onclick="tickSet(${activeIdx},${si})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${checkColor}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5 11-11"/></svg>
        </button>
      </div>`;
    }).join('');

    html += `<div class="exb" id="eb${activeIdx}">
      <div class="eb-hdr">
        <div class="eb-num">${ex.muscle}</div>
        <div class="eb-name${ex.fst7 ? ' fst' : ''}">${ex.fst7 ? '★ ' : ''}${ex.name}</div>
        ${ex.note ? `<div class="eb-note">${ex.note}</div>` : ''}
      </div>
      <div class="eb-body">
        <div class="sth-row">
          <div>SET</div><div>PREV</div><div style="text-align:center">KG</div><div style="text-align:center">REPS</div><div></div>
        </div>
        ${rows}
        <div class="set-adj-row">
          <button class="rm-set-btn" onclick="delSet(${activeIdx},${sets.length - 1})" ${sets.length <= 1 ? 'disabled style="opacity:0.4"' : ''}>
            <div style="width:14px;height:2.4px;border-radius:2px;background:var(--ink2)"></div>
          </button>
          <button class="add-set" onclick="addSet(${activeIdx})">+ ADD SET</button>
        </div>
        <button class="ex-next-btn" onclick="nextExercise(${activeIdx})">
          ${activeIdx === tot - 1 ? 'FINISH EXERCISE' : 'DONE · NEXT EXERCISE'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
        <button class="swpbtn" onclick="openSM(${activeIdx})">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
          Swap exercise
        </button>
      </div>
    </div>`;
  }

  // UP NEXT section — full interactive cards so user can view/pre-fill
  const upNextStart = activeIdx === -1 ? tot : activeIdx + 1;
  if (upNextStart < tot) {
    const remaining = tot - upNextStart;
    html += `<div style="margin-top:16px"><div class="sp-sec-lbl">UP NEXT · ${remaining} LEFT</div>`;
    for (let ei = upNextStart; ei < tot; ei++) {
      const ex = SESSION.exercises[ei];
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

      html += `<div class="exb exb-upcoming" id="eb${ei}">
        <div class="eb-hdr">
          <div class="eb-num">${ex.muscle}</div>
          <div class="eb-name${ex.fst7 ? ' fst' : ''}">${ex.fst7 ? '★ ' : ''}${ex.name}</div>
          ${ex.note ? `<div class="eb-note">${ex.note}</div>` : ''}
        </div>
        <div class="eb-body">
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
          <button class="swpbtn" onclick="openSM(${ei})">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
            Swap exercise
          </button>
        </div>
      </div>`;
    }
    html += `</div>`;
  }

  exListEl.innerHTML = html;
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
  renderSP();
  document.getElementById('spExList')?.scrollTo({ top: 0, behavior: 'smooth' });
}
