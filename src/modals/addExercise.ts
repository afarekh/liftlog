import { SESSION, aemCtx, aemMG, aemPicked, aemPickedMuscles, aemCustomMG,
  setAemCtx, setAemMG, setAemPicked, setAemPickedMuscles, setAemCustomMG } from '../store/state';
import { EX, MG_ORDER } from '../data/exercises';
import { cloudSave } from '../services/firebase';
import { renderSP } from '../session/render';

// Will be set by workouts module to avoid circular deps
let _getWizDayExercises: (() => any[]) | null = null;
let _setWizDayExercises: ((exes: any[]) => void) | null = null;
let _renderWizDay: (() => void) | null = null;

export function registerWizHandlers(
  get: () => any[],
  set: (exes: any[]) => void,
  render: () => void
): void {
  _getWizDayExercises = get;
  _setWizDayExercises = set;
  _renderWizDay = render;
}

export function openAEM(ctx: string): void {
  setAemCtx(ctx);
  setAemMG('Back');
  setAemPicked([]);
  setAemPickedMuscles({});
  setAemCustomMG('Back');
  const searchEl = document.getElementById('aemSearch') as HTMLInputElement | null;
  if (searchEl) searchEl.value = '';
  const form = document.getElementById('aemCustomForm');
  const btn = document.getElementById('aemCustomToggle');
  if (form) form.style.display = 'none';
  if (btn) btn.textContent = '➕ Add custom exercise';
  const aem = document.getElementById('AEM');
  if (aem) aem.classList.add('open');
  renderAEMgrid();
  renderAEMlist();
}

export function closeAEM(): void {
  const aem = document.getElementById('AEM');
  if (aem) aem.classList.remove('open');
}

export function renderAEMgrid(): void {
  const grid = document.getElementById('aemMGGrid');
  if (!grid) return;
  grid.innerHTML = MG_ORDER.map(m =>
    `<button class="mgbtn${m === aemMG ? ' sel' : ''}" onclick="aemSelMG('${m}')">${m}</button>`
  ).join('');
  const wrap = document.getElementById('aemExWrap');
  if (wrap) wrap.style.display = 'block';
}

export function renderAEMlist(): void {
  const searchEl = document.getElementById('aemSearch') as HTMLInputElement | null;
  const q = searchEl?.value || '';
  const term = q.trim().toLowerCase();
  let items: Array<{ name: string; muscle: string }> = [];
  if (term.length >= 2) {
    MG_ORDER.forEach(mg => {
      (EX[mg] || []).forEach(e => {
        if (e.toLowerCase().includes(term)) items.push({ name: e, muscle: mg });
      });
    });
    items.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(term);
      const bStarts = b.name.toLowerCase().startsWith(term);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.name.localeCompare(b.name);
    });
  } else {
    items = (EX[aemMG] || []).map(e => ({ name: e, muscle: aemMG }));
  }
  const list = document.getElementById('aemExList');
  if (!list) return;
  list.innerHTML = items.length
    ? items.map(({ name, muscle }) => {
        const isPicked = aemPicked.includes(name);
        const showMuscle = term.length >= 2;
        return `<div class="eprow${isPicked ? ' picked' : ''}" onclick="toggleAEM('${name.replace(/'/g, "\\'")}','${muscle}')">
          <div style="flex:1">
            <div>${name}</div>
            ${showMuscle ? `<div style="font-size:10px;color:var(--muted);margin-top:1px">${muscle}</div>` : ''}
          </div>
          ${isPicked ? '<span style="color:var(--gd);font-weight:800">✓</span>' : '<span style="color:#ccc;font-size:16px">+</span>'}
        </div>`;
      }).join('')
    : `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">No exercises found</div>`;
}

export function toggleAEM(name: string, muscle: string): void {
  const i = aemPicked.indexOf(name);
  if (i >= 0) {
    aemPicked.splice(i, 1);
  } else {
    aemPicked.push(name);
    if (muscle) aemPickedMuscles[name] = muscle;
  }
  renderAEMlist();
}

export function confirmAEM(): void {
  if (!aemPicked.length) { closeAEM(); return; }
  if (aemCtx === 'session' && SESSION) {
    aemPicked.forEach(name => {
      const muscle = (aemPickedMuscles && aemPickedMuscles[name]) || aemMG;
      SESSION!.exercises.push({
        name, muscle, fst7: false, reps: '8-12', note: '',
        sets: [{ kg: '', reps: '', done: false }, { kg: '', reps: '', done: false }, { kg: '', reps: '', done: false }],
      } as any);
    });
    renderSP();
  } else if (aemCtx === 'wiz' && _getWizDayExercises && _setWizDayExercises && _renderWizDay) {
    const exes = _getWizDayExercises();
    aemPicked.forEach(name => {
      if (!exes.find((e: any) => e.name === name)) {
        const muscle = (aemPickedMuscles && aemPickedMuscles[name]) || aemMG;
        exes.push({ name, muscle, sets: 3, reps: '8-12', note: '', fst7: false });
      }
    });
    _setWizDayExercises(exes);
    _renderWizDay();
  }
  setAemPickedMuscles({});
  closeAEM();
}

export function aemSelMG(m: string): void {
  setAemMG(m);
  const searchEl = document.getElementById('aemSearch') as HTMLInputElement | null;
  if (searchEl) searchEl.value = '';
  renderAEMgrid();
  renderAEMlist();
}

export function aemSelCustomMG(g: string): void {
  setAemCustomMG(g);
  renderAEMCustomPills();
}

export function toggleAEMCustom(): void {
  const form = document.getElementById('aemCustomForm');
  const btn = document.getElementById('aemCustomToggle');
  if (!form || !btn) return;
  const isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '➕ Add custom exercise' : '✕ Cancel';
  if (!isOpen) {
    renderAEMCustomPills();
    const nameEl = document.getElementById('aemCustomName') as HTMLInputElement | null;
    if (nameEl) nameEl.focus();
  }
}

export function renderAEMCustomPills(): void {
  const pills = document.getElementById('aemCustomMGPills');
  if (!pills) return;
  pills.innerHTML = MG_ORDER.map(g =>
    `<div onclick="aemSelCustomMG('${g}')" style="padding:6px 12px;border:1.5px solid ${aemCustomMG === g ? 'var(--black)' : 'var(--border)'};border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;background:${aemCustomMG === g ? 'var(--black)' : '#fff'};color:${aemCustomMG === g ? '#fff' : '#555'};transition:all .15s">${g}</div>`
  ).join('');
}

export function confirmAEMCustom(): void {
  const nameEl = document.getElementById('aemCustomName') as HTMLInputElement | null;
  if (!nameEl) return;
  const name = nameEl.value.trim();
  if (!name) { alert('Please enter an exercise name.'); return; }
  const saveTgl = document.getElementById('aemSaveTgl');
  const save = saveTgl?.classList.contains('on') ?? false;

  if (save) {
    if (!EX[aemCustomMG]) EX[aemCustomMG] = [];
    if (!EX[aemCustomMG].includes(name)) {
      EX[aemCustomMG].push(name);
      EX[aemCustomMG].sort();
      try {
        const custom = JSON.parse(localStorage.getItem('ll_custom_ex') || '{}');
        if (!custom[aemCustomMG]) custom[aemCustomMG] = [];
        if (!custom[aemCustomMG].includes(name)) custom[aemCustomMG].push(name);
        localStorage.setItem('ll_custom_ex', JSON.stringify(custom));
        cloudSave();
      } catch (e) {}
    }
  }

  if (aemCtx === 'session' && SESSION) {
    SESSION.exercises.push({
      name, muscle: aemCustomMG, fst7: false, reps: '8-12', note: '',
      sets: [{ kg: '', reps: '', done: false }, { kg: '', reps: '', done: false }, { kg: '', reps: '', done: false }],
    } as any);
    renderSP();
  } else if (aemCtx === 'wiz' && _getWizDayExercises && _setWizDayExercises && _renderWizDay) {
    const exes = _getWizDayExercises();
    if (!exes.find((e: any) => e.name === name))
      exes.push({ name, muscle: aemCustomMG, sets: 3, reps: '8-12', note: '', fst7: false });
    _setWizDayExercises(exes);
    _renderWizDay();
  }

  nameEl.value = '';
  if (saveTgl) saveTgl.classList.remove('on');
  toggleAEMCustom();
  closeAEM();
}
