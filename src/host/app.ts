import * as THREE from 'three';
import { MmoGame } from '../mmo/render/game';
import { InteractSystem } from './interact';
import { InputRouter, type Mode } from './input';
import { PlayerController } from './player';
import { buildRoom, type Room } from './room';

const MONITOR_REFRESH_MS = 100; // ~10fps mirror on the 3D monitor

export interface AppHooks {
  /** Player sat down / stood up. */
  onModeChange?: (mode: Mode) => void;
  /** Player pressed 1-4 while a prompt was open. */
  onPromptOption?: (option: number) => void;
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
  private monitorRefreshAcc = 0;
  private currentPrompt: { label: string; actionable: boolean } | null = null;

  constructor(root: HTMLElement, opts: { speed?: number; seed?: number } = {}) {
    this.root = root;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.domElement.id = 'room-canvas';
    root.appendChild(this.renderer.domElement);

    this.room = buildRoom();
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 50);
    this.player = new PlayerController(this.camera, this.room.playerSpawn, this.room.colliders);
    this.interact = new InteractSystem(this.room);
    this.mmo = new MmoGame(opts.seed, opts.speed ?? 1);

    // PC overlay (hidden until the player sits down)
    this.pcWrap = document.createElement('div');
    this.pcWrap.className = 'crt-wrap';
    this.pcWrap.style.display = 'none';
    const bezel = document.createElement('div');
    bezel.className = 'crt-bezel';
    this.crtScreen = document.createElement('div');
    this.crtScreen.className = 'crt-screen';
    this.crtScreen.appendChild(this.mmo.canvas);
    const crtLabel = document.createElement('div');
    crtLabel.className = 'crt-label';
    crtLabel.textContent = 'ESC / Q — STAND UP';
    bezel.appendChild(this.crtScreen);
    bezel.appendChild(crtLabel);
    this.pcWrap.appendChild(bezel);
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
    this.interact.onEnterPc = () => this.enterPc();

    window.addEventListener('resize', this.onResize);
    this.fitCrt();
  }

  get prompt(): { label: string; actionable: boolean } | null {
    return this.currentPrompt;
  }

  enterPc(): void {
    if (this.mode === 'pc') return;
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
    // The sim always ticks (unless globally paused).
    this.mmo.paused = this.paused;
    this.mmo.update(dtMs, this.mode === 'room');

    if (this.mode === 'room') {
      if (!this.paused) {
        this.player.update(dt);
        this.currentPrompt = this.interact.update(this.camera, performance.now());
        this.interact.updateCarried(this.camera);
      }
      this.monitorRefreshAcc += dtMs;
      if (this.monitorRefreshAcc >= MONITOR_REFRESH_MS) {
        this.monitorRefreshAcc = 0;
        this.monitorTex.needsUpdate = true;
      }
      this.renderer.render(this.room.scene, this.camera);
    } else {
      this.currentPrompt = null;
    }
  }

  dispose(): void {
    this.router.dispose();
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.root.innerHTML = '';
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.fitCrt();
  };

  private fitCrt(): void {
    const scale = Math.max(
      1,
      Math.floor(Math.min((window.innerWidth - 140) / 320, (window.innerHeight - 160) / 240)),
    );
    this.crtScreen.style.width = `${320 * scale}px`;
    this.crtScreen.style.height = `${240 * scale}px`;
  }
}
