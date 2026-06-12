/** Title screen overlay. Resolves its promise when the player clicks begin. */
export function showTitle(parent: HTMLElement): { el: HTMLDivElement; begun: Promise<void> } {
  const el = document.createElement('div');
  el.className = 'title-screen';
  el.innerHTML = `
    <div class="title-card">
      <div class="title-kicker">A domestic incident in one act</div>
      <h1 class="title-name">Just Five More Minutes</h1>
      <p class="title-premise">
        Dinner is in twelve minutes, and your room is a mild disgrace.
        Unfortunately, the goblins of <em>Mudwick Online</em> aren't going to grind themselves.
      </p>
      <div class="title-controls">
        <div><b>WASD</b> move &nbsp;·&nbsp; <b>Mouse</b> look &nbsp;·&nbsp; <b>E</b> interact</div>
        <div><b>Mouse</b> plays Mudwick at the PC &nbsp;·&nbsp; <b>Esc / Q</b> stand up</div>
        <div><b>1–4</b> answer the voice at the door</div>
      </div>
      <button class="title-begin">Click to begin</button>
      <div class="title-footnote">Earn 100 coins before dinner. Also, maybe, tidy up. Your call.</div>
    </div>
  `;
  parent.appendChild(el);
  const begun = new Promise<void>((resolve) => {
    const btn = el.querySelector('.title-begin');
    btn?.addEventListener('click', () => {
      el.remove();
      resolve();
    });
  });
  return { el, begun };
}
