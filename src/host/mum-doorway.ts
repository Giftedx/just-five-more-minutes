import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface MumDoorway {
  root: THREE.Group;
  character: THREE.Group;
  tick: (nowMs: number) => void;
  setRevealed: (on: boolean) => void;
}

const SKIN = 0xe2b491;
const SKIN_SHADOW = 0xc98f72;
const CARDIGAN = 0xa86878;
const CARDIGAN_DARK = 0x814759;
const CARDIGAN_LIGHT = 0xc37f8b;
const BLOUSE = 0xefe6d4;
const SKIRT = 0x35405d;
const SKIRT_HEM = 0x252d44;
const HAIR = 0x6d5245;
const HAIR_LIGHT = 0x806357;
const TIGHTS = 0x403941;
const GOLD = 0xc99b38;
const TOWEL = 0xe9e1cd;
const TOWEL_SHADOW = 0xd2c8b2;
const TOWEL_STRIPE = 0x98443b;

const lambert = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color });

const metal = (color: number): THREE.MeshPhongMaterial => new THREE.MeshPhongMaterial({
  color,
  specular: 0x6f4c24,
  shininess: 32,
});

function named<T extends THREE.Object3D>(object: T, name: string): T {
  object.name = name;
  return object;
}

function box(
  size: [number, number, number],
  material: THREE.Material,
  position: [number, number, number],
  name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  if (name) mesh.name = name;
  return mesh;
}

function ellipsoid(
  radius: number,
  segments: [number, number],
  scale: [number, number, number],
  material: THREE.Material,
  position: [number, number, number],
  name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, ...segments), material);
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  if (name) mesh.name = name;
  return mesh;
}

function limbBetween(
  name: string,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const delta = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.92, delta.length(), 8),
    material,
  );
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

function batchStaticMeshes(
  root: THREE.Object3D,
  batchName: string,
  protectedRoots: THREE.Object3D[] = [],
): void {
  root.updateWorldMatrix(true, true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const batches = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
  const meshes: THREE.Mesh[] = [];
  const removedNames = new Map<string, THREE.Matrix4>();
  const isProtected = (object: THREE.Object3D): boolean => {
    for (let cursor: THREE.Object3D | null = object; cursor; cursor = cursor.parent) {
      if (protectedRoots.includes(cursor)) return true;
      if (cursor === root) return false;
    }
    return false;
  };

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || isProtected(object) || Array.isArray(object.material)) return;
    object.updateWorldMatrix(true, false);
    const relative = inverseRoot.clone().multiply(object.matrixWorld);
    const key = object.material.uuid;
    let batch = batches.get(key);
    if (!batch) {
      batch = { material: object.material, geometries: [] };
      batches.set(key, batch);
    }
    batch.geometries.push(object.geometry.clone().applyMatrix4(relative));
    meshes.push(object);
    if (object.name) removedNames.set(object.name, relative.clone());
  });

  for (const mesh of meshes) mesh.removeFromParent();
  let index = 0;
  for (const { material, geometries } of batches.values()) {
    const geometry = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries, false);
    if (!geometry) throw new Error(`Could not batch ${batchName}`);
    root.add(named(new THREE.Mesh(geometry, material), `${batchName}-${index++}`));
  }
  for (const [name, relative] of removedNames) {
    if (root.getObjectByName(name)) continue;
    const marker = named(new THREE.Group(), name);
    marker.applyMatrix4(relative);
    root.add(marker);
  }
}

function makeExpressionTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for Mum expression');
  ctx.scale(1.5, 1.5);

  ctx.lineCap = 'round';
  ctx.strokeStyle = '#684c40';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(25, 48);
  ctx.quadraticCurveTo(38, 43, 50, 46);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(77, 40);
  ctx.quadraticCurveTo(91, 40, 103, 48);
  ctx.stroke();

  ctx.fillStyle = '#f1dfcb';
  ctx.beginPath();
  ctx.ellipse(39, 63, 9, 5.5, -0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(89, 63, 9, 5.5, 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#352821';
  for (const x of [39, 89]) {
    ctx.beginPath();
    ctx.arc(x, 63, 4.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f8ead8';
  ctx.beginPath();
  ctx.arc(40.5, 61.5, 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(90.5, 61.5, 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(104,76,64,0.72)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(27, 58);
  ctx.lineTo(50, 57);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(78, 56);
  ctx.lineTo(101, 59);
  ctx.stroke();

  ctx.strokeStyle = '#ba806a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(64, 67);
  ctx.quadraticCurveTo(60, 78, 67, 82);
  ctx.stroke();
  ctx.fillStyle = 'rgba(104,76,64,0.7)';
  for (const x of [60, 68]) {
    ctx.beginPath();
    ctx.arc(x, 82, 1.25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(205,101,95,0.23)';
  ctx.beginPath();
  ctx.ellipse(35, 84, 12, 7, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(94, 84, 12, 7, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#8f4f4d';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(51, 98);
  ctx.quadraticCurveTo(64, 96, 78, 98);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(143,79,77,0.76)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(47, 99);
  ctx.lineTo(51, 98);
  ctx.moveTo(78, 98);
  ctx.lineTo(82, 99);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(104,76,64,0.26)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(55, 107);
  ctx.quadraticCurveTo(64, 110, 73, 107);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function makeFootwear(materials: { slipper: THREE.Material; sole: THREE.Material; trim: THREE.Material }): THREE.Group {
  const footwear = named(new THREE.Group(), 'mum-footwear');
  for (const x of [-0.075, 0.075]) {
    const shoe = ellipsoid(0.08, [10, 7], [0.9, 0.44, 1.3], materials.slipper, [x, 0.055, 0.02]);
    shoe.rotation.x = -0.08;
    footwear.add(shoe);
    footwear.add(box([0.13, 0.018, 0.19], materials.sole, [x, 0.022, 0.028]));
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.007, 5, 10, Math.PI), materials.trim);
    trim.position.set(x, 0.077, 0.08);
    trim.rotation.x = Math.PI / 2;
    footwear.add(trim);
  }
  return footwear;
}

function makeCharacter(): { character: THREE.Group; head: THREE.Group; towel: THREE.Group } {
  const character = named(new THREE.Group(), 'mum-character');
  const skin = lambert(SKIN);
  const skinShadow = lambert(SKIN_SHADOW);
  const cardigan = lambert(CARDIGAN);
  const cardiganDark = lambert(CARDIGAN_DARK);
  const cardiganLight = lambert(CARDIGAN_LIGHT);
  const blouse = lambert(BLOUSE);
  const skirtMaterial = lambert(SKIRT);
  const skirtHem = lambert(SKIRT_HEM);
  const hair = lambert(HAIR);
  const hairLight = lambert(HAIR_LIGHT);
  const tights = lambert(TIGHTS);
  const gold = metal(GOLD);
  const towelMaterial = lambert(TOWEL);
  const towelShadow = lambert(TOWEL_SHADOW);
  const towelStripe = lambert(TOWEL_STRIPE);

  character.add(makeFootwear({ slipper: cardiganLight, sole: cardiganDark, trim: blouse }));
  for (const x of [-0.075, 0.075]) {
    const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.18, 8), tights);
    ankle.position.set(x, 0.17, 0);
    character.add(ankle);
  }

  const skirt = named(
    new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.23, 0.56, 12), skirtMaterial),
    'mum-skirt',
  );
  skirt.position.y = 0.51;
  skirt.scale.z = 0.72;
  character.add(skirt);
  character.add(box([0.31, 0.045, 0.18], skirtHem, [0, 0.79, 0], 'mum-skirt-waist'));
  character.add(box([0.39, 0.03, 0.19], skirtHem, [0, 0.245, 0.005], 'mum-skirt-hem'));

  const torso = named(
    new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.17, 0.39, 10), cardigan),
    'mum-torso',
  );
  torso.position.y = 1.005;
  torso.scale.z = 0.62;
  character.add(torso);
  character.add(box([0.065, 0.28, 0.025], blouse, [0, 1.025, 0.13], 'mum-blouse'));
  const lapelLeft = box([0.047, 0.25, 0.025], cardiganLight, [-0.047, 1.05, 0.139], 'mum-lapel-left');
  lapelLeft.rotation.z = -0.18;
  const lapelRight = box([0.047, 0.25, 0.025], cardiganLight, [0.047, 1.05, 0.139], 'mum-lapel-right');
  lapelRight.rotation.z = 0.18;
  character.add(lapelLeft, lapelRight);
  character.add(box([0.3, 0.035, 0.17], cardiganDark, [0, 0.82, 0.005], 'mum-cardigan-hem'));
  const neckline = named(
    new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.007, 4, 12, Math.PI), cardiganDark),
    'mum-cardigan-neckline',
  );
  neckline.position.set(0, 1.155, 0.137);
  neckline.rotation.z = Math.PI;
  character.add(neckline);
  const ribbing = named(new THREE.Group(), 'mum-cardigan-ribbing');
  ribbing.position.set(0, 0.815, 0.093);
  for (const y of [-0.01, 0, 0.01]) {
    ribbing.add(box([0.28, 0.006, 0.01], cardiganDark, [0, y, 0]));
  }
  character.add(ribbing);
  for (const y of [1.09, 1.01, 0.93]) {
    character.add(ellipsoid(0.012, [7, 5], [1, 1, 0.55], cardiganDark, [0, y, 0.153]));
  }
  character.add(ellipsoid(0.068, [9, 6], [1, 0.62, 0.7], cardigan, [-0.178, 1.125, 0]));
  character.add(ellipsoid(0.068, [9, 6], [1, 0.62, 0.7], cardigan, [0.178, 1.125, 0]));
  const seamLeft = named(
    new THREE.Mesh(new THREE.TorusGeometry(0.059, 0.006, 4, 10, Math.PI), cardiganDark),
    'mum-armhole-seam-left',
  );
  seamLeft.position.set(-0.178, 1.125, 0.04);
  seamLeft.rotation.z = -0.38;
  const seamRight = named(
    new THREE.Mesh(new THREE.TorusGeometry(0.059, 0.006, 4, 10, Math.PI), cardiganDark),
    'mum-armhole-seam-right',
  );
  seamRight.position.set(0.178, 1.125, 0.04);
  seamRight.rotation.z = 0.38;
  character.add(seamLeft, seamRight);

  const shoulderLeft = new THREE.Vector3(-0.18, 1.12, 0);
  const elbowLeft = new THREE.Vector3(-0.225, 0.98, 0.07);
  const shoulderRight = new THREE.Vector3(0.18, 1.12, 0);
  const elbowRight = new THREE.Vector3(0.225, 0.98, 0.06);
  const handLeft = new THREE.Vector3(0.105, 0.91, 0.16);
  const handRight = new THREE.Vector3(-0.11, 0.88, 0.18);
  character.add(limbBetween('mum-upper-arm-left', shoulderLeft, elbowLeft, 0.057, cardiganDark));
  character.add(limbBetween('mum-upper-arm-right', shoulderRight, elbowRight, 0.057, cardiganDark));
  character.add(limbBetween('mum-forearm-left', elbowLeft, handLeft, 0.052, cardiganDark));
  character.add(limbBetween('mum-forearm-right', elbowRight, handRight, 0.052, cardiganLight));
  character.add(ellipsoid(0.045, [8, 6], [1.08, 0.78, 0.95], skin, [0.105, 0.91, 0.16], 'mum-hand-left'));
  character.add(ellipsoid(0.045, [8, 6], [1.08, 0.78, 0.95], skin, [-0.11, 0.88, 0.18], 'mum-hand-right'));
  character.add(ellipsoid(0.019, [7, 5], [0.7, 1.05, 0.7], skinShadow, [0.082, 0.932, 0.192], 'mum-thumb-left'));
  character.add(ellipsoid(0.019, [7, 5], [0.7, 1.05, 0.7], skinShadow, [-0.086, 0.902, 0.205], 'mum-thumb-right'));
  character.add(box([0.07, 0.035, 0.075], cardiganLight, [0.086, 0.92, 0.145], 'mum-cuff-left'));
  character.add(box([0.07, 0.035, 0.075], cardiganDark, [-0.09, 0.89, 0.168], 'mum-cuff-right'));
  const necklace = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.0025, 4, 12, Math.PI), gold);
  necklace.position.set(0, 1.115, 0.157);
  necklace.rotation.z = Math.PI;
  character.add(necklace);
  character.add(ellipsoid(0.008, [7, 5], [0.82, 1, 0.65], gold, [0, 1.078, 0.163], 'mum-locket'));

  const towel = named(new THREE.Group(), 'mum-tea-towel');
  towel.add(box([0.105, 0.19, 0.022], towelMaterial, [-0.055, 0.79, 0.213]));
  towel.add(box([0.095, 0.13, 0.025], towelShadow, [-0.014, 0.665, 0.216]));
  towel.add(box([0.108, 0.024, 0.027], towelStripe, [-0.055, 0.735, 0.216]));
  towel.add(box([0.098, 0.021, 0.029], towelStripe, [-0.024, 0.62, 0.219]));
  towel.add(box([0.102, 0.018, 0.03], towelShadow, [-0.024, 0.602, 0.22], 'mum-towel-hem'));
  const fold = box([0.018, 0.18, 0.012], towelShadow, [-0.006, 0.73, 0.231], 'mum-towel-fold');
  fold.rotation.z = -0.06;
  towel.add(fold);
  towel.add(box([0.012, 0.18, 0.028], towelStripe, [-0.103, 0.785, 0.216], 'mum-towel-binding'));
  towel.rotation.z = 0.045;
  character.add(towel);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 10), skinShadow);
  neck.position.y = 1.245;
  character.add(neck);
  character.add(box([0.08, 0.055, 0.025], blouse, [0, 1.215, 0.08], 'mum-blouse-collar'));

  const head = named(new THREE.Group(), 'mum-head');
  head.position.y = 1.395;
  const headShape = ellipsoid(0.12, [10, 7], [1, 1.08, 0.9], skin, [0, 0, 0], 'mum-head-shape');
  head.add(headShape);
  head.add(ellipsoid(0.026, [8, 6], [0.75, 1, 0.65], skinShadow, [-0.121, -0.005, 0], 'mum-ear-left'));
  head.add(ellipsoid(0.026, [8, 6], [0.75, 1, 0.65], skinShadow, [0.121, -0.005, 0], 'mum-ear-right'));
  const expression = new THREE.Mesh(
    new THREE.PlaneGeometry(0.19, 0.18),
    new THREE.MeshBasicMaterial({ map: makeExpressionTexture(), transparent: true, depthWrite: false }),
  );
  expression.name = 'mum-expression';
  expression.position.set(0, -0.006, 0.116);
  head.add(expression);

  const backHair = ellipsoid(0.125, [12, 8], [1.02, 1.08, 0.72], hair, [0, 0.005, -0.045], 'mum-hair-back');
  head.add(backHair);
  const cap = named(
    new THREE.Mesh(new THREE.SphereGeometry(0.127, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.48), hairLight),
    'mum-hair-cap',
  );
  cap.scale.set(1.02, 1.04, 0.93);
  cap.position.set(0, 0.008, 0.002);
  head.add(cap);
  head.add(ellipsoid(0.035, [8, 6], [0.58, 1.55, 0.75], hair, [-0.105, 0.005, 0.002], 'mum-hair-side-left'));
  head.add(ellipsoid(0.035, [8, 6], [0.58, 1.55, 0.75], hair, [0.105, 0.005, 0.002], 'mum-hair-side-right'));
  const fringe = box([0.12, 0.03, 0.025], hairLight, [-0.02, 0.085, 0.101], 'mum-hair-fringe');
  fringe.rotation.z = -0.13;
  head.add(fringe);
  const hairPart = box([0.008, 0.07, 0.01], hair, [-0.018, 0.105, 0.108], 'mum-hair-part');
  hairPart.rotation.z = -0.2;
  head.add(hairPart);
  head.add(ellipsoid(0.058, [10, 7], [1, 1, 0.88], hair, [0, 0.075, -0.125], 'mum-hair-bun'));
  const bunPin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.085, 6), gold);
  bunPin.position.set(0.035, 0.092, -0.165);
  bunPin.rotation.z = Math.PI / 2.4;
  head.add(bunPin);
  head.add(ellipsoid(0.011, [7, 5], [0.8, 1, 0.55], gold, [-0.128, -0.035, 0.012], 'mum-stud-left'));
  head.add(ellipsoid(0.011, [7, 5], [0.8, 1, 0.55], gold, [0.128, -0.035, 0.012], 'mum-stud-right'));
  character.add(head);

  batchStaticMeshes(head, 'mum-head-batch', [expression]);
  batchStaticMeshes(towel, 'mum-towel-batch');
  batchStaticMeshes(character, 'mum-body-batch', [head, towel]);
  character.position.z = 0.43;
  character.rotation.y = Math.PI;
  return { character, head, towel };
}

function makeHallDressing(): THREE.Group {
  const hall = named(new THREE.Group(), 'mum-hall-dressing');
  const runnerMaterial = lambert(0x6f3440);
  const runnerStripe = lambert(0xb28a4e);
  const wood = lambert(0x7a512d);
  const trim = lambert(0xd8c9ad);
  const paper = lambert(0xd8c9ac);
  const brass = metal(0x6c4822);

  const runner = named(new THREE.Group(), 'mum-hall-runner');
  const runnerBase = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.95), runnerMaterial);
  runnerBase.rotation.x = -Math.PI / 2;
  runnerBase.position.set(0, 0.009, 0.08);
  runner.add(runnerBase);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.88), runnerStripe);
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(0, 0.011, 0.08);
  runner.add(stripe);
  hall.add(runner);

  hall.add(box([0.84, 0.025, 0.1], wood, [0, 0.016, -0.49], 'mum-hall-threshold'));
  const skirting = named(new THREE.Group(), 'mum-hall-skirting');
  skirting.add(box([0.06, 0.09, 0.92], trim, [-0.43, 0.045, 0.04]));
  skirting.add(box([0.06, 0.09, 0.92], trim, [0.43, 0.045, 0.04]));
  hall.add(skirting);

  const portrait = named(new THREE.Group(), 'mum-family-portrait');
  portrait.position.set(-0.29, 1.36, 0.456);
  portrait.add(named(new THREE.Group(), 'mum-hall-domestic-detail'));
  portrait.add(box([0.2, 0.26, 0.018], brass, [0, 0, 0.02]));
  portrait.add(box([0.158, 0.216, 0.009], paper, [0, 0, 0.008]));
  portrait.add(box([0.125, 0.17, 0.006], lambert(0x3b302b), [0, 0, 0]));
  const portraitNavy = lambert(0x3f5067);
  const family = [
    { x: -0.032, y: 0.035, radius: 0.016, material: runnerMaterial },
    { x: 0, y: 0.015, radius: 0.014, material: portraitNavy },
    { x: 0.032, y: 0.03, radius: 0.012, material: wood },
  ];
  for (const member of family) {
    portrait.add(ellipsoid(
      member.radius,
      [7, 5],
      [0.9, 1.05, 0.62],
      paper,
      [member.x, member.y, -0.008],
    ));
    portrait.add(box(
      [member.radius * 2.5, member.radius * 1.7, 0.006],
      member.material,
      [member.x, member.y - 0.035, -0.006],
    ));
  }
  hall.add(portrait);

  const practical = named(new THREE.Group(), 'mum-hall-practical');
  practical.position.set(0.26, 1.82, 0.445);
  practical.add(ellipsoid(0.04, [8, 6], [0.7, 1, 0.22], wood, [0, 0, 0]));
  practical.add(limbBetween(
    'mum-sconce-arm',
    new THREE.Vector3(0, -0.018, -0.018),
    new THREE.Vector3(0, -0.105, -0.13),
    0.012,
    brass,
  ));
  const socket = named(
    new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.055, 10), brass),
    'mum-sconce-socket',
  );
  socket.position.set(0, -0.14, -0.14);
  practical.add(socket);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.132, 0.145, 12, 1, true), paper);
  shade.position.set(0, -0.22, -0.14);
  practical.add(shade);
  const rim = named(new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.007, 5, 14), brass), 'mum-sconce-rim');
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, -0.292, -0.14);
  practical.add(rim);
  const bulb = ellipsoid(
    0.038,
    [9, 6],
    [0.8, 1.05, 0.8],
    new THREE.MeshBasicMaterial({ color: 0xffd5a0 }),
    [0, -0.305, -0.14],
  );
  practical.add(bulb);
  hall.add(practical);

  const contact = new THREE.Mesh(
    new THREE.CircleGeometry(0.19, 20),
    new THREE.MeshBasicMaterial({ color: 0x1b0d09, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  contact.name = 'mum-contact-cue';
  contact.rotation.x = -Math.PI / 2;
  contact.scale.y = 0.62;
  contact.position.set(0, 0.013, 0.43);
  hall.add(contact);
  batchStaticMeshes(hall, 'mum-hall-batch');
  return hall;
}

export function makeMumDoorway(): MumDoorway {
  const root = named(new THREE.Group(), 'room-mum-doorway');
  const { character, head, towel } = makeCharacter();
  root.add(makeHallDressing(), character);

  const practicalLight = new THREE.PointLight(0xffc487, 1.55, 2.2, 1.8);
  practicalLight.name = 'mum-hall-practical-light';
  practicalLight.position.set(0.26, 1.68, 0.28);
  root.add(practicalLight);
  const fillLight = new THREE.PointLight(0xffd9b0, 1.25, 2.1, 1.8);
  fillLight.name = 'mum-hall-fill-light';
  fillLight.position.set(0, 1.48, -0.72);
  root.add(fillLight);

  root.visible = false;
  const tick = (nowMs: number): void => {
    const t = nowMs / 1000;
    character.rotation.z = Math.sin(t * 1.1) * 0.014;
    head.rotation.z = Math.sin(t * 0.7 + 1) * 0.048;
    head.position.y = 1.395 + Math.sin(t * 2.1) * 0.004;
    towel.rotation.z = 0.045 + Math.sin(t * 1.1 + 0.4) * 0.008;
  };

  return {
    root,
    character,
    tick,
    setRevealed: (on: boolean) => {
      root.visible = on;
    },
  };
}
