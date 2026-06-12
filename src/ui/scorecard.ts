import type { ScoreBreakdown } from '../score/score';

export interface ScorecardStats {
  coins: number;
  deaths: number;
  choresDone: number;
  choresTotal: number;
}

/** The HOUSEHOLD INCIDENT REPORT. */
export function showScorecard(
  parent: HTMLElement,
  score: ScoreBreakdown,
  stats: ScorecardStats,
  onRestart: () => void,
): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'scorecard';

  const row = (label: string, value: number, max: number): string =>
    `<div class="sc-row"><span class="sc-label">${label}</span>` +
    `<span class="sc-dots"></span><span class="sc-value">${fmt(value)} / ${max}</span></div>`;

  const facts =
    score.facts.length > 0
      ? score.facts.map((f) => `<li>${f.note}</li>`).join('')
      : '<li>No notable incidents. Which is, frankly, suspicious in itself.</li>';

  el.innerHTML = `
    <div class="sc-card">
      <div class="sc-header">
        <div class="sc-stamp">FILED</div>
        <div class="sc-title">HOUSEHOLD INCIDENT REPORT</div>
        <div class="sc-subtitle">RE: the twelve minutes before dinner</div>
      </div>
      <div class="sc-body">
        ${row('MMO Progress', score.mmo, 40)}
        ${row('Household Responsibility', score.household, 30)}
        ${row('Vibe Preservation', score.vibe, 20)}
        ${row('Comedy Bonus', score.comedy, 10)}
        <div class="sc-total-row"><span>TOTAL</span><span>${score.total} / 100</span></div>
        <div class="sc-meta">${stats.coins} coins · ${stats.deaths} death${stats.deaths === 1 ? '' : 's'} · ${stats.choresDone}/${stats.choresTotal} chores</div>
        <div class="sc-notes-title">INCIDENT NOTES</div>
        <ul class="sc-notes">${facts}</ul>
        <div class="sc-ending-label">VERDICT</div>
        <div class="sc-ending">${score.endingTitle}</div>
      </div>
      <button class="sc-restart">File another report (restart)</button>
    </div>
  `;
  parent.appendChild(el);
  el.querySelector('.sc-restart')?.addEventListener('click', () => onRestart());
  return el;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
