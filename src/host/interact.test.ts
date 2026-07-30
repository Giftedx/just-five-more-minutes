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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InteractSystem placement slots', () => {
  it('provides enough target slots for every carry chore across the week', () => {
    stubRoomGlobals();
    const room = buildRoom(roomConfigFor(nightSpec(4)));

    for (const spec of NIGHTS) {
      for (const def of Object.values(choreDefsFor(spec))) {
        if (def.verb !== 'carry') continue;
        const target = def.target as keyof Room['slots'];
        expect(
          room.slots[target].length,
          `${spec.card}: ${def.physical} needs ${def.count} ${target} slots`,
        ).toBeGreaterThanOrEqual(def.count);
      }
    }
  });

  it('places all five Friday wrappers at pairwise-distinct bin positions', () => {
    stubRoomGlobals();
    const friday = nightSpec(4);
    const builtRoom = buildRoom(roomConfigFor(friday));
    const wrapperItems = builtRoom.items.filter((item) => item.chore === 'wrappers');
    const wrapperObjects = wrapperItems.map((item) => {
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

    const bin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1));
    bin.position.set(0, 0, -2);
    bin.userData['interact'] = {
      type: 'target',
      target: 'bin',
      accepts: 'wrappers',
      name: 'bin',
    };
    bin.updateMatrixWorld(true);

    const room = {
      interactables: [...wrapperObjects, bin],
      items: wrapperItems,
      slots: builtRoom.slots,
    } as unknown as Room;
    const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 50);
    camera.updateMatrixWorld(true);
    const interact = new InteractSystem(room, choreDefsFor(friday));

    expect(wrapperObjects).toHaveLength(5);
    for (const wrapper of wrapperObjects) {
      expect(interact.act(camera)).toBe(true);
      expect(interact.act(camera)).toBe(true);
      wrapper.updateMatrixWorld(true);
    }

    const positions = wrapperObjects.map((wrapper) => wrapper.position.toArray().join(','));
    expect(new Set(positions).size).toBe(5);
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
