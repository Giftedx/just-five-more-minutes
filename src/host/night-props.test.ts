import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeCurtainTug, makeDuvetTug, makeWallPhone } from './night-props';

function inspect(roots: THREE.Object3D[]): {
  meshes: number;
  triangles: number;
  textures: number;
  lights: number;
  casters: number;
  unsupportedMaterials: string[];
  interactions: number;
} {
  let meshes = 0;
  let triangles = 0;
  let lights = 0;
  let casters = 0;
  let interactions = 0;
  const textures = new Set<string>();
  const unsupportedMaterials: string[] = [];

  for (const root of roots) {
    root.traverse((object) => {
      if (object.userData.interact) interactions++;
      if (object instanceof THREE.Light) lights++;
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      if (object.castShadow) casters++;
      const multiplier = object instanceof THREE.InstancedMesh ? object.count : 1;
      const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
      triangles += Math.floor(primitives / 3) * multiplier;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshLambertMaterial) && !(material instanceof THREE.MeshBasicMaterial)) {
          unsupportedMaterials.push(material.type);
        }
        if ('map' in material && material.map instanceof THREE.Texture) textures.add(material.map.uuid);
      }
    });
  }

  return { meshes, triangles, textures: textures.size, lights, casters, unsupportedMaterials, interactions };
}

describe('night-specific household prop factories', () => {
  it('builds a readable wall phone from named procedural parts', () => {
    const phone = makeWallPhone();

    expect(phone.name).toBe('room-wall-phone');
    for (const name of [
      'room-phone-backplate',
      'room-phone-handset',
      'room-phone-keypad',
      'room-phone-buttons',
      'room-phone-cord',
    ]) {
      expect(phone.getObjectByName(name)?.name).toBe(name);
    }
    expect((phone.getObjectByName('room-phone-buttons') as THREE.InstancedMesh).count).toBe(12);
  });

  it('mirrors sculpted duvet corners without interaction metadata', () => {
    const left = makeDuvetTug('left');
    const right = makeDuvetTug('right');

    expect(left.name).toBe('room-duvet-tug-left');
    expect(right.name).toBe('room-duvet-tug-right');
    for (const [side, root] of [['left', left], ['right', right]] as const) {
      for (const name of ['room-duvet-tug-body', 'room-duvet-tug-fold', 'room-duvet-tug-shadow']) {
        expect(root.getObjectByName(name)?.name, `${side} duvet: ${name} is registered`).toBe(name);
      }
      expect(
        (root.getObjectByName('room-duvet-tug-body') as THREE.Mesh).geometry.type,
        `${side} duvet: body geometry`,
      ).not.toBe('BoxGeometry');
      expect(
        (root.getObjectByName('room-duvet-tug-fold') as THREE.Mesh).geometry.type,
        `${side} duvet: fold geometry`,
      ).not.toBe('BoxGeometry');
      expect(root.userData.interact, `${side} duvet: interaction metadata`).toBeUndefined();
    }
    expect(left.getObjectByName('room-duvet-tug-fold')?.rotation.z).toBeLessThan(0);
    expect(right.getObjectByName('room-duvet-tug-fold')?.rotation.z).toBeGreaterThan(0);
  });

  it('mirrors pleated curtain gathers and stays inside the procedural budget', () => {
    const phone = makeWallPhone();
    const duvetLeft = makeDuvetTug('left');
    const duvetRight = makeDuvetTug('right');
    const curtainLeft = makeCurtainTug('left');
    const curtainRight = makeCurtainTug('right');

    expect(curtainLeft.name).toBe('room-curtain-tug-left');
    expect(curtainRight.name).toBe('room-curtain-tug-right');
    for (const [side, root] of [['left', curtainLeft], ['right', curtainRight]] as const) {
      for (const name of [
        'room-curtain-tug-body',
        'room-curtain-tug-pleats',
        'room-curtain-tug-band',
        'room-curtain-tug-tail',
      ]) {
        expect(root.getObjectByName(name)?.name, `${side} curtain: ${name} is registered`).toBe(name);
      }
      expect(
        (root.getObjectByName('room-curtain-tug-pleats') as THREE.InstancedMesh).count,
        `${side} curtain: pleat count`,
      ).toBe(3);
      const body = root.getObjectByName('room-curtain-tug-body') as THREE.Mesh;
      const pleats = root.getObjectByName('room-curtain-tug-pleats') as THREE.InstancedMesh;
      expect(body.geometry.type, `${side} curtain: body geometry`).not.toBe('CylinderGeometry');
      expect(
        (body.material as THREE.MeshLambertMaterial).vertexColors,
        `${side} curtain: body vertex colors`,
      ).toBe(true);
      expect(body.geometry.getAttribute('color'), `${side} curtain: body color attribute`).toBeDefined();
      expect(
        new Set(Array.from(body.geometry.getAttribute('position').array)
          .filter((_, index) => index % 3 === 0)
          .map((value) => Number(value.toFixed(4)))).size,
        `${side} curtain: body contour count`,
      ).toBeGreaterThanOrEqual(3);
      const positions = body.geometry.getAttribute('position');
      const topY = Math.max(...Array.from({ length: positions.count }, (_, index) => positions.getY(index)));
      const topDepths = Array.from({ length: positions.count }, (_, index) => index)
        .filter((index) => positions.getY(index) === topY)
        .map((index) => positions.getX(index));
      expect(Math.min(...topDepths), `${side} curtain: top depth`).toBeGreaterThan(-0.03);
      expect(pleats.geometry.type, `${side} curtain: pleat geometry`).not.toBe('BoxGeometry');
      expect(
        root.getObjectByName('room-curtain-tug-band')?.position.x,
        `${side} curtain: band position`,
      ).toBeLessThan(-0.04);
      expect(
        (root.getObjectByName('room-curtain-tug-tail') as THREE.Mesh).geometry.type,
        `${side} curtain: tail geometry`,
      ).not.toBe('BoxGeometry');
      expect(root.userData.interact, `${side} curtain: interaction metadata`).toBeUndefined();
    }
    expect(curtainLeft.getObjectByName('room-curtain-tug-tail')?.rotation.x).toBeLessThan(0);
    expect(curtainRight.getObjectByName('room-curtain-tug-tail')?.rotation.x).toBeGreaterThan(0);

    const state = inspect([phone, duvetLeft, duvetRight, curtainLeft, curtainRight]);
    expect(state.meshes).toBeLessThanOrEqual(36);
    expect(state.triangles).toBeLessThanOrEqual(1500);
    expect(state.textures).toBe(0);
    expect(state.lights).toBe(0);
    expect(state.casters).toBe(0);
    expect(state.unsupportedMaterials).toEqual([]);
    expect(state.interactions).toBe(0);
  });
});
