import { EX_DB } from '../data/exercises';
import type { AppState, WizState, Session, FST7Day, DayProgram, Program } from '../types';

export let S: AppState = {
  workouts: [],
  prog: null,
  library: Object.values(EX_DB).flat(),
};

export let SESSION: Session | null = null;
export let timerInt: ReturnType<typeof setInterval> | null = null;
export let timerSecs = 0;
export let timerPaused = false;

export let calDate = new Date();
export let calSel: string | null = null;
export let calExpanded = '';

export let homeSelDate: string | null = null;
export let homeCalExpanded = false;
export let homeCalMonth: { y: number; m: number } | null = null;
export let homeWeekOffset = 0;
export let homeProgramExpanded = false;

export let swapExIdx = -1;
export let swapSelEx = '';
export let swapMG = 'Back';

export let aemCtx = '';
export let aemMG = 'Back';
export let aemPicked: string[] = [];
export let aemPickedMuscles: Record<string, string> = {};
export let aemCustomMG = 'Back';

export let wiz: WizState = {
  name: '',
  startDate: '',
  weeks: 8,
  days: 5,
  restDays: [2, 6],
  dayPrograms: [],
  activeDay: 0,
  activeWeek: null,
  activeWeeks: [],
  weekOverrides: {},
  step: 1,
};

export let progMG = '';
export let progExes: string[] = [];
export let dragSrc: number | null = null;

// Active program day data — populated when a program is activated
export const FST7: FST7Day[] = [];

// ── Setters (needed since ES module bindings are live but not re-assignable from outside)
export function setSession(v: Session | null) { SESSION = v; }
export function setTimerInt(v: ReturnType<typeof setInterval> | null) { timerInt = v; }
export function setTimerSecs(v: number) { timerSecs = v; }
export function setTimerPaused(v: boolean) { timerPaused = v; }
export function setCalDate(v: Date) { calDate = v; }
export function setCalSel(v: string | null) { calSel = v; }
export function setCalExpanded(v: string) { calExpanded = v; }
export function setHomeSelDate(v: string | null) { homeSelDate = v; }
export function setHomeCalExpanded(v: boolean) { homeCalExpanded = v; }
export function setHomeCalMonth(v: { y: number; m: number } | null) { homeCalMonth = v; }
export function setHomeWeekOffset(v: number) { homeWeekOffset = v; }
export function setHomeProgramExpanded(v: boolean) { homeProgramExpanded = v; }
export function setSwapExIdx(v: number) { swapExIdx = v; }
export function setSwapSelEx(v: string) { swapSelEx = v; }
export function setSwapMG(v: string) { swapMG = v; }
export function setAemCtx(v: string) { aemCtx = v; }
export function setAemMG(v: string) { aemMG = v; }
export function setAemPicked(v: string[]) { aemPicked = v; }
export function setAemPickedMuscles(v: Record<string, string>) { aemPickedMuscles = v; }
export function setAemCustomMG(v: string) { aemCustomMG = v; }
export function setWiz(v: WizState) { wiz = v; }
export function patchWiz(patch: Partial<WizState>) { Object.assign(wiz, patch); }
export function setProgMG(v: string) { progMG = v; }
export function setProgExes(v: string[]) { progExes = v; }
export function setDragSrc(v: number | null) { dragSrc = v; }

// Rebuild the active-program day data (FST7) from S.prog. Called after loading
// from localStorage and after pulling a program down from the cloud.
//
// A program can end up active with no exercises attached — an older importer
// wrote a name, a duration and a schedule but no dayPrograms, which renders as
// a program on the home screen that has nothing to train. Where the library
// still holds a full copy under the same name, recover from it rather than
// leaving the app in that half-state.
export function rebuildFST7(): void {
  if (!S.prog) { FST7.length = 0; return; }

  if (!(S.prog.dayPrograms && S.prog.dayPrograms.length)) {
    try {
      const saved = JSON.parse(localStorage.getItem('ll_saved_progs') || '[]') as Array<{
        name?: string; dayPrograms?: DayProgram[]; schedule?: Record<number, number>;
        weekOverrides?: Program['weekOverrides'];
      }>;
      const match = saved.find(p => p.name === S.prog!.name && p.dayPrograms && p.dayPrograms.length);
      if (match) {
        S.prog.dayPrograms = match.dayPrograms;
        S.prog.isCustom = true;
        if (!S.prog.weekOverrides) S.prog.weekOverrides = match.weekOverrides || {};
        if (!S.prog.schedule || !Object.keys(S.prog.schedule).length) S.prog.schedule = match.schedule || {};
      }
    } catch (_) {}
  }

  FST7.length = 0;
  if (!(S.prog.dayPrograms && S.prog.dayPrograms.length)) return;
  S.prog.dayPrograms.forEach((d, i) => {
    FST7.push({
      day: d.name || 'Day ' + (i + 1),
      name: d.name || 'Day ' + (i + 1),
      muscles: [...new Set(d.exercises.map(e => e.muscle))],
      exercises: d.exercises.map(e => ({ ...e })),
    });
  });
}

/** True when a program is active but has no exercises to train. */
export function progIsEmpty(): boolean {
  return !!S.prog && !(S.prog.dayPrograms && S.prog.dayPrograms.length);
}
