import { S, homeSelDate, homeCalExpanded, homeCalMonth, homeWeekOffset, homeProgramExpanded,
  setHomeSelDate, setHomeCalExpanded, setHomeCalMonth, setHomeWeekOffset, setHomeProgramExpanded } from '../store/state';
import { fmt, fmtD, ymd, parseYMD, today, todayYMD, DOW_SHORT, monthName } from '../utils/date';
import { chip, isInProgRange, getDayIdx, getLogged, getFST7Day } from '../utils/helpers';
import { FST7 } from '../store/state';

export function renderHome(): void {
  const h = today().getHours();
  const greetEl = document.getElementById('heroGreet');
  if (greetEl) greetEl.textContent = h < 12 ? 'Good morning 💪' : h < 17 ? 'Good afternoon 💪' : 'Good evening 💪';

  const wkStart = new Date(today());
  wkStart.setDate(today().getDate() - today().getDay());
  const wkCount = S.workouts.filter(w => parseYMD(w.date) >= wkStart).length;

  let streak = 0, d = new Date(today());
  for (let i = 0; i < 365; i++) {
    if (S.workouts.find(w => w.date === ymd(d))) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  const streakEl = document.getElementById('streakChip');
  const weekEl = document.getElementById('weekChip');
  if (streakEl) streakEl.textContent = `🔥 ${streak} streak`;
  if (weekEl) weekEl.textContent = `📅 ${wkCount} this week`;

  renderHomeProgram();
  renderHomeCalStrip();
  renderHomeTodayCard();
}

export function homeCalToggle(expanded: boolean): void {
  setHomeCalExpanded(expanded);
  setHomeCalMonth(null);
  renderHomeCalStrip();
}

export function homeWeekNav(delta: number): void {
  setHomeWeekOffset(homeWeekOffset + delta);
  renderHomeCalStrip();
}

export function homeWeekReset(): void {
  setHomeWeekOffset(0);
  renderHomeCalStrip();
}

export function toggleHomeProgram(): void {
  setHomeProgramExpanded(!homeProgramExpanded);
  renderHomeProgram();
}

export function selectHomeDay(ds: string): void {
  setHomeSelDate(ds === todayYMD() ? null : ds);
  renderHomeCalStrip();
  renderHomeTodayCard();
}

export function homeCalNavMonth(dir: number): void {
  if (!homeCalMonth) { const t = today(); setHomeCalMonth({ y: t.getFullYear(), m: t.getMonth() }); }
  const next = { ...homeCalMonth! };
  next.m += dir;
  if (next.m > 11) { next.m = 0; next.y++; }
  else if (next.m < 0) { next.m = 11; next.y--; }
  setHomeCalMonth(next);
  renderHomeCalStrip();
}

export function renderHomeProgram(): void {
  const pb = document.getElementById('homeProgBanner');
  if (!pb) return;
  if (!S.prog || !S.prog.active) {
    pb.innerHTML = `<div class="card-b" style="text-align:center;padding:18px">
      <div style="font-size:14px;font-weight:800;margin-bottom:6px">No Active Program</div>
      <button class="btn btn-g" style="padding:11px;font-size:13px" onclick="goPage(2)">Set Up Program</button>
    </div>`;
    return;
  }

  const start = parseYMD(S.prog.startDate);
  const end = new Date(start); end.setDate(start.getDate() + S.prog.weeks * 7);
  const done = S.workouts.length, total = S.prog.weeks * 5;
  const pct = Math.min(100, Math.round((done / Math.max(total, 1)) * 100));

  const MCOL: Record<string, string> = {
    Back: '#3B82F6', Chest: '#EF4444', Legs: '#F59E0B', Shoulders: '#8B5CF6',
    Biceps: '#06B6D4', Triceps: '#EC4899', Core: '#10B981', Calves: '#F97316',
  };

  const todayD = today();
  const wkSun = new Date(todayD); wkSun.setDate(todayD.getDate() - todayD.getDay());
  const wkSat = new Date(wkSun); wkSat.setDate(wkSun.getDate() + 6);
  const wkSunStr = ymd(wkSun), wkSatStr = ymd(wkSat);
  const wkWorkouts = S.workouts.filter(w => w.date >= wkSunStr && w.date <= wkSatStr);

  const allMuscles = [...new Set(FST7.filter(d => d && d.exercises).flatMap(d => d.exercises.map(e => e.muscle)))].sort();
  const planned: Record<string, number> = {};
  allMuscles.forEach(m => planned[m] = 0);
  for (let i = 0; i < 7; i++) {
    const d2 = new Date(wkSun); d2.setDate(wkSun.getDate() + i);
    const dayIdx = getDayIdx(d2);
    if (dayIdx === null) continue;
    const day = FST7[dayIdx];
    if (!day || !day.exercises) continue;
    const muscles = [...new Set(day.exercises.map(e => e.muscle))];
    muscles.forEach(m => { if (planned[m] !== undefined) planned[m]++; });
  }

  const logged: Record<string, number> = {};
  allMuscles.forEach(m => logged[m] = 0);
  wkWorkouts.forEach(w => {
    const muscles = [...new Set((w.exercises || []).map(e => e.muscle))];
    muscles.forEach(m => { if (logged[m] !== undefined) logged[m]++; });
  });

  const progStart = S.prog.startDate;
  function maxKg(workouts: typeof S.workouts, muscle: string): number | null {
    let max = 0;
    workouts.forEach(w => {
      (w.exercises || []).filter(e => e.muscle === muscle).forEach(e => {
        const sets = e.sets as Array<{ kg: string; done: boolean }>;
        sets.filter(s => s.done && s.kg).forEach(s => {
          const v = parseFloat(s.kg); if (v > max) max = v;
        });
      });
    });
    return max || null;
  }
  const progWorkouts = S.workouts.filter(w => w.date >= progStart);

  const statsRows = allMuscles.map(m => {
    const col = MCOL[m] || '#9CA3AF';
    const progMax = maxKg(progWorkouts, m);
    const allMax = maxKg(S.workouts, m);
    const isPB = progMax && allMax && progMax >= allMax;
    const progCell = progMax ? `${progMax} kg` : `<span style="color:#D1D5DB">—</span>`;
    const allCell = allMax ? `${allMax} kg` : `<span style="color:#D1D5DB">—</span>`;
    const dl = logged[m] || 0, pl = planned[m] || 0;
    const sessCell = dl > 0
      ? `<span style="color:#4CAF50;font-weight:900">${dl}</span><span style="color:#D1D5DB;font-size:11px">/${pl}</span>`
      : `<span style="color:#D1D5DB;font-size:11px">—/${pl}</span>`;
    const pbBadge = isPB ? `<span style="font-size:8px;font-weight:700;color:#16A34A;background:#DCFCE7;border-radius:4px;padding:1px 5px;margin-left:3px">PB</span>` : '';
    return `<tr>
      <td style="padding:8px 0;border-top:1px solid #F3F4F6;font-size:12px">
        <div style="display:flex;align-items:center">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:6px;flex-shrink:0"></span>${m}
        </div>
      </td>
      <td style="padding:8px 0;border-top:1px solid #F3F4F6;text-align:right;font-size:12px;font-weight:700">${progCell}${pbBadge}</td>
      <td style="padding:8px 0;border-top:1px solid #F3F4F6;text-align:right;font-size:11px;font-weight:500;color:#6B7280">${allCell}</td>
      <td style="padding:8px 0;border-top:1px solid #F3F4F6;text-align:center;font-size:12px">${sessCell}</td>
    </tr>`;
  }).join('');

  const chevron = homeProgramExpanded ? '▲' : '▼';
  pb.innerHTML = `<div class="pbanner">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div><div class="p-lbl">Active</div><div class="p-name">${S.prog.name}</div></div>
      <button onclick="goPage(2)" style="padding:6px 12px;background:var(--light);border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">Change</button>
    </div>
    <div style="margin-bottom:6px">${chip('📅 ' + S.prog.weeks + 'w')}${chip('🏋️ ' + done + '/' + (S.prog.weeks * 5))}${chip('Ends ' + fmtD(end))}</div>
    <div class="pbar-t"><div class="pbar-f" style="width:${pct}%"></div></div>
    <div class="pbar-pct">${pct}% complete</div>
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;margin-top:10px;padding-top:8px;border-top:1px solid #EDEDED" onclick="toggleHomeProgram()">
      <span style="font-size:10px;font-weight:700;color:#6B7280">Muscle stats</span>
      <span style="font-size:11px;color:#6B7280">${chevron}</span>
    </div>
    ${homeProgramExpanded ? `<div style="margin-top:10px">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.8px;padding:0 0 7px;text-align:left">Muscle</th>
          <th style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.8px;padding:0 0 7px;text-align:right">Prog max</th>
          <th style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.8px;padding:0 0 7px;text-align:right">All-time</th>
          <th style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.8px;padding:0 0 7px;text-align:center">This wk</th>
        </tr></thead>
        <tbody>${statsRows}</tbody>
      </table>
    </div>` : ''}
  </div>`;
}

export function renderHomeCalStrip(): void {
  const cs = document.getElementById('homeCalStrip');
  if (!cs) return;
  const todayD = today();
  const todayStr = ymd(todayD);
  if (!homeCalMonth) setHomeCalMonth({ y: todayD.getFullYear(), m: todayD.getMonth() });
  const { y: calY, m: calM } = homeCalMonth!;
  const chevron = homeCalExpanded ? '▲' : '▼';
  const isCurrentMonth = calY === todayD.getFullYear() && calM === todayD.getMonth();
  const mLabel = `${monthName(calM)} ${calY}` + (isCurrentMonth ? ' <span style="font-size:9px;color:var(--green);font-weight:700">· Now</span>' : '');

  function dayState(d: Date) {
    const ds = ymd(d);
    const isToday = ds === todayStr;
    const isSel = homeSelDate ? ds === homeSelDate : isToday;
    const inProg = isInProgRange(ds);
    const hasProg = getDayIdx(d) !== null;
    const isRest = inProg && !hasProg;
    const loggedW = getLogged(ds);
    const dotCls = loggedW ? 'cs-dot logged' : hasProg ? 'cs-dot planned' : 'cs-dot';
    const indicator = isRest ? `<span style="font-size:8px;line-height:1">💤</span>` : `<div class="${dotCls}"></div>`;
    let dayCls = 'cs-day';
    if (isSel && isToday) dayCls += ' cs-today';
    else if (isSel) dayCls += ' cs-selected';
    return { ds, dayCls, indicator };
  }

  function stripCell(d: Date): string {
    const { ds, dayCls, indicator } = dayState(d);
    return `<div class="${dayCls}" onclick="selectHomeDay('${ds}')">
      <div class="cs-lbl">${DOW_SHORT[d.getDay()]}</div>
      <div class="cs-circle"><span class="cs-num">${d.getDate()}</span></div>
      ${indicator}
    </div>`;
  }

  function gridCell(d: Date): string {
    const { ds, dayCls, indicator } = dayState(d);
    return `<div class="${dayCls}" onclick="selectHomeDay('${ds}')">
      <div class="cs-circle"><span class="cs-num">${d.getDate()}</span></div>
      ${indicator}
    </div>`;
  }

  const header = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    ${homeCalExpanded
      ? `<span style="font-size:11px;font-weight:700;color:var(--muted)">${mLabel}</span>
        <div style="display:flex;gap:4px">
          <button onclick="homeCalNavMonth(-1)" style="width:24px;height:24px;border:none;background:var(--light);border-radius:8px;font-size:14px;cursor:pointer;color:var(--muted);display:flex;align-items:center;justify-content:center">‹</button>
          <button onclick="homeCalNavMonth(1)" style="width:24px;height:24px;border:none;background:var(--light);border-radius:8px;font-size:14px;cursor:pointer;color:var(--muted);display:flex;align-items:center;justify-content:center">›</button>
          <button onclick="homeCalToggle(false)" style="width:24px;height:24px;border:none;background:var(--light);border-radius:8px;font-size:11px;cursor:pointer;color:var(--muted);display:flex;align-items:center;justify-content:center">▲</button>
        </div>`
      : `<span></span><span></span>`
    }
  </div>`;

  let body = '';
  if (!homeCalExpanded) {
    const startOfWeek = new Date(todayD);
    startOfWeek.setDate(todayD.getDate() - todayD.getDay() + (homeWeekOffset * 7));
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
    const isCurrentWeek = homeWeekOffset === 0;
    const MSHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const weekLbl = isCurrentWeek
      ? `${MSHORT[startOfWeek.getMonth()]} ${startOfWeek.getFullYear()}`
      : `${startOfWeek.getDate()} – ${endOfWeek.getDate()} ${MSHORT[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;
    const stripHeader = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:11px;font-weight:700;color:var(--muted)">${weekLbl}</span>
      <div style="display:flex;gap:4px">
        <button onclick="homeWeekNav(-1)" style="width:24px;height:24px;border:none;background:var(--light);border-radius:8px;font-size:14px;cursor:pointer;color:var(--muted);display:flex;align-items:center;justify-content:center">‹</button>
        ${!isCurrentWeek ? `<button onclick="homeWeekReset()" style="border:none;background:var(--light);border-radius:8px;padding:0 8px;font-size:9px;font-weight:700;cursor:pointer;color:var(--green);height:24px">Now</button>` : ''}
        <button onclick="homeWeekNav(1)" style="width:24px;height:24px;border:none;background:var(--light);border-radius:8px;font-size:14px;cursor:pointer;color:var(--muted);display:flex;align-items:center;justify-content:center">›</button>
        <button onclick="homeCalToggle(true)" style="width:24px;height:24px;border:none;background:var(--light);border-radius:8px;font-size:11px;cursor:pointer;color:var(--muted);display:flex;align-items:center;justify-content:center">▼</button>
      </div>
    </div>`;
    body = stripHeader + `<div class="cal-strip">`;
    for (let i = 0; i < 7; i++) {
      const d2 = new Date(startOfWeek); d2.setDate(startOfWeek.getDate() + i);
      body += stripCell(d2);
    }
    body += `</div>`;
  } else {
    const firstDOW = new Date(calY, calM, 1).getDay();
    const numDays = new Date(calY, calM + 1, 0).getDate();
    body = `<div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px">${DOW_SHORT.map(d2 => `<div style="text-align:center;font-size:9px;font-weight:700;color:var(--muted);padding:2px 0">${d2}</div>`).join('')}</div>`;
    body += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;
    for (let i = 0; i < firstDOW; i++) body += `<div></div>`;
    for (let d2 = 1; d2 <= numDays; d2++) {
      const date2 = new Date(calY, calM, d2);
      body += `<div style="display:flex;justify-content:center;padding:2px 0">${gridCell(date2)}</div>`;
    }
    body += `</div>`;
  }

  cs.innerHTML = `<div style="background:#fff;border-radius:14px;padding:12px 10px 10px;box-shadow:var(--shadow);margin-bottom:10px">${homeCalExpanded ? header : ''}${body}</div>`;
}

export function renderHomeTodayCard(): void {
  const tc = document.getElementById('homeTodayCard');
  const lbl = document.getElementById('homeDayLabel');
  if (!tc) return;
  const activeDate = homeSelDate ? parseYMD(homeSelDate) : today();
  const activeStr = homeSelDate || todayYMD();
  const isToday2 = activeStr === todayYMD();
  if (lbl) lbl.textContent = isToday2 ? 'Today' : fmt(activeDate);
  const dayIdx = getDayIdx(activeDate);
  const logged = getLogged(activeStr);
  const inProg = isInProgRange(activeStr);

  if (dayIdx !== null) {
    const day = FST7[dayIdx];
    if (!day || !day.exercises) {
      tc.innerHTML = `<div class="tcrd" style="text-align:center;padding:20px">
        <div style="font-size:28px;margin-bottom:6px">🏋️</div>
        <div style="font-size:15px;font-weight:800;margin-bottom:3px">Training Day</div>
        <div style="font-size:11px;color:var(--muted)">No exercises set up yet.</div>
        <button class="btn btn-g" style="margin-top:10px" onclick="goPage(2)">Set Up Exercises</button>
      </div>`;
      return;
    }
    const chips = day.exercises.slice(0, 4).map(e => chip(e.name, !!e.fst7)).join('') + chip('+more');
    const muscles = [...new Set(day.exercises.map(e => e.muscle).filter(Boolean))].slice(0, 3).map(m => `<span class="chip">${m}</span>`).join('');
    tc.innerHTML = `<div class="tcrd">
      <div class="t-lbl">${isToday2 ? "Today's Program" : fmt(activeDate)}</div>
      <div class="t-name">${day.day} — ${day.name}</div>
      ${muscles ? `<div style="margin-bottom:6px">${muscles}</div>` : ''}
      <div style="margin-bottom:12px">${chips}</div>
      <button class="btn btn-g" style="width:100%;margin-bottom:5px" onclick="handleSessionBtn('${activeStr}',${dayIdx},${logged ? 1 : 0})">${logged ? '🔄 Restart Session' : '▶ Start Session'}</button>
      <button class="btn" style="width:100%;background:var(--light);color:var(--muted);font-size:11px;font-weight:700" onclick="showDayOpts('${activeStr}',${logged ? 1 : 0})">⚙️ Options</button>
    </div>`;
  } else if (inProg) {
    tc.innerHTML = `<div class="tcrd" style="text-align:center;padding:20px">
      <div style="font-size:28px;margin-bottom:6px">💤</div>
      <div style="font-size:15px;font-weight:800;margin-bottom:3px">Rest Day</div>
      <div style="font-size:11px;color:var(--muted)">Recovery is part of the program.</div>
    </div>`;
  } else {
    tc.innerHTML = `<div class="tcrd" style="text-align:center;padding:20px">
      <div style="font-size:28px;margin-bottom:6px">📅</div>
      <div style="font-size:15px;font-weight:800;margin-bottom:3px">No Session Scheduled</div>
      <div style="font-size:11px;color:var(--muted)">Outside of active program range.</div>
    </div>`;
  }
}
