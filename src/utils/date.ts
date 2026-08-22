const DS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function fmt(d: Date): string {
  return `${DS[d.getDay()]} ${d.getDate()} ${MS[d.getMonth()]}`;
}
export function fmtD(d: Date): string {
  return `${d.getDate()} ${MS[d.getMonth()]} ${d.getFullYear()}`;
}
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function parseYMD(s: string): Date {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
export function today(): Date { return new Date(); }
export function todayYMD(): string { return ymd(today()); }
export function fmtSecs(s: number): string {
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
export function monthName(m: number): string { return MONTHS_FULL[m]; }
export function monthNameShort(m: number): string { return MS[m]; }
export const DOW_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];
export const DOW_3 = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
