import type { Program, DayProgram, ExerciseEntry } from '../types';

/**
 * Import format (schemaVersion 1).
 *
 * Deliberately not the app's internal shape: this is what a language model is
 * asked to produce from a written program document, so it favours things that
 * are easy to state plainly — working-set counts, rep bands as text, an
 * exercise "type" — and lets the importer derive the rest.
 */
export interface ImportExercise {
  name: string;
  muscle: string;
  sets: number;                 // working sets only; ramp sets belong in `note`
  reps: string;                 // "6-8", "10-15", "AMRAP" — free text
  type?: ExerciseType;
  fst7?: boolean;
  note?: string;
  superset?: boolean;           // true = performed with the NEXT exercise
}
export interface ImportDay { name: string; exercises: ImportExercise[]; }
export interface ImportOverrideRule {
  forType?: ExerciseType;
  forMuscle?: string;
  match?: string;               // exercise name, case-insensitive
  reps?: string;
  sets?: number;
  note?: string;
  remove?: boolean;
}
export interface ImportOverride { weeks: number[]; label?: string; rules: ImportOverrideRule[]; }
export interface ImportProgram {
  schemaVersion?: number;
  name: string;
  weeks: number;
  restDays?: number[];          // 0 = Sunday
  days: ImportDay[];
  weekOverrides?: ImportOverride[];
}

export type ExerciseType = 'compound' | 'isolation' | 'fst7' | 'abs' | 'raise';
const TYPES: ExerciseType[] = ['compound', 'isolation', 'fst7', 'abs', 'raise'];

export interface ImportResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  program?: Program;
  dayPrograms?: DayProgram[];
  summary?: { days: number; exercises: number; weeklySets: Record<string, number>; overrideWeeks: number[] };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function toEntry(x: ImportExercise): ExerciseEntry {
  // fst7 is stated explicitly, or implied by the type, or by the 7-set shape
  // the app already uses as its own heuristic.
  const fst7 = x.fst7 !== undefined ? !!x.fst7 : (x.type === 'fst7' || x.sets === 7);
  const e: ExerciseEntry = {
    name: String(x.name).trim(),
    muscle: String(x.muscle).trim(),
    fst7,
    fst7Manual: true,           // the document decided this, not the set count
    sets: Number(x.sets),
    reps: String(x.reps).trim(),
  };
  if (x.note) e.note = String(x.note).trim();
  if (x.superset) e.ssLink = true;
  return e;
}

function ruleMatches(r: ImportOverrideRule, src: ImportExercise): boolean {
  if (r.match && src.name.toLowerCase() !== r.match.toLowerCase()) return false;
  if (r.forMuscle && src.muscle.toLowerCase() !== r.forMuscle.toLowerCase()) return false;
  if (r.forType) {
    const t = src.type || (src.fst7 || src.sets === 7 ? 'fst7' : 'isolation');
    if (t !== r.forType) return false;
  }
  return !!(r.match || r.forMuscle || r.forType);
}

/** Apply one week's rules to a day, returning the resulting exercise list. */
function applyRules(day: ImportDay, rules: ImportOverrideRule[]): ExerciseEntry[] {
  const out: ExerciseEntry[] = [];
  for (const src of day.exercises) {
    const hits = rules.filter(r => ruleMatches(r, src));
    if (hits.some(r => r.remove)) continue;
    const patched: ImportExercise = { ...src };
    for (const r of hits) {
      if (r.reps !== undefined) patched.reps = r.reps;
      if (r.sets !== undefined) patched.sets = r.sets;
      if (r.note !== undefined) patched.note = patched.note ? patched.note + ' — ' + r.note : r.note;
    }
    out.push(toEntry(patched));
  }
  return out;
}

/**
 * Map training days onto weekdays exactly the way the wizard does, so an
 * imported program and a hand-built one produce the same schedule.
 */
function buildSchedule(restDays: number[], numDays: number): Record<number, number> {
  const schedule: Record<number, number> = {};
  let di = 0;
  for (let dow = 0; dow < 7 && di < numDays; dow++) {
    if (!restDays.includes(dow)) schedule[dow] = di++;
  }
  return schedule;
}

export function parseProgram(text: string, startDate: string): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: ['That is not valid JSON. ' + (e instanceof Error ? e.message : '')], warnings: [] };
  }
  if (!isObj(raw)) return { ok: false, errors: ['Expected a JSON object at the top level.'], warnings: [] };

  const d = raw as unknown as ImportProgram;

  if (!d.name || typeof d.name !== 'string') errors.push('Missing "name".');
  if (!Array.isArray(d.days) || d.days.length === 0) errors.push('Missing "days" — expected an array of training days.');
  const weeks = Number(d.weeks);
  if (!weeks || weeks < 1 || weeks > 52) errors.push('"weeks" must be a number between 1 and 52.');
  if (errors.length) return { ok: false, errors, warnings };

  if (d.days.length > 7) errors.push(`${d.days.length} days given, but a week only has 7.`);

  const restDays = Array.isArray(d.restDays) ? d.restDays.filter(n => n >= 0 && n <= 6) : [];
  if (7 - restDays.length < d.days.length) {
    errors.push(`${d.days.length} training days will not fit around ${restDays.length} rest days.`);
  }

  // Days and exercises
  const dayPrograms: DayProgram[] = [];
  let exerciseCount = 0;
  const weeklySets: Record<string, number> = {};

  d.days.forEach((day, di) => {
    if (!day || !Array.isArray(day.exercises) || day.exercises.length === 0) {
      errors.push(`Day ${di + 1} has no exercises.`);
      return;
    }
    day.exercises.forEach((x, xi) => {
      const where = `Day ${di + 1} ("${day.name || di + 1}"), exercise ${xi + 1}`;
      if (!x || !x.name) { errors.push(`${where}: missing "name".`); return; }
      if (!x.muscle) { errors.push(`${where} ("${x.name}"): missing "muscle".`); return; }
      const sets = Number(x.sets);
      if (!sets || sets < 1 || sets > 20) { errors.push(`${where} ("${x.name}"): "sets" must be 1–20, got ${x.sets}.`); return; }
      if (!x.reps) { errors.push(`${where} ("${x.name}"): missing "reps".`); return; }
      if (x.type && !TYPES.includes(x.type)) {
        warnings.push(`${where} ("${x.name}"): unknown type "${x.type}" — ignored.`);
      }
      exerciseCount++;
      weeklySets[x.muscle] = (weeklySets[x.muscle] || 0) + sets;
    });

    // A trailing superset flag has nothing to pair with.
    const last = day.exercises[day.exercises.length - 1];
    if (last && last.superset) {
      warnings.push(`Day ${di + 1}: last exercise is marked as a superset but has nothing after it — flag dropped.`);
      last.superset = false;
    }

    dayPrograms.push({
      name: day.name || 'Day ' + (di + 1),
      exercises: day.exercises.filter(x => x && x.name && x.muscle && Number(x.sets)).map(toEntry),
    });
  });

  if (errors.length) return { ok: false, errors, warnings };

  // Week overrides. Rules are gathered per week BEFORE being applied, because
  // a single week can be touched by more than one entry — a joint back-off and
  // a retired exercise can land on week 9 together, and applying each entry
  // separately would make the last one silently discard the others.
  const rulesByWeek: Record<number, ImportOverrideRule[]> = {};
  for (const ov of d.weekOverrides || []) {
    if (!ov || !Array.isArray(ov.weeks) || !Array.isArray(ov.rules)) {
      warnings.push('Skipped a weekOverrides entry that had no "weeks" or "rules".');
      continue;
    }
    for (const wk of ov.weeks) {
      const w = Number(wk);
      if (!w || w < 1 || w > weeks) {
        warnings.push(`Override for week ${wk} is outside the ${weeks}-week block — skipped.`);
        continue;
      }
      rulesByWeek[w] = (rulesByWeek[w] || []).concat(ov.rules);
    }
  }

  const weekOverrides: Record<number, Record<number, ExerciseEntry[]>> = {};
  for (const wk of Object.keys(rulesByWeek)) {
    const w = Number(wk);
    weekOverrides[w] = {};
    d.days.forEach((day, di) => {
      const list = applyRules(day, rulesByWeek[w]);
      if (list.length) weekOverrides[w][di] = list;
    });
  }
  const overrideWeeks = Object.keys(rulesByWeek).map(Number);

  const program: Program = {
    active: true,
    name: d.name.trim(),
    weeks,
    days: d.days.length,
    startDate,
    schedule: buildSchedule(restDays, d.days.length),
    isCustom: true,
    dayPrograms,
    weekOverrides,
  };

  return {
    ok: true, errors: [], warnings, program, dayPrograms,
    summary: { days: d.days.length, exercises: exerciseCount, weeklySets, overrideWeeks: [...new Set(overrideWeeks)].sort((a, b) => a - b) },
  };
}

export interface BundleResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  programs: ImportResult[];     // first entry becomes the active program
}

/**
 * Accept either a single program object, a bare array, or {"programs":[...]}.
 * A document that ships a main block plus an alternate (a Block B rotation,
 * say) arrives as several programs in one paste; the first is activated and
 * the rest are filed in the library.
 */
export function parseBundle(text: string, startDate: string): BundleResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: ['That is not valid JSON. ' + (e instanceof Error ? e.message : '')], warnings: [], programs: [] };
  }

  let list: unknown[];
  if (Array.isArray(raw)) list = raw;
  else if (isObj(raw) && Array.isArray((raw as { programs?: unknown[] }).programs)) list = (raw as { programs: unknown[] }).programs;
  else list = [raw];

  if (!list.length) return { ok: false, errors: ['No programs found in that JSON.'], warnings: [], programs: [] };

  const programs = list.map(p => parseProgram(JSON.stringify(p), startDate));
  const errors: string[] = [];
  const warnings: string[] = [];
  programs.forEach((r, i) => {
    const tag = list.length > 1 ? `Program ${i + 1}: ` : '';
    r.errors.forEach(e => errors.push(tag + e));
    r.warnings.forEach(w => warnings.push(tag + w));
  });

  return { ok: programs.every(p => p.ok), errors, warnings, programs };
}
