import { SESSION, FST7, S,
  swapExIdx, swapSelEx, swapMG,
  setSwapExIdx, setSwapSelEx, setSwapMG } from '../store/state';
import { EX } from '../data/exercises';
import { saveS } from '../services/storage';
import { ilToast } from '../utils/ui';
import { renderSP } from '../session/render';

export function openSM(ei: number): void {
  setSwapExIdx(ei);
  setSwapSelEx('');
  if (SESSION) setSwapMG(SESSION.exercises[ei].muscle || 'Back');
  const subEl = document.getElementById('smSub');
  const manNameEl = document.getElementById('manName') as HTMLInputElement | null;
  const searchEl = document.getElementById('smSearch') as HTMLInputElement | null;
  if (subEl) subEl.textContent = 'Replacing: ' + (SESSION ? SESSION.exercises[ei].name : '—');
  if (manNameEl) manNameEl.value = '';
  if (searchEl) searchEl.value = '';
  renderSMmuscles();
  renderSMlist('');
  renderManMG();
  const sm = document.getElementById('SM');
  if (sm) sm.classList.add('open');
}

export function closeSM(): void {
  const sm = document.getElementById('SM');
  if (sm) sm.classList.remove('open');
}

export function renderSMmuscles(): void {
  const row = document.getElementById('smMGRow');
  if (!row) return;
  row.innerHTML = Object.keys(EX).map(m =>
    `<button class="mmg${m === swapMG ? ' sel' : ''}" onclick="smSelMG('${m}')">${m}</button>`
  ).join('');
}

export function smSelMG(m: string): void {
  setSwapMG(m);
  setSwapSelEx('');
  renderSMmuscles();
  renderSMlist('');
}

export function renderSMlist(q: string): void {
  const list = document.getElementById('smExList');
  if (!list) return;
  const exes = (EX[swapMG] || []).filter(e => !q || e.toLowerCase().includes(q.toLowerCase()));
  list.innerHTML = exes.map(e =>
    `<div class="mexrow${e === swapSelEx ? ' sel' : ''}" onclick="smPickEx('${e.replace(/'/g, "\\'")}')">
      ${e}${e === swapSelEx ? '<span style="color:var(--gd);font-weight:800">✓</span>' : ''}
    </div>`
  ).join('') || '<div style="padding:14px;font-size:12px;color:var(--muted);text-align:center">No results</div>';
}

export function filterSwap(q: string): void {
  renderSMlist(q);
}

export function smPickEx(name: string): void {
  setSwapSelEx(name);
  const searchEl = document.getElementById('smSearch') as HTMLInputElement | null;
  renderSMlist(searchEl?.value || '');
}

export function renderManMG(): void {
  const row = document.getElementById('manMGRow');
  if (!row) return;
  row.innerHTML = Object.keys(EX).map(m =>
    `<span class="mchip${m === swapMG ? ' sel' : ''}" onclick="smSelMG('${m}')">${m}</span>`
  ).join('');
}

export function useManual(): void {
  const nameEl = document.getElementById('manName') as HTMLInputElement | null;
  if (!nameEl) return;
  const name = nameEl.value.trim();
  if (!name) { ilToast('Enter exercise name.', 'error'); return; }
  setSwapSelEx(name);
  const saveTgl = document.getElementById('saveTgl');
  if (saveTgl && saveTgl.classList.contains('on') && !S.library.includes(name)) {
    S.library.push(name);
    if (!EX[swapMG]) EX[swapMG] = [];
    EX[swapMG].push(name);
    saveS();
  }
  doSwap('today');
}

export function doSwap(scope: string): void {
  if (!swapSelEx) { closeSM(); return; }
  if (SESSION && swapExIdx >= 0) {
    const old = SESSION.exercises[swapExIdx];
    SESSION.exercises[swapExIdx] = { ...old, name: swapSelEx, muscle: swapMG, fst7: false, note: '' };
    if (scope === 'all') {
      const di = SESSION.dayIdx;
      if (di >= 0 && FST7[di] && FST7[di].exercises[swapExIdx]) {
        FST7[di].exercises[swapExIdx] = { ...FST7[di].exercises[swapExIdx], name: swapSelEx, muscle: swapMG };
      }
    }
    renderSP();
  }
  closeSM();
}
