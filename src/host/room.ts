import * as THREE from 'three';
import type { ChoreId } from '../director/director';

export type Interactable =
  | { type: 'item'; itemId: string; chore: ChoreId; name: string }
  | { type: 'target'; target: 'tray' | 'bin' | 'basket'; accepts: ChoreId; name: string }
  | { type: 'pc' };

export interface RoomItemDef {
  id: string;
  chore: ChoreId;
  name: string;
}

export interface Room {
  scene: THREE.Scene;
  /** AABB colliders for player movement. */
  colliders: THREE.Box3[];
  /** Meshes the interaction raycast may hit (includes item groups). */
  interactables: THREE.Object3D[];
  itemObjects: Map<string, THREE.Object3D>;
  items: RoomItemDef[];
  /** Placement slot positions per target, in world space. */
  slots: Record<'tray' | 'bin' | 'basket', THREE.Vector3[]>;
  monitorScreen: THREE.Mesh;
  npcSilhouette: THREE.Object3D;
  /** Toggle the warm hallway light behind the door (NPC presence). */
  setHallLight: (on: boolean) => void;
  playerSpawn: THREE.Vector3;
}

const WALL = 0x8a7560;
const FLOOR = 0x9c7b52;
const WOOD = 0x7a5a38;
const WOOD_DARK = 0x5c421f;

function lambert(color: number, opts: { emissive?: number; emissiveIntensity?: number } = {}): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color });
  if (opts.emissive !== undefined) {
    m.emissive = new THREE.Color(opts.emissive);
    m.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  return m;
}

function box(
  w: number,
  h: number,
  d: number,
  color: number | THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mat = typeof color === 'number' ? lambert(color) : color;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function tagInteract(obj: THREE.Object3D, interact: Interactable): void {
  obj.userData['interact'] = interact;
}

function colliderAt(x: number, z: number, w: number, d: number, h = 2): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(x - w / 2, 0, z - d / 2),
    new THREE.Vector3(x + w / 2, h, z + d / 2),
  );
}

// ---------------------------------------------------------------- textures

function makePosterTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 192;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1a2418';
    ctx.fillRect(0, 0, 128, 192);
    ctx.fillStyle = '#0e140d';
    ctx.fillRect(4, 4, 120, 184);
    // big goblin face
    ctx.fillStyle = '#5f8f3e';
    ctx.fillRect(34, 40, 60, 52);
    ctx.fillRect(20, 48, 14, 18); // ears
    ctx.fillRect(94, 48, 14, 18);
    ctx.fillStyle = '#e8d44f';
    ctx.fillRect(46, 56, 12, 10);
    ctx.fillRect(70, 56, 12, 10);
    ctx.fillStyle = '#222';
    ctx.fillRect(50, 59, 5, 5);
    ctx.fillRect(74, 59, 5, 5);
    ctx.fillRect(48, 78, 32, 6); // deadpan mouth
    ctx.fillStyle = '#e8c33f';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MUDWICK', 64, 118);
    ctx.fillText('ONLINE', 64, 136);
    ctx.fillStyle = '#b8b09a';
    ctx.font = '9px monospace';
    ctx.fillText('Your goblins', 64, 158);
    ctx.fillText('miss you.', 64, 170);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSilhouetteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 64, 128);
    ctx.fillStyle = 'rgba(12,10,14,0.96)';
    // head
    ctx.beginPath();
    ctx.arc(32, 22, 11, 0, Math.PI * 2);
    ctx.fill();
    // shoulders / torso
    ctx.beginPath();
    ctx.moveTo(14, 44);
    ctx.quadraticCurveTo(32, 30, 50, 44);
    ctx.lineTo(48, 96);
    ctx.lineTo(16, 96);
    ctx.closePath();
    ctx.fill();
    // arm holding a tea towel (deadpan domestic authority)
    ctx.fillRect(10, 48, 8, 34);
    ctx.fillRect(46, 48, 8, 30);
    ctx.fillStyle = 'rgba(40,38,44,0.9)';
    ctx.fillRect(44, 74, 14, 20);
    // legs
    ctx.fillStyle = 'rgba(12,10,14,0.96)';
    ctx.fillRect(18, 96, 12, 32);
    ctx.fillRect(34, 96, 12, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- pieces

function makeMug(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.09, 10), lambert(color));
  body.position.y = 0.045;
  const handle = box(0.015, 0.04, 0.03, color, 0.05, 0.05, 0);
  g.add(body, handle);
  return g;
}

function makeWrapper(color: number): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), lambert(color));
  m.scale.set(1, 0.45, 0.8);
  m.position.y = 0.02;
  m.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, 0);
  const mat = m.material as THREE.MeshLambertMaterial;
  mat.flatShading = true;
  g.add(m);
  return g;
}

function makeCloth(color: number, long = false): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(long ? 0.42 : 0.3, 0.045, long ? 0.3 : 0.24), lambert(color));
  m.position.y = 0.025;
  m.rotation.y = Math.random() * Math.PI;
  const fold = new THREE.Mesh(new THREE.BoxGeometry(long ? 0.26 : 0.18, 0.04, 0.14), lambert(color));
  fold.position.set(0.03, 0.06, 0.02);
  fold.rotation.y = 0.5;
  g.add(m, fold);
  return g;
}

// ---------------------------------------------------------------- room

export function buildRoom(): Room {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12101a);

  const colliders: THREE.Box3[] = [];
  const interactables: THREE.Object3D[] = [];
  const itemObjects = new Map<string, THREE.Object3D>();
  const items: RoomItemDef[] = [];

  // ---- shell: floor, ceiling, walls (room 5 x 4 m, 2.6 m high)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), lambert(FLOOR));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), lambert(0x7a6a58));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 2.6;
  scene.add(ceiling);

  const mkWall = (w: number, h: number, x: number, y: number, z: number, ry: number, color = WALL): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lambert(color));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    return m;
  };
  mkWall(5, 2.6, 0, 1.3, -2, 0); // north
  mkWall(4, 2.6, -2.5, 1.3, 0, Math.PI / 2); // west
  mkWall(4, 2.6, 2.5, 1.3, 0, -Math.PI / 2); // east
  // south wall has the door: build in segments around opening x in [-1.2,-0.4]
  mkWall(1.3, 2.6, -1.85, 1.3, 2, Math.PI); // left of door
  mkWall(2.9, 2.6, 1.05, 1.3, 2, Math.PI); // right of door
  mkWall(0.8, 0.55, -0.8, 2.32, 2, Math.PI); // above door

  // skirting glow strip for warmth
  const rug = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), lambert(0x9c4a3c));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.1, 0.005, 0.4);
  scene.add(rug);
  const rugInner = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), lambert(0xb86a50));
  rugInner.rotation.x = -Math.PI / 2;
  rugInner.position.set(0.1, 0.006, 0.4);
  scene.add(rugInner);

  // ---- door + dark hallway + NPC silhouette anchor
  // Hallway is near-black until the NPC appears; then the hall light comes
  // on so her silhouette reads (see setHallLight).
  const doorwayMat = new THREE.MeshBasicMaterial({ color: 0x0a0810 });
  const doorway = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.05), doorwayMat);
  doorway.position.set(-0.8, 1.02, 2.01);
  doorway.rotation.y = Math.PI;
  scene.add(doorway);
  const frameMat = lambert(WOOD_DARK);
  scene.add(box(0.08, 2.1, 0.12, frameMat, -1.24, 1.05, 2));
  scene.add(box(0.08, 2.1, 0.12, frameMat, -0.36, 1.05, 2));
  scene.add(box(0.96, 0.1, 0.12, frameMat, -0.8, 2.1, 2));
  const silTex = makeSilhouetteTexture();
  const silMat = new THREE.MeshBasicMaterial({ map: silTex, transparent: true, depthWrite: false });
  const sil = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.8), silMat);
  sil.position.set(-0.78, 0.95, 1.97); // just inside the doorway, in front of the hall plane
  sil.rotation.y = Math.PI;
  sil.visible = false;
  scene.add(sil);

  // ---- window (east wall) with night glow
  const winFrame = lambert(WOOD_DARK);
  // frame: four bars around the opening
  scene.add(box(0.08, 0.08, 1.3, winFrame, 2.47, 2.1, 0.4));
  scene.add(box(0.08, 0.08, 1.3, winFrame, 2.47, 1.0, 0.4));
  scene.add(box(0.08, 1.18, 0.08, winFrame, 2.47, 1.55, -0.21));
  scene.add(box(0.08, 1.18, 0.08, winFrame, 2.47, 1.55, 1.01));
  const winGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.18, 1.06),
    new THREE.MeshBasicMaterial({ color: 0x2a4a80 }),
  );
  winGlow.position.set(2.49, 1.55, 0.4);
  winGlow.rotation.y = -Math.PI / 2;
  scene.add(winGlow);
  // moon + stars
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), new THREE.MeshBasicMaterial({ color: 0xd8e2f0 }));
  moon.position.set(2.485, 1.8, 0.15);
  moon.rotation.y = -Math.PI / 2;
  scene.add(moon);
  for (const [sy, sz] of [
    [1.32, 0.72],
    [1.7, 0.85],
    [1.18, 0.1],
  ] as const) {
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.012, 6), new THREE.MeshBasicMaterial({ color: 0xc8d8f0 }));
    star.position.set(2.485, sy, sz);
    star.rotation.y = -Math.PI / 2;
    scene.add(star);
  }
  scene.add(box(0.05, 1.06, 0.05, winFrame, 2.45, 1.55, 0.4)); // mullion
  scene.add(box(0.05, 0.05, 1.18, winFrame, 2.45, 1.55, 0.4));

  // ---- desk + monitor + chair (north-east area)
  const desk = new THREE.Group();
  desk.add(box(1.6, 0.06, 0.7, lambert(WOOD), 0, 0.75, 0));
  for (const [lx, lz] of [
    [-0.74, -0.3],
    [0.74, -0.3],
    [-0.74, 0.3],
    [0.74, 0.3],
  ] as const) {
    desk.add(box(0.07, 0.75, 0.07, lambert(WOOD_DARK), lx, 0.375, lz));
  }
  desk.position.set(0.9, 0, -1.55);
  scene.add(desk);
  colliders.push(colliderAt(0.9, -1.55, 1.7, 0.8));

  // CRT monitor
  const crt = new THREE.Group();
  const shellMat = lambert(0xb8b0a0);
  crt.add(box(0.5, 0.42, 0.46, shellMat, 0, 0.21, 0));
  crt.add(box(0.54, 0.05, 0.5, shellMat, 0, -0.02, 0));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x0a1408 }),
  );
  screen.position.set(0, 0.21, 0.235);
  crt.add(screen);
  crt.position.set(0.9, 0.78, -1.72);
  scene.add(crt);
  tagInteract(crt, { type: 'pc' });
  interactables.push(crt);

  // keyboard
  scene.add(box(0.42, 0.025, 0.16, lambert(0xc8c0b0), 0.9, 0.79, -1.32));

  // mousepad + mouse, to the right of the keyboard
  scene.add(box(0.2, 0.006, 0.24, lambert(0x3a4450), 1.32, 0.784, -1.32));
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), lambert(0xc8c0b0));
  mouse.scale.set(1, 0.5, 1.35);
  mouse.position.set(1.32, 0.8, -1.32);
  scene.add(mouse);

  // chair
  const chair = new THREE.Group();
  chair.add(box(0.42, 0.06, 0.42, lambert(0x4a4a56), 0, 0.46, 0));
  chair.add(box(0.42, 0.55, 0.06, lambert(0x4a4a56), 0, 0.78, 0.2));
  chair.add(box(0.06, 0.46, 0.06, lambert(0x2e2e36), 0, 0.23, 0));
  chair.add(box(0.4, 0.04, 0.4, lambert(0x2e2e36), 0, 0.02, 0));
  chair.position.set(0.9, 0, -0.95);
  scene.add(chair);
  tagInteract(chair, { type: 'pc' });
  interactables.push(chair);
  colliders.push(colliderAt(0.9, -0.95, 0.5, 0.5, 0.9));

  // ---- bed (west wall)
  const bed = new THREE.Group();
  bed.add(box(0.95, 0.22, 2.0, lambert(WOOD_DARK), 0, 0.11, 0));
  bed.add(box(0.9, 0.16, 1.95, lambert(0xcab694), 0, 0.3, 0));
  bed.add(box(0.8, 0.1, 0.4, lambert(0xe8e2d4), 0, 0.42, -0.7)); // pillow
  bed.add(box(0.92, 0.08, 1.1, lambert(0x6e4a8c), 0, 0.4, 0.35)); // blanket
  bed.position.set(-1.95, 0, -0.4);
  scene.add(bed);
  colliders.push(colliderAt(-1.95, -0.4, 1.05, 2.1, 0.6));

  // ---- poster above the bed (west wall)
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.93),
    new THREE.MeshBasicMaterial({ map: makePosterTexture() }),
  );
  poster.position.set(-2.48, 1.62, -0.4);
  poster.rotation.y = Math.PI / 2;
  scene.add(poster);

  // ---- tray by the door
  const tray = new THREE.Group();
  tray.add(box(0.56, 0.03, 0.36, lambert(0xa88a58), 0, 0.015, 0));
  tray.add(box(0.56, 0.05, 0.03, lambert(0x8a6c3c), 0, 0.04, 0.18));
  tray.add(box(0.56, 0.05, 0.03, lambert(0x8a6c3c), 0, 0.04, -0.18));
  tray.add(box(0.03, 0.05, 0.36, lambert(0x8a6c3c), 0.28, 0.04, 0));
  tray.add(box(0.03, 0.05, 0.36, lambert(0x8a6c3c), -0.28, 0.04, 0));
  tray.position.set(0.05, 0, 1.72);
  scene.add(tray);
  tagInteract(tray, { type: 'target', target: 'tray', accepts: 'mugs', name: 'tray' });
  interactables.push(tray);

  // ---- bin (beside desk)
  const bin = new THREE.Group();
  const binMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.34, 12, 1, true), lambert(0x5a6a72));
  (binMesh.material as THREE.Material).side = THREE.DoubleSide;
  binMesh.position.y = 0.17;
  const binBottom = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), lambert(0x4a565c));
  binBottom.rotation.x = -Math.PI / 2;
  binBottom.position.y = 0.005;
  bin.add(binMesh, binBottom);
  bin.position.set(1.95, 0, -1.1);
  scene.add(bin);
  tagInteract(bin, { type: 'target', target: 'bin', accepts: 'wrappers', name: 'bin' });
  interactables.push(bin);
  colliders.push(colliderAt(1.95, -1.1, 0.36, 0.36, 0.4));

  // ---- laundry basket (south-west corner)
  const basket = new THREE.Group();
  const bw = 0.5;
  basket.add(box(bw, 0.05, bw, lambert(0x8a6c3c), 0, 0.025, 0));
  basket.add(box(bw, 0.3, 0.04, lambert(0xa88a58), 0, 0.17, bw / 2));
  basket.add(box(bw, 0.3, 0.04, lambert(0xa88a58), 0, 0.17, -bw / 2));
  basket.add(box(0.04, 0.3, bw, lambert(0xa88a58), bw / 2, 0.17, 0));
  basket.add(box(0.04, 0.3, bw, lambert(0xa88a58), -bw / 2, 0.17, 0));
  basket.position.set(-1.85, 0, 1.55);
  scene.add(basket);
  tagInteract(basket, { type: 'target', target: 'basket', accepts: 'laundry', name: 'laundry basket' });
  interactables.push(basket);
  colliders.push(colliderAt(-1.85, 1.55, 0.6, 0.6, 0.4));

  // ---- chore items
  const addItem = (id: string, chore: ChoreId, name: string, obj: THREE.Object3D, x: number, y: number, z: number): void => {
    obj.position.set(x, y, z);
    tagInteract(obj, { type: 'item', itemId: id, chore, name });
    scene.add(obj);
    interactables.push(obj);
    itemObjects.set(id, obj);
    items.push({ id, chore, name });
  };

  addItem('mug0', 'mugs', 'mug', makeMug(0x3c6e8f), 0.28, 0.78, -1.42);
  addItem('mug1', 'mugs', 'mug', makeMug(0x8f3c50), 1.5, 0.78, -1.38);
  addItem('mug2', 'mugs', 'mug', makeMug(0x4a8f3c), 1.56, 0.78, -1.74);

  addItem('wrap0', 'wrappers', 'wrapper', makeWrapper(0xd8a02a), 0.3, 0, 0.1);
  addItem('wrap1', 'wrappers', 'wrapper', makeWrapper(0x3ca8d8), 1.5, 0, -0.4);
  addItem('wrap2', 'wrappers', 'wrapper', makeWrapper(0xd84a8a), -0.55, 0, 1.1);
  addItem('wrap3', 'wrappers', 'wrapper', makeWrapper(0x8ad84a), 0.32, 0.78, -1.72);

  addItem('cloth0', 'laundry', 'hoodie', makeCloth(0x4a5a8f, true), -0.9, 0, -0.2);
  addItem('cloth1', 'laundry', 'sock', makeCloth(0x8f8f3c), -0.2, 0, 1.35);
  addItem('cloth2', 'laundry', 'shirt', makeCloth(0x8f5a3c, true), -1.9, 0.48, 0.2);

  // ---- decoration pass (visual only: nothing here is interactable or solid)

  // skirting boards (south wall split around the door opening)
  const skirt = lambert(0x6e5a44);
  scene.add(box(5, 0.09, 0.025, skirt, 0, 0.045, -1.99));
  scene.add(box(0.025, 0.09, 4, skirt, -2.49, 0.045, 0));
  scene.add(box(0.025, 0.09, 4, skirt, 2.49, 0.045, 0));
  scene.add(box(1.26, 0.09, 0.025, skirt, -1.87, 0.045, 1.99));
  scene.add(box(2.86, 0.09, 0.025, skirt, 1.07, 0.045, 1.99));

  // PC tower under the desk, with power LED and drive slots
  const tower = new THREE.Group();
  tower.add(box(0.18, 0.46, 0.42, lambert(0xb8b0a0), 0, 0.23, 0));
  tower.add(box(0.12, 0.008, 0.005, lambert(0x4a4640), 0, 0.36, 0.21));
  tower.add(box(0.12, 0.008, 0.005, lambert(0x4a4640), 0, 0.32, 0.21));
  const towerLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.014, 0.006),
    new THREE.MeshBasicMaterial({ color: 0x5ee85e }),
  );
  towerLed.position.set(-0.05, 0.4, 0.21);
  tower.add(towerLed);
  tower.add(box(0.025, 0.025, 0.006, lambert(0x8a8276), 0.04, 0.4, 0.21));
  tower.position.set(1.5, 0, -1.62);
  scene.add(tower);

  // cables: monitor drop behind the desk + floor run to the tower
  const cableMat = lambert(0x1c1c20);
  scene.add(box(0.02, 0.74, 0.02, cableMat, 1.08, 0.37, -1.92));
  scene.add(box(0.32, 0.02, 0.02, cableMat, 1.26, 0.012, -1.88));

  // curtain rod + panels framing the window (east wall)
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.74, 8), lambert(WOOD_DARK));
  rod.rotation.x = Math.PI / 2;
  rod.position.set(2.44, 2.26, 0.4);
  scene.add(rod);
  const curtainMat = lambert(0x6e4a8c);
  for (const cz of [-0.34, 1.14]) {
    const panel = box(0.06, 1.42, 0.26, curtainMat, 2.43, 1.5, cz);
    scene.add(panel);
    scene.add(box(0.045, 1.42, 0.1, curtainMat, 2.4, 1.46, cz + (cz < 0.4 ? 0.16 : -0.16)));
  }

  // window sill + a small potted plant
  scene.add(box(0.1, 0.045, 1.34, lambert(WOOD_DARK), 2.44, 0.96, 0.4));
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.07, 8), lambert(0xa05838));
  pot.position.set(2.4, 1.02, 0.78);
  scene.add(pot);
  const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), lambert(0x4a8f3c));
  plant.scale.set(1, 1.25, 1);
  plant.position.set(2.4, 1.1, 0.78);
  scene.add(plant);

  // shelf above the desk: books (one leaning) + a small trophy
  scene.add(box(0.92, 0.035, 0.2, lambert(WOOD), 0.9, 1.74, -1.88));
  const bookColors = [0x8f3c50, 0x3c6e8f, 0xc8a040, 0x4a8f3c, 0x6e4a8c];
  let bx = 0.54;
  for (let i = 0; i < bookColors.length; i++) {
    const w = 0.034 + (i % 3) * 0.007;
    const h = 0.16 + ((i * 7) % 4) * 0.014;
    scene.add(box(w, h, 0.15, lambert(bookColors[i] ?? 0x888888), bx + w / 2, 1.758 + h / 2, -1.88));
    bx += w + 0.012;
  }
  const leaning = box(0.03, 0.18, 0.15, lambert(0xb86a50), bx + 0.05, 1.84, -1.88);
  leaning.rotation.z = -0.42;
  scene.add(leaning);
  scene.add(box(0.07, 0.02, 0.07, lambert(0x4a4640), 1.22, 1.768, -1.88));
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.018, 0.055, 8), lambert(0xe8c33f, { emissive: 0x806820, emissiveIntensity: 0.35 }));
  cup.position.set(1.22, 1.806, -1.88);
  scene.add(cup);

  // sticky notes + wall calendar near the desk (north wall)
  const stickyColors = [0xf0e060, 0x88d8a0, 0xf0a0b0];
  const stickyPos: [number, number, number][] = [
    [0.34, 1.46, -0.12],
    [0.5, 1.32, 0.14],
    [0.27, 1.28, 0.05],
  ];
  stickyColors.forEach((c, i) => {
    const p = stickyPos[i];
    if (!p) return;
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.075), new THREE.MeshLambertMaterial({ color: c }));
    note.position.set(p[0], p[1], -1.995);
    note.rotation.z = p[2];
    scene.add(note);
  });
  const calendar = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.22), lambert(0xe8e2d4));
  calendar.position.set(1.66, 1.46, -1.995);
  scene.add(calendar);
  const calHeader = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.05), lambert(0xa03028));
  calHeader.position.set(1.66, 1.545, -1.994);
  scene.add(calHeader);
  const calRing = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.018), lambert(0x4a4640));
  calRing.position.set(1.66, 1.578, -1.994);
  scene.add(calRing);

  // headboard + slippers by the bed
  scene.add(box(0.95, 0.55, 0.05, lambert(WOOD_DARK), -1.95, 0.45, -1.43));
  for (const [sx, sz, ry] of [
    [-1.36, 0.78, 0.25],
    [-1.32, 0.95, -0.15],
  ] as const) {
    const slipper = box(0.09, 0.045, 0.2, lambert(0x9c4a3c), sx, 0.023, sz);
    slipper.rotation.y = ry;
    scene.add(slipper);
  }

  // glow-in-the-dark ceiling stars
  const starMat = new THREE.MeshBasicMaterial({ color: 0xb8e8c8 });
  for (const [gx, gz] of [
    [-1.5, -1.2],
    [0.6, -0.9],
    [1.4, 0.3],
    [-0.6, 0.5],
    [0.2, -1.6],
    [-1.8, 1.0],
    [1.0, 1.2],
    [-0.2, -0.1],
    [1.9, -0.9],
    [-1.1, -1.7],
    [2.1, 1.5],
    [-2.0, -0.3],
  ] as const) {
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.016, 5), starMat);
    star.position.set(gx, 2.595, gz);
    star.rotation.x = Math.PI / 2;
    scene.add(star);
  }

  // cord for the ceiling lamp
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), lambert(0x2e2a26));
  cord.position.set(-0.4, 2.49, -0.2);
  scene.add(cord);

  // ---- placement slots (world space)
  const slots = {
    tray: [
      new THREE.Vector3(-0.13, 0.035, 1.72),
      new THREE.Vector3(0.05, 0.035, 1.72),
      new THREE.Vector3(0.23, 0.035, 1.72),
    ],
    bin: [
      new THREE.Vector3(1.95, 0.1, -1.1),
      new THREE.Vector3(1.93, 0.16, -1.12),
      new THREE.Vector3(1.97, 0.22, -1.08),
      new THREE.Vector3(1.95, 0.28, -1.1),
    ],
    basket: [
      new THREE.Vector3(-1.85, 0.08, 1.55),
      new THREE.Vector3(-1.83, 0.16, 1.53),
      new THREE.Vector3(-1.87, 0.24, 1.57),
    ],
  };

  // ---- lighting: one warm point light + dim ambient + faint window blue
  scene.add(new THREE.AmbientLight(0x9a90b8, 0.55));
  const lamp = new THREE.PointLight(0xffc878, 14, 0, 1.8);
  lamp.position.set(-0.4, 2.25, -0.2);
  scene.add(lamp);
  // visible lamp fixture
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 12, 1, true), lambert(0xe8c878, { emissive: 0xffc878, emissiveIntensity: 0.6 }));
  shade.position.set(-0.4, 2.38, -0.2);
  scene.add(shade);
  const windowLight = new THREE.PointLight(0x4060a8, 2.2, 3.5, 1.6);
  windowLight.position.set(2.1, 1.6, 0.4);
  scene.add(windowLight);

  const setHallLight = (on: boolean): void => {
    doorwayMat.color.setHex(on ? 0x4a3826 : 0x0a0810);
  };

  return {
    scene,
    colliders,
    interactables,
    itemObjects,
    items,
    slots,
    monitorScreen: screen,
    npcSilhouette: sil,
    setHallLight,
    playerSpawn: new THREE.Vector3(-0.6, 0, 0.9),
  };
}
