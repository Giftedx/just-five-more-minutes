import * as THREE from 'three';

const EYE_HEIGHT = 1.55;
const SPEED = 2.6;
const RADIUS = 0.28;
/** Movement smoothing time constants (s): quick to start, quicker to stop. */
const ACCEL_TAU = 0.055;
const DECEL_TAU = 0.075;

/** First-person controller: WASD + mouse look, AABB push-out collision. */
export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;
  yaw = Math.PI; // face the desk area initially? spawn faces door->desk
  pitch = 0;
  pos: THREE.Vector3;
  private keys = new Set<string>();
  private vel = new THREE.Vector2(0, 0); // world-space ground velocity
  private colliders: THREE.Box3[];
  private bounds: { minX: number; maxX: number; minZ: number; maxZ: number };

  constructor(camera: THREE.PerspectiveCamera, spawn: THREE.Vector3, colliders: THREE.Box3[]) {
    this.camera = camera;
    this.pos = spawn.clone();
    this.colliders = colliders;
    this.bounds = { minX: -2.5 + RADIUS, maxX: 2.5 - RADIUS, minZ: -2 + RADIUS, maxZ: 2 - RADIUS };
    // Face the chair/PC on spawn: forward = (-sin(yaw), -cos(yaw)).
    const toChairX = 0.9 - spawn.x;
    const toChairZ = -0.95 - spawn.z;
    this.yaw = Math.atan2(-toChairX, -toChairZ);
    this.apply();
  }

  keyDown(code: string): void {
    this.keys.add(code);
  }

  keyUp(code: string): void {
    this.keys.delete(code);
  }

  clearKeys(): void {
    this.keys.clear();
    this.vel.set(0, 0);
  }

  mouseLook(dx: number, dy: number): void {
    this.yaw -= dx * 0.0024;
    this.pitch -= dy * 0.0024;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  update(dt: number): void {
    let fx = 0;
    let fz = 0;
    if (this.keys.has('KeyW')) fz += 1;
    if (this.keys.has('KeyS')) fz -= 1;
    if (this.keys.has('KeyA')) fx -= 1;
    if (this.keys.has('KeyD')) fx += 1;

    // target world-space velocity from input
    let tx = 0;
    let tz = 0;
    const moving = fx !== 0 || fz !== 0;
    if (moving) {
      const len = Math.hypot(fx, fz);
      fx /= len;
      fz /= len;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // forward = (-sin, -cos), right = (cos, -sin) on the ground plane
      tx = (-sin * fz + cos * fx) * SPEED;
      tz = (-cos * fz - sin * fx) * SPEED;
    }

    // exponential approach: brisk ramp-up, slightly snappier stop — kills the
    // harsh start/stop jerk without feeling floaty
    const tau = moving ? ACCEL_TAU : DECEL_TAU;
    const a = 1 - Math.exp(-dt / tau);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.y += (tz - this.vel.y) * a;
    if (!moving && this.vel.lengthSq() < 0.0004) this.vel.set(0, 0);

    if (this.vel.lengthSq() > 0) {
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.y * dt;
      this.collide();
    }
    this.apply();
  }

  private collide(): void {
    this.pos.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.pos.x));
    this.pos.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, this.pos.z));
    // Two relaxation passes so push-out from one box can't leave us inside a
    // neighbouring one (stops corner jitter between adjacent colliders).
    for (let pass = 0; pass < 2; pass++) this.pushOut();
  }

  private pushOut(): void {
    for (const b of this.colliders) {
      const nx = Math.max(b.min.x, Math.min(b.max.x, this.pos.x));
      const nz = Math.max(b.min.z, Math.min(b.max.z, this.pos.z));
      const dx = this.pos.x - nx;
      const dz = this.pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < RADIUS * RADIUS) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          this.pos.x = nx + (dx / d) * RADIUS;
          this.pos.z = nz + (dz / d) * RADIUS;
        } else {
          // center inside the box: push out along smallest axis
          const pushLeft = Math.abs(this.pos.x - b.min.x);
          const pushRight = Math.abs(b.max.x - this.pos.x);
          const pushNear = Math.abs(this.pos.z - b.min.z);
          const pushFar = Math.abs(b.max.z - this.pos.z);
          const m = Math.min(pushLeft, pushRight, pushNear, pushFar);
          if (m === pushLeft) this.pos.x = b.min.x - RADIUS;
          else if (m === pushRight) this.pos.x = b.max.x + RADIUS;
          else if (m === pushNear) this.pos.z = b.min.z - RADIUS;
          else this.pos.z = b.max.z + RADIUS;
        }
      }
    }
  }

  private apply(): void {
    this.camera.position.set(this.pos.x, EYE_HEIGHT, this.pos.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
  }
}
