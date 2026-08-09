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

describe('buildRoom chore counts', () => {
  it.each(NIGHTS)('$card stages the configured count for each chore', (night) => {
    stubRoomGlobals();
    const spec = nightSpec(night.night);
    const room = buildRoom(roomConfigFor(spec));

    for (const slot of ['mugs', 'wrappers', 'laundry'] as const) {
      expect(room.items.filter((item) => item.chore === slot)).toHaveLength(spec.slots[slot].count);
    }

    const decreasedConfig = roomConfigFor(spec);
    for (const chore of decreasedConfig.chores) chore.count -= 1;
    const decreasedRoom = buildRoom(decreasedConfig);

    for (const chore of decreasedConfig.chores) {
      expect(decreasedRoom.items.filter((item) => item.chore === chore.slot)).toHaveLength(chore.count);
    }
  });

  it('stages two mugs when the configured count is two', () => {
    stubRoomGlobals();
    const room = buildRoom({
      chores: [{ slot: 'mugs', physical: 'mugs', count: 2 }],
      phone: false,
    });

    expect(room.items).toHaveLength(2);
  });

  it('rejects a carry count above the slot capacity', () => {
    stubRoomGlobals();

    expect(() => buildRoom({
      chores: [{ slot: 'mugs', physical: 'wrappers', count: 5 }],
      phone: false,
    })).toThrow('Chore slot "mugs" has 5 items. Its capacity is 4.');
  });
});

describe('InteractSystem placement slots', () => {
  it('does not advertise tug chores on carry targets', () => {
    stubRoomGlobals();

    const promptForTarget = (night: 0 | 1 | 2 | 3, target: 'bin' | 'basket'): string => {
      const spec = nightSpec(night);
      const room = buildRoom(roomConfigFor(spec));
      const targetObject = room.interactables.find((object) => {
        const interact = object.userData['interact'];
        return interact?.type === 'target' && interact.target === target;
      });
      expect(targetObject).toBeDefined();

      const center = new THREE.Box3().setFromObject(targetObject!).getCenter(new THREE.Vector3());
      const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 50);
      camera.position.copy(center).add(new THREE.Vector3(0, 0, 1));
      camera.lookAt(center);
      camera.updateMatrixWorld(true);

      const isolatedRoom = { ...room, interactables: [targetObject!] };
      const prompt = new InteractSystem(isolatedRoom, choreDefsFor(spec)).update(camera);
      expect(prompt).not.toBeNull();
      return prompt!.label;
    };

    expect(promptForTarget(0, 'bin')).toBe('bin (wrappers go here)');
    expect(promptForTarget(1, 'bin')).not.toContain('duvet corners');
    expect(promptForTarget(2, 'basket')).not.toContain('duvet corners');
    expect(promptForTarget(3, 'bin')).not.toContain('curtains');
  });

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

  it('keeps the carried item when the target is full', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    });

    const items = ['mug-1', 'mug-2'].map((id, index) => {
      const item = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
      item.position.set(0, 0, -1 - index * 0.1);
      item.userData['interact'] = {
        type: 'item',
        itemId: id,
        chore: 'mugs',
        name: 'mug',
      };
      item.updateMatrixWorld(true);
      return item;
    });

    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1));
    tray.position.set(0, 0, -2);
    tray.userData['interact'] = {
      type: 'target',
      target: 'tray',
      accepts: 'mugs',
      name: 'tray',
    };
    tray.updateMatrixWorld(true);

    const room = {
      interactables: [...items, tray],
      items: items.map((_, index) => ({ id: 'mug-' + (index + 1), chore: 'mugs', name: 'mug' })),
      slots: {
        tray: [new THREE.Vector3(1, 0, -1)],
        bin: [],
        basket: [],
      },
    } as unknown as Room;
    const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 50);
    camera.updateMatrixWorld(true);
    const interact = new InteractSystem(room, choreDefsFor(nightSpec(0)));

    expect(interact.act(camera)).toBe(true);
    expect(interact.act(camera)).toBe(true);
    items[0]!.updateMatrixWorld(true);
    expect(interact.act(camera)).toBe(true);

    expect(interact.act(camera)).toBe(false);
    expect(interact.tracker.carried?.id).toBe('mug-2');
  });
});
