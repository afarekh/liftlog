import type { WorkoutLog } from '../types';

/** Number of completed sets in a log — used to pick a winner on collision. */
export function loggedSets(w: WorkoutLog): number {
  return (w.exercises || []).reduce((n, ex) =>
    n + (Array.isArray(ex.sets) ? ex.sets.filter(s => s && s.done).length : 0), 0);
}

/**
 * Union workout logs from both sides so a log can never be lost, no matter
 * which device recorded it. Same-date collisions keep whichever entry has more
 * completed sets (ties go to remote, which is the shared source of truth).
 */
export function mergeWorkouts(local: WorkoutLog[], remote: WorkoutLog[]): WorkoutLog[] {
  const byKey = new Map<string, WorkoutLog>();
  for (const w of local || []) byKey.set(w.date, w);
  for (const w of remote || []) {
    const mine = byKey.get(w.date);
    if (!mine || loggedSets(w) >= loggedSets(mine)) byKey.set(w.date, w);
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
}

type NamedProg = { name?: string };

/**
 * Union the saved-program library by name. Programs are authored on either
 * device, so on a first sync we must end up with every one of them rather
 * than whichever list happened to be written last. Same name = same program;
 * remote wins that tie since it is the shared copy.
 */
export function mergeSavedProgs<T extends NamedProg>(local: T[], remote: T[]): T[] {
  const byName = new Map<string, T>();
  for (const p of local || []) if (p && p.name) byName.set(p.name, p);
  for (const p of remote || []) if (p && p.name) byName.set(p.name, p);
  return [...byName.values()];
}

/** Union custom exercises per muscle group, de-duplicated and sorted. */
export function mergeCustomEx(
  local: Record<string, string[]>, remote: Record<string, string[]>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const src of [local || {}, remote || {}]) {
    for (const mg of Object.keys(src)) {
      out[mg] = [...new Set([...(out[mg] || []), ...(src[mg] || [])])].sort();
    }
  }
  return out;
}

/** True when a value carries no data (used to avoid empty-cloud wipeouts). */
export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
}

/**
 * Decide whether to accept a remote value for a field that cannot be merged
 * (the active program, and the wizard draft — single values, not collections).
 *
 * On a device's first-ever sync, anything already on the device wins: joining
 * an account must never replace data you are actively using. The device pushes
 * its own copy up instead. Only once the two are in step does the newer writer
 * win, so that later edits and deletions propagate normally.
 */
export function shouldTakeRemote(
  remoteValue: unknown, localValue: unknown,
  firstEverSync: boolean, remoteAt: number, localAt: number
): boolean {
  if (!firstEverSync) return remoteAt >= localAt;
  return isEmpty(localValue) && !isEmpty(remoteValue);
}
