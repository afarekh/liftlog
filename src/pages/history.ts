import { S, progMG, progExes, setProgMG, setProgExes } from '../store/state';
import { EX } from '../data/exercises';
import { fmt, fmtD, parseYMD } from '../utils/date';
import { ilToast } from '../utils/ui';

export function renderHistory(): void {
  const sess = [...S.workouts].sort((a, b) => b.date.localeCompare(a.date));
  const sessNEl = document.getElementById('hSessN');
  const setsNEl = document.getElementById('hSetsN');
  if (sessNEl) sessNEl.textContent = String(sess.length);
  const tot = sess.reduce((a, w) => a + (w.exercises || []).reduce((b, e) => {
    const sets = e.sets as Array<{ done: boolean }>;
    return b + sets.filter(s => s.done).length;
  }, 0), 0);
  if (setsNEl) setsNEl.textContent = String(tot);

  const histEl = document.getElementById('histList');
  if (!histEl) return;
  if (!sess.length) {
    histEl.innerHTML = '<div class="empty"><div class="empty-ic">📋</div><div class="empty-t">No sessions yet</div><div class="empty-s">Complete your first workout to see history.</div></div>';
    return;
  }
  histEl.innerHTML = sess.map(w => {
    const date = parseYMD(w.date);
    const sets = w.exercises as Array<{ sets: Array<{ done: boolean }>; name: string; fst7?: boolean }>;
    const ts = sets.reduce((a, e) => a + (e.sets || []).filter(s => s.done).length, 0);
    const exD = (w.exercises || []).map(e => {
      const eSets = e.sets as Array<{ kg: string; reps: string; done: boolean }>;
      const rows = eSets.filter(s => s.done).map((s, i) =>
        `<div class="hd-set"><span>Set ${i + 1}</span><strong>${s.kg || 'BW'}kg</strong><span>×</span><strong>${s.reps || '?'} reps</strong></div>`
      ).join('');
      return `<div class="hd-ex"><div class="hd-exn">${e.fst7 ? '★ ' : ''}${e.name}</div>${rows}</div>`;
    }).join('');
    return `<div class="hcrd" onclick="this.querySelector('.hc-body').classList.toggle('open')">
      <div class="hc-hdr">
        <div class="hc-top"><div class="hc-dt">${fmt(date)}</div><div style="display:flex;align-items:center;gap:5px"><span class="chip">${w.style || 'High Volume'}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></div></div>
        <div class="hc-day">${w.dayLabel || 'Session'}</div>
        <div class="hc-met">${(w.exercises || []).length} exercises · ${ts} sets${w.duration ? ' · ⏱ ' + w.duration : ''}</div>
      </div>
      <div class="hc-body">${exD}</div>
    </div>`;
  }).join('');
}

export function switchHTab(n: number): void {
  const tab0 = document.getElementById('htab0');
  const tab1 = document.getElementById('htab1');
  const sessEl = document.getElementById('hpSess');
  const progEl = document.getElementById('hpProg');
  if (tab0) tab0.classList.toggle('active', n === 0);
  if (tab1) tab1.classList.toggle('active', n === 1);
  if (sessEl) sessEl.style.display = n === 0 ? 'block' : 'none';
  if (progEl) progEl.style.display = n === 1 ? 'block' : 'none';
  if (n === 1) renderProgTab();
}

export function renderProgTab(): void {
  setProgMG('');
  setProgExes([]);
  const progDataEl = document.getElementById('progData');
  const progExSecEl = document.getElementById('progExSec');
  if (progDataEl) progDataEl.style.display = 'none';
  if (progExSecEl) progExSecEl.style.display = 'none';
  const mgGrid = document.getElementById('progMGGrid');
  if (mgGrid) {
    mgGrid.innerHTML = Object.keys(EX).map(m =>
      `<button class="mgsbtn${m === progMG ? ' sel' : ''}" onclick="selProgMG('${m}')">${m}</button>`
    ).join('');
  }
}

export function selProgMG(m: string): void {
  setProgMG(m);
  setProgExes([]);
  document.querySelectorAll('.mgsbtn').forEach((b, i) => {
    b.classList.toggle('sel', Object.keys(EX)[i] === m);
  });
  const progExSecEl = document.getElementById('progExSec');
  const progDataEl = document.getElementById('progData');
  if (progExSecEl) progExSecEl.style.display = 'block';
  if (progDataEl) progDataEl.style.display = 'none';
  const progExList = document.getElementById('progExList');
  if (progExList) {
    progExList.innerHTML = (EX[m] || []).map(e =>
      `<div class="eprow${progExes.includes(e) ? ' picked' : ''}" onclick="toggleProgEx('${e.replace(/'/g, "\\'")}')">
        ${e}${progExes.includes(e) ? '<span style="color:var(--gd);font-weight:800">✓</span>' : '<span style="color:#ccc">+</span>'}
      </div>`
    ).join('');
  }
}

export function toggleProgEx(name: string): void {
  const i = progExes.indexOf(name);
  if (i >= 0) progExes.splice(i, 1);
  else progExes.push(name);
  selProgMG(progMG);
}

export function showProgData(): void {
  if (!progExes.length) { ilToast('Select at least one exercise.', 'error'); return; }
  const progDataEl = document.getElementById('progData');
  if (progDataEl) progDataEl.style.display = 'block';
  const data: Array<{ date: string; ex: string; kg: number; reps: number }> = [];
  S.workouts.forEach(w => {
    (w.exercises || []).forEach(e => {
      if (progExes.includes(e.name)) {
        const sets = e.sets as Array<{ kg: string; reps: string; done: boolean }>;
        sets.filter(s => s.done && s.kg).forEach(s => {
          data.push({ date: w.date, ex: e.name, kg: parseFloat(s.kg) || 0, reps: parseInt(s.reps) || 0 });
        });
      }
    });
  });
  const maxE = data.reduce((b, d) => (!b || d.kg > b.kg) ? d : b, null as typeof data[0] | null);
  const maxBanEl = document.getElementById('maxBan');
  if (maxBanEl) {
    maxBanEl.innerHTML = maxE
      ? `<div class="max-ban">
          <div><div class="mb-lbl">Max Weight · ${progMG}</div>
            <div class="mb-val">${maxE.kg} <span style="font-size:13px;opacity:.6">kg</span></div>
            <div class="mb-sub">${maxE.ex} · ${fmtD(parseYMD(maxE.date))}</div>
          </div>
          <div class="mb-chg">↑</div>
        </div>`
      : '<div class="max-ban"><div style="color:rgba(255,255,255,.5);font-size:12px">Complete sessions first to see max weight.</div></div>';
  }

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const cc = document.getElementById('progChart');
  if (cc && sorted.length >= 2) {
    const maxK = Math.max(...sorted.map(d => d.kg)), minK = Math.min(...sorted.map(d => d.kg));
    const W = 260, H = 80, P = 5;
    const pts = sorted.map((d, i) => [P + (i / (sorted.length - 1)) * (W - P * 2), H - P - ((d.kg - minK) / (maxK - minK || 1)) * (H - P * 2), d] as [number, number, typeof d]);
    const poly = pts.map(([x, y]) => `${x},${y}`).join(' ');
    const area = `M${pts[0][0]},${pts[0][1]} ` + pts.slice(1).map(([x, y]) => `L${x},${y}`).join(' ') + ` L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`;
    cc.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:12px;font-weight:800">Weight Progression</div><div style="font-size:10px;color:var(--muted)">${sorted.length} points</div></div>
      <svg width="100%" viewBox="0 0 ${W} ${H + 15}" style="overflow:visible">
        <line x1="${P}" y1="${P}" x2="${W - P}" y2="${P}" stroke="#F5F5F5" stroke-width="1"/>
        <line x1="${P}" y1="${H / 2}" x2="${W - P}" y2="${H / 2}" stroke="#F5F5F5" stroke-width="1"/>
        <line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="#F0F0F0" stroke-width="1"/>
        <path d="${area}" fill="rgba(76,175,80,.08)"/>
        <polyline points="${poly}" fill="none" stroke="#4CAF50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${pts.map(([x, y, d], i) => `<circle cx="${x}" cy="${y}" r="${i === pts.length - 1 ? 4.5 : 3}" fill="${i === pts.length - 1 ? 'white' : '#4CAF50'}" stroke="${i === pts.length - 1 ? '#4CAF50' : 'none'}" stroke-width="2.5"/>`).join('')}
      </svg>`;
  } else if (cc) {
    cc.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Not enough data to chart yet.</div>';
  }

  const tbl = document.getElementById('progTbl');
  if (tbl) {
    tbl.innerHTML = `<div class="pt-hdr"><div class="pt-th">Date</div><div class="pt-th">Exercise</div><div class="pt-th">Weight</div><div class="pt-th">Reps</div></div>` +
      [...data].sort((a, b) => b.date.localeCompare(a.date)).map(d =>
        `<div class="ptrow"><div class="pt-d">${fmtD(parseYMD(d.date))}</div><div class="pt-e">${d.ex}</div><div class="pt-w">${d.kg}kg</div><div class="pt-r">${d.reps}</div></div>`
      ).join('');
  }
}
