export interface SetEntry {
  kg: string;
  reps: string;
  done: boolean;
}

export interface ExerciseEntry {
  name: string;
  muscle: string;
  fst7: boolean;
  fst7Manual?: boolean;
  sets: number | SetEntry[];
  reps: string;
  note?: string;
  ssLink?: boolean;
  ssPos?: string;
}

export interface DayProgram {
  name: string;
  exercises: ExerciseEntry[];
}

export interface WorkoutLog {
  date: string;
  dayIdx: number;
  dayLabel: string;
  style: string;
  duration?: string;
  weekNum?: number;
  exercises: ExerciseEntry[];
}

export interface Program {
  active: boolean;
  name: string;
  weeks: number;
  days?: number;
  startDate: string;
  endDate?: string;
  schedule: Record<number, number>;
  isCustom?: boolean;
  dayPrograms?: DayProgram[];
  weekOverrides?: Record<number, Record<number, ExerciseEntry[]>>;
  customisedWeeks?: number[];
}

export interface WizState {
  name: string;
  startDate: string;
  weeks: number;
  days: number;
  restDays: number[];
  dayPrograms: DayProgram[];
  activeDay: number;
  activeWeek: number | null;
  activeWeeks: number[];
  weekOverrides: Record<number, Record<number, ExerciseEntry[]>>;
  customisedWeeks?: number[];
  step: number;
}

export interface Session {
  dateStr: string;
  dayIdx: number;
  dayLabel: string;
  style: string;
  weekNum?: number;
  exercises: Array<ExerciseEntry & { sets: SetEntry[] }>;
}

export interface FST7Day {
  day: string;
  name: string;
  muscles: string[];
  exercises: ExerciseEntry[];
}

export interface AppState {
  workouts: WorkoutLog[];
  prog: Program | null;
  library: string[];
}
