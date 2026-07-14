import * as THREE from 'three';

type Side = 'left' | 'right';

function lambert(color: number, options: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, ...options });
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

function named<T extends THREE.Object3D>(object: T, name: string): T {
  object.name = name;
  return object;
}

function makeButtons(material: THREE.Material): THREE.InstancedMesh {
  const buttons = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.012, 0.009), material, 12);
  const matrix = new THREE.Matrix4();
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 3; column++) {
      matrix.makeTranslation(0.028 + column * 0.027, 0.054 - row * 0.031, -0.073);
      buttons.setMatrixAt(row * 3 + column, matrix);
    }
  }
  buttons.instanceMatrix.needsUpdate = true;
  return named(buttons, 'room-phone-buttons');
}

export function makeWallPhone(): THREE.Group {
  const phone = named(new THREE.Group(), 'room-wall-phone');
  const cream = lambert(0xd8cfbb);
  const creamDark = lambert(0xa99d86);
  const dark = lambert(0x39332d);
  const button = lambert(0xb9ad98);

  phone.add(named(box(0.29, 0.36, 0.055, creamDark), 'room-phone-backplate'));
  phone.add(named(box(0.255, 0.325, 0.035, cream, 0, 0, -0.035), 'room-phone-face'));
  phone.add(named(box(0.098, 0.17, 0.025, dark, 0.055, 0, -0.057), 'room-phone-keypad'));
  phone.add(makeButtons(button));

  const handset = named(new THREE.Group(), 'room-phone-handset');
  handset.add(named(box(0.055, 0.22, 0.066, creamDark, -0.074, 0.018, -0.082), 'room-phone-handset-grip'));
  handset.add(named(box(0.102, 0.066, 0.078, cream, -0.074, 0.12, -0.084), 'room-phone-handset-top'));
  handset.add(named(box(0.102, 0.066, 0.078, cream, -0.074, -0.09, -0.084), 'room-phone-handset-bottom'));
  for (const [name, y] of [
    ['room-phone-earpiece', 0.12],
    ['room-phone-mouthpiece', -0.09],
  ] as const) {
    const detail = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.012, 8), dark);
    detail.name = name;
    detail.rotation.x = Math.PI / 2;
    detail.position.set(-0.074, y, -0.13);
    handset.add(detail);
  }
  phone.add(handset);

  phone.add(named(box(0.07, 0.024, 0.036, creamDark, -0.074, 0.126, -0.052), 'room-phone-cradle-top'));
  phone.add(named(box(0.07, 0.024, 0.036, creamDark, -0.074, -0.096, -0.052), 'room-phone-cradle-bottom'));

  const cordPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.078, -0.126, -0.12),
    new THREE.Vector3(-0.11, -0.175, -0.115),
    new THREE.Vector3(-0.055, -0.205, -0.115),
    new THREE.Vector3(-0.095, -0.245, -0.11),
    new THREE.Vector3(-0.035, -0.285, -0.105),
  ]);
  phone.add(named(new THREE.Mesh(new THREE.TubeGeometry(cordPath, 24, 0.006, 4, false), dark), 'room-phone-cord'));
  return phone;
}

function sculptedDuvetGeometry(side: Side): THREE.BufferGeometry {
  const sign = side === 'left' ? -1 : 1;
  const source = new THREE.BoxGeometry(0.28, 0.12, 0.23, 2, 1, 2).toNonIndexed();
  const position = source.getAttribute('position');
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    if (y > 0) {
      const arch = (1 - Math.abs(x) / 0.145) * (1 - Math.abs(z) / 0.12);
      position.setY(index, y + Math.max(0, arch) * 0.045 + sign * x * 0.035);
    }
  }
  position.needsUpdate = true;
  source.computeVertexNormals();
  source.computeBoundingBox();
  source.computeBoundingSphere();
  return source;
}

function sculptedFoldGeometry(side: Side): THREE.BufferGeometry {
  const sign = side === 'left' ? -1 : 1;
  const source = new THREE.BoxGeometry(0.17, 0.035, 0.18, 2, 1, 2).toNonIndexed();
  const position = source.getAttribute('position');
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    if (y > 0) {
      const crown = (1 - Math.abs(x) / 0.09) * (1 - Math.abs(z) / 0.095);
      position.setY(index, y + Math.max(0, crown) * 0.018 + sign * x * 0.025);
    }
  }
  position.needsUpdate = true;
  source.computeVertexNormals();
  source.computeBoundingBox();
  source.computeBoundingSphere();
  return source;
}

export function makeDuvetTug(side: Side): THREE.Group {
  const sign = side === 'left' ? -1 : 1;
  const tug = named(new THREE.Group(), `room-duvet-tug-${side}`);
  const body = named(new THREE.Mesh(sculptedDuvetGeometry(side), lambert(side === 'left' ? 0x765294 : 0x684381)), 'room-duvet-tug-body');
  body.rotation.y = sign * 0.08;
  tug.add(body);

  const fold = named(
    new THREE.Mesh(sculptedFoldGeometry(side), lambert(side === 'left' ? 0x9270ad : 0x84609f)),
    'room-duvet-tug-fold',
  );
  fold.position.set(sign * 0.045, 0.06, 0.025);
  fold.rotation.z = sign * 0.14;
  fold.rotation.y = -sign * 0.1;
  tug.add(fold);
  tug.add(named(box(0.23, 0.025, 0.18, lambert(0x3d2850), 0, -0.065, 0.012), 'room-duvet-tug-shadow'));
  return tug;
}

function sculptedCurtainGatherGeometry(side: Side): THREE.BufferGeometry {
  const rows = [0.25, 0.13, -0.02, -0.14, -0.25] as const;
  const halfWidths = [0.15, 0.13, 0.09, 0.115, 0.13] as const;
  const depths = [-0.058, -0.076, -0.048, -0.076, -0.058] as const;
  const palette = side === 'left'
    ? [0x603c7d, 0x78529a, 0x684386, 0x755094, 0x573270]
    : [0x573270, 0x704991, 0x79569a, 0x644080, 0x5d3978];
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row < rows.length; row++) {
    const seamInset = row === 0 ? 0.056 : row === 1 ? 0.02 : 0;
    for (let column = 0; column < depths.length; column++) {
      const horizontal = column / (depths.length - 1);
      positions.push(
        depths[column]! + seamInset,
        rows[row]!,
        THREE.MathUtils.lerp(-halfWidths[row]!, halfWidths[row]!, horizontal),
      );
      const color = new THREE.Color(row === rows.length - 1 ? 0x4d2d63 : palette[column]!);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let row = 0; row < rows.length - 1; row++) {
    for (let column = 0; column < depths.length - 1; column++) {
      const a = row * depths.length + column;
      const b = a + 1;
      const d = a + depths.length;
      const c = d + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function makePleats(material: THREE.Material): THREE.InstancedMesh {
  const pleats = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.013, 0.2, 5), material, 3);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < 3; index++) {
    matrix.makeTranslation(-0.082, 0.09, (index - 1) * 0.066);
    pleats.setMatrixAt(index, matrix);
  }
  pleats.instanceMatrix.needsUpdate = true;
  return named(pleats, 'room-curtain-tug-pleats');
}

export function makeCurtainTug(side: Side): THREE.Group {
  const sign = side === 'left' ? -1 : 1;
  const tug = named(new THREE.Group(), `room-curtain-tug-${side}`);
  const fabric = lambert(0xffffff, { vertexColors: true, side: THREE.DoubleSide });
  const highlight = lambert(side === 'left' ? 0x75518f : 0x6e4988);

  const body = new THREE.Mesh(sculptedCurtainGatherGeometry(side), fabric);
  body.name = 'room-curtain-tug-body';
  tug.add(body);
  tug.add(makePleats(highlight));

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.035, 8), lambert(0x806548));
  band.name = 'room-curtain-tug-band';
  band.scale.set(0.4, 1, 1);
  band.position.set(-0.05, -0.035, 0);
  tug.add(band);

  const tail = named(
    new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.05, 0.2, 5), highlight),
    'room-curtain-tug-tail',
  );
  tail.scale.set(0.58, 1, 0.75);
  tail.position.set(-0.052, -0.22, sign * 0.058);
  tail.rotation.x = sign * 0.18;
  tail.rotation.z = -0.05;
  tug.add(tail);
  return tug;
}
