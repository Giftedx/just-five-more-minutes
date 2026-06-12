import * as THREE from 'three';
import { InteractSystem } from './host/interact';
import { PlayerController } from './host/player';
import { buildRoom } from './host/room';

/** Standalone room-mode dev route (`?dev=room`): walk, pick up, place. */
export function runRoomDev(app: HTMLElement): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  app.appendChild(renderer.domElement);

  const room = buildRoom();
  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 50);
  const player = new PlayerController(camera, room.playerSpawn, room.colliders);
  const interact = new InteractSystem(room);

  // Dev: all chores requested up front so placement counts.
  interact.tracker.request('mugs');
  interact.tracker.request('wrappers');
  interact.tracker.request('laundry');

  const label = document.createElement('div');
  label.style.cssText =
    'position:absolute;bottom:18%;left:50%;transform:translateX(-50%);font:600 16px system-ui;' +
    'color:#ffe9b0;background:rgba(10,8,6,0.7);padding:6px 14px;border-radius:8px;display:none;pointer-events:none;';
  app.appendChild(label);

  const chip = document.createElement('div');
  chip.style.cssText =
    'position:absolute;top:14px;left:14px;font:600 14px system-ui;color:#e8e2d4;' +
    'background:rgba(10,8,6,0.7);padding:6px 12px;border-radius:8px;pointer-events:none;white-space:pre;';
  app.appendChild(chip);

  const crosshair = document.createElement('div');
  crosshair.style.cssText =
    'position:absolute;top:50%;left:50%;width:6px;height:6px;margin:-3px;border-radius:50%;' +
    'background:rgba(255,255,255,0.85);pointer-events:none;';
  app.appendChild(crosshair);

  interact.onTrackerEvents = (events) => {
    for (const e of events) {
      if (e.type === 'choreCompleted') label.textContent = `${e.chore} DONE!`;
    }
  };

  renderer.domElement.addEventListener('click', () => {
    if (document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
      player.mouseLook(e.movementX, e.movementY);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') interact.act(camera);
    player.keyDown(e.code);
  });
  document.addEventListener('keyup', (e) => player.keyUp(e.code));
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // dev hook for headless poking
  (window as unknown as Record<string, unknown>)['__devroom'] = { player, camera, interact };

  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    player.update(dt);
    const prompt = interact.update(camera);
    interact.updateCarried(camera);
    if (prompt) {
      label.style.display = 'block';
      label.textContent = prompt.label;
    } else {
      label.style.display = 'none';
    }
    const p = (c: 'mugs' | 'wrappers' | 'laundry') => {
      const { done, total } = interact.tracker.progress(c);
      return `${c}: ${done}/${total}${interact.tracker.isCompleted(c) ? ' ✓' : ''}`;
    };
    chip.textContent = `${p('mugs')}\n${p('wrappers')}\n${p('laundry')}`;
    renderer.render(room.scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
