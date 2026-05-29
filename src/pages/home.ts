import { S, homeSelDate, homeCalExpanded, homeCalMonth, homeWeekOffset, homeProgramExpanded,
  setHomeSelDate, setHomeCalExpanded, setHomeCalMonth, setHomeWeekOffset, setHomeProgramExpanded } from '../store/state';
import { fmt, ymd, parseYMD, today, todayYMD, DOW_SHORT, monthName } from '../utils/date';
import { isInProgRange, getDayIdx, getLogged } from '../utils/helpers';
import { FST7 } from '../store/state';

export function renderHome(): void {
  const h = today().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  const greetNameEl = document.getElementById('heroGreetName');
  if (greetNameEl) greetNameEl.textContent = greeting;

  const greetDateEl = document.getElementById('heroGreetDate');
  if (greetDateEl) {
    const d = today();
    greetDateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

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

export function toggleTodayCardExes(): void {
  const wrap = document.getElementById('tcardExWrap');
  const btn = document.getElementById('tcardToggleBtn');
  if (!wrap || !btn) return;
  const isOpen = wrap.classList.toggle('open');
  btn.innerHTML = isOpen
    ? `Hide exercises <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 15l-6-6-6 6"/></svg>`
    : `Show exercises <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>`;
}

export function renderHomeProgram(): void {
  const pb = document.getElementById('homeProgBanner');
  if (!pb) return;

  if (!S.prog || !S.prog.active) {
    pb.innerHTML = `<div class="pbanner" style="text-align:center;padding:20px">
      <div class="p-name" style="font-size:16px;margin-bottom:8px">No Active Program</div>
      <button class="start-btn" style="height:44px;font-size:14px" onclick="goPage(2)">Set Up Program</button>
    </div>`;
    return;
  }

  const start = parseYMD(S.prog.startDate);
  const diffDays = Math.max(0, Math.floor((today().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const currentWeek = Math.min(Math.floor(diffDays / 7) + 1, S.prog.weeks);
  const totalWeeks = S.prog.weeks;
  const ringPct = totalWeeks > 1 ? Math.min(1, (currentWeek - 1) / (totalWeeks - 1)) : 1;

  const done = S.workouts.length;
  const totalSessions = S.prog.weeks * 5;

  // Ring SVG
  const sz = 88, r = (sz - 12) / 2, c = 2 * Math.PI * r;
  const offset = c * (1 - ringPct);
  const ringHtml = `<svg width="${sz}" height="${sz}" style="transform:rotate(-90deg)" viewBox="0 0 ${sz} ${sz}">
    <circle cx="${sz/2}" cy="${sz/2}" r="${r}" stroke="var(--line2)" stroke-width="6" fill="none"/>
    <circle cx="${sz/2}" cy="${sz/2}" r="${r}" stroke="var(--lime-edge)" stroke-width="6" fill="none"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" stroke-linecap="round"/>
  </svg>`;

  // Muscle usage bars (sessions where muscle appeared)
  const MUSCLES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'];
  const muscleCounts: Record<string, number> = {};
  MUSCLES.forEach(m => muscleCounts[m] = 0);
  S.workouts.forEach(w => {
    (w.exercises || []).forEach(e => {
      const m = e.muscle;
      if (muscleCounts[m] !== undefined) muscleCounts[m]++;
    });
  });
  const maxCount = Math.max(...Object.values(muscleCounts), 1);
  const muscleBars = MUSCLES.map(m => {
    const count = muscleCounts[m] || 0;
    const pct = Math.round((count / maxCount) * 100);
    return `<div class="p-muscle-row">
      <div class="p-muscle-name">${m}</div>
      <div class="p-muscle-bar"><div class="p-muscle-fill" style="width:${pct}%"></div></div>
      <div class="p-muscle-val">${count}</div>
    </div>`;
  }).join('');

  const chevSvg = homeProgramExpanded
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 15l-6-6-6 6"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>`;

  pb.innerHTML = `<div class="pbanner">
    <div class="p-ring-row">
      <div class="p-ring-wrap">
        ${ringHtml}
        <div class="p-ring-inner">
          <div class="p-ring-wk">${currentWeek}<span>/${totalWeeks}</span></div>
          <div class="p-ring-lbl">WEEKS</div>
        </div>
      </div>
      <div class="p-info">
        <div class="p-name">${S.prog.name}</div>
        <div class="p-lbl">${done} of ${totalSessions} sessions</div>
        <div class="p-stats-row">
          <div><div class="p-stat-v">${done}</div><div class="p-stat-l">SESSIONS</div></div>
          <div><div class="p-stat-v">${currentWeek}</div><div class="p-stat-l">CURR WEEK</div></div>
        </div>
      </div>
    </div>
    <div class="p-detail-wrap${homeProgramExpanded ? ' open' : ''}">
      <div class="p-detail-inner">
        <div class="p-detail">
          <div class="p-detail-eyebrow">SESSIONS BY MUSCLE</div>
          ${muscleBars}
        </div>
      </div>
    </div>
    <button class="p-toggle" onclick="toggleHomeProgram()">
      ${homeProgramExpanded ? 'Hide details' : 'Program details'} ${chevSvg}
    </button>
  </div>`;
}

export function renderHomeCalStrip(): void {
  const cs = document.getElementById('homeCalStrip');
  if (!cs) return;
  const todayD = today();
  const todayStr = ymd(todayD);
  if (!homeCalMonth) setHomeCalMonth({ y: todayD.getFullYear(), m: todayD.getMonth() });
  const { y: calY, m: calM } = homeCalMonth!;
  const isCurrentMonth = calY === todayD.getFullYear() && calM === todayD.getMonth();
  const mLabel = `${monthName(calM)} ${calY}` + (isCurrentMonth ? ' · Now' : '');

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

  let html = '';
  if (!homeCalExpanded) {
    const startOfWeek = new Date(todayD);
    startOfWeek.setDate(todayD.getDate() - todayD.getDay() + (homeWeekOffset * 7));
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
    const isCurrentWeek = homeWeekOffset === 0;
    const MSHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const weekLbl = isCurrentWeek
      ? `${MSHORT[startOfWeek.getMonth()]} ${startOfWeek.getFullYear()}`
      : `${startOfWeek.getDate()} – ${endOfWeek.getDate()} ${MSHORT[endOfWeek.getMonth()]}`;

    const navBtns = `<div class="wstrip-nav">
      <button onclick="homeWeekNav(-1)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button onclick="homeWeekNav(1)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>`;

    html = `<div class="wstrip-hdr">
      <div class="wstrip-date-lbl">${weekLbl}</div>
      ${navBtns}
    </div><div class="cal-strip">`;
    for (let i = 0; i < 7; i++) {
      const d2 = new Date(startOfWeek); d2.setDate(startOfWeek.getDate() + i);
      html += stripCell(d2);
    }
    html += `</div>`;
    if (!isCurrentWeek) {
      html += `<button onclick="homeWeekReset()" style="display:block;margin:8px auto 0;border:none;background:none;font-size:10px;font-weight:700;color:var(--lime-text);cursor:pointer;letter-spacing:0.5px">Back to today</button>`;
    }
  } else {
    const navBtns = `<div style="display:flex;gap:6px">
      <button onclick="homeCalNavMonth(-1)" style="width:24px;height:24px;border:1px solid var(--line2);background:var(--bg);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button onclick="homeCalNavMonth(1)" style="width:24px;height:24px;border:1px solid var(--line2);background:var(--bg);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
      <button onclick="homeCalToggle(false)" style="width:24px;height:24px;border:1px solid var(--line2);background:var(--bg);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" stroke-width="2" stroke-linecap="round"><path d="M18 15l-6-6-6 6"/></svg>
      </button>
    </div>`;
    html = `<div class="wstrip-hdr">
      <div class="wstrip-date-lbl">${mLabel}</div>
      ${navBtns}
    </div>`;
    const firstDOW = new Date(calY, calM, 1).getDay();
    const numDays = new Date(calY, calM + 1, 0).getDate();
    html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px">${DOW_SHORT.map(d2 => `<div style="text-align:center;font-size:9px;font-weight:700;color:var(--ink3);padding:2px 0">${d2}</div>`).join('')}</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;
    for (let i = 0; i < firstDOW; i++) html += `<div></div>`;
    for (let d2 = 1; d2 <= numDays; d2++) {
      const date2 = new Date(calY, calM, d2);
      html += `<div style="display:flex;justify-content:center;padding:2px 0">${gridCell(date2)}</div>`;
    }
    html += `</div>`;
  }

  cs.innerHTML = `<div style="margin-bottom:10px">${html}</div>`;
}

export function renderHomeTodayCard(): void {
  const tc = document.getElementById('homeTodayCard');
  const lbl = document.getElementById('homeDayLabel');
  if (!tc) return;
  const activeDate = homeSelDate ? parseYMD(homeSelDate) : today();
  const activeStr = homeSelDate || todayYMD();
  const isToday2 = activeStr === todayYMD();
  if (lbl) lbl.textContent = isToday2 ? 'TODAY' : fmt(activeDate).toUpperCase();
  const dayIdx = getDayIdx(activeDate);
  const logged = getLogged(activeStr);
  const inProg = isInProgRange(activeStr);

  if (dayIdx !== null) {
    const day = FST7[dayIdx];
    if (!day || !day.exercises) {
      tc.innerHTML = `<div class="tcrd">
        <div style="font-size:28px;margin-bottom:8px">🏋️</div>
        <div class="t-name">Training Day</div>
        <div style="font-size:12px;color:var(--ink3);margin-bottom:12px">No exercises set up yet.</div>
        <button class="start-btn" style="height:44px;font-size:14px" onclick="goPage(2)">Set Up Exercises</button>
      </div>`;
      return;
    }
    const muscles = [...new Set(day.exercises.map(e => e.muscle).filter(Boolean))];
    const muscleStr = muscles.slice(0, 4).join(' · ');

    const chipHtml = day.exercises.slice(0, 4).map((e, i) =>
      `<div class="tcard-chip${i >= 2 ? ' dim' : ''}">${e.name.toUpperCase()}</div>`
    ).join('') + (day.exercises.length > 4
      ? `<div class="tcard-chip dim">+${day.exercises.length - 4} MORE</div>` : '');

    const exListHtml = day.exercises.map((e, i) => {
      const setsCount = typeof e.sets === 'number' ? e.sets : (e.sets as any[]).length;
      return `<div class="tcard-ex-row">
        <div class="tcard-ex-num">${i + 1}</div>
        <div class="tcard-ex-info">
          <div class="tcard-ex-name">${e.name.toUpperCase()}</div>
          <div class="tcard-ex-sub">${e.muscle}</div>
        </div>
        <div class="tcard-ex-sets">${setsCount} × ${e.reps}</div>
      </div>`;
    }).join('');

    tc.innerHTML = `<div class="tcard">
      <div class="tcard-meta">
        <div class="tcard-tag">${logged ? 'LOGGED ✓' : 'UP NEXT'}</div>
        <div class="tcard-dur">${day.exercises.length} exercises</div>
      </div>
      <div class="tcard-title">${day.name.toUpperCase()}</div>
      ${muscleStr ? `<div class="tcard-muscles">${muscleStr}</div>` : ''}
      <div class="tcard-chips">${chipHtml}</div>
      <div class="tcard-ex-wrap" id="tcardExWrap">
        <div class="tcard-ex-inner">
          <div class="tcard-ex-list">${exListHtml}</div>
        </div>
      </div>
      <button class="tcard-toggle" onclick="toggleTodayCardExes()" id="tcardToggleBtn">
        Show exercises
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div style="height:14px"></div>
      <button class="start-btn" onclick="handleSessionBtn('${activeStr}',${dayIdx},${logged ? 1 : 0})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/></svg>
        ${logged ? 'RESTART SESSION' : 'START WORKOUT'}
      </button>
    </div>`;
  } else if (inProg) {
    tc.innerHTML = `<div class="tcrd">
      <div style="font-size:28px;margin-bottom:8px">💤</div>
      <div class="t-name">Rest Day</div>
      <div style="font-size:12px;color:var(--ink3)">Recovery is part of the program.</div>
    </div>`;
  } else {
    tc.innerHTML = `<div class="tcrd">
      <div style="font-size:28px;margin-bottom:8px">📅</div>
      <div class="t-name">No Session</div>
      <div style="font-size:12px;color:var(--ink3)">Outside active program range.</div>
    </div>`;
  }
}
