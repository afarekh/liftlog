import { S, wiz, rebuildFST7 } from '../store/state';
import { EX } from '../data/exercises';
import { KEYS } from './keys';
import { cloudSave } from './firebase';

export { KEYS };

export function saveS(): void {
  try {
    localStorage.setItem(KEYS.workouts, JSON.stringify(S.workouts));
    localStorage.setItem(KEYS.prog, JSON.stringify(S.prog));
    localStorage.setItem(KEYS.library, JSON.stringify(S.library));
    localStorage.setItem(KEYS.wiz, JSON.stringify(wiz));
  } catch (e) {}
  // Every local save mirrors to the cloud. cloudSave() is debounced and is a
  // no-op until sign-in and the first pull have completed, so this cannot
  // clobber newer data from another device.
  cloudSave();
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
    rebuildFST7();
  } catch (e) {}
}
