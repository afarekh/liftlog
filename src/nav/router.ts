import { SESSION } from '../store/state';

const PAGES = ['pgHome', 'pgCal', 'pgWork', 'pgHist', 'pgStats'];
const NAV_IDS = ['nb0', 'nb1', 'nb2', 'nb3', 'nb4'];

type PageRenderer = () => void;
const renderers: PageRenderer[] = [];

export function registerRenderers(fns: PageRenderer[]): void {
  renderers.push(...fns);
}

export function goPage(n: number): void {
  // If the session overlay is open, minimise it so the page underneath is visible.
  // SESSION data stays intact; the user can resume via the floating pill.
  const sp = document.getElementById('SP');
  if (sp?.classList.contains('open')) {
    sp.classList.remove('open');
  }

  PAGES.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', i === n);
    const nb = document.getElementById(NAV_IDS[i]);
    if (nb) nb.classList.toggle('active', i === n);
  });
  if (renderers[n]) renderers[n]();

  // Show resume pill whenever a session is active but the overlay is hidden
  updateResumePill();
}

export function updateResumePill(): void {
  const pill = document.getElementById('spResumePill');
  if (!pill) return;
  const sp = document.getElementById('SP');
  const sessionActive = SESSION !== null;
  const spHidden = !sp?.classList.contains('open');
  pill.classList.toggle('show', sessionActive && spHidden);
}
