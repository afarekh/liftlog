import { S, FST7 } from '../store/state';
import { ymd, parseYMD, today } from './date';

export function chip(t: string, g = false): string {
  return `<span class="chip${g ? ' g' : ''}">${t}</span>`;
}

export function isInProgRange(ds: string): boolean {
  if (!S.prog || !S.prog.active) return false;
  if (ds < S.prog.startDate) return false;
  if (S.prog.endDate && ds >= S.prog.endDate) return false;
  const endD = new Date(parseYMD(S.prog.startDate));
  endD.setDate(endD.getDate() + S.prog.weeks * 7);
  return ds < ymd(endD);
}

export function getDayIdx(date: Date): number | null {
  if (!S.prog || !S.prog.active) return null;
  if (S.prog.endDate && ymd(date) >= S.prog.endDate) return null;
  if (S.prog.startDate && ymd(date) < S.prog.startDate) return null;
  const dow = date.getDay();
  return S.prog.schedule[dow] !== undefined ? S.prog.schedule[dow] : null;
}

export function getLogged(dateStr: string) {
  return S.workouts.find(w => w.date === dateStr) || null;
}

export function getPrev(name: string): { kg: string; reps: string } | null {
  const prev = [...S.workouts].sort((a, b) => b.date.localeCompare(a.date));
  for (const w of prev) {
    const ex = (w.exercises || []).find(e => e.name === name);
    if (ex) {
      const sets = ex.sets as Array<{ kg: string; reps: string; done: boolean }>;
      const best = sets.filter(s => s.done && s.kg)
        .sort((a, b) => parseFloat(b.kg) - parseFloat(a.kg))[0];
      if (best) return { kg: best.kg, reps: best.reps };
    }
  }
  return null;
}

export function getFST7Day(dayIdx: number) {
  return FST7[dayIdx] || null;
}
