import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

interface InstanceTransform {
  position: [number, number, number];
  scale: [number, number, number];
}

function lambert(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function paintGeometry(geometry: THREE.BufferGeometry, colorHex: number): THREE.BufferGeometry {
  const color = new THREE.Color(colorHex);
  const position = geometry.getAttribute('position');
  if (!position) throw new Error('Cannot paint geometry without positions');
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index++) {
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function batchedMarker(name: string, y: number): THREE.Group {
  const marker = new THREE.Group();
  marker.name = name;
  marker.position.y = y;
  marker.userData.batchedInto = 'room-chore-bin-mouth';
  return marker;
}

function instances(material: THREE.Material, transforms: readonly InstanceTransform[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, transforms.length);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < transforms.length; index++) {
    const transform = transforms[index]!;
    matrix.compose(
      new THREE.Vector3(...transform.position),
      new THREE.Quaternion(),
      new THREE.Vector3(...transform.scale),
    );
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  if (mesh.boundingBox) {
    // Three's default sphere scales the unit cube by each instance's longest
    // axis, badly inflating bounds for thin rails and defeating frustum culling.
    mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new THREE.Sphere());
  }
  return mesh;
}

export function makeChoreTray(): THREE.Group {
  const tray = new THREE.Group();
  tray.name = 'room-chore-tray';

  const bed = box(0.56, 0.025, 0.36, lambert(0x8d6238), 0, 0.0125, 0);
  bed.name = 'room-chore-tray-bed';
  tray.add(bed);

  const inset = box(0.46, 0.012, 0.26, lambert(0x4d3320), 0, 0.031, 0);
  inset.name = 'room-chore-tray-inset';
  tray.add(inset);

  const rim = instances(lambert(0xb28757), [
    { position: [-0.265, 0.055, 0], scale: [0.03, 0.07, 0.36] },
    { position: [0.265, 0.055, 0], scale: [0.03, 0.07, 0.36] },
    { position: [0, 0.055, -0.165], scale: [0.5, 0.07, 0.03] },
    { position: [0, 0.055, 0.165], scale: [0.5, 0.07, 0.03] },
  ]);
  rim.name = 'room-chore-tray-rim';
  tray.add(rim);
  return tray;
}

export function makeChoreBin(): THREE.Group {
  const bin = new THREE.Group();
  bin.name = 'room-chore-bin';

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.13, 0.34, 12, 1, true),
    lambert(0x68767c),
  );
  shell.name = 'room-chore-bin-shell';
  shell.material.side = THREE.DoubleSide;
  shell.position.y = 0.17;
  bin.add(shell);

  const interiorGeometry = paintGeometry(
    new THREE.CircleGeometry(0.125, 12).rotateX(-Math.PI / 2).translate(0, 0.315, 0),
    0x202529,
  );
  const rimGeometry = paintGeometry(
    new THREE.TorusGeometry(0.15, 0.012, 6, 12).rotateX(Math.PI / 2).translate(0, 0.335, 0),
    0x8a979a,
  );
  const mouthGeometry = mergeGeometries([interiorGeometry, rimGeometry], false);
  if (!mouthGeometry) throw new Error('Could not batch chore bin mouth');
  const mouth = new THREE.Mesh(mouthGeometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mouth.name = 'room-chore-bin-mouth';
  bin.add(mouth, batchedMarker('room-chore-bin-interior', 0.315), batchedMarker('room-chore-bin-rim', 0.335));
  return bin;
}

export function makeLaundryBasket(): THREE.Group {
  const basket = new THREE.Group();
  basket.name = 'room-chore-basket';

  const base = box(0.46, 0.035, 0.46, lambert(0x725034), 0, 0.0175, 0);
  base.name = 'room-chore-basket-base';
  basket.add(base);

  const slats: InstanceTransform[] = [];
  for (const offset of [-0.15, 0, 0.15]) {
    slats.push(
      { position: [offset, 0.17, -0.235], scale: [0.055, 0.29, 0.025] },
      { position: [offset, 0.17, 0.235], scale: [0.055, 0.29, 0.025] },
      { position: [-0.235, 0.17, offset], scale: [0.025, 0.29, 0.055] },
      { position: [0.235, 0.17, offset], scale: [0.025, 0.29, 0.055] },
    );
  }
  const slatMesh = instances(lambert(0xb28a55), slats);
  slatMesh.name = 'room-chore-basket-slats';
  basket.add(slatMesh);

  const rim = instances(lambert(0x8e673c), [
    { position: [-0.235, 0.33, 0], scale: [0.055, 0.055, 0.5] },
    { position: [0.235, 0.33, 0], scale: [0.055, 0.055, 0.5] },
    { position: [0, 0.33, -0.235], scale: [0.5, 0.055, 0.055] },
    { position: [0, 0.33, 0.235], scale: [0.5, 0.055, 0.055] },
  ]);
  rim.name = 'room-chore-basket-rim';
  basket.add(rim);
  return basket;
}
