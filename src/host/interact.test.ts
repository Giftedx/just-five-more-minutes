import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { nightSpec } from '../director/nights';
import { choreDefsFor } from './chores';
import { InteractSystem } from './interact';
import type { Interactable, Room } from './room';

function roomWithTarget(interact: Extract<Interactable, { type: 'target' }>): Room {
  const target = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial(),
  );
  target.position.z = -1;
  target.userData['interact'] = interact;
  target.updateMatrixWorld(true);

  return {
    scene: new THREE.Scene(),
    colliders: [],
    interactables: [target],
    itemObjects: new Map(),
    items: [],
    slots: { tray: [], bin: [], basket: [] },
    monitorScreen: new THREE.Mesh(),
    npcSilhouette: new THREE.Object3D(),
    npcTick: () => {},
    setHallLight: () => {},
    setDusk: () => {},
    setDeskLamp: () => {},
    playerSpawn: new THREE.Vector3(),
  };
}

describe('InteractSystem target prompts', () => {
  beforeAll(() => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    {
      night: 2,
      interact: {
        type: 'target',
        target: 'basket',
        accepts: 'laundry',
        name: 'laundry basket',
      } as const,
      expected: 'laundry basket',
    },
    {
      night: 3,
      interact: {
        type: 'target',
        target: 'bin',
        accepts: 'wrappers',
        name: 'bin',
      } as const,
      expected: 'bin',
    },
  ])('uses a neutral $interact.name label when night $night maps its slot to a tug chore', ({
    night,
    interact,
    expected,
  }) => {
    const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 50);
    camera.updateMatrixWorld(true);
    const system = new InteractSystem(roomWithTarget(interact), choreDefsFor(nightSpec(night)));

    expect(system.update(camera)).toEqual({ label: expected, actionable: false });
  });
});
