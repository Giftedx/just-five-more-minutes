import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { choreDefsFor } from './chores';
import { InteractSystem } from './interact';
import type { Room } from './room';
import { nightSpec } from '../director/nights';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InteractSystem placement slots', () => {
  it('reuses the basket slot after a Tuesday wrapper is picked back up', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    });

    const item = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    item.position.set(0, 0, -1);
    item.userData['interact'] = {
      type: 'item',
      itemId: 'wrapper-1',
      chore: 'laundry',
      name: 'wrapper',
    };

    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1));
    basket.position.set(0, 0, -2);
    basket.userData['interact'] = {
      type: 'target',
      target: 'basket',
      accepts: 'laundry',
      name: 'laundry basket',
    };

    const basketSlots = [
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0.5, 0, -1),
    ];
    const room = {
      interactables: [item, basket],
      items: [{ id: 'wrapper-1', chore: 'laundry', name: 'wrapper' }],
      slots: {
        tray: [],
        bin: [],
        basket: basketSlots,
      },
    } as unknown as Room;
    const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 50);
    camera.updateMatrixWorld(true);
    item.updateMatrixWorld(true);
    basket.updateMatrixWorld(true);

    const interact = new InteractSystem(room, choreDefsFor(nightSpec(1)));

    expect(interact.act(camera)).toBe(true);
    expect(interact.act(camera)).toBe(true);
    expect(item.position.toArray()).toEqual(basketSlots[0]!.toArray());

    item.updateMatrixWorld(true);
    expect(interact.act(camera)).toBe(true);
    expect(interact.act(camera)).toBe(true);

    expect(item.position.toArray()).toEqual(basketSlots[0]!.toArray());
  });
});
