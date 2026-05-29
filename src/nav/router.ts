const PAGES = ['pgHome', 'pgCal', 'pgWork', 'pgHist', 'pgStats'];
const NAV_IDS = ['nb0', 'nb1', 'nb2', 'nb3', 'nb4'];

type PageRenderer = () => void;
const renderers: PageRenderer[] = [];

export function registerRenderers(fns: PageRenderer[]): void {
  renderers.push(...fns);
}

export function goPage(n: number): void {
  PAGES.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', i === n);
    const nb = document.getElementById(NAV_IDS[i]);
    if (nb) nb.classList.toggle('active', i === n);
  });
  if (renderers[n]) renderers[n]();
}
