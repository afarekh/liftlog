import { S, FST7 } from '../store/state';
import { fmtD, parseYMD, todayYMD } from '../utils/date';

export function renderStats(): void {
  if (!S.prog || !S.prog.active) {
    const progBan = document.getElementById('stProgBan');
    if (progBan) progBan.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No active program. Set up a program first.</div>';
    return;
  }

  const start = parseYMD(S.prog.startDate);
  const end = new Date(start); end.setDate(start.getDate() + S.prog.weeks * 7);
  const pct = Math.min(100, Math.round(((Date.now() - start.getTime()) / (end.getTime() - start.getTime())) * 100));

  const progBan = document.getElementById('stProgBan');
  if (progBan) {
    progBan.innerHTML = `<div class="prog-dk">
      <div class="pd-lbl">Current Program</div>
      <div class="pd-nm">${S.prog.name}</div>
      <div class="pd-bt"><div class="pd-bf" style="width:${pct}%"></div></div>
      <div class="pd-sb">${pct}% complete · ends ${fmtD(end)}</div>
    </div>`;
  }

  const totalSessions = S.workouts.length;
  const totalSets = S.workouts.reduce((a, w) =>
    a + (w.exercises || []).reduce((b, e) => {
      const sets = e.sets as Array<{ done: boolean }>;
      return b + sets.filter(s => s.done).length;
    }, 0), 0);

  const wkStart = new Date();
  wkStart.setDate(wkStart.getDate() - wkStart.getDay());
  const wkWorkouts = S.workouts.filter(w => parseYMD(w.date) >= wkStart).length;

  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (S.workouts.find(w => w.date === ds)) { streak++; d.setDate(d.getDate() - 1); } else break;
  }

  const s4 = document.getElementById('s4grid');
  if (s4) {
    const stats = [
      { l: 'Sessions', v: String(totalSessions), s: 'total logged', p: Math.min(100, totalSessions * 5) },
      { l: 'Total Sets', v: String(totalSets), s: 'all time', p: Math.min(100, totalSets / 5) },
      { l: 'This Week', v: String(wkWorkouts), s: 'sessions', p: Math.min(100, wkWorkouts * 20) },
      { l: 'Streak', v: String(streak), s: 'days', p: Math.min(100, streak * 10) },
    ];
    s4.innerHTML = stats.map(s =>
      `<div class="s4b"><div class="s4l">${s.l}</div><div class="s4v">${s.v}</div><div class="s4s">${s.s}</div><div class="s4bt"><div class="s4bf" style="width:${s.p}%"></div></div></div>`
    ).join('');
  }

  // Volume by muscle
  const volCounts: Record<string, number> = {};
  S.workouts.forEach(w => {
    (w.exercises || []).forEach(e => {
      const sets = e.sets as Array<{ done: boolean }>;
      const doneSets = sets.filter(s => s.done).length;
      volCounts[e.muscle] = (volCounts[e.muscle] || 0) + doneSets;
    });
  });

  // Sets per muscle per week from program
  const programVolume: Record<string, number> = {};
  FST7.forEach(day => {
    if (!day || !day.exercises) return;
    day.exercises.forEach(e => {
      programVolume[e.muscle] = (programVolume[e.muscle] || 0) + (e.sets as number);
    });
  });

  const musData = Object.entries(programVolume).sort((a, b) => b[1] - a[1]);
  const maxVol = musData.length ? musData[0][1] : 1;

  const musChart = document.getElementById('musChart');
  if (musChart) {
    musChart.innerHTML = musData.map(([m, s]) =>
      `<div class="ms-row"><div class="ms-top"><div class="ms-nm">${m}</div><div class="ms-v" style="color:${s >= 14 ? 'var(--gd)' : 'var(--text)'}">${s}</div></div><div class="ms-bt"><div class="ms-bf" style="width:${Math.round((s / maxVol) * 100)}%;background:${s >= 14 ? 'var(--green)' : 'var(--black)'}"></div></div></div>`
    ).join('');
  }

  const volData = Object.entries(volCounts).sort((a, b) => b[1] - a[1]);
  const maxLogVol = volData.length ? volData[0][1] : 1;
  const volChart = document.getElementById('volChart');
  if (volChart) {
    volChart.innerHTML = volData.map(([m, s]) =>
      `<div class="ms-row"><div class="ms-top"><div class="ms-nm">${m}</div><div class="ms-v">${s} sets</div></div><div class="ms-bt"><div class="ms-bf" style="width:${Math.round((s / maxLogVol) * 100)}%;background:${s === maxLogVol ? 'var(--green)' : s > maxLogVol * 0.6 ? 'var(--black)' : '#EDEDED'}"></div></div></div>`
    ).join('') || '<div style="text-align:center;padding:14px;color:var(--muted);font-size:12px">Log some sessions first.</div>';
  }
}
