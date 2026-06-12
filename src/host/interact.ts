import * as THREE from 'three';
import { CHORE_DEFS, ChoreTracker, type ChoreTrackerEvent } from './chores';
import type { Interactable, Room } from './room';

const REACH = 2.5;

export interface InteractPrompt {
  label: string;
  /** Whether pressing E right now does something. */
  actionable: boolean;
}

/**
 * Center-screen raycast interaction: hover highlight, E-to-act, carry one
 * item at a time, place onto matching targets with generous snapping.
 */
export class InteractSystem {
  readonly tracker: ChoreTracker;
  private room: Room;
  private raycaster = new THREE.Raycaster();
  private hovered: THREE.Object3D | null = null;
  private highlightMats = new Map<THREE.MeshLambertMaterial, number>();
  private carriedObj: THREE.Object3D | null = null;
  private slotByItem = new Map<string, number>();
  private usedSlots: Record<'tray' | 'bin' | 'basket', Set<number>> = {
    tray: new Set(),
    bin: new Set(),
    basket: new Set(),
  };
  onEnterPc: (() => void) | null = null;
  onTrackerEvents: ((events: ChoreTrackerEvent[]) => void) | null = null;
  onAct: ((kind: 'pickup' | 'place') => void) | null = null;

  constructor(room: Room) {
    this.room = room;
    this.tracker = new ChoreTracker(room.items.map((i) => ({ id: i.id, chore: i.chore })));
    this.raycaster.far = REACH;
  }

  /** The interactable in the crosshair plus its prompt, or null. */
  update(camera: THREE.Camera): InteractPrompt | null {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const candidates = this.room.interactables.filter((o) => o !== this.carriedObj);
    const hits = this.raycaster.intersectObjects(candidates, true);
    let target: THREE.Object3D | null = null;
    let interact: Interactable | null = null;
    const hit = hits[0];
    if (hit) {
      let cur: THREE.Object3D | null = hit.object;
      while (cur) {
        const tag = cur.userData['interact'] as Interactable | undefined;
        if (tag) {
          target = cur;
          interact = tag;
          break;
        }
        cur = cur.parent;
      }
    }

    const prompt = interact ? this.promptFor(interact) : null;
    this.setHighlight(prompt && prompt.actionable ? target : null);
    return prompt;
  }

  /** Carried item follows the camera. Call every frame. */
  updateCarried(camera: THREE.PerspectiveCamera): void {
    if (!this.carriedObj) return;
    const offset = new THREE.Vector3(0.28, -0.32, -0.55);
    offset.applyQuaternion(camera.quaternion);
    this.carriedObj.position.copy(camera.position).add(offset);
    this.carriedObj.quaternion.copy(camera.quaternion);
  }

  /** Press E. Returns true when something happened. */
  act(camera: THREE.Camera): boolean {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const candidates = this.room.interactables.filter((o) => o !== this.carriedObj);
    const hits = this.raycaster.intersectObjects(candidates, true);
    const hit = hits[0];
    if (!hit) return false;
    let cur: THREE.Object3D | null = hit.object;
    let interact: Interactable | null = null;
    let obj: THREE.Object3D | null = null;
    while (cur) {
      const tag = cur.userData['interact'] as Interactable | undefined;
      if (tag) {
        interact = tag;
        obj = cur;
        break;
      }
      cur = cur.parent;
    }
    if (!interact || !obj) return false;

    switch (interact.type) {
      case 'pc':
        this.onEnterPc?.();
        return true;
      case 'item': {
        if (!this.tracker.canPickUp(interact.itemId)) return false;
        const events = this.tracker.pickUp(interact.itemId);
        this.freeSlot(interact.itemId);
        this.carriedObj = obj;
        this.onTrackerEvents?.(events);
        this.onAct?.('pickup');
        return true;
      }
      case 'target': {
        const carried = this.tracker.carried;
        if (!carried || carried.chore !== interact.accepts) return false;
        const slotIdx = this.takeSlot(interact.target);
        const slot = this.room.slots[interact.target][slotIdx];
        if (slot && this.carriedObj) {
          this.carriedObj.position.copy(slot);
          this.carriedObj.rotation.set(0, Math.random() * Math.PI * 2, 0);
        }
        this.slotByItem.set(carried.id, slotIdx);
        this.carriedObj = null;
        const events = this.tracker.placeCarried();
        this.onTrackerEvents?.(events);
        this.onAct?.('place');
        return true;
      }
    }
  }

  private promptFor(interact: Interactable): InteractPrompt {
    switch (interact.type) {
      case 'pc':
        return { label: 'E — Sit down at Mudwick Online', actionable: true };
      case 'item': {
        if (this.tracker.carried) {
          return { label: 'Hands full', actionable: false };
        }
        return { label: `E — Pick up ${interact.name}`, actionable: true };
      }
      case 'target': {
        const carried = this.tracker.carried;
        if (!carried) {
          const def = CHORE_DEFS[interact.accepts];
          return { label: `${interact.name} (${def.noun}s go here)`, actionable: false };
        }
        const carriedName = this.room.items.find((i) => i.id === carried.id)?.name ?? 'item';
        if (carried.chore !== interact.accepts) {
          return { label: `The ${carriedName} doesn't go there`, actionable: false };
        }
        return { label: `E — Put ${carriedName} in ${interact.name}`, actionable: true };
      }
    }
  }

  private takeSlot(target: 'tray' | 'bin' | 'basket'): number {
    const used = this.usedSlots[target];
    const max = this.room.slots[target].length;
    for (let i = 0; i < max; i++) {
      if (!used.has(i)) {
        used.add(i);
        return i;
      }
    }
    return 0;
  }

  private freeSlot(itemId: string): void {
    const idx = this.slotByItem.get(itemId);
    if (idx === undefined) return;
    this.slotByItem.delete(itemId);
    const item = this.tracker.item(itemId);
    if (!item) return;
    const target = CHORE_DEFS[item.chore].target as 'tray' | 'bin' | 'basket';
    this.usedSlots[target].delete(idx);
  }

  private setHighlight(obj: THREE.Object3D | null): void {
    if (obj === this.hovered) return;
    // restore old
    for (const [mat, emissive] of this.highlightMats) {
      mat.emissive.setHex(emissive);
      mat.emissiveIntensity = 1;
    }
    this.highlightMats.clear();
    this.hovered = obj;
    if (!obj) return;
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) {
        this.highlightMats.set(o.material, o.material.emissive.getHex());
        o.material.emissive.setHex(0xffb84a);
        o.material.emissiveIntensity = 0.35;
      }
    });
  }
}
