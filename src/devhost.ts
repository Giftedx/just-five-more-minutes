import { HostApp } from './host/app';

/** Mode-switching dev route (`?dev=host`): room + PC + live monitor mirror. */
export function runHostDev(app: HTMLElement, speed: number): void {
  const host = new HostApp(app, { speed });

  // Dev: all chores requested up front.
  host.interact.tracker.request('mugs');
  host.interact.tracker.request('wrappers');
  host.interact.tracker.request('laundry');

  const label = document.createElement('div');
  label.style.cssText =
    'position:absolute;bottom:18%;left:50%;transform:translateX(-50%);font:600 16px system-ui;' +
    'color:#ffe9b0;background:rgba(10,8,6,0.7);padding:6px 14px;border-radius:8px;display:none;pointer-events:none;';
  app.appendChild(label);

  const crosshair = document.createElement('div');
  crosshair.style.cssText =
    'position:absolute;top:50%;left:50%;width:6px;height:6px;margin:-3px;border-radius:50%;' +
    'background:rgba(255,255,255,0.85);pointer-events:none;';
  app.appendChild(crosshair);

  host.hooks.onModeChange = (mode) => {
    crosshair.style.display = mode === 'room' ? 'block' : 'none';
  };

  (window as unknown as Record<string, unknown>)['__devhost'] = host;

  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(100, now - last);
    last = now;
    host.update(dt);
    const prompt = host.prompt;
    if (prompt && host.mode === 'room') {
      label.style.display = 'block';
      label.textContent = prompt.label;
    } else {
      label.style.display = 'none';
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
