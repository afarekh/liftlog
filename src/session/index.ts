import { S, SESSION, timerInt, timerSecs, timerPaused, FST7, wiz,
  setSession, setTimerInt, setTimerSecs, setTimerPaused } from '../store/state';
import { fmt, fmtSecs, ymd, parseYMD, todayYMD } from '../utils/date';
import { saveS } from '../services/storage';
import { renderSP } from './render';
import { openCV, closeCV } from './completed';
import { renderCal } from '../pages/calendar';
import { renderHome } from '../pages/home';
import { ilToast, ilConfirm } from '../utils/ui';
import type { Session } from '../types';

export function handleSessionBtn(ds: string, dayIdx: number, isLogged: number): void {
  if (isLogged) restartFromCard(ds, dayIdx);
  else startFreshSession(ds, dayIdx);
}

export function startFreshSession(ds: string, dayIdx: number): void {
  const day = FST7[dayIdx];
  if (!day || !day.exercises) {
    ilToast('No exercises set up for this day.', 'error');
    (window as any).goPage(2);
    return;
  }

  let weekNum = 1;
  if (S.prog && S.prog.startDate) {
    const startD = parseYMD(S.prog.startDate);
    const sessionD = parseYMD(ds);
    const diffDays = Math.floor((sessionD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));
    weekNum = Math.min(Math.floor(diffDays / 7) + 1, S.prog.weeks || 8);
  }

  const overrides = S.prog && S.prog.weekOverrides;
  let sessionExes = day.exercises;
  if (overrides && overrides[weekNum] && overrides[weekNum][dayIdx]) {
    sessionExes = overrides[weekNum][dayIdx];
  }

  const newSession: Session = {
    dateStr: ds,
    dayIdx,
    dayLabel: `${day.day} — ${day.name}`,
    style: 'High Volume',
    weekNum,
    exercises: sessionExes.map(e => ({
      ...e,
      sets: Array.from({ length: e.sets as number }, () => ({ kg: '', reps: '', done: false })),
    })) as Session['exercises'],
  };
  setSession(newSession);

  const titleEl = document.getElementById('spTitle');
  const subEl = document.getElementById('spSub');
  if (titleEl) titleEl.textContent = `Exercise 1 / ${day.exercises.length}`;
  if (subEl) subEl.textContent = `${day.day.toUpperCase()} · WK ${weekNum}`;

  setTimerSecs(0);
  if (timerInt) clearInterval(timerInt);
  setTimerPaused(false);
  const timerEl = document.getElementById('spTimer');
  const timerIconEl = document.getElementById('spTimerIcon');
  if (timerEl) timerEl.textContent = '00:00';
  if (timerIconEl) timerIconEl.textContent = '⏱';

  setTimerInt(setInterval(() => {
    if (!timerPaused) {
      setTimerSecs(timerSecs + 1);
      const el = document.getElementById('spTimer');
      if (el) el.textContent = fmtSecs(timerSecs);
    }
  }, 1000));

  renderSP();
  const sp = document.getElementById('SP');
  if (sp) { sp.classList.add('open'); sp.scrollTop = 0; }
  history.pushState({ v: 'session' }, '');
}

export function openSession(ds: string, dayIdx: number): void {
  const logged = S.workouts.find(w => w.date === ds) || null;
  if (logged) { openCV(logged); return; }
  const day = FST7[dayIdx];
  const newSession: Session = {
    dateStr: ds,
    dayIdx,
    dayLabel: `${day.day} — ${day.name}`,
    style: 'High Volume',
    exercises: day.exercises.map(e => ({
      ...e,
      sets: Array.from({ length: e.sets as number }, () => ({ kg: '', reps: '', done: false })),
    })) as Session['exercises'],
  };
  setSession(newSession);

  const titleEl = document.getElementById('spTitle');
  const subEl = document.getElementById('spSub');
  if (titleEl) titleEl.textContent = `Exercise 1 / ${day.exercises.length}`;
  if (subEl) subEl.textContent = `${day.day.toUpperCase()} · DAY`;

  setTimerSecs(0);
  if (timerInt) clearInterval(timerInt);
  setTimerPaused(false);
  const timerEl = document.getElementById('spTimer');
  if (timerEl) timerEl.textContent = '00:00';

  setTimerInt(setInterval(() => {
    if (!timerPaused) {
      setTimerSecs(timerSecs + 1);
      const el = document.getElementById('spTimer');
      if (el) el.textContent = fmtSecs(timerSecs);
    }
  }, 1000));

  renderSP();
  const sp = document.getElementById('SP');
  if (sp) { sp.classList.add('open'); sp.scrollTop = 0; }
  history.pushState({ v: 'session' }, '');
}

export function closeSession(): void {
  if (timerInt) clearInterval(timerInt);
  const sp = document.getElementById('SP');
  if (sp) sp.classList.remove('open');
  setSession(null);
}

export function completeWorkout(): void {
  if (!SESSION) return;
  if (timerInt) clearInterval(timerInt);
  const w = {
    date: SESSION.dateStr,
    dayIdx: SESSION.dayIdx,
    dayLabel: SESSION.dayLabel,
    style: SESSION.style,
    duration: fmtSecs(timerSecs),
    exercises: SESSION.exercises.map(e => ({
      name: e.name,
      muscle: e.muscle,
      fst7: e.fst7 || false,
      reps: e.reps || '8-12',
      sets: e.sets.map(s => ({ kg: s.kg, reps: s.reps, done: s.done })),
    })),
  };
  S.workouts.push(w);
  saveS();
  const sp = document.getElementById('SP');
  if (sp) sp.classList.remove('open');
  setSession(null);
  openCV(w);
  renderCal();
  renderHome();
}

export function toggleTimer(): void {
  setTimerPaused(!timerPaused);
  const iconEl = document.getElementById('spTimerIcon');
  const timerEl = document.getElementById('spTimer');
  if (iconEl) iconEl.textContent = timerPaused ? '⏸' : '⏱';
  if (timerEl) timerEl.style.opacity = timerPaused ? '0.5' : '1';
}

export function restartFromCard(ds: string, dayIdx: number): void {
  ilConfirm(
    'Start fresh? Existing data for this day will be deleted.',
    () => {
      S.workouts = S.workouts.filter(w => w.date !== ds);
      saveS();
      renderCal();
      renderHome();
      startFreshSession(ds, dayIdx);
    },
    'Start Fresh',
    true
  );
}

export function restartSession(): void {
  const rb = document.getElementById('cvRestartBtn') as HTMLButtonElement | null;
  if (!rb) return;
  const cvDate = rb.dataset['date'];
  const cvDayIdx = parseInt(rb.dataset['dayidx'] || '0');
  if (!cvDate) { ilToast('Session data not found.', 'error'); return; }
  ilConfirm(
    'Start fresh? The existing logged session will be deleted.',
    () => {
      S.workouts = S.workouts.filter(w => w.date !== cvDate);
      saveS();
      closeCV();
      startFreshSession(cvDate, cvDayIdx);
    },
    'Start Fresh',
    true
  );
}
