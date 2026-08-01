import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { choreDefsFor } from './chores';
import { InteractSystem } from './interact';
import { buildRoom, type Room, type RoomNightConfig } from './room';
import { NIGHTS, nightSpec, type NightSpec } from '../director/nights';

function stubRoomGlobals(): void {
  const gradient = { addColorStop: vi.fn() };
  const noop = vi.fn();
  const context = new Proxy<Record<PropertyKey, unknown>>({}, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === 'createLinearGradient' || property === 'createRadialGradient') {
        return () => gradient;
      }
      return noop;
    },
  }) as unknown as CanvasRenderingContext2D;

  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => context,
    }),
  });
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: false }),
  });
}

function roomConfigFor(spec: NightSpec): RoomNightConfig {
  return {
    chores: (['mugs', 'wrappers', 'laundry'] as const).map((slot) => ({
      slot,
      physical: spec.slots[slot].id,
      count: spec.slots[slot].count,
    })),
    phone: spec.beats.phone !== undefined,
  };
}

const TARGET_FOR_SLOT: Record<keyof NightSpec['slots'], keyof Room['slots']> = {
  mugs: 'tray',
  wrappers: 'bin',
  laundry: 'basket',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InteractSystem placement slots', () => {
  it.each(NIGHTS)('$card provides enough target slots for every carry chore', (spec) => {
    stubRoomGlobals();
    const room = buildRoom(roomConfigFor(spec));

    for (const slot of ['mugs', 'wrappers', 'laundry'] as const) {
      const chore = spec.slots[slot];
      if (chore.verb !== 'carry') continue;
      const target = TARGET_FOR_SLOT[slot];
      expect(
        room.slots[target].length,
        `${spec.card}: ${chore.id} needs ${chore.count} ${target} slots`,
      ).toBeGreaterThanOrEqual(chore.count);
    }
  });

  it.each([
    { night: 1, slot: 'laundry', target: 'basket', count: 4, label: 'Tuesday wrappers' },
    { night: 3, slot: 'mugs', target: 'tray', count: 4, label: 'Thursday wrappers' },
    { night: 4, slot: 'wrappers', target: 'bin', count: 5, label: 'Friday wrappers' },
  ] as const)('places all $label at pairwise-distinct $target positions', ({ night, slot, target, count }) => {
    stubRoomGlobals();
    const spec = nightSpec(night);
    const builtRoom = buildRoom(roomConfigFor(spec));
    const carryItems = builtRoom.items.filter((item) => item.chore === slot);
    const carryObjects = carryItems.map((item) => {
      const object = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
      object.position.set(0, 0, -1);
      object.userData['interact'] = {
        type: 'item',
        itemId: item.id,
        chore: item.chore,
        name: item.name,
      };
      object.updateMatrixWorld(true);
      return object;
    });

    const placementTarget = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1));
    placementTarget.position.set(0, 0, -2);
    placementTarget.userData['interact'] = {
      type: 'target',
      target,
      accepts: slot,
      name: target,
    };
    placementTarget.updateMatrixWorld(true);

    const room = {
      interactables: [...carryObjects, placementTarget],
      items: carryItems,
      slots: builtRoom.slots,
    } as unknown as Room;
    const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 50);
    camera.updateMatrixWorld(true);
    const interact = new InteractSystem(room, choreDefsFor(spec));

    expect(carryObjects).toHaveLength(count);
    for (const object of carryObjects) {
      expect(interact.act(camera)).toBe(true);
      expect(interact.act(camera)).toBe(true);
      object.updateMatrixWorld(true);
    }

    const positions = carryObjects.map((object) => object.position.toArray().join(','));
    expect(new Set(positions).size).toBe(count);
  });

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
