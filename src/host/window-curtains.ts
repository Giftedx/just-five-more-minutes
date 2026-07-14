import * as THREE from 'three';

type Side = 'left' | 'right';

const ROWS = 7;
const COLUMNS = 6;
const TOP = 2.21;
const BOTTOM = 0.79;
const PLEAT_DEPTHS = [-0.055, -0.075, -0.035, -0.075, -0.035, -0.055] as const;

interface FabricBuffers {
  positions: number[];
  colors: number[];
  indices: number[];
}

function lambert(color: number, options: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, ...options });
}

function appendPanel(side: Side, buffers: FabricBuffers): void {
  const vertexOffset = buffers.positions.length / 3;
  const topEdges = side === 'left' ? [-0.88, -0.4] : [0.4, 0.88];
  const bottomEdges = side === 'left' ? [-0.92, -0.62] : [0.62, 0.92];
  const palette = side === 'left'
    ? [0x603c7d, 0x78529a, 0x684386, 0x805ba0, 0x674185, 0x573270]
    : [0x573270, 0x704991, 0x815ca0, 0x644080, 0x765096, 0x5d3978];

  for (let row = 0; row < ROWS; row++) {
    const vertical = row / (ROWS - 1);
    const yBase = THREE.MathUtils.lerp(TOP, BOTTOM, vertical);
    const outer = THREE.MathUtils.lerp(topEdges[0]!, bottomEdges[0]!, vertical);
    const inner = THREE.MathUtils.lerp(topEdges[1]!, bottomEdges[1]!, vertical);
    for (let column = 0; column < COLUMNS; column++) {
      const horizontal = column / (COLUMNS - 1);
      const z = THREE.MathUtils.lerp(outer, inner, horizontal);
      const sag = Math.sin(Math.PI * horizontal) * Math.sin(Math.PI * vertical) * 0.014;
      buffers.positions.push(PLEAT_DEPTHS[column]!, yBase - sag, z);

      const color = new THREE.Color(row === ROWS - 1 ? 0x49295f : palette[column]!);
      buffers.colors.push(color.r, color.g, color.b);
    }
  }

  for (let row = 0; row < ROWS - 1; row++) {
    for (let column = 0; column < COLUMNS - 1; column++) {
      const a = vertexOffset + row * COLUMNS + column;
      const b = a + 1;
      const d = a + COLUMNS;
      const c = d + 1;
      buffers.indices.push(a, d, b, b, d, c);
    }
  }
}

function makeFabric(): THREE.Mesh {
  const buffers: FabricBuffers = { positions: [], colors: [], indices: [] };
  appendPanel('left', buffers);
  appendPanel('right', buffers);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setIndex(buffers.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const fabric = new THREE.Mesh(
    geometry,
    lambert(0xffffff, { vertexColors: true, side: THREE.DoubleSide }),
  );
  fabric.name = 'room-curtain-fabric';
  return fabric;
}

function exactInstanceBounds(mesh: THREE.InstancedMesh): void {
  mesh.computeBoundingBox();
  if (!mesh.boundingBox) throw new Error('Curtain hardware batch has no bounds');
  mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new THREE.Sphere());
}

function makeRings(): THREE.InstancedMesh {
  const rings = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.032, 0.007, 4, 8),
    lambert(0x9a7340),
    8,
  );
  const matrix = new THREE.Matrix4();
  const positions = [-0.82, -0.68, -0.54, -0.42, 0.42, 0.54, 0.68, 0.82];
  for (let index = 0; index < positions.length; index++) {
    matrix.makeTranslation(-0.025, 2.19, positions[index]!);
    rings.setMatrixAt(index, matrix);
  }
  rings.instanceMatrix.needsUpdate = true;
  rings.name = 'room-curtain-rings';
  exactInstanceBounds(rings);
  return rings;
}

function makeRod(): THREE.Mesh {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 1.74, 8),
    lambert(0x3e2819),
  );
  rod.name = 'room-curtain-rod';
  rod.rotation.x = Math.PI / 2;
  rod.position.set(0, 2.26, 0);
  return rod;
}

function makeFinials(): THREE.InstancedMesh {
  const finials = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.038, 0),
    lambert(0x513420),
    2,
  );
  const matrix = new THREE.Matrix4();
  matrix.makeTranslation(0, 2.26, -0.9);
  finials.setMatrixAt(0, matrix);
  matrix.makeTranslation(0, 2.26, 0.9);
  finials.setMatrixAt(1, matrix);
  finials.instanceMatrix.needsUpdate = true;
  finials.name = 'room-curtain-finials';
  exactInstanceBounds(finials);
  return finials;
}

export function makeWindowCurtains(): THREE.Group {
  const curtains = new THREE.Group();
  curtains.name = 'room-window-curtains';
  curtains.add(makeFabric(), makeRings(), makeRod(), makeFinials());
  return curtains;
}
