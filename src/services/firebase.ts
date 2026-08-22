import { initializeApp } from 'firebase/app';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, onSnapshot, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged, type User,
} from 'firebase/auth';
import { S, wiz, rebuildFST7 } from '../store/state';
import { EX } from '../data/exercises';
import { KEYS } from './keys';
import type { WorkoutLog } from '../types';
import { mergeWorkouts, mergeSavedProgs, mergeCustomEx, shouldTakeRemote } from './merge';

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
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _unsub: (() => void) | null = null;
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
function pushNow(): void {
  if (!_uid || !_ready) return;
  emit({ state: 'saving' });
  setDoc(doc(_db, 'users', _uid), {
    workouts: S.workouts || [],
    prog: S.prog || null,
    wiz: wiz,
    custom_ex: readLocal(KEYS.customEx, {}),
    saved_progs: readLocal(KEYS.savedProgs, []),
    updatedAt: serverTimestamp(),
    writer: deviceId(),
  })
    .then(() => {
      localStorage.setItem(KEYS.syncedAt, String(Date.now()));
      emit({ state: 'synced', lastSynced: Date.now(), message: '' });
    })
    .catch((e: unknown) => {
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
  saved_progs?: unknown[];
  updatedAt?: Timestamp;
  writer?: string;
};

function applyRemote(d: RemoteDoc, firstEverSync: boolean): void {
  const remoteAt = d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : 0;
  const localAt = Number(localStorage.getItem(KEYS.syncedAt) || 0);

  // Workout logs always merge — they are append-only history and must never
  // be dropped by a device that happened to write last.
  const merged = mergeWorkouts(S.workouts || [], d.workouts || []);
  S.workouts = merged;
  localStorage.setItem(KEYS.workouts, JSON.stringify(merged));

  // Collections union on a first sync so nothing authored on either device is
  // lost when the two are first joined. After that the newer writer wins.
  if (firstEverSync) {
    const savedProgs = mergeSavedProgs(readLocal(KEYS.savedProgs, [] as { name?: string }[]), d.saved_progs as { name?: string }[] || []);
    localStorage.setItem(KEYS.savedProgs, JSON.stringify(savedProgs));

    const customEx = mergeCustomEx(readLocal(KEYS.customEx, {}), d.custom_ex || {});
    localStorage.setItem(KEYS.customEx, JSON.stringify(customEx));
    Object.keys(customEx).forEach(mg => {
      if (EX[mg]) EX[mg] = [...new Set([...EX[mg], ...customEx[mg]])].sort();
    });
  } else {
    if (d.saved_progs !== undefined && remoteAt >= localAt) {
      localStorage.setItem(KEYS.savedProgs, JSON.stringify(d.saved_progs));
    }
    if (d.custom_ex !== undefined && remoteAt >= localAt) {
      localStorage.setItem(KEYS.customEx, JSON.stringify(d.custom_ex));
      Object.keys(d.custom_ex).forEach(mg => {
        if (EX[mg]) EX[mg] = [...new Set([...EX[mg], ...d.custom_ex![mg]])].sort();
      });
    }
  }

  // The active program and the wizard draft are single values, so they cannot
  // be unioned. Whatever this device already holds wins on a first sync.
  if (d.prog !== undefined && shouldTakeRemote(d.prog, S.prog, firstEverSync, remoteAt, localAt)) {
    S.prog = d.prog as typeof S.prog;
    localStorage.setItem(KEYS.prog, JSON.stringify(d.prog));
    rebuildFST7();
  }
  if (d.wiz !== undefined && shouldTakeRemote(d.wiz, readLocal(KEYS.wiz, null), firstEverSync, remoteAt, localAt)) {
    Object.assign(wiz, d.wiz);
    localStorage.setItem(KEYS.wiz, JSON.stringify(wiz));
  }

  localStorage.setItem(KEYS.syncedAt, String(Math.max(remoteAt, localAt)));
  redraw();
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

function watch(uid: string): void {
  if (_unsub) { _unsub(); _unsub = null; }
  let first = true;
  const firstEverSync = !localStorage.getItem(KEYS.syncedAt);

  _unsub = onSnapshot(doc(_db, 'users', uid),
    (snap) => {
      // Our own in-flight write echoing back — nothing new to apply.
      if (snap.metadata.hasPendingWrites) return;

      if (!snap.exists()) {
        // Nothing in the cloud yet: this device seeds the account.
        _ready = true;
        emit({ state: 'saving' });
        pushNow();
        return;
      }

      const d = snap.data() as RemoteDoc;
      const wasFirst = first;
      first = false;

      // Ignore echoes of writes this device made.
      if (!wasFirst && d.writer === deviceId()) {
        emit({ state: 'synced', lastSynced: Date.now() });
        return;
      }

      applyRemote(d, wasFirst && firstEverSync);
      _ready = true;
      emit({ state: 'synced', lastSynced: Date.now(), message: '' });

      // If the first pull found the cloud missing data we hold locally,
      // push the merged result straight back up.
      if (wasFirst && firstEverSync) pushNow();
    },
    (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      emit({
        state: 'error',
        message: /permission|insufficient/i.test(msg)
          ? 'Cloud access denied. Firestore rules need deploying.'
          : 'Sync error: ' + msg,
      });
    });
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
  if (_unsub) { _unsub(); _unsub = null; }
  _uid = null; _ready = false;
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
      _uid = null; _ready = false;
      if (_unsub) { _unsub(); _unsub = null; }
      emit({ state: 'signed-out', user: null, message: '' });
      return;
    }
    _uid = user.uid;
    emit({
      state: 'connecting',
      user: { email: user.email || '', name: user.displayName || '', photo: user.photoURL || '' },
      message: '',
    });
    watch(user.uid);
  });

  window.addEventListener('online', () => { if (_uid) cloudSaveNow(); });
}
