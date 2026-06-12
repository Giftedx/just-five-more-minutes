/** Title screen overlay. Resolves its promise when the player clicks begin. */

import type { AudioSynth } from '../audio/synth';

const TITLE_CHAT = [
  'Welcome to Mudwick Online.',
  'Left-click to act. Right-click for options.',
  'Earn max stack before dinner.',
  '"Show me the goods." — Wyn',
  'Could you move those mugs?',
];

const MUM_QUOTES = [
  {
    text: "Dinner's in about five minutes. Give your room a quick tidy if you get a second.",
    foot: '— Mum, already counting',
  },
  {
    text: 'Could you shift those mugs? I can hear them from here.',
    foot: '— Mum, acoustically informed',
  },
  {
    text: "You're not still on that computer, are you?",
    foot: '— Mum, who knows the answer',
  },
  {
    text: 'The pasta does not care about your kill streak.',
    foot: '— Mum, philosopher',
  },
] as const;

/** Tiny live Mudwick vignette for the title CRT. */
function startTitleCrt(canvas: HTMLCanvasElement, audio?: AudioSynth): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const w = canvas.width;
  const h = canvas.height;
  ctx.imageSmoothingEnabled = false;

  const viewW = Math.floor(w * 0.78);
  const player = { x: 0.48, y: 0.58, tx: 0.48, ty: 0.58 };
  const goblins = [
    { x: 0.22, y: 0.42, vx: 0.0011, hp: 3 },
    { x: 0.68, y: 0.68, vx: -0.0009, hp: 3 },
  ];
  const trees: [number, number][] = [
    [0.14, 0.28],
    [0.34, 0.22],
    [0.58, 0.26],
    [0.8, 0.3],
  ];

  let frame = 0;
  let chatIdx = 0;
  let chatLine = TITLE_CHAT[0] ?? '';
  let chatChar = 0;
  let coins = 0;
  let xp = 0;
  let hitFlash = 0;
  let coinFlash = 0;
  let raf = 0;

  const loop = (): void => {
    frame++;
    if (hitFlash > 0) hitFlash--;
    if (coinFlash > 0) coinFlash--;

    ctx.fillStyle = hitFlash > 0 ? '#3a2818' : '#243d18';
    ctx.fillRect(0, 0, viewW, h);
    for (let gy = 0; gy < h; gy += 5) {
      for (let gx = 0; gx < viewW; gx += 5) {
        const alt = ((gx >> 2) + (gy >> 2) + frame) % 7 === 0;
        ctx.fillStyle = alt ? '#3a6228' : '#48732f';
        ctx.fillRect(gx, gy, 5, 5);
      }
    }

    for (const [tx, ty] of trees) {
      const px = Math.floor(tx * viewW);
      const py = Math.floor(ty * h);
      ctx.fillStyle = '#1a3010';
      ctx.fillRect(px - 2, py, 5, 9);
      ctx.fillStyle = '#2d5020';
      ctx.fillRect(px - 4, py - 5, 9, 6);
    }

    if (frame % 110 === 0) {
      const g = goblins[Math.floor(Math.random() * goblins.length)];
      if (g) {
        player.tx = g.x + (Math.random() - 0.5) * 0.08;
        player.ty = g.y + 0.06;
      }
    }
    player.x += (player.tx - player.x) * 0.035;
    player.y += (player.ty - player.y) * 0.035;

    for (const g of goblins) {
      g.x += g.vx;
      if (g.x < 0.12 || g.x > 0.86) g.vx *= -1;
      const near =
        Math.abs(g.x - player.x) < 0.06 && Math.abs(g.y - player.y) < 0.08;
      if (near && frame % 45 === 0 && g.hp > 0) {
        g.hp--;
        hitFlash = 4;
        if (g.hp <= 0) {
          coins = Math.min(99, coins + 4 + Math.floor(Math.random() * 5));
          coinFlash = 18;
          xp = Math.min(100, xp + 8);
          g.hp = 3;
          g.x = 0.15 + Math.random() * 0.7;
          audio?.atGain(0.35, () => audio.coin());
        } else {
          audio?.atGain(0.28, () => audio.hit());
        }
      }
      ctx.fillStyle = hitFlash > 0 && near ? '#c84848' : '#5a3828';
      ctx.fillRect(Math.floor(g.x * viewW) - 2, Math.floor(g.y * h) - 3, 5, 6);
    }

    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(Math.floor(player.x * viewW) - 2, Math.floor(player.y * h) - 2, 4, 4);

    if (frame % 2 === 0 && chatChar < chatLine.length) chatChar++;
    if (chatChar >= chatLine.length && frame % 140 === 0) {
      chatIdx = (chatIdx + 1) % TITLE_CHAT.length;
      chatLine = TITLE_CHAT[chatIdx] ?? '';
      chatChar = 0;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, h - 13, viewW, 13);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '7px monospace';
    ctx.fillText(chatLine.slice(0, chatChar), 3, h - 4);

    const pw = w - viewW;
    ctx.fillStyle = '#c8b088';
    ctx.fillRect(viewW, 0, pw, h);
    ctx.fillStyle = '#3a2c18';
    ctx.fillRect(viewW + 3, 4, pw - 6, 18);
    ctx.fillStyle = '#48732f';
    ctx.fillRect(viewW + 5, 6, pw - 10, 14);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(viewW + 7, 10, 2, 2);
    ctx.fillStyle = '#8aff96';
    ctx.fillRect(viewW + 11, 10, 2, 2);
    ctx.fillStyle = coinFlash > 0 ? '#ffe566' : '#5a4a30';
    ctx.font = '6px monospace';
    ctx.fillText(`${coins}gp`, viewW + 5, 28);
    ctx.fillStyle = '#2a2010';
    ctx.fillRect(viewW + 5, 32, pw - 10, 4);
    ctx.fillStyle = '#6a9a48';
    ctx.fillRect(viewW + 5, 32, Math.floor(((pw - 10) * xp) / 100), 4);
    ctx.fillStyle = '#8a3030';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(viewW + 5 + i * 5, 40, 3, 3);
    }

    raf = requestAnimationFrame(loop);
  };

  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

function startMumKnocks(quote: HTMLElement, audio?: AudioSynth): () => void {
  let quoteIdx = 0;
  const textEl = quote.querySelector<HTMLElement>('.title-mum-quote-text');
  const footEl = quote.querySelector<HTMLElement>('.title-mum-quote-foot');

  const knock = (): void => {
    quote.classList.add('title-mum-quote--knock');
    audio?.knock();
    window.setTimeout(() => {
      quoteIdx = (quoteIdx + 1) % MUM_QUOTES.length;
      const q = MUM_QUOTES[quoteIdx];
      if (q && textEl && footEl) {
        textEl.textContent = `"${q.text}"`;
        footEl.textContent = q.foot;
      }
      quote.classList.remove('title-mum-quote--knock');
    }, 220);
  };

  window.setTimeout(knock, 2200);
  const id = window.setInterval(knock, 9000);
  return () => window.clearInterval(id);
}

function startParallax(screen: HTMLElement): () => void {
  const atmosphere = screen.querySelector<HTMLElement>('.title-atmosphere');
  const onMove = (e: MouseEvent): void => {
    if (!atmosphere) return;
    const rect = screen.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    atmosphere.style.transform = `translate(${nx * 8}px, ${ny * 5}px)`;
  };
  screen.addEventListener('mousemove', onMove);
  return () => screen.removeEventListener('mousemove', onMove);
}

export function showTitle(
  parent: HTMLElement,
  audio?: AudioSynth,
): { el: HTMLDivElement; begun: Promise<void> } {
  const el = document.createElement('div');
  el.className = 'title-screen';
  el.innerHTML = `
    <div class="title-atmosphere" aria-hidden="true">
      <div class="title-lamp"></div>
      <div class="title-vignette"></div>
      <div class="title-desk-glow"></div>
      <div class="title-motes"></div>
    </div>
    <div class="title-card">
      <header class="title-header">
        <div class="title-header-meta">
          <span class="title-kicker">A domestic incident in one act</span>
          <span class="title-header-sep" aria-hidden="true">·</span>
          <span class="title-header-clock">
            Dinner in 5<span class="title-colon">:</span>00
          </span>
        </div>
        <h1 class="title-name" aria-label="Just Five More Minutes">
          <span class="title-word">Just</span>
          <span class="title-word title-word-hero">Five</span>
          <span class="title-word">More</span>
          <span class="title-word">Minutes</span>
        </h1>
      </header>
      <p class="title-premise">
        Your room is a mild disgrace. The goblins of
        <span class="title-mmo">Mudwick Online</span> aren't going to grind themselves.
      </p>
      <div class="title-scene">
        <div class="title-scene-col">
          <span class="title-scene-label title-scene-label--screen">The screen</span>
          <div class="title-crt-wrap">
            <div class="title-crt-bezel">
              <div class="title-crt-brand">VISIONMASTER 240</div>
              <span class="title-crt-led"></span>
              <canvas class="title-crt" width="200" height="152" aria-hidden="true"></canvas>
              <div class="title-crt-scanlines"></div>
              <div class="title-crt-flicker"></div>
            </div>
            <div class="title-crt-stand"></div>
            <div class="title-crt-desk" aria-hidden="true">
              <div class="title-crt-kb"></div>
              <div class="title-crt-mouse"></div>
            </div>
          </div>
        </div>
        <div class="title-scene-col">
          <span class="title-scene-label title-scene-label--hall">The hall</span>
          <blockquote class="title-mum-quote">
            <p class="title-mum-quote-text">"${MUM_QUOTES[0].text}"</p>
            <span class="title-mum-quote-foot">${MUM_QUOTES[0].foot}</span>
          </blockquote>
        </div>
      </div>
      <p class="title-controls">
        <span><span class="key">WASD</span> move</span>
        <span><span class="key">Mouse</span> look</span>
        <span><span class="key">E</span> interact</span>
        <span><span class="key">1–4</span> answer Mum</span>
      </p>
      <footer class="title-footer">
        <button type="button" class="title-begin">Begin</button>
        <p class="title-footer-note">2,147,483,647 gp · 99 all stats · <kbd>Enter</kbd></p>
      </footer>
    </div>
  `;
  parent.appendChild(el);

  const disposers: (() => void)[] = [];
  disposers.push(startParallax(el));

  const canvas = el.querySelector<HTMLCanvasElement>('.title-crt');
  if (canvas) disposers.push(startTitleCrt(canvas, audio));

  const quote = el.querySelector<HTMLElement>('.title-mum-quote');
  if (quote) disposers.push(startMumKnocks(quote, audio));

  const begun = new Promise<void>((resolve) => {
    let done = false;
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        finish();
      }
    };
    const finish = (): void => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey);
      for (const d of disposers) d();
      audio?.titleBegin();
      el.classList.add('title-screen--exit');
      window.setTimeout(() => {
        el.remove();
        resolve();
      }, 520);
    };

    document.addEventListener('keydown', onKey);
    el.querySelector('.title-begin')?.addEventListener('click', (e) => {
      e.stopPropagation();
      finish();
    });
    el.addEventListener('click', finish);
  });

  return { el, begun };
}
