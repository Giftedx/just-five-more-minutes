import * as THREE from 'three';

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

function instances(material: THREE.Material, transforms: readonly InstanceTransform[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, transforms.length);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < transforms.length; i++) {
    const transform = transforms[i]!;
    matrix.compose(
      new THREE.Vector3(...transform.position),
      new THREE.Quaternion(),
      new THREE.Vector3(...transform.scale),
    );
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function makeStoryBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for story board');

  ctx.fillStyle = '#9b6f45';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 92; i++) {
    const x = (i * 47 + 13) % canvas.width;
    const y = (i * 29 + 7) % canvas.height;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(84,49,26,0.25)' : 'rgba(232,179,111,0.18)';
    ctx.fillRect(x, y, 2 + (i % 3), 1 + (i % 2));
  }

  // School-week sheet: bold coloured blocks survive minification better than
  // fake paragraphs and tell the same story at gameplay distance.
  ctx.save();
  ctx.translate(13, 14);
  ctx.rotate(-0.025);
  ctx.fillStyle = '#e9e0c7';
  ctx.fillRect(0, 0, 76, 132);
  ctx.fillStyle = '#34313a';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('WEEK', 9, 17);
  const dayColours = ['#a7443d', '#557f62', '#3d6690', '#c18b3e', '#79537e'];
  for (let i = 0; i < dayColours.length; i++) {
    ctx.fillStyle = dayColours[i]!;
    ctx.fillRect(9, 27 + i * 19, 58 - (i % 2) * 9, 10);
    ctx.fillStyle = '#c7bca5';
    ctx.fillRect(9, 39 + i * 19, 34 + (i % 3) * 8, 3);
  }
  ctx.restore();

  // Mudwick sketch and a raid ticket form the central narrative cluster.
  ctx.save();
  ctx.translate(102, 13);
  ctx.rotate(0.035);
  ctx.fillStyle = '#d7ccb0';
  ctx.fillRect(0, 0, 78, 84);
  ctx.strokeStyle = '#554f5f';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 29, 49, 35);
  ctx.beginPath();
  ctx.moveTo(14, 29);
  ctx.lineTo(26, 17);
  ctx.lineTo(38, 29);
  ctx.lineTo(50, 15);
  ctx.lineTo(63, 29);
  ctx.stroke();
  ctx.fillStyle = '#6f496f';
  ctx.fillRect(22, 47, 9, 17);
  ctx.fillRect(47, 42, 8, 22);
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('MUDWICK', 12, 77);
  ctx.restore();

  ctx.save();
  ctx.translate(104, 111);
  ctx.rotate(-0.045);
  ctx.fillStyle = '#d5aa55';
  ctx.fillRect(0, 0, 72, 28);
  ctx.strokeStyle = '#684d2e';
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(5, 5, 62, 18);
  ctx.setLineDash([]);
  ctx.fillStyle = '#50392b';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('RAID 20:00', 10, 18);
  ctx.restore();

  // Two taped snapshots provide family/friend texture without unreadable copy.
  const photo = (x: number, y: number, sky: string, shirt: string, angle: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#eee5ce';
    ctx.fillRect(0, 0, 52, 58);
    ctx.fillStyle = sky;
    ctx.fillRect(5, 5, 42, 39);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(20, 26, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(13, 33, 16, 10);
    ctx.fillStyle = '#d8c79f';
    ctx.fillRect(17, -4, 18, 8);
    ctx.restore();
  };
  photo(190, 13, '#5b7891', '#8c4f58', 0.04);
  photo(190, 88, '#6c8154', '#4d5f82', -0.035);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeStoryBoard(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'room-story-board';
  group.position.set(-0.72, 1.55, -1.968);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.96, 0.6),
    new THREE.MeshBasicMaterial({ map: makeStoryBoardTexture() }),
  );
  face.name = 'room-story-board-face';
  face.position.z = 0.018;
  group.add(face);

  const frame = instances(lambert(0x4a2d19), [
    { position: [-0.505, 0, 0.035], scale: [0.05, 0.68, 0.055] },
    { position: [0.505, 0, 0.035], scale: [0.05, 0.68, 0.055] },
    { position: [0, -0.325, 0.035], scale: [1.06, 0.05, 0.055] },
    { position: [0, 0.325, 0.035], scale: [1.06, 0.05, 0.055] },
  ]);
  frame.name = 'room-story-board-frame';
  group.add(frame);
  return group;
}

function makeDeskDrawers(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'room-desk-drawers';
  group.position.set(0.28, 0, -1.6);

  const cabinetMaterial = lambert(0x5f3f22);
  group.add(box(0.46, 0.68, 0.58, cabinetMaterial, 0, 0.34, 0));

  const drawerMaterial = lambert(0x79502a);
  const drawerFronts = instances(drawerMaterial, [0.17, 0.36, 0.55].map((y) => ({
    position: [0, y, 0.302] as [number, number, number],
    scale: [0.39, 0.15, 0.025] as [number, number, number],
  })));
  drawerFronts.name = 'room-desk-drawer-fronts';
  group.add(drawerFronts);

  const handles = instances(lambert(0x302b29), [0.17, 0.36, 0.55].map((y) => ({
    position: [0, y, 0.324] as [number, number, number],
    scale: [0.13, 0.022, 0.026] as [number, number, number],
  })));
  handles.name = 'room-desk-drawer-handles';
  group.add(handles);
  return group;
}

function makeRadiator(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'room-radiator';
  group.position.set(2.43, 0.52, 0.4);

  const bodyMaterial = lambert(0xc2bba8);
  const body = box(0.1, 0.58, 0.88, bodyMaterial);
  body.name = 'room-radiator-panel';
  group.add(body);

  const ribs = instances(lambert(0xd7d0bd), Array.from({ length: 8 }, (_, i) => ({
    position: [-0.061, 0, -0.35 + i * 0.1] as [number, number, number],
    scale: [0.025, 0.48, 0.055] as [number, number, number],
  })));
  ribs.name = 'room-radiator-ribs';
  group.add(ribs);

  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 8), lambert(0xa9a28f));
  pipe.position.set(-0.01, -0.38, -0.47);
  group.add(pipe);
  group.add(box(0.11, 0.065, 0.08, lambert(0x8e8878), -0.04, -0.23, -0.47));
  return group;
}

function makeCoving(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'room-coving';
  const material = lambert(0x4f3524);
  const rails = [
    box(5, 0.08, 0.08, material, 0, 2.54, -1.95),
    box(5, 0.08, 0.08, material, 0, 2.54, 1.95),
    box(0.08, 0.08, 3.82, material, -2.45, 2.54, 0),
    box(0.08, 0.08, 3.82, material, 2.45, 2.54, 0),
  ];
  for (const [index, rail] of rails.entries()) {
    rail.name = `room-coving-${index + 1}`;
    group.add(rail);
  }
  return group;
}

export function makeEnvironmentDetails(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'room-environment-details';
  root.add(makeStoryBoard(), makeDeskDrawers(), makeRadiator(), makeCoving());
  return root;
}
