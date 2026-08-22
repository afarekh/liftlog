import { wiz } from '../../store/state';
import { fmtD, parseYMD } from '../../utils/date';
import { renderRestGrid, goWiz, renderLibrary } from './wizard';

export function switchWTab(n: number): void {
  const tab0 = document.getElementById('wtab0');
  const tab1 = document.getElementById('wtab1');
  const wpCustom = document.getElementById('wpCustom');
  const wpPD = document.getElementById('wpPD');
  if (tab0) tab0.classList.toggle('active', n === 0);
  if (tab1) tab1.classList.toggle('active', n === 1);
  if (wpCustom) wpCustom.style.display = n === 0 ? 'block' : 'none';
  if (wpPD) wpPD.style.display = n === 1 ? 'block' : 'none';
}

export function renderWorkouts(): void {
  const progNameEl = document.getElementById('wProgName') as HTMLInputElement | null;
  const weeksEl = document.getElementById('wWeeksV');
  const daysEl = document.getElementById('wDaysV');
  const startLbl = document.getElementById('wStartDateLbl');
  if (progNameEl) progNameEl.value = wiz.name || '';
  if (weeksEl) weeksEl.textContent = String(wiz.weeks || 8);
  if (daysEl) daysEl.textContent = String(wiz.days || 5);
  if (startLbl) startLbl.textContent = wiz.startDate ? fmtD(parseYMD(wiz.startDate)) : 'Tap to select';
  renderRestGrid();
  goWiz(wiz.step || 1);
  renderLibrary();
}
