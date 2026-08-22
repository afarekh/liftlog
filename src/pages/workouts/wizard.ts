import { S, wiz, FST7, dragSrc, setDragSrc, patchWiz, setWiz } from '../../store/state';
import { EX, MG_ORDER } from '../../data/exercises';
import { fmtD, parseYMD, todayYMD, DOW_3 } from '../../utils/date';
import { saveS } from '../../services/storage';
import { cloudSave } from '../../services/firebase';
import { ilToast, ilConfirm, ilDatePick } from '../../utils/ui';
import { openAEM, registerWizHandlers } from '../../modals/addExercise';
import { renderHome } from '../home';
import { renderCal } from '../calendar';
import { renderStats } from '../stats';
import type { ExerciseEntry } from '../../types';

const LINK_ICO = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

export function initWizardHandlers(): void {
  registerWizHandlers(getWizDayExercises, setWizDayExercises, renderWizDay);
}

export function goWiz(step: number): void {
  patchWiz({ step });
  ['wps1','wps2','wps3'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'wiz-pseg' + (i + 1 < step ? ' done' : i + 1 === step ? ' act' : '');
  });
  const titles = ['Program Setup','Add Exercises','Review Program'];
  const titleEl = document.getElementById('wizHdrTitle');
  const subEl = document.getElementById('wizHdrSub');
  const ctxEl = document.getElementById('wizContext');
  if (titleEl) titleEl.textContent = titles[step - 1] || '';
  const name = wiz.name || '';
  const weeks = wiz.weeks || 8;
  const days = wiz.days || 5;
  if (subEl) subEl.textContent = name ? `${name} · ${weeks} weeks · ${days} days/wk` : '';
  if (ctxEl) ctxEl.style.display = 'none';
  [1, 2, 3].forEach(s => {
    const p = document.getElementById('wiz' + s);
    if (p) p.style.display = s === step ? 'block' : 'none';
  });
  if (step === 2) renderWizStep2();
  if (step === 3) renderWizStep3();
  saveS();
}

export function wizSetName(name: string): void {
  patchWiz({ name });
  const sub = document.getElementById('wizHdrSub');
  if (sub) sub.textContent = name ? `${name} · ${wiz.weeks || 8} weeks · ${wiz.days || 5} days/wk` : '';
}

export function wizNext(from: number): void {
  if (from === 1) {
    const nameEl = document.getElementById('wProgName') as HTMLInputElement | null;
    const name = nameEl?.value.trim() || '';
    if (!name) { ilToast('Enter a program name.', 'error'); return; }
    patchWiz({ name });
    const requiredRest = 7 - (wiz.days || 5);
    if ((wiz.restDays || []).length < requiredRest) return;
    const numDays = wiz.days || 5;
    if (!wiz.dayPrograms || wiz.dayPrograms.length !== numDays) {
      patchWiz({ dayPrograms: Array.from({ length: numDays }, (_, i) => ({ name: 'Day ' + (i + 1), exercises: [] })) });
    }
    patchWiz({ activeDay: 0 });
    saveS(); goWiz(2);
  } else if (from === 2) {
    goWiz(3);
  }
}

export function wAdj(field: string, delta: number): void {
  if (field === 'weeks') patchWiz({ weeks: Math.max(1, Math.min(52, (wiz.weeks || 8) + delta)) });
  if (field === 'days') {
    patchWiz({ days: Math.max(1, Math.min(6, (wiz.days || 5) + delta)) });
    const maxRest = 7 - wiz.days;
    if ((wiz.restDays || []).length > maxRest) patchWiz({ restDays: wiz.restDays.slice(0, maxRest) });
    renderRestGrid();
  }
  const wWeeksEl = document.getElementById('wWeeksV');
  const wDaysEl = document.getElementById('wDaysV');
  if (wWeeksEl) wWeeksEl.textContent = String(wiz.weeks);
  if (wDaysEl) wDaysEl.textContent = String(wiz.days);
  const subEl = document.getElementById('wizHdrSub');
  if (subEl && wiz.name) subEl.textContent = `${wiz.name} · ${wiz.weeks || 8} weeks · ${wiz.days || 5} days/wk`;
  saveS();
}

export function renderRestGrid(): void {
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const maxRest = 7 - (wiz.days || 5);
  const selected = (wiz.restDays || []).length;
  const atCap = selected >= maxRest;
  const remaining = maxRest - selected;

  const counter = document.getElementById('restCounter');
  if (counter) {
    if (remaining === 0) {
      counter.textContent = `${selected}/${maxRest} selected ✓`;
      counter.style.color = 'var(--green)';
    } else {
      counter.textContent = `${selected}/${maxRest} selected — ${remaining} more needed`;
      counter.style.color = 'var(--muted)';
    }
  }

  const btn = document.getElementById('wizNextBtn');
  if (btn) {
    if (remaining === 0) {
      btn.textContent = 'Next: Add Exercises →';
      (btn as HTMLButtonElement).style.opacity = '1';
      (btn as HTMLButtonElement).style.cursor = 'pointer';
      (btn as HTMLButtonElement).style.background = 'var(--green)';
    } else {
      btn.textContent = `Select ${remaining} more rest day${remaining > 1 ? 's' : ''} to continue`;
      (btn as HTMLButtonElement).style.opacity = '.45';
      (btn as HTMLButtonElement).style.cursor = 'default';
      (btn as HTMLButtonElement).style.background = 'var(--black)';
    }
  }

  const gridEl = document.getElementById('restGrid');
  if (!gridEl) return;
  gridEl.innerHTML = DAYS.map((d, i) => {
    const isRest = (wiz.restDays || []).includes(i);
    const disabled = !isRest && atCap;
    return `<button class="rdaybtn${isRest ? ' rest' : ''}" onclick="toggleRest(${i})" ${disabled ? 'style="opacity:.35;cursor:not-allowed"' : ''}>
      <span style="font-size:11px;font-weight:700;color:${isRest ? '#bbb' : 'var(--text)'}">${d}</span>
      ${isRest ? '<span style="font-size:10px">💤</span>' : ''}
    </button>`;
  }).join('');
}

export function toggleRest(i: number): void {
  if (!wiz.restDays) patchWiz({ restDays: [] });
  const idx = wiz.restDays.indexOf(i);
  if (idx >= 0) {
    wiz.restDays.splice(idx, 1);
  } else {
    const maxRest = 7 - (wiz.days || 5);
    if (wiz.restDays.length >= maxRest) return;
    wiz.restDays.push(i);
  }
  renderRestGrid(); saveS();
}

export function pickWizDate(): void {
  const existing = document.getElementById('dpInline');
  if (existing) { existing.remove(); return; }

  const initDate = wiz.startDate ? parseYMD(wiz.startDate) : new Date();
  let pickY = initDate.getFullYear(), pickM = initDate.getMonth();
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function buildGrid() {
    const firstDOW = new Date(pickY, pickM, 1).getDay();
    const numDays = new Date(pickY, pickM + 1, 0).getDate();
    const todayStr = todayYMD();
    const selStr = wiz.startDate || '';
    let g = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <button onclick="dpNav(-1)" style="width:28px;height:28px;border:none;background:var(--light);border-radius:8px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text)">‹</button>
      <span style="font-size:13px;font-weight:800;color:var(--text)">${MONTHS[pickM]} ${pickY}</span>
      <button onclick="dpNav(1)" style="width:28px;height:28px;border:none;background:var(--light);border-radius:8px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text)">›</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px">
      ${DOW.map(d => `<div style="text-align:center;font-size:9px;font-weight:700;color:var(--muted);padding:2px 0">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;
    for (let i = 0; i < firstDOW; i++) g += `<div></div>`;
    for (let d = 1; d <= numDays; d++) {
      const ds = `${pickY}-${String(pickM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSel = ds === selStr, isTdy = ds === todayStr;
      const bg = isSel ? 'var(--black)' : isTdy ? 'var(--green)' : 'transparent';
      const col = isSel || isTdy ? '#fff' : 'var(--text)';
      const fw = isSel || isTdy ? '700' : '400';
      g += `<div onclick="dpPick('${ds}')" style="display:flex;align-items:center;justify-content:center;cursor:pointer">
        <span style="width:30px;height:30px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:${fw};color:${col}">${d}</span>
      </div>`;
    }
    g += `</div>`;
    const dpGridEl = document.getElementById('dpGrid');
    if (dpGridEl) dpGridEl.innerHTML = g;
  }

  const wrap = document.createElement('div');
  wrap.id = 'dpInline';
  wrap.style.cssText = 'background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:12px;margin-top:6px;margin-bottom:14px';
  wrap.innerHTML = `<div id="dpGrid"></div>`;

  const box = document.getElementById('wStartDateBox');
  if (box) box.after(wrap);

  (window as any).dpNav = function (dir: number) {
    pickM += dir;
    if (pickM > 11) { pickM = 0; pickY++; }
    else if (pickM < 0) { pickM = 11; pickY--; }
    buildGrid();
  };
  (window as any).dpPick = function (ds: string) {
    patchWiz({ startDate: ds });
    const lblEl = document.getElementById('wStartDateLbl');
    if (lblEl) lblEl.textContent = fmtD(parseYMD(ds));
    saveS();
    const dp = document.getElementById('dpInline');
    if (dp) dp.remove();
  };

  buildGrid();
}

export function renderWizStep2(): void {
  renderWizWeekCircles();
  renderWizDayCircles();
  renderWizDay();
}

export function renderWizWeekCircles(): void {
  const n = wiz.weeks || 8;
  const selWeeks = wiz.activeWeeks || [];
  const overridden = Object.keys(wiz.weekOverrides || {}).map(Number);
  const customisedWks = overridden.filter(w2 => w2 !== 1);
  const allSel = selWeeks.length === 0;

  let html = `<div class="wkc${allSel ? ' sel' : ''}" onclick="toggleWizWeek('all')" title="All weeks" style="font-size:14px">✦</div>`;
  for (let w2 = 1; w2 <= n; w2++) {
    const isSel = selWeeks.includes(w2);
    const isCust = customisedWks.includes(w2);
    html += `<div class="wkc${isSel ? ' sel' : ''}${isCust ? ' cust' : ''}" onclick="toggleWizWeek(${w2})">${w2}</div>`;
  }
  const wizWeekCirclesEl = document.getElementById('wizWeekCircles');
  if (wizWeekCirclesEl) wizWeekCirclesEl.innerHTML = html;

  const custInSel = selWeeks.filter(w2 => customisedWks.includes(w2));
  const showCust = selWeeks.length === 0 ? customisedWks : custInSel;
  const custNote = showCust.length ? ` &nbsp;·&nbsp; <span style="color:var(--gd)">Wk ${showCust.join(', ')} customised</span>` : '';
  let weekLbl = allSel ? 'All weeks' : selWeeks.length === 1 ? `Week ${selWeeks[0]}` : `Weeks ${[...selWeeks].sort((a, b) => a - b).join(', ')}`;
  const dayLbl = `Day ${(wiz.activeDay || 0) + 1}`;
  const noteEl = document.getElementById('wizWeekNote');
  if (noteEl) noteEl.innerHTML = `Editing <strong>${weekLbl} · ${dayLbl}</strong>${custNote}`;
}

export function toggleWizWeek(w: number | 'all'): void {
  if (!wiz.activeWeeks) patchWiz({ activeWeeks: [] });
  if (w === 'all') {
    patchWiz({ activeWeek: null, activeWeeks: [] });
  } else {
    const idx = wiz.activeWeeks.indexOf(w as number);
    if (idx >= 0) wiz.activeWeeks.splice(idx, 1);
    else wiz.activeWeeks.push(w as number);
    patchWiz({ activeWeek: wiz.activeWeeks.length === 1 ? wiz.activeWeeks[0] : null });
  }
  saveS(); renderWizStep2();
}

export function renderWizDayCircles(): void {
  const rest = wiz.restDays || [];
  let ti = 0;
  const wizDayCirclesEl = document.getElementById('wizDayCircles');
  if (!wizDayCirclesEl) return;
  wizDayCirclesEl.innerHTML = DOW_3.map((d, dow) => {
    const isRest = rest.includes(dow);
    if (isRest) return `<div class="wkc-day rest"><span class="wkc-day-lbl">${d}</span><span style="font-size:9px">💤</span></div>`;
    const trainIdx = ti++;
    const isSel = trainIdx === wiz.activeDay;
    const dayName = (wiz.dayPrograms && wiz.dayPrograms[trainIdx]) ? wiz.dayPrograms[trainIdx].name : `Day ${trainIdx + 1}`;
    return `<div class="wkc-day${isSel ? ' sel' : ''}" onclick="wizSelDay(${trainIdx})">
      <span class="wkc-day-lbl">${d}</span>
      <span class="wkc-day-num">${trainIdx + 1}</span>
      <span class="wkc-day-name">${dayName}</span>
    </div>`;
  }).join('');
}

export function getWizDayExercises(): ExerciseEntry[] {
  const d = wiz.activeDay;
  const weeks = wiz.activeWeeks || [];
  const w = weeks.length === 1 ? weeks[0] : null;
  if (w && wiz.weekOverrides[w] && wiz.weekOverrides[w][d]) {
    return wiz.weekOverrides[w][d] as ExerciseEntry[];
  }
  return JSON.parse(JSON.stringify((wiz.dayPrograms[d] || {}).exercises || []));
}

export function setWizDayExercises(exes: ExerciseEntry[]): void {
  const d = wiz.activeDay;
  const weeks = wiz.activeWeeks || [];
  const targets = weeks.length > 0 ? weeks : null;
  if (targets) {
    if (!wiz.weekOverrides) patchWiz({ weekOverrides: {} });
    targets.forEach(w2 => {
      if (!wiz.weekOverrides[w2]) wiz.weekOverrides[w2] = {};
      wiz.weekOverrides[w2][d] = JSON.parse(JSON.stringify(exes));
      if (!wiz.customisedWeeks) patchWiz({ customisedWeeks: [] });
      if (!wiz.customisedWeeks!.includes(w2)) wiz.customisedWeeks!.push(w2);
    });
  } else {
    if (wiz.dayPrograms[d]) wiz.dayPrograms[d].exercises = exes;
  }
  saveS();
}

function muscleVolume(days: typeof wiz.dayPrograms): Record<string, number> {
  const counts: Record<string, number> = {};
  days.forEach(d => d.exercises.forEach(e => { counts[e.muscle] = (counts[e.muscle] || 0) + (e.sets as number); }));
  return counts;
}

function renderVolStrip(weeklyVol: Record<string, number>): string {
  const entries = Object.entries(weeklyVol).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  const chips = entries.map(([m, s]) => `<span class="wk-vol-chip">${m} · ${s}</span>`).join('');
  return `<div class="wk-vol-strip"><div class="wk-vol-eyebrow">Weekly Sets</div><div class="wk-vol-chips">${chips}</div></div>`;
}

function ssClass(exes: ExerciseEntry[], i: number): string {
  const above = i > 0 && exes[i - 1].ssLink;
  const below = exes[i].ssLink;
  if (above && below) return 'ss-mid';
  if (below) return 'ss-top';
  if (above) return 'ss-bot';
  return '';
}

function ssGroupSize(exes: ExerciseEntry[], i: number): number {
  let top = i;
  while (top > 0 && exes[top - 1].ssLink) top--;
  let size = 1;
  while (top + size - 1 < exes.length - 1 && exes[top + size - 1].ssLink) size++;
  return size;
}

export function renderWizDay(): void {
  const day = (wiz.dayPrograms || [])[wiz.activeDay];
  const wizDayBodyEl = document.getElementById('wizDayBody');
  if (!wizDayBodyEl) return;
  if (!day) { wizDayBodyEl.innerHTML = ''; return; }
  const exes = getWizDayExercises();
  const counts: Record<string, number> = {};
  exes.forEach(e => { counts[e.muscle] = (counts[e.muscle] || 0) + (e.sets as number); });
  const badges = Object.entries(counts).map(([m, s]) => `<span class="wk-vol-chip">${m} · ${s}</span>`).join('');
  const weeklyVol = muscleVolume(wiz.dayPrograms || []);
  const volStripHTML = renderVolStrip(weeklyVol);

  const exRows = exes.length ? exes.map((e, i) => {
    const cls = ssClass(exes, i);
    const inSS = cls !== '';
    const isTop = cls === 'ss-top';
    const isLast = i === exes.length - 1;
    const linked = !!e.ssLink;
    const groupSize = inSS ? ssGroupSize(exes, i) : 0;
    const isFST = e.fst7Manual ? e.fst7 : e.sets === 7;
    const pill = isTop ? `<div class="ss-pill">${groupSize >= 3 ? 'GIANT SET' : 'SUPERSET'}</div>` : '';
    const fst7pill = isFST ? `<div class="fst7-pill">FST-7</div>` : '';
    return `
    <div class="erow${cls ? ' ' + cls : ''}" id="wizex${i}" data-idx="${i}" draggable="true">
      ${pill}${fst7pill}
      <div class="enum${inSS ? ' ss' : ''}">${i + 1}</div>
      <div class="einf"><div class="en">${e.name}</div><div class="em">${e.muscle}</div></div>
      <div class="ssp">
        <button class="ssb m" onclick="wizAdjSets(${i},-1)">−</button>
        <span class="ssv${isFST ? ' fst' : ''}" id="ws${i}">${e.sets}</span>
        <button class="ssb p" onclick="wizAdjSets(${i},1)">+</button>
      </div>
      <button onclick="wizDelEx(${i})" style="width:22px;height:22px;border:none;background:none;color:#ccc;font-size:16px;flex-shrink:0">×</button>
      <button class="fst7b${e.fst7 ? ' on' : ''}" onclick="wizToggleFST7(${i})" title="${e.fst7 ? 'Remove FST-7 lock' : 'Lock as FST-7'}">F7</button>
      <button class="lnkb${linked ? ' on' : ''}" onclick="wizToggleSS(${i})" title="${linked ? 'Unlink superset' : 'Link with next'}" ${isLast ? 'disabled style="opacity:.25;cursor:default"' : ''}>
        ${LINK_ICO}
      </button>
      <div class="dgh" onpointerdown="startWizDrag(event,${i})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2.5" stroke-linecap="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </div>
    </div>`;
  }).join('') : '<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px;background:white;border-radius:12px;border:1.5px dashed #EDEDED">No exercises yet. Tap + Add Exercise.</div>';

  const wkLabel = wiz.activeWeek ? `Week ${wiz.activeWeek} · ` : 'All weeks · ';
  wizDayBodyEl.innerHTML = `
    <span class="sec">Day Name</span>
    <input class="fi" value="${day.name || 'Day ' + (wiz.activeDay + 1)}" oninput="wizSetDayName(this.value)">
    <div id="wizBadges" class="wk-vol-chips" style="margin-bottom:10px">${badges}</div>
    <div id="wizVolStrip">${volStripHTML}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="sec" style="margin:0">Exercises · ${wkLabel}Day ${wiz.activeDay + 1}</span>
    </div>
    ${exRows}
    <button class="btn btn-ol" style="margin-top:8px;font-size:13px;padding:11px" onclick="openAEM('wiz')">+ Add Exercise</button>`;
  initWizDrag();
}

export function wizSelDay(trainIdx: number): void {
  patchWiz({ activeDay: trainIdx });
  renderWizStep2();
}

export function wizSetDayName(name: string): void {
  if (wiz.dayPrograms[wiz.activeDay]) {
    wiz.dayPrograms[wiz.activeDay].name = name;
    renderWizDayCircles();
  }
}

export function wizToggleSS(i: number): void {
  const exes = getWizDayExercises();
  exes[i].ssLink = !exes[i].ssLink;
  setWizDayExercises(exes);
  renderWizDay();
}

function updateWizBadges(): void {
  const el = document.getElementById('wizBadges');
  if (el) {
    const exes = getWizDayExercises();
    const counts: Record<string, number> = {};
    exes.forEach(e => { counts[e.muscle] = (counts[e.muscle] || 0) + (e.sets as number); });
    el.innerHTML = Object.entries(counts).map(([m, s]) => `<span class="wk-vol-chip">${m} · ${s}</span>`).join('');
  }
  const stripEl = document.getElementById('wizVolStrip');
  if (stripEl) {
    stripEl.innerHTML = renderVolStrip(muscleVolume(wiz.dayPrograms || []));
  }
}

export function wizAdjSets(i: number, delta: number): void {
  const exes = getWizDayExercises();
  exes[i].sets = Math.max(1, (exes[i].sets as number) + delta);
  if (!exes[i].fst7Manual) exes[i].fst7 = exes[i].sets === 7;
  setWizDayExercises(exes);
  renderWizDay();
  updateWizBadges();
}

export function wizToggleFST7(i: number): void {
  const exes = getWizDayExercises();
  const e = exes[i];
  const isFST = e.fst7Manual ? e.fst7 : e.sets === 7;
  if (isFST) { e.fst7 = false; e.fst7Manual = true; }
  else { e.fst7 = true; e.fst7Manual = true; }
  setWizDayExercises(exes);
  renderWizDay();
}

export function wizDelEx(i: number): void {
  const exes = getWizDayExercises();
  exes.splice(i, 1);
  setWizDayExercises(exes);
  renderWizDay();
}

let w3OpenDays = new Set<number>();
export function renderWizStep3(): void {
  const days = wiz.dayPrograms || [];
  const weeks = wiz.weeks || 8;

  const totalSessions = (wiz.days || 5) * (wiz.weeks || 8);
  const daySets = days.map(d => d.exercises.reduce((a, e) => a + (e.sets as number), 0));
  const maxSets = daySets.length ? Math.max(...daySets) : 0;
  const minSets = daySets.length ? Math.min(...daySets) : 0;
  const maxDayIdx = daySets.indexOf(maxSets);
  const minDayIdx = daySets.indexOf(minSets);
  const trainDOWs = [0,1,2,3,4,5,6].filter(d => !(wiz.restDays || []).includes(d));
  const maxDOW = trainDOWs[maxDayIdx] !== undefined ? DOW_3[trainDOWs[maxDayIdx]] : '—';
  const minDOW = trainDOWs[minDayIdx] !== undefined ? DOW_3[trainDOWs[minDayIdx]] : '—';

  const MG_COLORS: Record<string, string> = {Back:'#3B82F6',Chest:'#EF4444',Legs:'#F59E0B',Shoulders:'#8B5CF6',Biceps:'#06B6D4',Triceps:'#EC4899',Core:'#10B981',Calves:'#F97316',Forearms:'#64748B'};
  const MG_BG: Record<string, string> = {Back:'#DBEAFE',Chest:'#FEE2E2',Legs:'#FEF3C7',Shoulders:'#EDE9FE',Biceps:'#CFFAFE',Triceps:'#FCE7F3',Core:'#D1FAE5',Calves:'#FFEDD5',Forearms:'#F1F5F9'};
  const MG_TEXT: Record<string, string> = {Back:'#1D4ED8',Chest:'#DC2626',Legs:'#D97706',Shoulders:'#7C3AED',Biceps:'#0E7490',Triceps:'#BE185D',Core:'#065F46',Calves:'#C2410C',Forearms:'#475569'};

  const volCounts = muscleVolume(days);
  const volSorted = Object.entries(volCounts).sort((a, b) => b[1] - a[1]);
  const volRows = volSorted.map(([m, s]) => `
    <div class="w3-vrow">
      <div class="w3-vdot" style="background:${MG_COLORS[m] || '#888'}"></div>
      <div class="w3-vname">${m}</div>
      <div><div class="w3-vval">${s}</div><div class="w3-vsub">sets</div></div>
    </div>`).join('');

  const customWeeks = Object.keys(wiz.weekOverrides || {}).map(Number);
  const pillsHTML = [
    `<div class="w3-wpill all act" id="w3pill0" onclick="w3SelWeek(0)">All</div>`,
    ...[...Array(weeks)].map((_, i) => {
      const w2 = i + 1;
      const isCust = customWeeks.includes(w2);
      return `<div class="w3-wpill${isCust ? ' custom' : ''}" id="w3pill${w2}" onclick="w3SelWeek(${w2})">${w2}</div>`;
    }),
  ].join('');

  const SS_TAG = '<span style="font-size:7px;font-weight:800;color:var(--gd);background:var(--gbg);border-radius:3px;padding:1px 4px">SS</span>';
  const FST_TAG = '<span style="font-size:7px;font-weight:800;color:#DC2626;background:#FEF2F2;border-radius:3px;padding:1px 4px">FST-7</span>';

  function renderDayCards(dayList: typeof days): string {
    const allDOWs = [0,1,2,3,4,5,6];
    let trainIdx = 0;
    return allDOWs.map(dow => {
      const isRest = (wiz.restDays || []).includes(dow);
      if (isRest) return `
        <div class="w3-rest-card">
          <span style="font-size:18px">💤</span>
          <div><div style="font-size:13px;font-weight:700;color:var(--muted)">Rest Day</div><div style="font-size:10px;color:var(--muted)">${DOW_3[dow]}</div></div>
        </div>`;
      const d = dayList[trainIdx];
      const dIdx = trainIdx++;
      if (!d) return '';
      const totalSets2 = d.exercises.reduce((a, e) => a + (e.sets as number), 0);
      const muscles = [...new Set(d.exercises.map(e => e.muscle))];
      const chips = muscles.map(m => `<span class="w3-day-chip" style="background:${MG_BG[m] || '#eee'};color:${MG_TEXT[m] || '#555'}">${m}</span>`).join('');
      const exRows2 = d.exercises.map((e, i) => {
        const sc = e.ssPos === 'top' ? 'ss-top' : e.ssPos === 'mid' ? 'ss-mid' : e.ssPos === 'bot' ? 'ss-bot' : '';
        const ssTag = e.ssPos === 'top' ? SS_TAG : '';
        const fstTag = (e.fst7 || (e.fst7Manual && e.fst7)) ? FST_TAG : '';
        const isFST2 = e.fst7Manual ? e.fst7 : e.sets === 7;
        return `<div class="w3-ex-row ${sc}">
          <div class="w3-ex-num">${i + 1}</div>
          <div class="w3-ex-name">${e.name}</div>
          <div class="w3-ex-tags">${ssTag}${fstTag}</div>
          <div class="w3-ex-sets${isFST2 ? ' fst' : ''}">${e.sets}×</div>
          <div class="w3-ex-reps">${e.reps || '8-12'}</div>
        </div>`;
      }).join('');
      return `
      <div class="w3-day-card">
        <div class="w3-day-hdr" id="w3dh${dIdx}" onclick="w3ToggleDay(${dIdx})">
          <div class="w3-day-top">
            <div class="w3-day-num">${dIdx + 1}</div>
            <div style="flex:1">
              <div class="w3-day-dow">${DOW_3[dow]}</div>
              <div class="w3-day-name">${d.name || 'Day ' + (dIdx + 1)}</div>
            </div>
            <span class="w3-chev" id="w3dc${dIdx}">▾</span>
          </div>
          <div class="w3-day-meta">
            <div class="w3-day-chips">${chips}</div>
            <div class="w3-excount">${d.exercises.length} ex · ${totalSets2} sets</div>
          </div>
        </div>
        <div class="w3-ex-list" id="w3dl${dIdx}">${exRows2}</div>
      </div>`;
    }).join('');
  }

  const wizReviewEl = document.getElementById('wizReview');
  if (!wizReviewEl) return;
  wizReviewEl.innerHTML = `
    <span class="sec">Program</span>
    <div class="w3-prog-card">
      <div class="w3-eyebrow">Custom Program</div>
      <div class="w3-name">${wiz.name || 'My Program'}</div>
      <div class="w3-chips">
        <span class="w3-chip g">${weeks} weeks</span>
        <span class="w3-chip g">${wiz.days || 5} days/wk</span>
        <span class="w3-chip">${(wiz.restDays || []).length} rest days</span>
        <span class="w3-chip">${totalSessions} sessions</span>
      </div>
      <div class="w3-dates">Pick your start date when you activate.</div>
    </div>
    <span class="sec">Summary</span>
    <div class="w3-strip">
      <div class="w3-stat"><div class="w3-stat-v">${weeks}</div><div class="w3-stat-l">Weeks</div></div>
      <div class="w3-stat"><div class="w3-stat-v">${wiz.days || 5}</div><div class="w3-stat-l">Days / wk</div></div>
      <div class="w3-stat"><div class="w3-stat-v">${maxSets}</div><div class="w3-stat-l">Max sets</div><div class="w3-stat-day">${maxDOW}</div></div>
      <div class="w3-stat"><div class="w3-stat-v">${minSets}</div><div class="w3-stat-l">Min sets</div><div class="w3-stat-day">${minDOW}</div></div>
    </div>
    ${volSorted.length ? `
    <span class="sec">Weekly Volume</span>
    <div class="w3-vol">
      <div class="w3-vol-grid">${volRows}</div>
    </div>` : ''}
    <span class="sec">Schedule</span>
    <div class="w3-wpills" id="w3pills">${pillsHTML}</div>
    <div id="w3DayCards">${renderDayCards(days)}</div>`;

  (window as any)._w3RenderDayCards = renderDayCards;
}

export function w3ToggleDay(idx: number): void {
  w3OpenDays.has(idx) ? w3OpenDays.delete(idx) : w3OpenDays.add(idx);
  const hdr = document.getElementById('w3dh' + idx);
  const list = document.getElementById('w3dl' + idx);
  const chev = document.getElementById('w3dc' + idx);
  const open = w3OpenDays.has(idx);
  if (hdr) hdr.classList.toggle('open', open);
  if (list) list.classList.toggle('open', open);
  if (chev) chev.classList.toggle('open', open);
}

export function w3SelWeek(w: number): void {
  document.querySelectorAll('#w3pills .w3-wpill').forEach(p => p.classList.remove('act'));
  const el = document.getElementById('w3pill' + w);
  if (el) el.classList.add('act');
  w3OpenDays.clear();
  const days2 = w > 0 && wiz.weekOverrides && wiz.weekOverrides[w]
    ? wiz.weekOverrides[w] as any
    : wiz.dayPrograms || [];
  const container = document.getElementById('w3DayCards');
  if (container && (window as any)._w3RenderDayCards) container.innerHTML = (window as any)._w3RenderDayCards(days2);
}

function wizValidate(): string | null {
  const nameEl = document.getElementById('wProgName') as HTMLInputElement | null;
  const name = (nameEl?.value || wiz.name || '').trim();
  if (!name) { ilToast('Enter a program name first.', 'error'); goWiz(1); return null; }
  if (!(wiz.dayPrograms || []).some(d => d.exercises.length)) {
    ilToast('Add exercises to at least one day.', 'error'); goWiz(2); return null;
  }
  return name;
}

function wizBuildSchedule(): Record<number, number> {
  const schedule: Record<number, number> = {};
  let di = 0;
  for (let dow = 0; dow < 7 && di < (wiz.dayPrograms || []).length; dow++) {
    if (!(wiz.restDays || []).includes(dow)) schedule[dow] = di++;
  }
  return schedule;
}

function wizSaveToLibrary(name: string, schedule: Record<number, number>): void {
  const savedProgs = JSON.parse(localStorage.getItem('ll_saved_progs') || '[]');
  const progData = { name, weeks: wiz.weeks || 8, days: wiz.days || 5, startDate: '', schedule, dayPrograms: wiz.dayPrograms, weekOverrides: wiz.weekOverrides || {} };
  const idx = savedProgs.findIndex((p: any) => p.name === name);
  if (idx >= 0) savedProgs[idx] = progData;
  else savedProgs.push(progData);
  localStorage.setItem('ll_saved_progs', JSON.stringify(savedProgs));
  cloudSave();
}

export function saveWiz(): void {
  const name = wizValidate();
  if (!name) return;
  const schedule = wizBuildSchedule();
  wizSaveToLibrary(name, schedule);
  patchWiz({ step: 1 });
  saveS();
  const PAGES = ['pgHome','pgCal','pgWork','pgHist','pgStats'];
  const NAV = ['nb0','nb1','nb2','nb3','nb4'];
  PAGES.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', i === 2);
    const nb = document.getElementById(NAV[i]);
    if (nb) nb.classList.toggle('active', i === 2);
  });
  (window as any).switchWTab(1);
  renderLibrary();
  const pgWork = document.getElementById('pgWork');
  if (pgWork) pgWork.scrollTop = 0;
}

export function activateWiz(): void {
  const name = wizValidate();
  if (!name) return;
  ilDatePick(ds => {
    const schedule = wizBuildSchedule();
    const numDays = wiz.dayPrograms.length;
    FST7.length = numDays;
    wiz.dayPrograms.forEach((d, i) => {
      FST7[i] = {
        day: d.name || 'Day ' + (i + 1),
        name: d.name || 'Day ' + (i + 1),
        muscles: [...new Set(d.exercises.map(e => e.muscle))],
        exercises: d.exercises.map(e => ({ ...e })),
      };
    });
    wizSaveToLibrary(name, schedule);
    S.prog = { active: true, name, weeks: wiz.weeks || 8, startDate: ds, schedule, isCustom: true, weekOverrides: wiz.weekOverrides || {}, dayPrograms: wiz.dayPrograms };
    setWiz({ name: '', startDate: '', weeks: 8, days: 5, restDays: [2, 6], dayPrograms: [], activeDay: 0, activeWeek: null, activeWeeks: [], weekOverrides: {}, step: 1 });
    saveS(); renderHome(); renderCal(); renderStats();
    (window as any).goPage(0);
    setTimeout(() => ilToast(`"${name}" activated!`, 'success'), 200);
  });
}

export function initWizDrag(): void {
  const rows = document.querySelectorAll('#wizDayBody .erow');
  rows.forEach(row => {
    const htmlRow = row as HTMLElement;
    row.addEventListener('dragstart', e => {
      setDragSrc(parseInt(htmlRow.dataset['idx']!));
      htmlRow.classList.add('dragging');
      (e as DragEvent).dataTransfer!.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => htmlRow.classList.remove('dragging'));
    row.addEventListener('dragover', e => { e.preventDefault(); htmlRow.classList.add('drag-ov'); });
    row.addEventListener('dragleave', () => htmlRow.classList.remove('drag-ov'));
    row.addEventListener('drop', e => {
      e.preventDefault(); htmlRow.classList.remove('drag-ov');
      const t = parseInt(htmlRow.dataset['idx']!);
      if (dragSrc === null || dragSrc === t) return;
      const exes = getWizDayExercises();
      const moved = exes.splice(dragSrc, 1)[0];
      exes.splice(t, 0, moved);
      setWizDayExercises(exes);
      setDragSrc(null); renderWizDay();
    });
  });
}

export function startWizDrag(e: PointerEvent, idx: number): void {
  e.preventDefault();
  const row = document.getElementById('wizex' + idx);
  if (!row) return;
  row.classList.add('dragging');
  const onMove = (ev: PointerEvent | TouchEvent) => {
    ev.preventDefault();
    const cy = (ev as TouchEvent).touches ? (ev as TouchEvent).touches[0].clientY : (ev as PointerEvent).clientY;
    document.querySelectorAll('#wizDayBody .erow').forEach(r => r.classList.remove('drag-ov'));
    const t = [...document.querySelectorAll('#wizDayBody .erow')].find(r => {
      const rc = r.getBoundingClientRect();
      return cy >= rc.top && cy <= rc.bottom;
    });
    if (t && t !== row) t.classList.add('drag-ov');
  };
  const onEnd = (ev: PointerEvent | TouchEvent) => {
    ev.preventDefault();
    const cy = (ev as TouchEvent).changedTouches ? (ev as TouchEvent).changedTouches[0].clientY : (ev as PointerEvent).clientY;
    document.querySelectorAll('#wizDayBody .erow').forEach(r => r.classList.remove('drag-ov'));
    row.classList.remove('dragging');
    const t = [...document.querySelectorAll('#wizDayBody .erow')].find(r => {
      const rc = r.getBoundingClientRect();
      return cy >= rc.top && cy <= rc.bottom;
    });
    if (t) {
      const ti = parseInt((t as HTMLElement).dataset['idx']!);
      if (ti !== idx) {
        const exes = getWizDayExercises();
        const moved = exes.splice(idx, 1)[0];
        exes.splice(ti, 0, moved);
        setWizDayExercises(exes);
        renderWizDay();
      }
    }
    document.removeEventListener('touchmove', onMove as any);
    document.removeEventListener('touchend', onEnd as any);
    document.removeEventListener('pointermove', onMove as any);
    document.removeEventListener('pointerup', onEnd as any);
  };
  document.addEventListener('touchmove', onMove as any, { passive: false });
  document.addEventListener('touchend', onEnd as any, { passive: false });
  document.addEventListener('pointermove', onMove as any);
  document.addEventListener('pointerup', onEnd as any);
}

export function renderLibrary(): void {
  const activeName = S.prog ? S.prog.name : '';
  const savedProgs = JSON.parse(localStorage.getItem('ll_saved_progs') || '[]');

  function chip2(t: string, g = false): string {
    return `<span class="chip${g ? ' g' : ''}">${t}</span>`;
  }

  const customCards = savedProgs.map((p: any, pi: number) => `
    <div class="pd-crd" style="${p.name === activeName ? 'border:1.5px solid var(--lime-edge)' : ''}">
      <div class="pd-hdr">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div>
            <div class="pd-day">Custom Program</div>
            <div class="pd-name">${p.name}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${p.name === activeName ? '<span class="wk-vol-chip">ACTIVE</span>' : ''}
            <button onclick="deleteSavedProg(${pi})" title="Delete program" style="width:28px;height:28px;border:1px solid var(--line2);background:var(--bg);border-radius:8px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#E5484D;flex-shrink:0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
        <div style="margin-bottom:6px">${chip2(p.weeks + 'w')}${chip2(p.days + 'days/wk')}</div>
        <div>${(p.dayPrograms || []).map((d: any) => chip2(d.name || 'Day', false)).join('')}</div>
      </div>
      <div class="pd-act" style="display:flex;gap:8px">
        <button class="btn btn-ghost" style="flex:1;font-size:12px;padding:10px" onclick="loadProgToWiz(${pi})">✏️ Edit</button>
        <button class="btn ${p.name === activeName ? 'btn-ghost' : 'btn-g'}" style="flex:2;font-size:12px;padding:10px" onclick="activateSavedProg(${pi})">${p.name === activeName ? '✅ Active' : '▶ Activate'}</button>
      </div>
    </div>`).join('');

  const pdListEl = document.getElementById('pdList');
  if (pdListEl) {
    pdListEl.innerHTML = (customCards || '') +
      `<div style="text-align:center;padding:16px;color:var(--muted);font-size:12px">
        <div style="margin-bottom:8px">Create a new custom program</div>
        <button class="btn btn-g" style="font-size:13px;padding:12px" onclick="switchWTab(0)">+ New Custom Program</button>
      </div>`;
  }
}

export function activateSavedProg(pi: number): void {
  const savedProgs = JSON.parse(localStorage.getItem('ll_saved_progs') || '[]');
  const p = savedProgs[pi];
  if (!p) { ilToast('Program not found.', 'error'); return; }
  if (S.prog && S.prog.name === p.name) { ilToast(`"${p.name}" is already active.`, 'info'); return; }
  ilDatePick(ds => {
    FST7.length = 0;
    (p.dayPrograms || []).forEach((d: any, i: number) => {
      FST7.push({ day: d.name || 'Day ' + (i + 1), name: d.name || 'Day ' + (i + 1), muscles: [...new Set((d.exercises || []).map((e: any) => e.muscle))] as string[], exercises: (d.exercises || []).map((e: any) => ({ ...e })) });
    });
    S.prog = { active: true, name: p.name, weeks: p.weeks || 8, days: p.days || 5, startDate: ds, schedule: p.schedule || {}, isCustom: true, weekOverrides: p.weekOverrides || {}, dayPrograms: p.dayPrograms };
    saveS(); renderHome(); renderCal(); renderStats(); renderLibrary();
    ilToast(`"${p.name}" activated!`, 'success');
  });
}

export function deleteSavedProg(pi: number): void {
  const savedProgs = JSON.parse(localStorage.getItem('ll_saved_progs') || '[]');
  const p = savedProgs[pi];
  if (!p) return;
  ilConfirm(`Delete "${p.name}"? This removes it from your other devices too.`, () => {
    savedProgs.splice(pi, 1);
    localStorage.setItem('ll_saved_progs', JSON.stringify(savedProgs));
    // Record a tombstone. Libraries merge additively across devices, so a
    // program simply absent from this list would be restored by the next sync;
    // only an explicit deletion marker removes it everywhere.
    const tombs = JSON.parse(localStorage.getItem('ll_deleted_progs') || '[]');
    if (!tombs.includes(p.name)) tombs.push(p.name);
    localStorage.setItem('ll_deleted_progs', JSON.stringify(tombs));
    cloudSave();
    if (S.prog && S.prog.name === p.name) {
      S.prog = null;
      FST7.length = 0;
      saveS();
      renderHome(); renderCal(); renderStats();
    }
    renderLibrary();
    ilToast(`"${p.name}" deleted.`, 'success');
  }, 'Delete', true);
}

export function loadProgToWiz(idx: number): void {
  const p = JSON.parse(localStorage.getItem('ll_saved_progs') || '[]')[idx];
  if (!p) return;
  setWiz({ ...p, activeDay: 0, activeWeek: null, activeWeeks: [], step: 2 });
  saveS(); (window as any).switchWTab(0); goWiz(2);
}
