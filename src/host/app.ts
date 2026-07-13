import * as THREE from 'three';
import { MmoGame } from '../mmo/render/game';
import type { SimCharacter } from '../mmo/sim/sim';
import { CHORE_DEFS, type ChoreDef } from './chores';
import type { ChoreId } from '../director/director';
import { InteractSystem } from './interact';
import { InputRouter, type Mode } from './input';
import { PlayerController } from './player';
import { buildRoom, MONDAY_ROOM_CONFIG, type Room, type RoomNightConfig } from './room';

const MONITOR_REFRESH_MS = 100; // ~10fps mirror on the 3D monitor

export interface AppHooks {
  /** Player sat down / stood up. */
  onModeChange?: (mode: Mode) => void;
  /** Player pressed 1-4 while a prompt was open. */
  onPromptOption?: (option: number) => void;
}

export interface HostAppOpts {
  speed?: number;
  seed?: number;
  /** Tonight's slot -> physical chore staging. Defaults to Monday. */
  roomConfig?: RoomNightConfig;
  choreDefs?: Readonly<Record<ChoreId, ChoreDef>>;
  /** Persistent Mudwick character carried in from the career file. */
  character?: SimCharacter;
  doubleXp?: boolean;
}

/**
 * The host shell: owns the Three.js room, the Mudwick game, the input
 * router, and the Room/PC mode transitions. The Mudwick sim keeps ticking
 * regardless of mode — that's the whole joke.
 */
export class HostApp {
  readonly renderer: THREE.WebGLRenderer;
  readonly room: Room;
  readonly camera: THREE.PerspectiveCamera;
  readonly player: PlayerController;
  readonly interact: InteractSystem;
  readonly mmo: MmoGame;
  readonly router: InputRouter;
  readonly pcWrap: HTMLDivElement;
  mode: Mode = 'room';
  hooks: AppHooks = {};
  /** Pause flag (pointer-lock loss / tab hidden) — phase 9 wires this. */
  paused = false;

  private root: HTMLElement;
  private crtScreen: HTMLDivElement;
  private monitorTex: THREE.CanvasTexture;
  private homeworkTex: THREE.CanvasTexture | null = null;
  private homeworkOn = false;
  private monitorRefreshAcc = MONITOR_REFRESH_MS;
  private currentPrompt: { label: string; actionable: boolean } | null = null;
  /** 2D stand-ins for the chore items on the 3D desk, keyed by item id. */
  private deskItemEls = new Map<string, HTMLElement>();
  private deskItemOrig = new Map<string, THREE.Vector3>();

  constructor(root: HTMLElement, opts: HostAppOpts = {}) {
    this.root = root;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.domElement.id = 'room-canvas';
    root.appendChild(this.renderer.domElement);

    this.room = buildRoom(opts.roomConfig ?? MONDAY_ROOM_CONFIG);
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 50);
    this.player = new PlayerController(this.camera, this.room.playerSpawn, this.room.colliders);
    this.interact = new InteractSystem(this.room, opts.choreDefs ?? CHORE_DEFS);
    this.mmo = new MmoGame(opts.seed, opts.speed ?? 1, {
      character: opts.character,
      doubleXp: opts.doubleXp,
    });

    // PC overlay (hidden until the player sits down)
    this.pcWrap = document.createElement('div');
    this.pcWrap.className = 'crt-wrap';
    this.pcWrap.style.display = 'none';
    const bezel = document.createElement('div');
    bezel.className = 'crt-bezel';
    this.crtScreen = document.createElement('div');
    this.crtScreen.className = 'crt-screen';
    this.crtScreen.appendChild(this.mmo.canvas);
    const crtFlicker = document.createElement('div');
    crtFlicker.className = 'crt-flicker';
    this.crtScreen.appendChild(crtFlicker);
    const crtLabel = document.createElement('div');
    crtLabel.className = 'crt-label';
    crtLabel.textContent = 'E — STAND UP';
    const crtBrand = document.createElement('div');
    crtBrand.className = 'crt-brand';
    crtBrand.textContent = 'VISIONMASTER 240';
    const crtControls = document.createElement('div');
    crtControls.className = 'crt-controls';
    for (let i = 0; i < 3; i++) crtControls.appendChild(document.createElement('span'));
    bezel.appendChild(this.crtScreen);
    bezel.appendChild(crtLabel);
    bezel.appendChild(crtBrand);
    bezel.appendChild(crtControls);
    const crtStand = document.createElement('div');
    crtStand.className = 'crt-stand';
    const deskProps = document.createElement('div');
    deskProps.className = 'crt-desk-props';
    const deskKb = document.createElement('div');
    deskKb.className = 'crt-kb';
    const deskMouse = document.createElement('div');
    deskMouse.className = 'crt-mouse';
    // Wall props mirroring the 3D room's north wall: three sticky notes left
    // of the monitor (yellow/green/pink, same as buildRoom), calendar right,
    // book shelf + trophy directly above.
    const wallNote = document.createElement('div');
    wallNote.className = 'crt-wall-note';
    wallNote.textContent = 'dinner @ 7';
    const wallNote2 = document.createElement('div');
    wallNote2.className = 'crt-wall-note crt-wall-note-2';
    wallNote2.textContent = 'hydrate?';
    const wallNote3 = document.createElement('div');
    wallNote3.className = 'crt-wall-note crt-wall-note-3';
    wallNote3.textContent = 'feed goblins';
    const wallCal = document.createElement('div');
    wallCal.className = 'crt-wall-calendar';
    wallCal.textContent = 'JUNE';
    const shelf = document.createElement('div');
    shelf.className = 'crt-shelf';
    // Exact 3D book dimensions in meters, scaled by the --wall px/m variable.
    const bookWidths = [0.034, 0.041, 0.048, 0.034, 0.041];
    const bookHeights = [0.16, 0.202, 0.188, 0.174, 0.16];
    const bookColors = ['#8f3c50', '#3c6e8f', '#c8a040', '#4a8f3c', '#6e4a8c'];
    for (let i = 0; i < 5; i++) {
      const b = document.createElement('span');
      b.className = 'crt-book';
      b.style.width = `calc(var(--wall, 420px) * ${bookWidths[i]})`;
      b.style.height = `calc(var(--wall, 420px) * ${bookHeights[i]})`;
      b.style.background = bookColors[i] ?? '#888';
      shelf.appendChild(b);
    }
    const leanBook = document.createElement('span');
    leanBook.className = 'crt-book crt-book-lean';
    shelf.appendChild(leanBook);
    const trophy = document.createElement('span');
    trophy.className = 'crt-trophy';
    shelf.appendChild(trophy);
    deskProps.appendChild(deskKb);
    deskProps.appendChild(deskMouse);
    deskProps.appendChild(wallNote);
    deskProps.appendChild(wallNote2);
    deskProps.appendChild(wallNote3);
    deskProps.appendChild(wallCal);
    deskProps.appendChild(shelf);
    const deskPad = document.createElement('div');
    deskPad.className = 'crt-mousepad';
    deskProps.insertBefore(deskPad, deskMouse);
    // Chore items that live on the 3D desk, mirrored here while they're
    // actually still sitting there (synced on every sit-down).
    const deskItems: [string, string][] = [
      ['mug0', 'crt-mug crt-mug-blue'],
      ['mug1', 'crt-mug crt-mug-red'],
      ['mug2', 'crt-mug crt-mug-green crt-mug-rear'],
      ['wrap3', 'crt-wrapper'],
    ];
    for (const [id, cls] of deskItems) {
      const el = document.createElement('div');
      el.className = cls;
      deskProps.appendChild(el);
      this.deskItemEls.set(id, el);
      const obj = this.room.itemObjects.get(id);
      if (obj) this.deskItemOrig.set(id, obj.position.clone());
    }
    this.pcWrap.appendChild(bezel);
    this.pcWrap.appendChild(crtStand);
    this.pcWrap.appendChild(deskProps);
    root.appendChild(this.pcWrap);
    this.mmo.attachInput(this.crtScreen);

    // Monitor mirror texture (same canvas the PC overlay shows)
    this.monitorTex = new THREE.CanvasTexture(this.mmo.canvas);
    this.monitorTex.magFilter = THREE.NearestFilter;
    this.monitorTex.minFilter = THREE.LinearFilter;
    this.monitorTex.colorSpace = THREE.SRGBColorSpace;
    const screenMat = this.room.monitorScreen.material as THREE.MeshBasicMaterial;
    screenMat.map = this.monitorTex;
    screenMat.color = new THREE.Color(0xffffff);
    screenMat.needsUpdate = true;

    // Input routing
    this.router = new InputRouter(this.renderer.domElement);
    this.router.onMoveKey = (code, down) => {
      if (down) this.player.keyDown(code);
      else this.player.keyUp(code);
    };
    this.router.onLook = (dx, dy) => this.player.mouseLook(dx, dy);
    this.router.onInteract = () => {
      if (this.mode === 'room' && !this.paused) this.interact.act(this.camera);
    };
    this.router.onStandUp = () => this.exitPc();
    this.router.onRoomClick = () => {
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.renderer.domElement.requestPointerLock();
      }
    };
    this.router.onPromptOption = (n) => this.hooks.onPromptOption?.(n);
    this.router.onClearKeys = () => this.player.clearKeys();
    this.interact.onEnterPc = () => this.enterPc();

    window.addEventListener('resize', this.onResize);
    this.fitCrt();
  }

  get prompt(): { label: string; actionable: boolean } | null {
    return this.currentPrompt;
  }

  /**
   * The oldest trick: flip the 3D monitor to a very serious document. The
   * PC-mode overlay is unaffected — the ruse only matters from the doorway.
   */
  setHomework(on: boolean): void {
    if (on === this.homeworkOn) return;
    this.homeworkOn = on;
    const mat = this.room.monitorScreen.material as THREE.MeshBasicMaterial;
    if (on) {
      this.homeworkTex ??= new THREE.CanvasTexture(drawHomeworkDoc());
      this.homeworkTex.colorSpace = THREE.SRGBColorSpace;
      mat.map = this.homeworkTex;
    } else {
      mat.map = this.monitorTex;
    }
    mat.needsUpdate = true;
  }

  /** Show a 2D desk item only while it's genuinely still on the 3D desk. */
  private syncDeskProps(): void {
    for (const [id, el] of this.deskItemEls) {
      const item = this.interact.tracker.item(id);
      const obj = this.room.itemObjects.get(id);
      const orig = this.deskItemOrig.get(id);
      const onDesk =
        !!item && item.state === 'world' && !!obj && !!orig && obj.position.distanceToSquared(orig) < 0.01;
      el.style.display = onDesk ? 'block' : 'none';
    }
  }

  enterPc(): void {
    if (this.mode === 'pc') return;
    this.syncDeskProps();
    this.mode = 'pc';
    this.router.mode = 'pc';
    this.player.clearKeys();
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer.domElement.style.display = 'none';
    this.pcWrap.style.display = 'flex';
    this.fitCrt();
    this.hooks.onModeChange?.('pc');
  }

  exitPc(): void {
    if (this.mode === 'room') return;
    this.mmo.dismissUi();
    this.mode = 'room';
    this.router.mode = 'room';
    this.player.clearKeys();
    this.pcWrap.style.display = 'none';
    this.renderer.domElement.style.display = 'block';
    this.requestPointerLock();
    this.hooks.onModeChange?.('room');
  }

  requestPointerLock(): void {
    // Chrome enforces a cooldown after Esc-exiting pointer lock; the request
    // can reject. The pause overlay stays up, so the player just clicks again.
    const p = this.renderer.domElement.requestPointerLock() as unknown;
    if (p instanceof Promise) p.catch(() => undefined);
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.renderer.domElement;
  }

  /** Advance everything by dtMs of real time. */
  update(dtMs: number): void {
    const dt = dtMs / 1000;
    this.monitorRefreshAcc += dtMs;
    const monitorDue = this.monitorRefreshAcc >= MONITOR_REFRESH_MS;
    const renderMmo = this.mode === 'pc' || monitorDue;
    // The sim always ticks (unless globally paused).
    this.mmo.paused = this.paused;
    this.mmo.update(dtMs, this.mode === 'room', renderMmo);
    if (monitorDue) {
      this.monitorRefreshAcc %= MONITOR_REFRESH_MS;
      this.monitorTex.needsUpdate = true;
    }

    if (this.mode === 'room') {
      if (!this.paused) {
        this.player.update(dt);
        this.currentPrompt = this.interact.update(this.camera, performance.now());
        this.interact.updateCarried(this.camera);
        this.room.npcTick(performance.now()); // door swing + mum idle
      }
      this.renderer.render(this.room.scene, this.camera);
    } else {
      this.currentPrompt = null;
    }
  }

  dispose(): void {
    this.router.dispose();
    window.removeEventListener('resize', this.onResize);
    this.monitorTex.dispose();
    this.homeworkTex?.dispose();
    // Free GPU resources created in buildRoom (texture dispose is idempotent,
    // so the monitor screen's map appearing here too is fine).
    this.room.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        const mat = m as THREE.Material & { map?: THREE.Texture | null };
        mat.map?.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.root.innerHTML = '';
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.fitCrt();
  };

  private fitCrt(): void {
    // Reserve ~280px of vertical breathing room (desk + shelf above the
    // monitor) when picking the integer pixel scale for the screen.
    const scale = Math.max(
      1,
      Math.floor(Math.min((window.innerWidth - 140) / 320, (window.innerHeight - 280) / 240)),
    );
    this.crtScreen.style.width = `${320 * scale}px`;
    this.crtScreen.style.height = `${240 * scale}px`;
    // Rest the monitor on the desk: bottom padding sinks the stand foot just
    // past the desk's top edge, clamped so the bezel never spills off-screen.
    const clusterH = 240 * scale + 110; // screen + bezel padding + stand
    // Keep ~200px above the bezel for the shelf before granting desk padding,
    // but never sink the monitor so low it swallows the keyboard (floor 56px).
    const pad = Math.max(56, Math.min(0.12 * window.innerHeight, window.innerHeight - clusterH - 200));
    this.pcWrap.style.paddingBottom = `${pad}px`;
    // Anchor wall/desk props to the bezel regardless of scale.
    const half = 160 * scale + 30;
    const crtTop = pad + 240 * scale + 110;
    this.pcWrap.style.setProperty('--crt-half', `${half}px`);
    this.pcWrap.style.setProperty('--crt-top', `${crtTop}px`);
    // Wall scale (px per meter of 3D wall) for the shelf: true perspective
    // scale is ~2.06*half, shrunk if needed so the tallest book (0.202m) plus
    // the shelf board (0.035m) fits in the headroom above the bezel.
    const headroom = window.innerHeight - crtTop - 24;
    const wall = Math.max(220, Math.min(2.06 * half, headroom / 0.24));
    this.pcWrap.style.setProperty('--wall', `${wall.toFixed(0)}px`);
  }
}

/** A very convincing 320x240 Word-2003 document. The essay is due Friday. */
function drawHomeworkDoc(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Application chrome
  ctx.fillStyle = '#d4d0c8';
  ctx.fillRect(0, 0, 320, 240);
  ctx.fillStyle = '#0a246a';
  ctx.fillRect(0, 0, 320, 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('homework.doc - Word', 5, 11);
  ctx.fillStyle = '#d4d0c8';
  ctx.fillRect(302, 3, 14, 10);
  ctx.strokeStyle = '#404040';
  ctx.strokeRect(302.5, 3.5, 13, 10);
  ctx.fillStyle = '#000000';
  ctx.font = '8px monospace';
  ctx.fillText('x', 306, 11);
  // Menu + toolbar strips
  ctx.fillText('File  Edit  View  Insert  Format  Help', 6, 26);
  ctx.fillStyle = '#c0bcb4';
  ctx.fillRect(0, 30, 320, 12);

  // The page
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(30, 48, 260, 184);
  ctx.strokeStyle = '#808080';
  ctx.strokeRect(30.5, 48.5, 259, 183);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 10px serif';
  ctx.fillText('The Industrial Revolution', 48, 68);
  ctx.font = '8px serif';
  ctx.fillStyle = '#222222';
  const lines = [
    'The Industrial Revolution changed many',
    'things. Before it, things were different,',
    'and afterwards they were not the same.',
    '',
    'One major factor was the economy, which',
    'needed several people. Goblins did not',
    'exist yet, which historians agree was',
    'a missed opportunity for the mines.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, 48, 86 + i * 12));
  // Blinking cursor, caught mid-blink forever.
  ctx.fillRect(48 + 148, 172, 1, 9);
  return canvas;
}
