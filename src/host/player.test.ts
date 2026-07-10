import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PlayerController } from './player';

// THREE's camera/vector/box math is pure (no DOM), so PlayerController is
// node-testable. These guard the invariant the blur/lock-loss fix relies on:
// once keys are cleared, update() must not move the avatar.
function makePlayer(): PlayerController {
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 50);
  return new PlayerController(camera, new THREE.Vector3(0, 0, 0), []);
}

function step(p: PlayerController, frames: number): void {
  for (let i = 0; i < frames; i++) p.update(1 / 60);
}

describe('PlayerController.clearKeys', () => {
  it('a held key drives movement (sanity: the harness can detect drift)', () => {
    const p = makePlayer();
    const start = p.pos.clone();
    p.keyDown('KeyW');
    step(p, 30);
    expect(p.pos.distanceTo(start)).toBeGreaterThan(0.05);
  });

  it('clears held keys so a held key produces no further movement', () => {
    const p = makePlayer();
    p.keyDown('KeyW');
    step(p, 30); // build up velocity, as if mid-stride
    p.clearKeys();
    const afterClear = p.pos.clone();
    step(p, 120); // KeyW is still "held" but was cleared — must not drift
    expect(p.pos.distanceTo(afterClear)).toBe(0);
  });
});
