import { initializeApp } from 'firebase/app';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, getDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged, type User,
} from 'firebase/auth';
import { S, wiz, rebuildFST7 } from '../store/state';
import { EX } from '../data/exercises';
import { KEYS } from './keys';
import type { WorkoutLog } from '../types';
import { mergeWorkouts, mergeSavedProgs, mergeCustomEx, mergeTombstones, applyTombstones,
  isEmpty, sameData, sameProgs, sameList, sameCustomEx } from './merge';

const firebaseConfig = {
  apiKey: "AIzaSyAB6ux2qMCxQ_0KdNDs72l3cdFdcVAkDr8",
  // Pointing authDomain at the hosting domain keeps the Google sign-in redirect
  // same-origin (Firebase Hosting auto-serves /__/auth/*). Using the default
  // *.firebaseapp.com domain breaks the redirect flow in installed PWAs and in
  // any browser blocking third-party cookies.
  authDomain: "liftlogv2.web.app",
  projectId: "liftlogv2",
  storageBucket: "liftlogv2.firebasestorage.app",
  messagingSenderId: "686329670108",
  appId: "1:686329670108:web:1f64d568b259408648c719",
};

const app = initializeApp(firebaseConfig);

// Offline persistence: the phone keeps working (and queues writes) with no
// signal in the gym, then flushes when it reconnects.
const _db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
const _auth = getAuth(app);

// ── Sync status ────────────────────────────────────────────────────────────
export type SyncState = 'signed-out' | 'connecting' | 'synced' | 'saving' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  user: { email: string; name: string; photo: string } | null;
  lastSynced: number | null;
  message: string;
}

const status: SyncStatus = { state: 'signed-out', user: null, lastSynced: null, message: '' };
const listeners: Array<(s: SyncStatus) => void> = [];

export function getSyncStatus(): SyncStatus { return { ...status }; }
export function onSyncStatus(fn: (s: SyncStatus) => void): void { listeners.push(fn); fn(getSyncStatus()); }
function emit(patch: Partial<SyncStatus>): void {
  Object.assign(status, patch);
  listeners.forEach(fn => { try { fn(getSyncStatus()); } catch (_) {} });
}

// ── Internals ──────────────────────────────────────────────────────────────
let _uid: string | null = null;
let _ready = false;          // true once the first snapshot has been applied
let _dirty = false;          // local edits the cloud has not confirmed yet

// A merge that keeps producing "something changed" would push forever, one
// write per round, against a device that concludes the same thing. Nothing
// should need more than a couple of push-backs to settle, so past that the
// convergence push is abandoned and local state simply follows the cloud.
let _echoPushes = 0;
let _echoWindowStart = 0;
const ECHO_LIMIT = 4;
const ECHO_WINDOW_MS = 20000;

function convergencePushAllowed(): boolean {
  const now = Date.now();
  if (now - _echoWindowStart > ECHO_WINDOW_MS) { _echoWindowStart = now; _echoPushes = 0; }
  return ++_echoPushes <= ECHO_LIMIT;
}
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _renders: RenderFns | null = null;

function deviceId(): string {
  let id = localStorage.getItem(KEYS.deviceId);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEYS.deviceId, id);
  }
  return id;
}

function readLocal<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; }
  catch (_) { return fallback; }
}

// ── Push ───────────────────────────────────────────────────────────────────
let _savingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Show "saving" only when a write is actually taking a while. Most pushes
 * complete in well under a second, and flashing the indicator for each one
 * makes routine background housekeeping look like something going wrong.
 */
function beginSaving(silent: boolean): void {
  if (silent) return;
  if (_savingTimer) clearTimeout(_savingTimer);
  _savingTimer = setTimeout(() => emit({ state: 'saving' }), 600);
}

function endSaving(): void {
  if (_savingTimer) { clearTimeout(_savingTimer); _savingTimer = null; }
}

function pushNow(silent = false): void {
  if (!_uid || !_ready) return;
  beginSaving(silent);
  setDoc(doc(_db, 'users', _uid), {
    workouts: S.workouts || [],
    prog: S.prog || null,
    wiz: wiz,
    custom_ex: readLocal(KEYS.customEx, {}),
    saved_progs: readLocal(KEYS.savedProgs, []),
    deleted_progs: readLocal(KEYS.deletedProgs, []),
    updatedAt: serverTimestamp(),
    writer: deviceId(),
  })
    .then(() => {
      endSaving();
      // KEYS.syncedAt is deliberately NOT written here. It records the server's
      // updatedAt, and only a snapshot can tell us what the server actually
      // stamped. Writing Date.now() here would compare this device's clock
      // against Google's on the next merge, and a device running even slightly
      // fast would then reject every update the other device makes.
      emit({ state: 'synced', lastSynced: Date.now(), message: '' });
    })
    .catch((e: unknown) => {
      endSaving();
      // With offline persistence the write is queued locally and will flush
      // later, so this is only a hard failure for rules/permission problems.
      const msg = e instanceof Error ? e.message : String(e);
      if (/permission|insufficient/i.test(msg)) {
        emit({ state: 'error', message: 'Cloud rejected the save. Check Firestore rules.' });
      } else {
        emit({ state: 'offline', message: 'Offline — changes will sync when you reconnect.' });
      }
    });
}

/** Debounced push. Safe to call on every local save. */
export function cloudSave(): void {
  if (!_uid || !_ready) return;
  _dirty = true;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(pushNow, 800);
}

/** Force an immediate push, bypassing the debounce (used by "Sync now"). */
export function cloudSaveNow(): void {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  pushNow();
}

// ── Pull ───────────────────────────────────────────────────────────────────
type RemoteDoc = {
  workouts?: WorkoutLog[];
  prog?: unknown;
  wiz?: Record<string, unknown>;
  custom_ex?: Record<string, string[]>;
  saved_progs?: { name?: string }[];
  deleted_progs?: string[];
  updatedAt?: Timestamp;
  writer?: string;
};

/**
 * Merge a remote document into local state.
 *
 * Collections are unioned, always — never "take one side". A program missing
 * from a device's list means "not seen here", not "deleted", so the two must
 * not be resolved by picking a winner. Deletion travels separately, as a
 * tombstone, which is the only thing that removes a saved program.
 *
 * Single values (the active program, the wizard draft) cannot be unioned, so
 * they need a winner. `dirty` — this device holds edits the cloud has not yet
 * confirmed — decides it. Wall-clock times are never compared: the only clock
 * in play is Google's, read back from the document itself.
 *
 * Returns true when the merged result differs from what the cloud holds, in
 * which case the caller pushes the merge back so both devices converge.
 */
function applyRemote(d: RemoteDoc, dirty: boolean, firstEverSync: boolean): boolean {
  let changed = false;

  // ── Deletion tombstones. Merged first: they gate everything below.
  const tombs = mergeTombstones(readLocal<string[]>(KEYS.deletedProgs, []), d.deleted_progs || []);
  if (!sameList(tombs, d.deleted_progs || [])) changed = true;
  localStorage.setItem(KEYS.deletedProgs, JSON.stringify(tombs));

  // ── Workout logs: union by date, never lost.
  const logs = mergeWorkouts(S.workouts || [], d.workouts || []);
  if (!sameData(logs, mergeWorkouts([], d.workouts || []))) changed = true;
  S.workouts = logs;
  localStorage.setItem(KEYS.workouts, JSON.stringify(logs));

  // ── Saved-program library: union by name, then apply tombstones.
  // On a same-name clash the more recent edit wins, which is this device's
  // copy when it is holding unsynced edits and the cloud's otherwise.
  const localProgs = readLocal<{ name?: string }[]>(KEYS.savedProgs, []);
  const remoteProgs = d.saved_progs || [];
  const union = dirty
    ? mergeSavedProgs(remoteProgs, localProgs)   // later arg wins the clash
    : mergeSavedProgs(localProgs, remoteProgs);
  const progs = applyTombstones(union, tombs);
  if (!sameProgs(progs, applyTombstones(remoteProgs, tombs))) changed = true;
  localStorage.setItem(KEYS.savedProgs, JSON.stringify(progs));

  // ── Custom exercises: union per muscle group. Nothing deletes these.
  const customEx = mergeCustomEx(readLocal(KEYS.customEx, {}), d.custom_ex || {});
  if (!sameCustomEx(customEx, d.custom_ex || {})) changed = true;
  localStorage.setItem(KEYS.customEx, JSON.stringify(customEx));
  Object.keys(customEx).forEach(mg => {
    if (EX[mg]) EX[mg] = [...new Set([...EX[mg], ...customEx[mg]])].sort();
  });

  // ── Active program: a single value, so one side has to win.
  // A device joining an account keeps what it is already training rather than
  // adopting a cloud copy, and an empty cloud never clears a live program.
  const remoteProg = d.prog ?? null;
  const keepLocal = dirty || (firstEverSync && !isEmpty(S.prog)) || isEmpty(remoteProg);
  if (!keepLocal) {
    S.prog = remoteProg as typeof S.prog;
    localStorage.setItem(KEYS.prog, JSON.stringify(remoteProg));
    rebuildFST7();
  } else if (!sameData(S.prog ?? null, remoteProg)) {
    changed = true;
  }

  // ── Wizard draft: same rule, lower stakes.
  const remoteWiz = d.wiz;
  if (remoteWiz && !dirty && !firstEverSync) {
    Object.assign(wiz, remoteWiz);
    localStorage.setItem(KEYS.wiz, JSON.stringify(wiz));
  } else if (remoteWiz && !sameData(wiz, remoteWiz)) {
    changed = true;
  }

  redraw();
  return changed;
}

function redraw(): void {
  if (!_renders) return;
  try {
    _renders.renderHome();
    _renders.renderCal();
    _renders.renderWorkouts();
    _renders.renderHistory();
    _renders.renderStats();
  } catch (_) {}
}

/**
 * Pull the cloud document once, merge it into local state, and push back only
 * if the merge produced something the cloud lacks.
 *
 * This deliberately replaces a realtime listener. A listener kept both devices
 * live at the cost of a subscription running for as long as the app was open,
 * and made every write on one device wake the other — which is also what let a
 * disagreement between two devices turn into a sustained exchange of writes.
 * Syncing at the points where it actually matters costs a single read.
 */
async function pullAndMerge(opts: { silent?: boolean } = {}): Promise<void> {
  if (!_uid) return;
  const silent = !!opts.silent;
  if (!silent) emit({ state: 'connecting', message: '' });

  try {
    const ref = doc(_db, 'users', _uid);
    const snap = await getDoc(ref);
    const firstEverSync = !localStorage.getItem(KEYS.syncedAt);

    if (!snap.exists()) {
      // Nothing in the cloud yet — this device seeds the account.
      _ready = true;
      localStorage.setItem(KEYS.syncedAt, '1');
      pushNow(true);
      return;
    }

    const d = snap.data() as RemoteDoc;
    const serverAt = d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : 0;
    const changed = applyRemote(d, _dirty, firstEverSync);

    localStorage.setItem(KEYS.syncedAt, String(serverAt || 1));
    _ready = true;

    if (changed) {
      pushNow(true);
    } else {
      _dirty = false;
      emit({ state: 'synced', lastSynced: Date.now(), message: '' });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/permission|insufficient/i.test(msg)) {
      emit({ state: 'error', message: 'Cloud access denied. Firestore rules need deploying.' });
    } else {
      emit({ state: 'offline', message: 'Offline — will sync when you reconnect.' });
    }
  }
}

/**
 * Sync the user asked for. This and the single pull at startup are the only
 * reads the app performs — nothing syncs on a timer, on regaining focus, or in
 * the background.
 */
export async function syncNow(): Promise<void> {
  if (!_uid) return;
  await pullAndMerge();
}

// ── Auth ───────────────────────────────────────────────────────────────────
export function signInGoogle(): void {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  emit({ state: 'connecting', message: '' });

  // Popups are blocked or silently closed in installed PWAs, so fall back to
  // a full-page redirect whenever the popup route fails.
  signInWithPopup(_auth, provider).catch((e: unknown) => {
    const code = (e as { code?: string })?.code || '';
    if (code === 'auth/operation-not-allowed') {
      emit({ state: 'error', message: 'Google sign-in is not enabled in the Firebase console yet.' });
      return;
    }
    if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
      emit({ state: _uid ? 'synced' : 'signed-out', message: '' });
      return;
    }
    signInWithRedirect(_auth, provider).catch((e2: unknown) => {
      emit({ state: 'error', message: 'Sign-in failed: ' + ((e2 as Error)?.message || 'unknown error') });
    });
  });
}

export function signOutUser(): void {
  _uid = null; _ready = false; _dirty = false;
  signOut(_auth).catch(() => {});
  // Local data is deliberately left in place so the app still works signed out.
  emit({ state: 'signed-out', user: null, lastSynced: null, message: '' });
}

type RenderFns = {
  renderHome: () => void;
  renderCal: () => void;
  renderWorkouts: () => void;
  renderHistory: () => void;
  renderStats: () => void;
};

export function initSync(renders: RenderFns): void {
  _renders = renders;

  getRedirectResult(_auth).catch((e: unknown) => {
    emit({ state: 'error', message: 'Sign-in failed: ' + ((e as Error)?.message || 'unknown error') });
  });

  onAuthStateChanged(_auth, (user: User | null) => {
    if (!user) {
      _uid = null; _ready = false; _dirty = false;
      emit({ state: 'signed-out', user: null, message: '' });
      return;
    }
    _uid = user.uid;
    emit({
      state: 'connecting',
      user: { email: user.email || '', name: user.displayName || '', photo: user.photoURL || '' },
      message: '',
    });
    void pullAndMerge();
  });

  // Nothing else triggers a sync. Firestore's offline queue still flushes
  // pending writes on its own when the connection returns, so edits made in
  // the gym are not stranded by the absence of a listener here.
}
