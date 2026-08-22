import { getSyncStatus, onSyncStatus, signInGoogle, signOutUser, cloudSaveNow, type SyncStatus } from '../services/firebase';
import { ilToast, ilConfirm } from '../utils/ui';

const $ = (id: string) => document.getElementById(id);

function relTime(ts: number | null): string {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function label(s: SyncStatus): { text: string; cls: string } {
  switch (s.state) {
    case 'synced':     return { text: 'Up to date' + (s.lastSynced ? ' · ' + relTime(s.lastSynced) : ''), cls: 'is-synced' };
    case 'saving':     return { text: 'Saving…', cls: 'is-busy' };
    case 'connecting': return { text: 'Connecting…', cls: 'is-busy' };
    case 'offline':    return { text: s.message || 'Offline — will sync later', cls: 'is-busy' };
    case 'error':      return { text: s.message || 'Sync error', cls: 'is-error' };
    default:           return { text: 'Not signed in', cls: '' };
  }
}

function paint(s: SyncStatus): void {
  const { text, cls } = label(s);

  // Header button dot
  const dot = $('acctDot');
  if (dot) dot.className = 'h-acct-dot ' + cls;

  // Header button avatar
  const photo = $('acctPhoto') as HTMLImageElement | null;
  const icon = $('acctIcon');
  if (photo && icon) {
    if (s.user?.photo) {
      photo.src = s.user.photo;
      photo.style.display = '';
      icon.style.display = 'none';
    } else {
      photo.style.display = 'none';
      icon.style.display = '';
    }
  }

  // Sheet panels
  const out = $('acctSignedOut');
  const inn = $('acctSignedIn');
  if (out && inn) {
    const signedIn = !!s.user;
    out.style.display = signedIn ? 'none' : '';
    inn.style.display = signedIn ? '' : 'none';
  }

  if (s.user) {
    const nm = $('acctUserName');
    const ml = $('acctUserMail');
    const up = $('acctUserPhoto') as HTMLImageElement | null;
    if (nm) nm.textContent = s.user.name || 'Signed in';
    if (ml) ml.textContent = s.user.email;
    if (up) { if (s.user.photo) { up.src = s.user.photo; up.style.display = ''; } else { up.style.display = 'none'; } }
  }

  const st = $('acctStatusTxt');
  const sd = $('acctStatusDot');
  if (st) st.textContent = text;
  if (sd) sd.className = 'il-acct-status-dot ' + cls;
}

export function openAccount(): void {
  paint(getSyncStatus());
  $('ilAccount')?.classList.add('open');
}

export function closeAccount(): void {
  $('ilAccount')?.classList.remove('open');
}

export function initAccount(): void {
  onSyncStatus(paint);

  const build = $('acctBuild');
  if (build) build.textContent = 'Build ' + __BUILD__;

  $('acctSignInBtn')?.addEventListener('click', () => signInGoogle());
  $('acctCloseBtn')?.addEventListener('click', closeAccount);

  $('acctSyncBtn')?.addEventListener('click', () => {
    cloudSaveNow();
    ilToast('Syncing…', 'info');
  });

  $('acctSignOutBtn')?.addEventListener('click', () => {
    closeAccount();
    ilConfirm(
      'Sign out of i-lift? Your data stays on this device, but it will stop syncing.',
      () => { signOutUser(); ilToast('Signed out', 'info'); },
      'Sign out',
      true
    );
  });

  const bg = $('ilAccount');
  bg?.addEventListener('click', (e) => { if (e.target === bg) closeAccount(); });

  // Keep the "x minutes ago" line honest while the sheet is open.
  setInterval(() => {
    if ($('ilAccount')?.classList.contains('open')) paint(getSyncStatus());
  }, 30000);
}
