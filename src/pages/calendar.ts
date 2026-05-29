import { S, calDate, calSel, calExpanded, setCalDate, setCalSel, setCalExpanded } from '../store/state';
import { FST7 } from '../store/state';
import { fmt, fmtD, ymd, parseYMD, todayYMD, DOW_SHORT } from '../utils/date';
import { chip, isInProgRange, getDayIdx, getLogged } from '../utils/helpers';
import { saveS } from '../services/storage';
import { renderHome } from './home';
import { renderHistory } from './history';
import { renderStats } from './stats';

export function renderCal(): void {
  const y = calDate.getFullYear(), m = calDate.getMonth();
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mnEl = document.getElementById('calMonthName');
  if (mnEl) mnEl.textContent = `${MONTHS[m]} ${y}`;
  const firstDOW = new Date(y, m, 1).getDay();
  const numDays = new Date(y, m + 1, 0).getDate();
  const todayStr = todayYMD();
  if (!calSel) setCalSel(todayStr);

  let grid = '<div class="dow-row">' + DOW_SHORT.map(d => `<div class="dow-cell">${d}</div>`).join('') + '</div><div class="cgrid">';
  for (let i = 0; i < firstDOW; i++) grid += '<div></div>';
  for (let d = 1; d <= numDays; d++) {
    const date = new Date(y, m, d);
    const ds = ymd(date);
    const isTdy = ds === todayStr, isSel = ds === calSel;
    const logged = getLogged(ds);
    const dayIdx = getDayIdx(date);
    const inProgRange = isInProgRange(ds);
    const isRest = inProgRange && dayIdx === null;
    const isTrain = inProgRange && dayIdx !== null;
    let cls = 'cday' + (isSel ? ' sel' : (isTdy ? ' today' : (logged ? ' logged' : (isRest ? ' rest' : (isTrain ? ' train' : '')))));
    let dot = '';
    if (isSel) dot = `<div class="cday-d" style="background:${logged ? '#4CAF50' : 'white'}"></div>`;
    else if (logged) dot = '<div class="cday-d" style="background:#16A34A"></div>';
    else if (isTdy && isTrain) dot = '<div class="cday-d" style="background:#4CAF50"></div>';
    else if (isTrain) dot = '<div class="cday-d" style="background:#86EFAC"></div>';
    else if (isRest) dot = '<div style="font-size:7px;margin-top:1px">💤</div>';
    grid += `<div class="${cls}" onclick="selectDay('${ds}')"><span class="cday-n">${d}</span>${dot}</div>`;
  }
  grid += '</div>';
  const gridEl = document.getElementById('calGridWrap');
  if (gridEl) gridEl.innerHTML = grid;
  renderCalDet(calSel!);
}

export function selectDay(ds: string): void {
  setCalSel(ds);
  renderCal();
}

export function renderCalDet(ds: string): void {
  const el = document.getElementById('calDetail');
  if (!el) return;
  const date = parseYMD(ds);
  const dayIdx = getDayIdx(date);
  const logged = getLogged(ds);
  const isExp = calExpanded === ds;
  const inProgRange = isInProgRange(ds);

  if (dayIdx === null) {
    if (inProgRange) {
      el.innerHTML = `<div class="rest-crd"><div style="font-size:28px;margin-bottom:6px">💤</div><div style="font-size:15px;font-weight:800;margin-bottom:3px">Rest Day</div><div style="font-size:11px;color:var(--muted)">${fmt(date)}</div></div>`;
    } else {
      el.innerHTML = `<div class="rest-crd" style="background:transparent;box-shadow:none"><div style="font-size:13px;color:var(--muted);text-align:center">${fmt(date)}</div><div style="font-size:11px;color:#ccc;text-align:center;margin-top:4px">No session scheduled</div></div>`;
    }
    return;
  }

  const day = FST7[dayIdx];
  if (!day || !day.exercises) {
    el.innerHTML = `<div class="rest-crd"><div style="font-size:13px;color:var(--muted);text-align:center">Training day — no exercises set up.</div></div>`;
    return;
  }
  const exRows = day.exercises.map(e => `
    <div class="dce">
      <div><div class="dce-n${e.fst7 ? ' fst' : ''}">${e.fst7 ? '★ ' : ''}${e.name}</div><div style="font-size:9px;color:var(--muted);margin-top:1px">${e.muscle}</div></div>
      <span class="dce-s${e.fst7 ? ' fst' : ''}">${e.sets}×${e.reps}</span>
    </div>`).join('');

  el.innerHTML = `<div class="dcard">
    <div class="dc-hdr" onclick="toggleCalExp('${ds}')">
      <div class="dc-top">
        <div><div class="dc-dnum">${day.day}</div><div class="dc-name">${day.name}</div></div>
        <div class="dc-badges">
          ${logged ? '<div class="lgbadge">✅ Logged</div>' : ''}
          <button class="cogbtn day-act" data-date="${ds}" data-logged="${logged ? '1' : '0'}">⚙️</button>
        </div>
      </div>
      <div style="margin-top:6px">${chip(day.exercises.length + ' exercises')}${chip(day.muscles.join(' · '), true)}</div>
      <div class="etog"><div class="eline"></div><span class="etxt">${isExp ? 'Collapse ↑' : 'Show exercises ↓'}</span><div class="eline"></div></div>
    </div>
    ${isExp ? `<div class="dc-exes">${exRows}</div>` : ''}
    <div class="dc-act">
      <button class="btn btn-g" onclick="handleSessionBtn('${ds}',${dayIdx},${logged ? 1 : 0})">${logged ? '🔄 Restart Session' : '▶ Start Session'}</button>
    </div>
  </div>`;
}

export function toggleCalExp(ds: string): void {
  setCalExpanded(calExpanded === ds ? '' : ds);
  renderCalDet(ds);
}

export function showDayOpts(ds: string, isLogged: boolean): void {
  const date = parseYMD(ds);
  const old = document.getElementById('daySheet');
  if (old) old.remove();
  const sheet = document.createElement('div');
  sheet.id = 'daySheet';
  sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:flex-end;justify-content:center';
  const inner = document.createElement('div');
  inner.style.cssText = 'background:white;border-radius:22px 22px 0 0;padding:20px 16px 32px;width:100%;max-width:480px';
  inner.innerHTML = `<div style="width:34px;height:4px;background:#EDEDED;border-radius:2px;margin:0 auto 14px"></div>
    <div style="font-size:13px;font-weight:700;color:var(--muted);text-align:center;margin-bottom:4px">${fmt(date)}</div>
    <div style="font-size:11px;color:#bbb;text-align:center;margin-bottom:16px">${isLogged ? 'Session logged' : 'No session logged'}</div>`;
  const actions: Array<{ l: string; s: string; fn: (() => void) | null }> = [];

  if (isLogged) {
    actions.push({
      l: '🗑️  Delete this session only',
      s: 'Completely removes this day - all data gone',
      fn: () => confirmAct(
        'Delete this session?',
        `The session on ${fmt(date)} will be completely removed.`,
        () => {
          S.workouts = S.workouts.filter(w => w.date !== ds);
          saveS(); renderCal(); renderHome(); renderHistory(); renderStats();
        }
      ),
    });
  }

  actions.push({
    l: '🗑️  Delete all upcoming sessions',
    s: 'Removes all sessions from this date onwards from calendar',
    fn: () => confirmAct(
      'Delete all upcoming sessions?',
      `All sessions from ${fmt(date)} onwards will be completely removed from the calendar.`,
      () => {
        S.workouts = S.workouts.filter(w => w.date < ds);
        if (S.prog) S.prog.endDate = ds;
        saveS(); renderCal(); renderHome(); renderHistory(); renderStats();
      }
    ),
  });

  actions.push({ l: 'Cancel', s: '', fn: null });
  actions.forEach(a => {
    const btn = document.createElement('button');
    const isD = a.fn !== null;
    btn.style.cssText = `width:100%;padding:13px 14px;background:${isD ? '#FFF5F5' : '#F9FAFB'};border:1.5px solid ${isD ? '#FECACA' : '#EDEDED'};border-radius:12px;cursor:pointer;margin-bottom:8px;font-family:inherit;text-align:left`;
    btn.innerHTML = `<div style="font-size:14px;font-weight:700;color:${isD ? '#EF4444' : '#6B7280'}">${a.l}</div>${a.s ? `<div style="font-size:11px;color:#bbb;margin-top:2px">${a.s}</div>` : ''}`;
    btn.onclick = () => { sheet.remove(); if (a.fn) a.fn(); };
    inner.appendChild(btn);
  });
  sheet.appendChild(inner);
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  document.body.appendChild(sheet);
}

export function confirmAct(title: string, msg: string, fn: () => void): void {
  const old = document.getElementById('confDlg'); if (old) old.remove();
  const dlg = document.createElement('div');
  dlg.id = 'confDlg';
  dlg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:210;display:flex;align-items:center;justify-content:center;padding:24px';
  dlg.innerHTML = `<div style="background:white;border-radius:18px;padding:22px 20px;width:100%;max-width:340px;text-align:center">
    <div style="font-size:28px;margin-bottom:10px">⚠️</div>
    <div style="font-size:16px;font-weight:900;margin-bottom:8px">${title}</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:20px">${msg}</div>
    <div style="display:flex;gap:8px">
      <button id="confNo" style="flex:1;padding:13px;background:var(--light);border:none;border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--muted)">Cancel</button>
      <button id="confYes" style="flex:1;padding:13px;background:#EF4444;color:white;border:none;border-radius:11px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">Delete</button>
    </div>
  </div>`;
  document.body.appendChild(dlg);
  const noBtn = document.getElementById('confNo');
  const yesBtn = document.getElementById('confYes');
  if (noBtn) noBtn.onclick = () => dlg.remove();
  if (yesBtn) yesBtn.onclick = () => { dlg.remove(); fn(); };
}

// Delegated event listener for calendar day options button
export function initCalendarDelegation(): void {
  document.addEventListener('click', function (e) {
    const btn = (e.target as HTMLElement).closest('.day-act') as HTMLElement | null;
    if (!btn) return;
    e.stopPropagation();
    showDayOpts(btn.dataset['date']!, btn.dataset['logged'] === '1');
  });

  const prevBtn = document.getElementById('calPrevBtn');
  const nextBtn = document.getElementById('calNextBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1));
    renderCal();
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1));
    renderCal();
  });
}
