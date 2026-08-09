import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeWindowCurtains } from './window-curtains';

function sphereDelta(mesh: THREE.InstancedMesh, batchName: string): { center: number; radius: number } {
  mesh.computeBoundingBox();
  expect(mesh.boundingBox, `${batchName}: bounding box`).not.toBeNull();
  expect(mesh.boundingSphere, `${batchName}: bounding sphere`).not.toBeNull();
  const expected = mesh.boundingBox!.getBoundingSphere(new THREE.Sphere());
  return {
    center: mesh.boundingSphere!.center.distanceTo(expected.center),
    radius: Math.abs(mesh.boundingSphere!.radius - expected.radius),
  };
}

describe('window curtain factory', () => {
  it('builds one bounded four-call dressing with exact hardware batches', () => {
    const root = makeWindowCurtains();
    const fabric = root.getObjectByName('room-curtain-fabric') as THREE.Mesh;
    const rings = root.getObjectByName('room-curtain-rings') as THREE.InstancedMesh;
    const rod = root.getObjectByName('room-curtain-rod') as THREE.Mesh;
    const finials = root.getObjectByName('room-curtain-finials') as THREE.InstancedMesh;

    expect(root.name).toBe('room-window-curtains');
    expect([fabric?.name, rings?.name, rod?.name, finials?.name]).toEqual([
      'room-curtain-fabric',
      'room-curtain-rings',
      'room-curtain-rod',
      'room-curtain-finials',
    ]);
    expect(rings.count).toBe(8);
    expect(finials.count).toBe(2);
    expect(rod.position.toArray()).toEqual([0, 2.26, 0]);
    expect(rod.rotation.x).toBeCloseTo(Math.PI / 2, 12);

    let meshes = 0;
    let drawCalls = 0;
    let hardwareInstances = 0;
    let triangles = 0;
    let textures = 0;
    let lights = 0;
    let casters = 0;
    let interactions = 0;
    const unsupportedMaterials: string[] = [];
    root.traverse((object) => {
      if (object instanceof THREE.Light) lights++;
      if (object.userData.interact) interactions++;
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      if (object.castShadow) casters++;
      expect(Array.isArray(object.material)).toBe(false);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      drawCalls += materials.length;
      const multiplier = object instanceof THREE.InstancedMesh ? object.count : 1;
      if (object instanceof THREE.InstancedMesh) hardwareInstances += object.count;
      const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
      triangles += Math.floor(primitives / 3) * multiplier;
      for (const material of materials) {
        if (!(material instanceof THREE.MeshLambertMaterial)) unsupportedMaterials.push(material.type);
        if ('map' in material && material.map instanceof THREE.Texture) textures++;
      }
    });

    expect(meshes).toBe(4);
    expect(drawCalls).toBe(4);
    expect(hardwareInstances).toBe(10);
    expect(triangles).toBeLessThanOrEqual(1000);
    expect(textures).toBe(0);
    expect(lights).toBe(0);
    expect(casters).toBe(0);
    expect(interactions).toBe(0);
    expect(unsupportedMaterials).toEqual([]);

    for (const [batchName, batch] of [['rings', rings], ['finials', finials]] as const) {
      const delta = sphereDelta(batch, batchName);
      expect(delta.center, `${batchName}: bounding sphere center`).toBeLessThanOrEqual(1e-9);
      expect(delta.radius, `${batchName}: bounding sphere radius`).toBeLessThanOrEqual(1e-9);
    }
  });

  it('sculpts mirrored pleated fabric that tapers away from the glass', () => {
    const fabric = makeWindowCurtains().getObjectByName('room-curtain-fabric') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
    const position = fabric.geometry.getAttribute('position');
    const colors = fabric.geometry.getAttribute('color');
    fabric.geometry.computeBoundingBox();
    const bounds = fabric.geometry.boundingBox!;
    const depths = new Set<number>();
    const topLeft: number[] = [];
    const topRight: number[] = [];
    const bottomLeft: number[] = [];
    const bottomRight: number[] = [];

    for (let index = 0; index < position.count; index++) {
      const x = Number(position.getX(index).toFixed(4));
      const y = position.getY(index);
      const z = position.getZ(index);
      depths.add(x);
      if (Math.abs(y - 2.21) <= 1e-6) (z < 0 ? topLeft : topRight).push(z);
      if (Math.abs(y - 0.79) <= 1e-6) (z < 0 ? bottomLeft : bottomRight).push(z);
    }

    expect(fabric.material.vertexColors).toBe(true);
    expect(fabric.material.side).toBe(THREE.DoubleSide);
    expect(colors).toBeDefined();
    expect(depths.size).toBeGreaterThanOrEqual(3);
    expect(bounds.min.y).toBeCloseTo(0.79, 6);
    expect(bounds.max.y).toBeCloseTo(2.21, 6);
    expect(bounds.min.z).toBeCloseTo(-0.92, 6);
    expect(bounds.max.z).toBeCloseTo(0.92, 6);
    expect(Math.max(...topLeft)).toBeCloseTo(-0.4, 6);
    expect(Math.min(...topRight)).toBeCloseTo(0.4, 6);
    expect(Math.max(...bottomLeft)).toBeCloseTo(-0.62, 6);
    expect(Math.min(...bottomRight)).toBeCloseTo(0.62, 6);
  });
});
