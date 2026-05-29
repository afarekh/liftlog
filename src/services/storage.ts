import { S, wiz, FST7 } from '../store/state';
import { EX } from '../data/exercises';

export const KEYS = {
  workouts: 'll_w',
  prog: 'll_p',
  library: 'll_lib',
  wiz: 'll_wiz',
  customEx: 'll_custom_ex',
  savedProgs: 'll_saved_progs',
};

export function saveS(): void {
  try {
    localStorage.setItem(KEYS.workouts, JSON.stringify(S.workouts));
    localStorage.setItem(KEYS.prog, JSON.stringify(S.prog));
    localStorage.setItem(KEYS.library, JSON.stringify(S.library));
    localStorage.setItem(KEYS.wiz, JSON.stringify(wiz));
  } catch (e) {}
}

export function loadS(): void {
  try {
    const w = localStorage.getItem(KEYS.workouts);
    if (w) S.workouts = JSON.parse(w);
    const p = localStorage.getItem(KEYS.prog);
    if (p) S.prog = JSON.parse(p);
    const lib = localStorage.getItem(KEYS.library);
    if (lib) S.library = JSON.parse(lib);
    const wz = localStorage.getItem(KEYS.wiz);
    if (wz) Object.assign(wiz, JSON.parse(wz));

    // Load custom exercises into EX
    const custom = localStorage.getItem(KEYS.customEx);
    if (custom) {
      const parsed = JSON.parse(custom);
      Object.keys(parsed).forEach(mg => {
        if (EX[mg]) EX[mg] = [...new Set([...EX[mg], ...parsed[mg]])].sort();
      });
    }

    // Restore FST7 from active custom program
    if (S.prog && S.prog.isCustom && S.prog.dayPrograms && S.prog.dayPrograms.length) {
      FST7.length = 0;
      S.prog.dayPrograms.forEach((d, i) => {
        FST7.push({
          day: d.name || 'Day ' + (i + 1),
          name: d.name || 'Day ' + (i + 1),
          muscles: [...new Set(d.exercises.map(e => e.muscle))],
          exercises: d.exercises.map(e => ({ ...e })),
        });
      });
    }
  } catch (e) {}
}
