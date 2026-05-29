import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { S, wiz, FST7 } from '../store/state';
import { EX } from '../data/exercises';

const firebaseConfig = {
  apiKey: "AIzaSyAB6ux2qMCxQ_0KdNDs72l3cdFdcVAkDr8",
  authDomain: "liftlogv2.firebaseapp.com",
  projectId: "liftlogv2",
  storageBucket: "liftlogv2.firebasestorage.app",
  messagingSenderId: "686329670108",
  appId: "1:686329670108:web:1f64d568b259408648c719",
};

const app = initializeApp(firebaseConfig);
const _db = getFirestore(app);
const _auth = getAuth(app);
let _uid: string | null = null;

export function cloudSave(): void {
  if (!_uid) return;
  try {
    setDoc(doc(_db, 'users', _uid), {
      workouts: S.workouts || [],
      prog: S.prog || null,
      wiz: wiz,
      custom_ex: JSON.parse(localStorage.getItem('ll_custom_ex') || '{}'),
      saved_progs: JSON.parse(localStorage.getItem('ll_saved_progs') || '[]'),
    }).catch(() => {});
  } catch (e) {}
}

type RenderFns = {
  renderHome: () => void;
  renderCal: () => void;
  renderWorkouts: () => void;
  renderHistory: () => void;
  renderStats: () => void;
};

export function firebaseSync(renders: RenderFns): void {
  onAuthStateChanged(_auth, async (user) => {
    try {
      if (!user) { await signInAnonymously(_auth); return; }
      _uid = user.uid;
      const snap = await getDoc(doc(_db, 'users', _uid));
      if (!snap.exists()) return;
      const d = snap.data();
      if (d['workouts'] !== undefined) {
        localStorage.setItem('ll_w', JSON.stringify(d['workouts']));
        S.workouts = d['workouts'];
      }
      if (d['prog'] !== undefined) {
        localStorage.setItem('ll_p', JSON.stringify(d['prog']));
        S.prog = d['prog'];
        if (S.prog && S.prog.isCustom && S.prog.dayPrograms && S.prog.dayPrograms.length) {
          FST7.length = 0;
          S.prog.dayPrograms.forEach((dp, i) => {
            FST7.push({
              day: dp.name || 'Day ' + (i + 1),
              name: dp.name || 'Day ' + (i + 1),
              muscles: [...new Set(dp.exercises.map(e => e.muscle))],
              exercises: dp.exercises.map(e => ({ ...e })),
            });
          });
        }
      }
      if (d['wiz'] !== undefined) {
        localStorage.setItem('ll_wiz', JSON.stringify(d['wiz']));
        Object.assign(wiz, d['wiz']);
      }
      if (d['custom_ex'] !== undefined) {
        localStorage.setItem('ll_custom_ex', JSON.stringify(d['custom_ex']));
        Object.keys(d['custom_ex']).forEach(mg => {
          if (EX[mg]) EX[mg] = [...new Set([...EX[mg], ...d['custom_ex'][mg]])].sort();
        });
      }
      if (d['saved_progs'] !== undefined) {
        localStorage.setItem('ll_saved_progs', JSON.stringify(d['saved_progs']));
      }
      renders.renderHome();
      renders.renderCal();
      renders.renderWorkouts();
      renders.renderHistory();
      renders.renderStats();
    } catch (e) {}
  });
}
