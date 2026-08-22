import { todayYMD, parseYMD } from './date';

let _toastTimer: ReturnType<typeof setTimeout> | null = null;

export function ilToast(msg: string, type: 'success' | 'error' | 'info' = 'success'): void {
  const el = document.getElementById('ilToast');
  const msgEl = document.getElementById('ilToastMsg');
  const iconEl = document.getElementById('ilToastIcon');
  if (!el || !msgEl || !iconEl) return;

  if (type === 'success') {
    iconEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5 11-11"/></svg>`;
  } else if (type === 'error') {
    iconEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
  } else {
    iconEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>`;
  }
  msgEl.textContent = msg;

  if (_toastTimer) clearTimeout(_toastTimer);
  el.classList.add('show');
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

export function ilConfirm(
  msg: string,
  onOk: () => void,
  okLabel = 'Confirm',
  danger = false
): void {
  const bg = document.getElementById('ilConfirm');
  const msgEl = document.getElementById('ilConfirmMsg');
  const okBtn = document.getElementById('ilConfirmOk') as HTMLButtonElement | null;
  const cancelBtn = document.getElementById('ilConfirmCancel') as HTMLButtonElement | null;

  if (!bg || !msgEl || !okBtn || !cancelBtn) { if (window.confirm(msg)) onOk(); return; }

  msgEl.textContent = msg;
  okBtn.textContent = okLabel;
  okBtn.style.background = danger ? '#E5484D' : 'var(--ink)';

  bg.classList.add('open');

  const close = () => bg.classList.remove('open');

  const freshOk = okBtn.cloneNode(true) as HTMLButtonElement;
  const freshCancel = cancelBtn.cloneNode(true) as HTMLButtonElement;
  freshOk.textContent = okLabel;
  freshOk.style.background = danger ? '#E5484D' : 'var(--ink)';
  okBtn.replaceWith(freshOk);
  cancelBtn.replaceWith(freshCancel);

  freshOk.addEventListener('click', () => { close(); onOk(); });
  freshCancel.addEventListener('click', close);
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); }, { once: true });
}

export function ilDatePick(
  onPick: (ds: string) => void,
  defaultDate?: string
): void {
  const bg = document.getElementById('ilDatePick');
  if (!bg) return;

  const todayStr = todayYMD();
  const init = defaultDate ? parseYMD(defaultDate) : new Date();
  let pickY = init.getFullYear();
  let pickM = init.getMonth();

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function buildGrid(): void {
    const firstDOW = new Date(pickY, pickM, 1).getDay();
    const numDays = new Date(pickY, pickM + 1, 0).getDate();
    let g = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <button id="ilDpNavPrev" style="width:32px;height:32px;border:1px solid var(--line2);background:var(--bg);border-radius:9px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--ink)">‹</button>
      <span style="font-size:13px;font-weight:800;color:var(--ink);font-family:var(--font-d)">${MONTHS[pickM]} ${pickY}</span>
      <button id="ilDpNavNext" style="width:32px;height:32px;border:1px solid var(--line2);background:var(--bg);border-radius:9px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--ink)">›</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px">
      ${DOW.map(d => `<div style="text-align:center;font-size:9px;font-weight:700;color:var(--ink3);padding:2px 0">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;
    for (let i = 0; i < firstDOW; i++) g += `<div></div>`;
    for (let d = 1; d <= numDays; d++) {
      const ds = `${pickY}-${String(pickM + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isTdy = ds === todayStr;
      const bg2 = isTdy ? 'var(--lime)' : 'transparent';
      const col = isTdy ? 'var(--ink)' : 'var(--ink)';
      const fw = isTdy ? '800' : '400';
      g += `<div data-ds="${ds}" class="il-dp-day" style="display:flex;align-items:center;justify-content:center;cursor:pointer;padding:2px 0">
        <span style="width:32px;height:32px;border-radius:50%;background:${bg2};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:${fw};color:${col}">${d}</span>
      </div>`;
    }
    g += `</div>`;
    const gridEl = document.getElementById('ilDatePickGrid');
    if (gridEl) {
      gridEl.innerHTML = g;
      gridEl.querySelectorAll('.il-dp-day').forEach(el => {
        el.addEventListener('click', () => {
          const ds = (el as HTMLElement).dataset['ds']!;
          close();
          onPick(ds);
        });
      });
      document.getElementById('ilDpNavPrev')?.addEventListener('click', () => { pickM--; if (pickM < 0) { pickM = 11; pickY--; } buildGrid(); });
      document.getElementById('ilDpNavNext')?.addEventListener('click', () => { pickM++; if (pickM > 11) { pickM = 0; pickY++; } buildGrid(); });
    }
  }

  function close(): void { bg.classList.remove('open'); }

  bg.classList.add('open');
  buildGrid();

  const cancelBtn = document.getElementById('ilDatePickCancel');
  const freshCancel = cancelBtn?.cloneNode(true) as HTMLButtonElement | null;
  if (cancelBtn && freshCancel) {
    cancelBtn.replaceWith(freshCancel);
    freshCancel.addEventListener('click', close);
  }
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); }, { once: true });
}
