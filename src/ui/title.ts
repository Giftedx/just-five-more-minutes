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
        <div class="row">
          <span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> move
          <span class="sep">·</span> <span class="key">Mouse</span> look
          <span class="sep">·</span> <span class="key">E</span> interact
        </div>
        <div class="row">
          <span class="key">Mouse</span> plays Mudwick at the PC
          <span class="sep">·</span> <span class="key">E</span> stand up
        </div>
        <div class="row">
          <span class="key">1</span>–<span class="key">4</span> answer the voice at the door
        </div>
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
