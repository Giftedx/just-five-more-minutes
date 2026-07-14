import * as THREE from 'three';

interface InstanceTransform {
  position: [number, number, number];
  scale: [number, number, number];
  yaw?: number;
}

function lambert(color: number, vertexColors = false): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, vertexColors });
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

function instances(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: readonly InstanceTransform[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  for (let i = 0; i < transforms.length; i++) {
    const transform = transforms[i]!;
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), transform.yaw ?? 0);
    matrix.compose(
      new THREE.Vector3(...transform.position),
      quaternion,
      new THREE.Vector3(...transform.scale),
    );
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function radialTransforms(radius: number, scale: [number, number, number]): InstanceTransform[] {
  return Array.from({ length: 5 }, (_, index) => {
    const yaw = index * Math.PI * 2 / 5;
    return {
      // A Y rotation sends local +X toward (cos(yaw), 0, -sin(yaw)). Keep the
      // translated centre on that same ray so each spoke actually meets its
      // caster instead of forming a tangential pentagon.
      position: [Math.cos(yaw) * radius, 0, -Math.sin(yaw) * radius],
      scale,
      yaw,
    };
  });
}

function duvetRise(x: number, y: number): number {
  return 0.028
    + 0.022 * Math.sin((x + 0.44) * 8)
    + 0.016 * Math.cos((y + 0.57) * 6);
}

function makeDuvetGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(0.88, 1.14, 4, 5);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    positions.setZ(i, duvetRise(x, y));
    const shade = (((i * 13) % 9) - 4) * 0.008;
    new THREE.Color(0x765091).offsetHSL(0, 0, shade).toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makeDuvetDrapeGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const bottom = 0.28;
  const addQuad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
  ): void => {
    const first = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };

  for (const x of [-0.44, 0.44]) {
    for (let segment = 0; segment < 5; segment++) {
      const y0 = -0.57 + segment * (1.14 / 5);
      const y1 = -0.57 + (segment + 1) * (1.14 / 5);
      const z0 = 0.31 - y0;
      const z1 = 0.31 - y1;
      addQuad(
        [x, 0.445 + duvetRise(x, y0), z0],
        [x, bottom, z0],
        [x, bottom, z1],
        [x, 0.445 + duvetRise(x, y1), z1],
      );
    }
  }
  for (let segment = 0; segment < 4; segment++) {
    const x0 = -0.44 + segment * 0.22;
    const x1 = x0 + 0.22;
    addQuad(
      [x0, 0.445 + duvetRise(x0, -0.57), 0.88],
      [x0, bottom, 0.88],
      [x1, bottom, 0.88],
      [x1, 0.445 + duvetRise(x1, -0.57), 0.88],
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function makeDeskChair(): THREE.Group {
  const chair = new THREE.Group();
  chair.name = 'room-desk-chair';

  const upholstery = lambert(0x50515f);
  const darkMetal = lambert(0x2d2e35);

  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.245, 0.08, 8), upholstery);
  seat.name = 'room-chair-seat';
  seat.position.y = 0.46;
  seat.scale.z = 0.82;
  chair.add(seat);

  const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.22, 3, 8), upholstery);
  back.name = 'room-chair-back';
  back.position.set(0, 0.77, 0.2);
  back.scale.set(1.08, 1, 0.18);
  chair.add(back);

  const stitchMat = lambert(0x2f3038);
  const seatStitch = box(0.36, 0.012, 0.018, stitchMat, 0, 0.507, -0.105);
  seatStitch.name = 'room-chair-seat-stitch';
  chair.add(seatStitch);

  const backStitch = box(0.25, 0.012, 0.018, stitchMat, 0, 0.83, 0.235);
  backStitch.name = 'room-chair-back-stitch';
  chair.add(backStitch);

  const backHandle = instances(new THREE.BoxGeometry(1, 1, 1), darkMetal, [
    { position: [0, 0.59, 0.17], scale: [0.055, 0.34, 0.055] },
    { position: [0, 0.92, 0.24], scale: [0.18, 0.035, 0.018] },
  ]);
  backHandle.name = 'room-chair-back-handle';
  chair.add(backHandle);

  const base = new THREE.Group();
  base.name = 'room-chair-base';
  const lift = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 8), darkMetal);
  lift.position.y = 0.27;
  base.add(lift);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.07, 8), darkMetal);
  hub.position.y = 0.105;
  base.add(hub);

  const spokes = radialTransforms(0.13, [0.24, 0.025, 0.035]);
  for (const spoke of spokes) spoke.position[1] = 0.075;
  base.add(instances(new THREE.BoxGeometry(1, 1, 1), darkMetal, spokes));

  const casters = radialTransforms(0.25, [0.82, 0.52, 0.52]);
  for (const caster of casters) caster.position[1] = 0.045;
  base.add(instances(new THREE.IcosahedronGeometry(0.055, 0), darkMetal, casters));
  chair.add(base);

  return chair;
}

export function makeBed(): THREE.Group {
  const bed = new THREE.Group();
  bed.name = 'room-bed';

  const wood = lambert(0x5c421f);
  const frame = new THREE.Group();
  frame.name = 'room-bed-frame';
  const frameMembers = instances(new THREE.BoxGeometry(1, 1, 1), wood, [
    { position: [-0.445, 0.22, 0], scale: [0.08, 0.24, 1.92] },
    { position: [0.445, 0.22, 0], scale: [0.08, 0.24, 1.92] },
    { position: [0, 0.22, -0.96], scale: [0.95, 0.24, 0.08] },
    { position: [0, 0.22, 0.96], scale: [0.95, 0.24, 0.08] },
    { position: [-0.41, 0.09, -0.92], scale: [0.08, 0.18, 0.08] },
    { position: [0.41, 0.09, -0.92], scale: [0.08, 0.18, 0.08] },
    { position: [-0.41, 0.09, 0.92], scale: [0.08, 0.18, 0.08] },
    { position: [0.41, 0.09, 0.92], scale: [0.08, 0.18, 0.08] },
  ]);
  frame.add(frameMembers);
  bed.add(frame);

  const mattress = box(0.86, 0.16, 1.82, lambert(0xcab694), 0, 0.34, 0);
  mattress.name = 'room-bed-mattress';
  bed.add(mattress);

  const headboard = box(0.95, 0.56, 0.07, wood, 0, 0.5, -0.99);
  headboard.name = 'room-bed-headboard';
  bed.add(headboard);

  const headboardLip = box(0.98, 0.055, 0.085, wood, 0, 0.79, -1.0);
  headboardLip.name = 'room-bed-headboard-lip';
  bed.add(headboardLip);

  const duvet = new THREE.Mesh(makeDuvetGeometry(), lambert(0xffffff, true));
  duvet.name = 'room-bed-duvet';
  duvet.position.set(0, 0.445, 0.31);
  duvet.rotation.x = -Math.PI / 2;
  bed.add(duvet);

  const footThrow = box(0.82, 0.045, 0.18, lambert(0x5a3a72), 0, 0.505, 0.83);
  footThrow.name = 'room-bed-foot-throw';
  bed.add(footThrow);

  const drapeMaterial = lambert(0x68447f);
  drapeMaterial.side = THREE.DoubleSide;
  bed.add(new THREE.Mesh(makeDuvetDrapeGeometry(), drapeMaterial));

  const pillowMaterial = lambert(0xe8e2d4);
  pillowMaterial.flatShading = true;
  const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6), pillowMaterial);
  pillow.name = 'room-bed-pillow';
  pillow.position.set(0, 0.47, -0.66);
  pillow.rotation.y = -0.08;
  pillow.scale.set(0.72, 0.12, 0.34);
  bed.add(pillow);

  const pillowSeam = box(0.58, 0.012, 0.018, lambert(0xcfc6b6), 0, 0.54, -0.52);
  pillowSeam.name = 'room-bed-pillow-seam';
  pillowSeam.rotation.y = -0.08;
  bed.add(pillowSeam);

  return bed;
}
