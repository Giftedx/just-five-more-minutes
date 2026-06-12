import { MmoGame } from './mmo/render/game';

/** Standalone Mudwick Online dev route (`?dev=mmo`). */
export function runMmoDev(app: HTMLElement, speed: number): void {
  const wrap = document.createElement('div');
  wrap.className = 'crt-wrap';
  const bezel = document.createElement('div');
  bezel.className = 'crt-bezel';
  const screen = document.createElement('div');
  screen.className = 'crt-screen';
  const label = document.createElement('div');
  label.className = 'crt-label';
  label.textContent = 'MUDWICK ONLINE — DEV';

  const game = new MmoGame(undefined, speed);
  screen.appendChild(game.canvas);
  bezel.appendChild(screen);
  bezel.appendChild(label);
  wrap.appendChild(bezel);
  app.appendChild(wrap);

  const fit = (): void => {
    const scale = Math.max(
      1,
      Math.floor(Math.min((window.innerWidth - 120) / 320, (window.innerHeight - 140) / 240)),
    );
    screen.style.width = `${320 * scale}px`;
    screen.style.height = `${240 * scale}px`;
  };
  fit();
  window.addEventListener('resize', fit);

  game.attachInput(screen);

  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(100, now - last);
    last = now;
    game.update(dt, false);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
