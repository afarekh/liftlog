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
