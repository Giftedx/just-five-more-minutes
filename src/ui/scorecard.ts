import type { ScoreBreakdown } from '../score/score';
import type { ReportHistorySummary } from '../score/history';
import type { WeekVerdict } from '../score/week';
import { formatSessionSeed } from '../session';

export interface ScorecardStats {
  coins: number;
  coinsEarned: number;
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
    fishing: number;
  };
  seed: number;
  /** Tonight's card, e.g. "WEDNESDAY — Auntie Carol". */
  nightCard: string;
  history: ReportHistorySummary;
}

/** The HOUSEHOLD INCIDENT REPORT. */
export function showScorecard(
  parent: HTMLElement,
  score: ScoreBreakdown,
  stats: ScorecardStats,
  onRestart: () => void,
  restartLabel = 'File another report (restart)',
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
        <div class="sc-title" id="incident-report-title" tabindex="-1">HOUSEHOLD INCIDENT REPORT</div>
        <div class="sc-subtitle">RE: the five minutes before dinner · ${stats.nightCard}</div>
      </div>
      <div class="sc-body">
        ${row('MMO Progress', score.mmo, 40)}
        ${row('Household Responsibility', score.household, 30)}
        ${row('Vibe Preservation', score.vibe, 20)}
        ${row('Comedy Bonus', score.comedy, 10)}
        <div class="sc-total-row"><span>TOTAL</span><span>${score.total} / 100</span></div>
        <div class="sc-meta">
          <div class="sc-meta-line">${stats.coinsEarned.toLocaleString('en-US')} gp earned tonight (${stats.coins.toLocaleString('en-US')} banked) · ${stats.kills} kill${stats.kills === 1 ? '' : 's'} · ${stats.contractsCompleted} Wyn contract${stats.contractsCompleted === 1 ? '' : 's'} · best streak ${stats.bestStreak}</div>
          <div class="sc-meta-line">WC ${stats.skillLevels.woodcutting} · ATK ${stats.skillLevels.attack} · FOR ${stats.skillLevels.foraging} · FSH ${stats.skillLevels.fishing}${stats.statsBonusHit ? ' · 99 ALL' : ''} · ${stats.deaths} death${stats.deaths === 1 ? '' : 's'} · ${stats.choresDone}/${stats.choresTotal} chores</div>
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
      <button class="sc-restart" type="button">${restartLabel}</button>
    </div>
  `;
  parent.appendChild(el);
  const restartButton = el.querySelector<HTMLButtonElement>('.sc-restart');
  restartButton?.addEventListener('click', () => onRestart());
  el.querySelector<HTMLElement>('.sc-title')?.focus({ preventScroll: true });
  return el;
}

/** Five reports, one staple, one verdict. Shown after Friday's card. */
export function showWeekVerdict(
  parent: HTMLElement,
  verdict: WeekVerdict,
  galleryCount: number,
  onNewWeek: () => void,
): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'scorecard sc-week';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'week-verdict-title');

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const gradeChips = verdict.grades
    .map((g, i) => `<span class="sc-week-day"><span>${days[i]}</span><strong>${g}</strong></span>`)
    .join('');
  const stamps = verdict.stamps
    .map((s) => `<div class="sc-week-stamp">${s}</div>`)
    .join('');

  el.innerHTML = `
    <div class="sc-card">
      <div class="sc-header">
        <div class="sc-stamp">STAPLED</div>
        <div class="sc-title" id="week-verdict-title" tabindex="-1">THE WEEK VERDICT</div>
        <div class="sc-subtitle">Five evenings. One conclusion.</div>
      </div>
      <div class="sc-body">
        <div class="sc-week-grades">${gradeChips}</div>
        <div class="sc-total-row"><span>WEEK TOTAL</span><span>${verdict.weekTotal} / 500</span></div>
        ${stamps}
        <div class="sc-ending-label">THE WEEK, OFFICIALLY</div>
        <div class="sc-ending">${verdict.title}</div>
        <div class="sc-week-blurb">${verdict.blurb}</div>
        <div class="sc-career">
          <span class="sc-career-stamp">GALLERY</span>
          <span>${galleryCount} ending${galleryCount === 1 ? '' : 's'} collected</span>
        </div>
      </div>
      <button class="sc-restart" type="button">Start a new week (Mudwick remembers you)</button>
    </div>
  `;
  parent.appendChild(el);
  const button = el.querySelector<HTMLButtonElement>('.sc-restart');
  button?.addEventListener('click', () => onNewWeek());
  el.querySelector<HTMLElement>('.sc-title')?.focus({ preventScroll: true });
  return el;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
