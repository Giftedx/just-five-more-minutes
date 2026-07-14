import * as THREE from 'three';
import type { ChoreId } from '../director/director';
import { makeEnvironmentDetails } from './environment-details';
import { makeBed, makeDeskChair } from './hero-furniture';
import { makeMumDoorway } from './mum-doorway';
import { makeWovenRug } from './woven-rug';

export type Interactable =
  | { type: 'item'; itemId: string; chore: ChoreId; name: string }
  | { type: 'target'; target: 'tray' | 'bin' | 'basket'; accepts: ChoreId; name: string }
  | { type: 'tug'; itemId: string; chore: ChoreId; name: string; action: string }
  | { type: 'pc' };

export interface RoomItemDef {
  id: string;
  chore: ChoreId;
  name: string;
}

/** Which physical chore fills each director slot tonight, plus night props. */
export interface RoomNightConfig {
  chores: { slot: ChoreId; physical: 'mugs' | 'wrappers' | 'laundry' | 'bed' | 'curtains'; count: number }[];
  /** Wednesday: the landline appears by the door. */
  phone: boolean;
}

export const MONDAY_ROOM_CONFIG: RoomNightConfig = {
  chores: [
    { slot: 'mugs', physical: 'mugs', count: 3 },
    { slot: 'wrappers', physical: 'wrappers', count: 4 },
    { slot: 'laundry', physical: 'laundry', count: 3 },
  ],
  phone: false,
};

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
  /** Per-frame room animation: door swing easing + mum's idle when visible. */
  npcTick: (nowMs: number) => void;
  /** Toggle the warm hallway light behind the door (NPC presence). */
  setHallLight: (on: boolean) => void;
  /** Evening slide: 0 at 17:25, 1 at half past. Dims ambient, deepens the window. */
  setDusk: (f: number) => void;
  /** The little desk lamp ("you'll ruin your eyes"). */
  setDeskLamp: (on: boolean) => void;
  playerSpawn: THREE.Vector3;
}

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

function makeShellGeometry(
  width: number,
  height: number,
  base: number,
  opts: { widthSegments?: number; heightSegments?: number; vertical?: number; corner?: number; grain?: number } = {},
): THREE.PlaneGeometry {
  const widthSegments = opts.widthSegments ?? 8;
  const heightSegments = opts.heightSegments ?? 5;
  const geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const baseColor = new THREE.Color(base);
  for (let i = 0; i < position.count; i++) {
    const xNorm = width === 0 ? 0 : Math.abs(position.getX(i)) / (width / 2);
    const yNorm = height === 0 ? 0 : (position.getY(i) + height / 2) / height;
    const cornerShade = (xNorm ** 1.7) * (opts.corner ?? -0.025);
    const verticalShade = (0.5 - yNorm) * (opts.vertical ?? 0.055);
    const grain = ((((i * 37) % 17) - 8) / 8) * (opts.grain ?? 0.012);
    baseColor.clone().offsetHSL(0, 0, cornerShade + verticalShade + grain).toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function makeFloorGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const boardColors = [0x97754f, 0xa08058, 0x94714b, 0x9d7951, 0x96734d];
  for (let board = 0; board < boardColors.length; board++) {
    const x0 = -2.5 + board;
    const x1 = x0 + 1;
    const first = positions.length / 3;
    positions.push(x0, 0, -2, x1, 0, -2, x1, 0, 2, x0, 0, 2);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    const color = new THREE.Color(boardColors[board]!);
    for (let vertex = 0; vertex < 4; vertex++) color.toArray(colors, colors.length);
    indices.push(first, first + 2, first + 1, first, first + 3, first + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

function makeContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for contact shadows');
  const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(45,22,14,0.46)');
  gradient.addColorStop(0.55, 'rgba(45,22,14,0.22)');
  gradient.addColorStop(1, 'rgba(45,22,14,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function makeContactShadows(): THREE.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const footprints = [
    { x: 0.9, z: -1.55, width: 1.75, depth: 0.85 },
    { x: 0.9, z: -0.95, width: 0.68, depth: 0.68 },
    { x: -1.95, z: -0.4, width: 1.12, depth: 2.18 },
    { x: 1.95, z: -1.1, width: 0.42, depth: 0.42 },
    { x: -1.85, z: 1.55, width: 0.58, depth: 0.58 },
  ];
  for (const footprint of footprints) {
    const first = positions.length / 3;
    const halfW = footprint.width / 2;
    const halfD = footprint.depth / 2;
    positions.push(
      footprint.x - halfW, 0.007, footprint.z - halfD,
      footprint.x + halfW, 0.007, footprint.z - halfD,
      footprint.x + halfW, 0.007, footprint.z + halfD,
      footprint.x - halfW, 0.007, footprint.z + halfD,
    );
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(first, first + 2, first + 1, first, first + 3, first + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({
    map: makeContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'room-contact-shadows';
  mesh.renderOrder = 1;
  return mesh;
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
  c.width = 256;
  c.height = 384;
  const ctx = c.getContext('2d');
  if (ctx) {
    // pixel-art scene drawn at 2x blocks for the chunky retro box-art look
    const px = (x: number, y: number, w: number, h: number, col: string): void => {
      ctx.fillStyle = col;
      ctx.fillRect(x * 2, y * 2, w * 2, h * 2);
    };

    // frame
    px(0, 0, 128, 192, '#1a2418');
    px(3, 3, 122, 186, '#0e140d');

    // night sky gradient (banded, like a 16-colour palette)
    const skyBands = ['#0e1426', '#121a2c', '#182232', '#1f2a34', '#27332e', '#2e3c26'];
    for (const [i, band] of skyBands.entries()) {
      px(4, 4 + i * 19, 120, 19, band);
    }

    // stars (deterministic scatter)
    for (let i = 0; i < 34; i++) {
      const sx = 8 + ((i * 37 + 13) % 112);
      const sy = 7 + ((i * 53 + 29) % 78);
      px(sx, sy, 1, 1, i % 5 === 0 ? '#cfe0ff' : '#8fa0c0');
    }

    // moon with craters + glow (left, clear of the title)
    px(16, 50, 18, 18, '#2a3448');
    px(18, 48, 14, 22, '#2a3448');
    px(14, 52, 22, 14, '#2a3448');
    px(19, 51, 12, 16, '#e8e4cf');
    px(17, 53, 16, 12, '#e8e4cf');
    px(21, 55, 3, 3, '#cfcab2');
    px(27, 59, 2, 2, '#cfcab2');
    px(23, 62, 2, 2, '#cfcab2');

    // distant hills
    px(4, 104, 120, 14, '#1c2616');
    px(4, 100, 40, 6, '#1c2616');
    px(80, 99, 44, 8, '#1c2616');

    // the Mudwick keep on the right hill
    px(88, 76, 26, 26, '#141c12');
    px(86, 70, 8, 32, '#141c12'); // left tower
    px(108, 66, 9, 36, '#10180e'); // right tower
    px(85, 67, 10, 4, '#141c12'); // battlements
    px(107, 63, 11, 4, '#10180e');
    px(96, 72, 7, 4, '#141c12');
    // lit windows
    px(89, 76, 2, 3, '#e8c33f');
    px(111, 73, 2, 3, '#e8c33f');
    px(97, 84, 2, 3, '#f0d860');
    px(104, 88, 2, 3, '#e8c33f');
    // banner on the tall tower
    px(110, 58, 1, 6, '#3a3026');
    px(111, 58, 5, 4, '#a03828');

    // ground
    px(4, 118, 120, 70, '#222e16');
    px(4, 118, 120, 3, '#2e3c1e');
    // winding path to the keep
    px(58, 182, 26, 6, '#4a4430');
    px(62, 174, 22, 8, '#46402c');
    px(68, 164, 18, 10, '#423c2a');
    px(74, 152, 15, 12, '#3e3828');
    px(80, 138, 12, 14, '#3a3426');
    px(86, 124, 9, 14, '#363022');
    // tufts of grass
    for (let i = 0; i < 14; i++) {
      const gx = 8 + ((i * 41 + 7) % 110);
      const gy = 124 + ((i * 29 + 11) % 58);
      px(gx, gy, 2, 1, '#384a22');
    }

    // ---- goblin hero (front-left, holding his trusty club)
    const G = '#5f8f3e';
    const GD = '#4a7330';
    // legs + feet
    px(38, 158, 7, 12, '#3e5e2a');
    px(50, 158, 7, 12, '#3e5e2a');
    px(36, 168, 9, 4, '#2e2418');
    px(50, 168, 9, 4, '#2e2418');
    // body (little leather vest)
    px(34, 136, 27, 24, G);
    px(38, 140, 19, 18, '#6e5230');
    px(46, 140, 3, 18, '#5a4226');
    // arms
    px(28, 138, 7, 16, G);
    px(60, 138, 7, 14, G);
    // club arm raised — club resting on shoulder
    px(64, 124, 6, 16, GD);
    ctx.save();
    ctx.translate(140, 250);
    ctx.rotate(-0.6);
    ctx.fillStyle = '#6e4f28';
    ctx.fillRect(-5, -64, 10, 64); // handle
    ctx.fillStyle = '#7e5c30';
    ctx.fillRect(-9, -84, 18, 26); // head
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(-9, -78, 18, 3); // iron band
    ctx.restore();
    // head
    px(36, 108, 24, 26, G);
    px(26, 114, 10, 8, G); // ears
    px(60, 114, 10, 8, G);
    px(28, 116, 4, 4, GD);
    px(64, 116, 4, 4, GD);
    // eyes — deadpan as ever
    px(40, 116, 6, 5, '#e8d44f');
    px(50, 116, 6, 5, '#e8d44f');
    px(42, 118, 3, 3, '#222');
    px(52, 118, 3, 3, '#222');
    // heavy brow
    px(39, 114, 8, 2, GD);
    px(49, 114, 8, 2, GD);
    // mouth + snaggle tooth
    px(41, 127, 14, 3, '#222');
    px(43, 125, 3, 2, '#e8e4cf');

    // ---- tiny goblin mate waving by the path
    px(95, 142, 10, 9, G);
    px(92, 144, 4, 3, G);
    px(105, 144, 4, 3, G);
    px(97, 145, 2, 2, '#e8d44f');
    px(101, 145, 2, 2, '#e8d44f');
    px(96, 151, 8, 8, '#3e5e2a');
    px(106, 137, 3, 7, G); // waving arm

    // ---- title with drop shadow + gold gradient
    ctx.textAlign = 'center';
    ctx.font = 'bold 38px monospace';
    ctx.fillStyle = '#0a0e08';
    ctx.fillText('MUDWICK', 130, 50);
    ctx.fillText('ONLINE', 130, 86);
    const gold = ctx.createLinearGradient(0, 16, 0, 86);
    gold.addColorStop(0, '#f6e08a');
    gold.addColorStop(0.55, '#e0a83c');
    gold.addColorStop(1, '#a86a20');
    ctx.fillStyle = gold;
    ctx.fillText('MUDWICK', 128, 48);
    ctx.fillText('ONLINE', 128, 84);

    // ---- tagline + review, over the ground
    ctx.fillStyle = '#d8d0b0';
    ctx.font = '15px monospace';
    ctx.fillText('Your goblins miss you.', 128, 348);
    ctx.fillStyle = '#8a8468';
    ctx.font = '12px monospace';
    ctx.fillText('"A game." — Mum', 128, 368);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeNightSkyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 224;
  const ctx = c.getContext('2d');
  if (ctx) {
    // night gradient, lighter toward the horizon
    const grad = ctx.createLinearGradient(0, 0, 0, 224);
    grad.addColorStop(0, '#16244c');
    grad.addColorStop(0.65, '#27416f');
    grad.addColorStop(1, '#33517f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 224);
    // stars (deterministic scatter, varied brightness)
    for (let i = 0; i < 26; i++) {
      const sx = ((i * 73 + 31) % 251) + 2;
      const sy = ((i * 137 + 17) % 200) + 4;
      const bright = 0.35 + ((i * 29) % 10) / 16;
      ctx.fillStyle = `rgba(220, 230, 250, ${bright.toFixed(2)})`;
      const sz = i % 7 === 0 ? 2 : 1;
      ctx.fillRect(sx, sy, sz, sz);
    }
    // moon with a soft halo and craters
    const mx = 78;
    const my = 62;
    const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 42);
    halo.addColorStop(0, 'rgba(216, 226, 240, 0.45)');
    halo.addColorStop(1, 'rgba(216, 226, 240, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 42, my - 42, 84, 84);
    ctx.fillStyle = '#dde6f2';
    ctx.beginPath();
    ctx.arc(mx, my, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c2cee0';
    for (const [cx, cy, cr] of [
      [-6, -3, 3.4],
      [5, 6, 2.6],
      [3, -7, 2],
    ] as const) {
      ctx.beginPath();
      ctx.arc(mx + cx, my + cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }
    // a couple of thin cloud wisps
    ctx.fillStyle = 'rgba(150, 170, 205, 0.22)';
    ctx.beginPath();
    ctx.ellipse(170, 120, 52, 7, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(60, 168, 40, 5, 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Sticky note with the same handwriting as the 2D PC-mode notes. */
function makeStickyTexture(bg: string, lines: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 12, 96);
    grad.addColorStop(0, bg);
    grad.addColorStop(1, shadeHex(bg, -14));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 96, 96);
    ctx.fillStyle = '#4a4030';
    ctx.font = '15px "Segoe Print", "Comic Sans MS", cursive';
    ctx.textAlign = 'center';
    const y0 = 48 - (lines.length - 1) * 10;
    lines.forEach((ln, i) => ctx.fillText(ln, 48, y0 + i * 20));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Hex CSS color lightened (+) or darkened (-) by `amt` per channel. */
function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): number => Math.max(0, Math.min(255, v + amt));
  const r = ch((n >> 16) & 0xff);
  const g = ch((n >> 8) & 0xff);
  const b = ch(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** JUNE calendar matching the 2D PC-mode wall calendar. */
function makeCalendarTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 124;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ddd6c4';
    ctx.fillRect(0, 0, 96, 124);
    ctx.fillStyle = '#a03028';
    ctx.fillRect(0, 0, 96, 28);
    ctx.fillStyle = '#efe6cf';
    ctx.font = '700 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('J U N E', 48, 19);
    // 7x5 day grid
    ctx.strokeStyle = 'rgba(90, 80, 64, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 7; i++) {
      const gx = 6 + (i * 84) / 7;
      ctx.moveTo(gx, 38);
      ctx.lineTo(gx, 114);
    }
    for (let j = 1; j < 5; j++) {
      const gy = 38 + (j * 76) / 5;
      ctx.moveTo(6, gy);
      ctx.lineTo(90, gy);
    }
    ctx.stroke();
    ctx.strokeRect(6, 38, 84, 76);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Keycap grid + spacebar for the 3D keyboard top, matching the 2D one. */
function makeKeyboardTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 168;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#c8c0b0';
    ctx.fillRect(0, 0, 168, 64);
    // keycap field
    ctx.fillStyle = '#bcb2a0';
    ctx.fillRect(8, 6, 152, 38);
    ctx.strokeStyle = 'rgba(60, 52, 40, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let gx = 8; gx <= 160; gx += 13.8) {
      ctx.moveTo(gx, 6);
      ctx.lineTo(gx, 44);
    }
    for (let gy = 6; gy <= 44; gy += 12.7) {
      ctx.moveTo(8, gy);
      ctx.lineTo(160, gy);
    }
    ctx.stroke();
    // spacebar
    ctx.fillStyle = '#bcb2a0';
    ctx.fillRect(42, 48, 84, 11);
    ctx.strokeRect(42, 48, 84, 11);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dashed vent strip like the one along the top of the 2D bezel. */
function makeVentTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 8;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 8);
    ctx.fillStyle = 'rgba(90, 82, 70, 0.6)';
    for (let x = 2; x < 126; x += 7) ctx.fillRect(x, 2, 4, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Tiny "VISIONMASTER 240" badge for the monitor bezel. */
function makeBrandTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 16);
    ctx.fillStyle = 'rgba(90, 82, 70, 0.9)';
    ctx.font = '600 9px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('V I S I O N M A S T E R  2 4 0', 64, 11);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- pieces

/** Lighten/darken a packed RGB colour by `amt` per channel. */
function shadeNum(color: number, amt: number): number {
  const ch = (v: number): number => Math.max(0, Math.min(255, v + amt));
  return (ch((color >> 16) & 0xff) << 16) | (ch((color >> 8) & 0xff) << 8) | ch(color & 0xff);
}

function makeMug(color: number): THREE.Group {
  const g = new THREE.Group();
  // gently tapered body with a foot ring
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.092, 16), lambert(color));
  body.position.y = 0.05;
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.034, 0.008, 16),
    lambert(shadeNum(color, -28)),
  );
  foot.position.y = 0.004;
  // glazed rim lip
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.0375, 0.0035, 6, 16),
    lambert(shadeNum(color, 30)),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.096;
  // interior with the tell-tale ring of cold tea
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.034, 16), lambert(shadeNum(color, -55)));
  inside.rotation.x = -Math.PI / 2;
  inside.position.y = 0.0955;
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.027, 14), lambert(0x4a3018));
  tea.rotation.x = -Math.PI / 2;
  tea.position.y = 0.0957;
  // proper loop handle
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.0065, 8, 14, Math.PI),
    lambert(color),
  );
  handle.position.set(0.042, 0.052, 0);
  handle.rotation.z = -Math.PI / 2; // opening faces the body
  g.add(body, foot, rim, inside, tea, handle);
  return g;
}

/** Crumpled candy wrapper: flat foil base, twisted midsection, shiny inner fold. */
function makeWrapper(color: number): THREE.Group {
  const g = new THREE.Group();
  const foil = shadeNum(color, 0);
  const shine = shadeNum(color, 45);
  g.add(box(0.055, 0.006, 0.075, foil, 0, 0.003, 0)); // flattened on the floor
  const twist = box(0.038, 0.014, 0.032, shadeNum(color, -15), 0.012, 0.009, 0.018);
  twist.rotation.set(0.25, 0.55, 0.15);
  g.add(twist);
  const tail = box(0.022, 0.008, 0.04, foil, -0.018, 0.006, -0.022);
  tail.rotation.y = -0.7;
  g.add(tail);
  g.add(box(0.018, 0.005, 0.02, shine, 0.008, 0.012, 0.008)); // foil glint
  const interactionProxy = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.12, 0.13),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      visible: false,
    }),
  );
  interactionProxy.position.y = 0.06;
  g.add(interactionProxy);
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

/**
 * A proper slipper: sole, cosy toe dome, fleece trim at the opening, and a
 * visible footbed at the heel. Toe points +z; origin at the heel end's floor.
 */
function makeSlipper(color: number, trim = 0xe8d8c0, sole = 0x5c352a): THREE.Group {
  const g = new THREE.Group();
  // sole, slightly proud of the upper
  g.add(box(0.085, 0.022, 0.21, sole, 0, 0.011, 0));
  // footbed peeking out at the heel
  g.add(box(0.068, 0.01, 0.115, trim, 0, 0.027, -0.04));
  // toe dome — a squashed hemisphere over the front half
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    lambert(color),
  );
  dome.scale.set(0.86, 0.66, 1.5);
  dome.position.set(0, 0.022, 0.035);
  g.add(dome);
  // fleece trim band across the opening
  const band = box(0.082, 0.02, 0.026, trim, 0, 0.034, -0.015);
  band.rotation.x = -0.18;
  g.add(band);
  return g;
}

/** A t-shirt dumped flat: torso, sprawled sleeves, collar ring, crumple ridge. */
function makeShirt(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.24, 0.04, 0.28, color, 0, 0.02, 0)); // torso
  const wrinkle = box(0.17, 0.026, 0.12, shadeNum(color, 14), 0.015, 0.048, 0.035);
  wrinkle.rotation.y = 0.35;
  g.add(wrinkle);
  for (const [sx, ry] of [
    [-0.16, 0.55],
    [0.16, -0.55],
  ] as const) {
    const sleeve = box(0.13, 0.034, 0.1, color, sx, 0.017, -0.085);
    sleeve.rotation.y = ry;
    g.add(sleeve);
  }
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.034, 0.011, 6, 14),
    lambert(shadeNum(color, -30)),
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.042, -0.105);
  g.add(collar);
  return g;
}

/** A hoodie in a heap: deflated hood, kangaroo pocket, drawstrings, sleeves. */
function makeHoodie(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.3, 0.05, 0.3, color, 0, 0.025, 0.02));
  const ridge = box(0.22, 0.03, 0.14, shadeNum(color, 12), -0.02, 0.062, 0.05);
  ridge.rotation.y = -0.3;
  g.add(ridge);
  // hood — a deflated dome at the top end
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    lambert(shadeNum(color, -20)),
  );
  hood.scale.set(1, 0.55, 0.9);
  hood.position.set(0, 0.045, -0.13);
  g.add(hood);
  // drawstrings lying across the chest
  for (const dx of [-0.022, 0.022]) {
    const s = box(0.006, 0.006, 0.06, 0xe8e4d8, dx, 0.053, -0.045);
    s.rotation.y = dx > 0 ? -0.2 : 0.25;
    g.add(s);
  }
  // kangaroo pocket
  g.add(box(0.14, 0.014, 0.1, shadeNum(color, -14), 0.01, 0.052, 0.08));
  // sleeves sprawled either side, one flopped further out
  const sl = box(0.18, 0.04, 0.095, color, -0.21, 0.02, 0.04);
  sl.rotation.y = 0.85;
  g.add(sl);
  const sr = box(0.16, 0.04, 0.095, color, 0.2, 0.02, -0.02);
  sr.rotation.y = -0.5;
  g.add(sr);
  // ribbed cuffs at the sleeve ends
  const cl = box(0.04, 0.042, 0.085, shadeNum(color, 22), -0.265, 0.02, 0.105);
  cl.rotation.y = 0.85;
  g.add(cl);
  const cr = box(0.04, 0.042, 0.085, shadeNum(color, 22), 0.265, 0.02, -0.06);
  cr.rotation.y = -0.5;
  g.add(cr);
  return g;
}

/** A single lost sock, folded at the ankle, with a domed toe and ribbed cuff. */
function makeSock(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.07, 0.03, 0.15, color, 0, 0.015, 0)); // foot
  const toe = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    lambert(shadeNum(color, -18)),
  );
  toe.scale.set(1, 0.85, 1);
  toe.position.set(0, 0.001, 0.075);
  g.add(toe);
  const heel = box(0.06, 0.026, 0.05, shadeNum(color, -18), 0, 0.013, -0.065);
  g.add(heel);
  // leg folded over at the ankle
  const leg = box(0.065, 0.028, 0.11, color, 0.045, 0.014, -0.115);
  leg.rotation.y = 0.7;
  g.add(leg);
  // ribbed cuff
  const cuff = box(0.072, 0.034, 0.04, shadeNum(color, 28), 0.085, 0.017, -0.16);
  cuff.rotation.y = 0.7;
  g.add(cuff);
  return g;
}

// ---------------------------------------------------------------- room

export function buildRoom(config: RoomNightConfig = MONDAY_ROOM_CONFIG): Room {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12101a);

  const colliders: THREE.Box3[] = [];
  const interactables: THREE.Object3D[] = [];
  const itemObjects = new Map<string, THREE.Object3D>();
  const items: RoomItemDef[] = [];

  // ---- shell: floor, ceiling, walls (room 5 x 4 m, 2.6 m high)
  const floor = new THREE.Mesh(
    makeFloorGeometry(),
    new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
  );
  floor.name = 'room-floor';
  scene.add(floor);
  scene.add(makeContactShadows());

  const ceiling = new THREE.Mesh(
    makeShellGeometry(5, 4, 0x7a6a58, { vertical: 0.035, corner: -0.018, grain: 0.01 }),
    new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
  );
  ceiling.name = 'room-ceiling';
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 2.6;
  scene.add(ceiling);

  const mkWall = (
    name: string,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    ry: number,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(
      makeShellGeometry(w, h, 0x8a7560),
      new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    );
    m.name = name;
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    return m;
  };
  mkWall('room-wall-north', 5, 2.6, 0, 1.3, -2, 0);
  mkWall('room-wall-west', 4, 2.6, -2.5, 1.3, 0, Math.PI / 2);
  mkWall('room-wall-east', 4, 2.6, 2.5, 1.3, 0, -Math.PI / 2);
  // south wall has the door: build in segments around opening x in [-1.2,-0.4]
  mkWall('room-wall-south-left', 1.3, 2.6, -1.85, 1.3, 2, Math.PI);
  mkWall('room-wall-south-right', 2.9, 2.6, 1.05, 1.3, 2, Math.PI);
  mkWall('room-wall-south-header', 0.8, 0.55, -0.8, 2.32, 2, Math.PI);
  scene.add(makeEnvironmentDetails());

  scene.add(makeWovenRug());

  // ---- door + hallway recess + mum
  // The hall is a shallow dark box behind the door opening. It stays
  // near-black until mum appears; then the hall light comes on and she's lit
  // warm from behind with a soft spill on her face (see setHallLight).
  // Lambert so the hall light shades it naturally; oversized planes so no
  // background ever bleeds through the seams.
  // Hall is 1m deep so the door has room to swing fully open against the
  // right hall wall.
  const hallMat = new THREE.MeshLambertMaterial({ color: 0x3a2c20, side: THREE.DoubleSide });
  const hallBack = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.4), hallMat);
  hallBack.position.set(-0.8, 1.1, 3.0);
  hallBack.rotation.y = Math.PI;
  scene.add(hallBack);
  // sides/floor/ceiling start at the wall plane (z=2) so nothing pokes into
  // the room
  // start a hair behind the wall plane (z 2.03 > 2) so their edges never
  // stitch through the south wall
  const hallSideL = new THREE.Mesh(new THREE.PlaneGeometry(0.97, 2.4), hallMat);
  hallSideL.position.set(-1.26, 1.1, 2.515);
  hallSideL.rotation.y = Math.PI / 2;
  scene.add(hallSideL);
  const hallSideR = new THREE.Mesh(new THREE.PlaneGeometry(0.97, 2.4), hallMat);
  hallSideR.position.set(-0.34, 1.1, 2.515);
  hallSideR.rotation.y = -Math.PI / 2;
  scene.add(hallSideR);
  const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.97), hallMat);
  hallFloor.position.set(-0.8, 0.004, 2.515);
  hallFloor.rotation.x = -Math.PI / 2;
  scene.add(hallFloor);
  const hallCeil = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.97), hallMat);
  hallCeil.position.set(-0.8, 2.1, 2.515);
  hallCeil.rotation.x = Math.PI / 2;
  scene.add(hallCeil);
  const frameMat = lambert(WOOD_DARK);
  scene.add(box(0.08, 2.1, 0.12, frameMat, -1.24, 1.05, 2));
  scene.add(box(0.08, 2.1, 0.12, frameMat, -0.36, 1.05, 2));
  scene.add(box(0.96, 0.1, 0.12, frameMat, -0.8, 2.1, 2));
  // keep the player on the bedroom side of the threshold
  colliders.push(colliderAt(-0.8, 2.05, 0.95, 0.14));

  // The door itself — closed, it's a panelled door with a brass knob; when
  // mum appears it swings open into the hall (hinged on the right jamb).
  const door = new THREE.Group();
  door.position.set(-0.41, 0, 2.03);
  const doorWood = lambert(0x6e4f28);
  door.add(box(0.78, 2.05, 0.05, doorWood, -0.39, 1.025, 0));
  const doorPanel = lambert(0x5a3f1f);
  door.add(box(0.56, 0.72, 0.014, doorPanel, -0.39, 1.5, -0.026));
  door.add(box(0.56, 0.72, 0.014, doorPanel, -0.39, 0.62, -0.026));
  const knobMat = lambert(0xc8a040);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), knobMat);
  knob.position.set(-0.72, 1.0, -0.046);
  door.add(knob);
  const knobHall = knob.clone();
  knobHall.position.z = 0.046;
  door.add(knobHall);
  scene.add(door);
  const DOOR_OPEN = 1.65; // ~95°, flat against the right hall wall
  let doorAngle = 0;
  let doorTarget = 0;

  const mum = makeMumDoorway();
  mum.root.position.set(-0.8, 0, 2.5);
  mum.character.visible = false;
  scene.add(mum.root);

  // Always-on room tick: eases the door toward its target and runs mum's
  // idle while she's visible.
  let lastTickAt = 0;
  const roomTick = (nowMs: number): void => {
    const dt = lastTickAt === 0 ? 16 : Math.min(64, nowMs - lastTickAt);
    lastTickAt = nowMs;
    doorAngle += (doorTarget - doorAngle) * (1 - Math.exp(-dt / 150));
    door.rotation.y = doorAngle;
    if (mum.character.visible) mum.tick(nowMs);
  };

  // ---- window (east wall) with night glow
  const winFrame = lambert(WOOD_DARK);
  // frame: four bars around the opening
  scene.add(box(0.08, 0.08, 1.3, winFrame, 2.47, 2.1, 0.4));
  scene.add(box(0.08, 0.08, 1.3, winFrame, 2.47, 1.0, 0.4));
  scene.add(box(0.08, 1.18, 0.08, winFrame, 2.47, 1.55, -0.21));
  scene.add(box(0.08, 1.18, 0.08, winFrame, 2.47, 1.55, 1.01));
  // Night sky as a single textured backdrop (moon/stars baked in, so there's
  // no parallax swimming when viewed at an angle), oversized so the frame
  // always covers its edges.
  const winGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.28, 1.16),
    new THREE.MeshBasicMaterial({ map: makeNightSkyTexture() }),
  );
  winGlow.position.set(2.495, 1.55, 0.4);
  winGlow.rotation.y = -Math.PI / 2;
  scene.add(winGlow);
  scene.add(box(0.05, 1.06, 0.05, winFrame, 2.45, 1.55, 0.4)); // mullion
  scene.add(box(0.05, 0.05, 1.18, winFrame, 2.45, 1.55, 0.4));

  // ---- desk + monitor + chair (north-east area)
  const desk = new THREE.Group();
  const deskTop = box(1.6, 0.06, 0.7, lambert(WOOD), 0, 0.75, 0);
  deskTop.name = 'room-desk';
  desk.add(deskTop);
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

  // CRT monitor — cream shell like the 2D bezel, with the same brand badge,
  // control buttons, and power LED below the screen
  const crt = new THREE.Group();
  const shellMat = lambert(0xd0c8b8);
  crt.add(box(0.5, 0.42, 0.46, shellMat, 0, 0.21, 0));
  crt.add(box(0.54, 0.05, 0.5, shellMat, 0, -0.02, 0));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x0a1408 }),
  );
  screen.position.set(0, 0.21, 0.235);
  crt.add(screen);
  const brand = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.02),
    new THREE.MeshBasicMaterial({ map: makeBrandTexture(), transparent: true }),
  );
  brand.position.set(-0.08, 0.035, 0.2315);
  crt.add(brand);
  const vents = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.018),
    new THREE.MeshBasicMaterial({ map: makeVentTexture(), transparent: true }),
  );
  vents.position.set(0, 0.398, 0.2315);
  crt.add(vents);
  for (let i = 0; i < 3; i++) {
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.0065, 8),
      new THREE.MeshBasicMaterial({ color: 0x8a8274 }),
    );
    dot.position.set(0.13 + i * 0.03, 0.035, 0.2315);
    crt.add(dot);
  }
  const powerLed = new THREE.Mesh(
    new THREE.CircleGeometry(0.0075, 8),
    new THREE.MeshBasicMaterial({ color: 0x46d870 }),
  );
  powerLed.position.set(0.225, 0.035, 0.2315);
  crt.add(powerLed);
  crt.position.set(0.9, 0.78, -1.72);
  scene.add(crt);
  tagInteract(crt, { type: 'pc' });
  interactables.push(crt);

  // keyboard, with the same keycap grid + spacebar as the 2D one
  scene.add(box(0.42, 0.025, 0.16, lambert(0xc8c0b0), 0.9, 0.79, -1.32));
  const keycaps = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.145),
    new THREE.MeshLambertMaterial({ map: makeKeyboardTexture() }),
  );
  keycaps.rotation.x = -Math.PI / 2;
  keycaps.position.set(0.9, 0.8032, -1.32);
  scene.add(keycaps);

  // mousepad + mouse, to the right of the keyboard (same slate as 2D pad)
  scene.add(box(0.2, 0.006, 0.24, lambert(0x404b58), 1.32, 0.784, -1.32));
  // proper 90s two-button mouse: stepped cream body, humped back, split
  // buttons with a seam, and a cable arcing off toward the monitor
  const mouse = new THREE.Group();
  const SHELL = 0xd8d0c0;
  mouse.add(box(0.06, 0.013, 0.1, 0xb8b0a0, 0, 0.0065, 0)); // base
  mouse.add(box(0.055, 0.013, 0.094, SHELL, 0, 0.019, 0)); // mid shell
  const humpMat = lambert(SHELL);
  humpMat.flatShading = true;
  const hump = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    humpMat,
  );
  hump.scale.set(0.92, 0.78, 1.25);
  hump.position.set(0, 0.024, 0.012);
  mouse.add(hump);
  // buttons (front), tipped slightly down, with a dark split between them
  for (const bx2 of [-0.0145, 0.0145]) {
    const btn = box(0.025, 0.009, 0.032, 0xe2dacb, bx2, 0.0285, -0.032);
    btn.rotation.x = 0.14;
    mouse.add(btn);
  }
  mouse.add(box(0.0025, 0.009, 0.03, 0x6a6354, 0, 0.0285, -0.032)); // seam
  mouse.add(box(0.052, 0.003, 0.0025, 0x6a6354, 0, 0.0305, -0.015)); // button gap line
  // cable: out the front, swinging left and away behind the monitor
  const cablePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.012, -0.05),
    new THREE.Vector3(-0.01, 0.004, -0.13),
    new THREE.Vector3(-0.09, 0.003, -0.21),
    new THREE.Vector3(-0.24, 0.003, -0.3),
  ]);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(cablePath, 20, 0.0025, 6),
    lambert(0x3e382e),
  );
  mouse.add(cable);
  mouse.position.set(1.32, 0.787, -1.32);
  mouse.rotation.y = 0.12; // resting at a casual angle, as mice do
  scene.add(mouse);

  // chair
  const chair = makeDeskChair();
  chair.position.set(0.9, 0, -0.95);
  scene.add(chair);
  tagInteract(chair, { type: 'pc' });
  interactables.push(chair);
  colliders.push(colliderAt(0.9, -0.95, 0.5, 0.5, 0.9));

  // ---- bed (west wall)
  const bed = makeBed();
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

  // ---- chore items (which sets spawn depends on tonight's config)
  const addItem = (id: string, chore: ChoreId, name: string, obj: THREE.Object3D, x: number, y: number, z: number): void => {
    obj.position.set(x, y, z);
    tagInteract(obj, { type: 'item', itemId: id, chore, name });
    scene.add(obj);
    interactables.push(obj);
    itemObjects.set(id, obj);
    items.push({ id, chore, name });
  };

  const addTug = (id: string, chore: ChoreId, name: string, action: string, obj: THREE.Object3D, x: number, y: number, z: number): void => {
    obj.position.set(x, y, z);
    tagInteract(obj, { type: 'tug', itemId: id, chore, name, action });
    scene.add(obj);
    interactables.push(obj);
    itemObjects.set(id, obj);
    items.push({ id, chore, name });
  };

  const spawnPhysical = (slot: ChoreId, physical: RoomNightConfig['chores'][number]['physical'], count: number): void => {
    switch (physical) {
      case 'mugs':
        addItem('mug0', slot, 'mug', makeMug(0x3c6e8f), 0.28, 0.78, -1.42);
        addItem('mug1', slot, 'mug', makeMug(0x8f3c50), 1.5, 0.78, -1.38);
        addItem('mug2', slot, 'mug', makeMug(0x4a8f3c), 1.56, 0.78, -1.74);
        break;
      case 'wrappers': {
        addItem('wrap0', slot, 'wrapper', makeWrapper(0xd8a02a), 0.3, 0, 0.1);
        addItem('wrap1', slot, 'wrapper', makeWrapper(0x3ca8d8), 1.5, 0, -0.4);
        addItem('wrap2', slot, 'wrapper', makeWrapper(0xd84a8a), -0.55, 0, 1.1);
        addItem('wrap3', slot, 'wrapper', makeWrapper(0x8ad84a), 0.32, 0.78, -1.72);
        // Friday's fifth wrapper hides at the bed's edge, as is tradition.
        if (count >= 5) addItem('wrap4', slot, 'wrapper', makeWrapper(0xd8d84a), -1.42, 0, 0.42);
        break;
      }
      case 'laundry':
        addItem('cloth0', slot, 'hoodie', makeHoodie(0x4a5a8f), -0.9, 0, -0.2);
        addItem('cloth1', slot, 'sock', makeSock(0x8f8f3c), -0.2, 0, 1.35);
        addItem('cloth2', slot, 'shirt', makeShirt(0x8f5a3c), -1.9, 0.48, 0.2);
        break;
      case 'bed': {
        // Rumpled duvet corners at the foot of the bed; a tug settles them.
        const rumple = (tint: number): THREE.Mesh =>
          box(0.2, 0.12, 0.2, lambert(tint), 0, 0, 0);
        addTug('bed0', slot, 'duvet corner', 'Tug the duvet straight', rumple(0x7e5a9c), -1.68, 0.46, 0.42);
        addTug('bed1', slot, 'duvet corner', 'Tug the duvet straight', rumple(0x5e3a7c), -2.22, 0.46, 0.32);
        break;
      }
      case 'curtains': {
        // Bunched curtain gathers on each panel; a tug throws them open.
        const gather = (tint: number): THREE.Mesh =>
          box(0.09, 0.5, 0.3, lambert(tint), 0, 0, 0);
        addTug('curt0', slot, 'curtain', 'Throw the curtains open', gather(0x7e5a9c), 2.33, 1.35, -0.05);
        addTug('curt1', slot, 'curtain', 'Throw the curtains open', gather(0x7e5a9c), 2.33, 1.35, 0.85);
        break;
      }
    }
  };

  for (const chore of config.chores) {
    spawnPhysical(chore.slot, chore.physical, chore.count);
  }

  // ---- the landline (Wednesdays): a wall phone by the door, all Mum's
  if (config.phone) {
    const phone = new THREE.Group();
    const body = box(0.09, 0.2, 0.05, lambert(0xd8d0c0), 0, 0, 0);
    phone.add(body);
    phone.add(box(0.07, 0.08, 0.02, lambert(0x3a3630), 0, 0.03, -0.032)); // handset window
    phone.add(box(0.05, 0.015, 0.02, lambert(0xb8b0a0), 0, -0.055, -0.033)); // hook
    phone.position.set(0.35, 1.35, 1.97);
    scene.add(phone);
  }

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

  // curtain rod + panels framing the window (east wall); panels hang clear
  // of the wall so they pass in front of the sill instead of through it
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.74, 8), lambert(WOOD_DARK));
  rod.rotation.x = Math.PI / 2;
  rod.position.set(2.36, 2.26, 0.4);
  scene.add(rod);
  const curtainMat = lambert(0x6e4a8c);
  for (const cz of [-0.34, 1.14]) {
    const panel = box(0.06, 1.42, 0.26, curtainMat, 2.36, 1.5, cz);
    scene.add(panel);
    scene.add(box(0.045, 1.42, 0.1, curtainMat, 2.33, 1.46, cz + (cz < 0.4 ? 0.16 : -0.16)));
  }

  // window sill + a small potted plant (centered on the sill)
  scene.add(box(0.1, 0.045, 1.34, lambert(WOOD_DARK), 2.44, 0.96, 0.4));
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.07, 8), lambert(0xa05838));
  pot.position.set(2.44, 1.02, 0.78);
  scene.add(pot);
  const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), lambert(0x4a8f3c));
  plant.scale.set(1, 1.25, 1);
  plant.position.set(2.44, 1.1, 0.78);
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
  // leaning book: tilts top-LEFT so its upper corner rests against the last
  // upright book (x placed so the rotated corner lands on that book's face,
  // bottom corner grounded on the shelf top at y=1.7575)
  const leaning = box(0.03, 0.18, 0.15, lambert(0xb86a50), bx + 0.0384, 1.8458, -1.88);
  leaning.rotation.z = 0.42;
  scene.add(leaning);
  scene.add(box(0.07, 0.02, 0.07, lambert(0x4a4640), 1.22, 1.768, -1.88));
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.018, 0.055, 8), lambert(0xe8c33f, { emissive: 0x806820, emissiveIntensity: 0.35 }));
  cup.position.set(1.22, 1.806, -1.88);
  scene.add(cup);

  // sticky notes + wall calendar near the desk (north wall) — same colors,
  // texts, and tilts as the 2D PC-mode wall props
  const stickyDefs: { bg: string; lines: string[]; x: number; y: number; rot: number }[] = [
    { bg: '#f0e060', lines: ['dinner', '@ 7'], x: 0.34, y: 1.46, rot: -0.12 },
    { bg: '#88d8a0', lines: ['hydrate?'], x: 0.5, y: 1.32, rot: 0.14 },
    { bg: '#f0a0b0', lines: ['feed', 'goblins'], x: 0.27, y: 1.28, rot: 0.05 },
  ];
  for (const s of stickyDefs) {
    const note = new THREE.Mesh(
      new THREE.PlaneGeometry(0.075, 0.075),
      new THREE.MeshLambertMaterial({ map: makeStickyTexture(s.bg, s.lines) }),
    );
    note.position.set(s.x, s.y, -1.995);
    note.rotation.z = s.rot;
    scene.add(note);
  }
  const calendar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.17, 0.22),
    new THREE.MeshLambertMaterial({ map: makeCalendarTexture() }),
  );
  calendar.position.set(1.66, 1.46, -1.995);
  scene.add(calendar);
  const calRing = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.018), lambert(0x4a4640));
  calRing.position.set(1.66, 1.578, -1.994);
  scene.add(calRing);

  // Slippers by the bed, kicked off at slightly drunk angles,
  // as worn slippers always are)
  for (const [sx, sz, ry] of [
    [-1.36, 0.78, 0.25],
    [-1.32, 0.97, -0.45],
  ] as const) {
    const slipper = makeSlipper(0x9c4a3c);
    slipper.position.set(sx, 0, sz);
    slipper.rotation.y = ry;
    scene.add(slipper);
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

  // ---- lighting: a bounded warm key + non-shadowing practical and window fill
  const ambient = new THREE.AmbientLight(0x9a90b8, 0.55);
  scene.add(ambient);
  const lamp = new THREE.PointLight(0xffc878, 6, 0, 1.8);
  lamp.position.set(-0.4, 2.25, -0.2);
  scene.add(lamp);
  const keyLight = new THREE.SpotLight(0xffd39a, 4.5, 5.5, Math.PI / 3.2, 0.65, 1.4);
  keyLight.name = 'room-key-light';
  keyLight.position.set(-0.4, 2.45, -0.2);
  keyLight.target.position.set(0, 0.2, 0.15);
  keyLight.castShadow = false;
  scene.add(keyLight, keyLight.target);
  // visible lamp fixture — open cone needs DoubleSide or the inside face
  // is culled and the shade vanishes when seen from below
  const shadeMat = new THREE.MeshBasicMaterial({ color: 0xc9964a, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 24, 1, true), shadeMat);
  shade.position.set(-0.4, 2.38, -0.2);
  scene.add(shade);
  // dark rim around the shade mouth so it reads as a lamp (not a bright
  // blob) when viewed from directly underneath
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.009, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0x6a5026 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(-0.4, 2.3, -0.2);
  scene.add(rim);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd6a0 }),
  );
  bulb.position.set(-0.4, 2.33, -0.2);
  scene.add(bulb);
  const windowLight = new THREE.PointLight(0x4060a8, 2.2, 3.5, 1.6);
  windowLight.position.set(2.1, 1.6, 0.4);
  scene.add(windowLight);

  // Desk lamp — dark until Mum's "you'll ruin your eyes" beat flips it on.
  const deskLamp = new THREE.PointLight(0xffd8a0, 0, 2.2, 1.7);
  deskLamp.position.set(1.15, 1.05, -1.6);
  scene.add(deskLamp);
  const deskLampShadeMat = lambert(0x4a8f6a, { emissive: 0x000000, emissiveIntensity: 0 });
  const deskLampGroup = new THREE.Group();
  deskLampGroup.add(box(0.07, 0.02, 0.07, lambert(0x3a3630), 0, 0.01, 0)); // base
  deskLampGroup.add(box(0.016, 0.2, 0.016, lambert(0x3a3630), 0, 0.11, 0)); // stem
  const deskShade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.07, 12, 1, true), deskLampShadeMat);
  deskShade.position.set(0, 0.24, 0);
  deskLampGroup.add(deskShade);
  deskLampGroup.position.set(1.15, 0.78, -1.62);
  scene.add(deskLampGroup);

  const setHallLight = (on: boolean): void => {
    mum.setRevealed(on);
    doorTarget = on ? DOOR_OPEN : 0;
  };

  // The five-minute slide into proper evening: ambient dims, the window's
  // blue goes deeper and colder, the ceiling lamp carries more of the room.
  const setDusk = (f: number): void => {
    const t = Math.max(0, Math.min(1, f));
    ambient.intensity = 0.55 - 0.2 * t;
    windowLight.intensity = 2.2 - 1.1 * t;
    windowLight.color.setHSL(0.62, 0.45, 0.42 - 0.14 * t);
    lamp.intensity = 6 + 2 * t;
    keyLight.intensity = 4.5 + 2.5 * t;
  };

  const setDeskLamp = (on: boolean): void => {
    deskLamp.intensity = on ? 2.4 : 0;
    deskLampShadeMat.emissive.setHex(on ? 0xffd8a0 : 0x000000);
    deskLampShadeMat.emissiveIntensity = on ? 0.5 : 0;
  };

  return {
    scene,
    colliders,
    interactables,
    itemObjects,
    items,
    slots,
    monitorScreen: screen,
    npcSilhouette: mum.character,
    npcTick: roomTick,
    setHallLight,
    setDusk,
    setDeskLamp,
    playerSpawn: new THREE.Vector3(-0.6, 0, 0.9),
  };
}
