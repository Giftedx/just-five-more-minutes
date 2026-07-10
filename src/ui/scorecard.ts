import type { ScoreBreakdown } from '../score/score';
import type { ReportHistorySummary } from '../score/history';
import { formatSessionSeed } from '../session';

export interface ScorecardStats {
  coins: number;
  deaths: number;
  choresDone: number;
  choresTotal: number;
  statsBonusHit: boolean;
  kills: number;
  bestStreak: number;
  contractsCompleted: number;
  skillLevels: {
    woodcutting: number;
    attack: number;
    foraging: number;
  };
  seed: number;
  history: ReportHistorySummary;
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
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'incident-report-title');

  const row = (label: string, value: number, max: number): string =>
    `<div class="sc-row"><span class="sc-label">${label}</span>` +
    `<span class="sc-dots"></span><span class="sc-value">${fmt(value)} / ${max}</span></div>`;

  const facts =
    score.facts.length > 0
      ? score.facts.map((f) => `<li>${f.note}</li>`).join('')
      : '<li>No notable incidents. Which is, frankly, suspicious in itself.</li>';
  const { history } = stats;
  const change = history.delta === null
    ? 'FIRST FILING'
    : history.delta > 0
      ? `+${history.delta} VS LAST`
      : history.delta < 0
        ? `${history.delta} VS LAST`
        : 'LEVEL WITH LAST';
  const careerStamp = !history.persisted
    ? 'NOT SAVED'
    : history.isNewBest
      ? 'NEW BEST'
      : 'CAREER FILE';

  el.innerHTML = `
    <div class="sc-card">
      <div class="sc-header">
        <div class="sc-stamp">FILED</div>
        <div class="sc-title" id="incident-report-title">HOUSEHOLD INCIDENT REPORT</div>
        <div class="sc-subtitle">RE: the five minutes before dinner</div>
      </div>
      <div class="sc-body">
        ${row('MMO Progress', score.mmo, 40)}
        ${row('Household Responsibility', score.household, 30)}
        ${row('Vibe Preservation', score.vibe, 20)}
        ${row('Comedy Bonus', score.comedy, 10)}
        <div class="sc-total-row"><span>TOTAL</span><span>${score.total} / 100</span></div>
        <div class="sc-meta">
          <div class="sc-meta-line">${stats.coins.toLocaleString('en-US')} gp · ${stats.kills} kill${stats.kills === 1 ? '' : 's'} · ${stats.contractsCompleted} Wyn contract${stats.contractsCompleted === 1 ? '' : 's'} · best streak ${stats.bestStreak}</div>
          <div class="sc-meta-line">WC ${stats.skillLevels.woodcutting} · ATK ${stats.skillLevels.attack} · FOR ${stats.skillLevels.foraging}${stats.statsBonusHit ? ' · 99 ALL' : ''} · ${stats.deaths} death${stats.deaths === 1 ? '' : 's'} · ${stats.choresDone}/${stats.choresTotal} chores</div>
        </div>
        <div class="sc-career">
          <span class="sc-career-stamp">${careerStamp}</span>
          <span>RUN ${history.runNumber}</span>
          <span>BEST ${history.best}</span>
          <span>${change}</span>
        </div>
        <div class="sc-seed">RUN SEED · 0x${formatSessionSeed(stats.seed)}</div>
        <div class="sc-notes-title">INCIDENT NOTES</div>
        <ul class="sc-notes">${facts}</ul>
        <div class="sc-ending-label">VERDICT</div>
        <div class="sc-ending">${score.endingTitle}</div>
      </div>
      <button class="sc-restart" type="button">File another report (restart)</button>
    </div>
  `;
  parent.appendChild(el);
  const restartButton = el.querySelector<HTMLButtonElement>('.sc-restart');
  restartButton?.addEventListener('click', () => onRestart());
  restartButton?.focus();
  return el;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
