import * as THREE from 'three';
import { CHORE_DEFS, ChoreTracker, type ChoreDef, type ChoreTrackerEvent } from './chores';
import type { ChoreId } from '../director/director';
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
  private readonly defs: Readonly<Record<ChoreId, ChoreDef>>;
  private room: Room;
  private raycaster = new THREE.Raycaster();
  private hovered: THREE.Object3D | null = null;
  private highlightMats = new Map<THREE.MeshLambertMaterial, number>();
  private carriedObj: THREE.Object3D | null = null;
  private slotByItem = new Map<string, { target: 'tray' | 'bin' | 'basket'; index: number }>();
  private usedSlots: Record<'tray' | 'bin' | 'basket', Set<number>> = {
    tray: new Set(),
    bin: new Set(),
    basket: new Set(),
  };
  private readonly reducedMotion: boolean;
  onEnterPc: (() => void) | null = null;
  onTrackerEvents: ((events: ChoreTrackerEvent[]) => void) | null = null;
  onAct: ((kind: 'pickup' | 'place') => void) | null = null;

  constructor(room: Room, defs: Readonly<Record<ChoreId, ChoreDef>> = CHORE_DEFS) {
    this.room = room;
    this.defs = defs;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.tracker = new ChoreTracker(room.items.map((i) => ({ id: i.id, chore: i.chore })));
    this.raycaster.far = REACH;
  }

  /**
   * Find the interactable under the crosshair. While carrying, hits on other
   * items are skipped for *action* resolution so a full tray/bin doesn't block
   * placing onto it; the first skipped item is remembered for prompt purposes.
   */
  private resolveTarget(camera: THREE.Camera): {
    action: { obj: THREE.Object3D; interact: Interactable } | null;
    skippedItem: Interactable | null;
  } {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const candidates = this.room.interactables.filter((o) => o !== this.carriedObj);
    const hits = this.raycaster.intersectObjects(candidates, true);
    const carrying = this.tracker.carried !== null;
    let skippedItem: Interactable | null = null;
    for (const hit of hits) {
      let cur: THREE.Object3D | null = hit.object;
      while (cur) {
        const tag = cur.userData['interact'] as Interactable | undefined;
        if (tag) {
          if (carrying && tag.type === 'item') {
            skippedItem ??= tag; // look through items while carrying
            break;
          }
          return { action: { obj: cur, interact: tag }, skippedItem };
        }
        cur = cur.parent;
      }
    }
    return { action: null, skippedItem };
  }

  /** The interactable in the crosshair plus its prompt, or null. */
  update(camera: THREE.Camera, nowMs = 0): InteractPrompt | null {
    const { action, skippedItem } = this.resolveTarget(camera);
    const target = action?.obj ?? null;
    const interact = action?.interact ?? null;

    let prompt = interact ? this.promptFor(interact) : null;
    if (!prompt && skippedItem) prompt = this.promptFor(skippedItem);
    if (!prompt && this.tracker.carried) {
      prompt = { label: `E — Put down the ${this.carriedName()}`, actionable: true };
    }
    this.setHighlight(prompt && prompt.actionable ? target : null);
    // Keep the highlight steady for reduced motion; otherwise give it a gentle pulse.
    if (this.hovered && nowMs > 0) {
      const pulse = this.reducedMotion ? 0.35 : 0.3 + 0.13 * Math.sin(nowMs / 140);
      for (const mat of this.highlightMats.keys()) {
        mat.emissiveIntensity = pulse;
      }
    }
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
    const { action, skippedItem } = this.resolveTarget(camera);
    if (!action) {
      // Carrying and aiming at nothing actionable: put the item down at the
      // player's feet (guaranteed in-bounds and outside every collider).
      if (skippedItem || !this.carriedObj) return false;
      const obj = this.carriedObj;
      if (!this.tracker.putDown()) return false;
      obj.position.set(camera.position.x, 0, camera.position.z);
      obj.rotation.set(0, Math.random() * Math.PI * 2, 0);
      this.carriedObj = null;
      this.onAct?.('place');
      return true;
    }
    const { obj, interact } = action;

    switch (interact.type) {
      case 'pc':
        this.onEnterPc?.();
        return true;
      case 'tug': {
        const events = this.tracker.tug(interact.itemId);
        if (events.length === 0 && this.tracker.item(interact.itemId)?.state !== 'world') {
          return false; // already tugged
        }
        // The point visibly settles: duvet corner flattens, curtain opens.
        obj.scale.y = Math.max(0.2, obj.scale.y * 0.25);
        obj.position.y = Math.max(0.02, obj.position.y - 0.02);
        this.onTrackerEvents?.(events);
        this.onAct?.('place');
        return true;
      }
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
        this.slotByItem.set(carried.id, { target: interact.target, index: slotIdx });
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
      case 'tug': {
        const item = this.tracker.item(interact.itemId);
        if (!item || item.state !== 'world') {
          return { label: `${interact.name} — sorted`, actionable: false };
        }
        return { label: `E — ${interact.action}`, actionable: true };
      }
      case 'item': {
        if (this.tracker.carried) {
          return { label: `Hands full — carrying the ${this.carriedName()}`, actionable: false };
        }
        return { label: `E — Pick up ${interact.name}`, actionable: true };
      }
      case 'target': {
        const carried = this.tracker.carried;
        if (!carried) {
          const def = this.defs[interact.accepts];
          return { label: `${interact.name} (${def.plural} go here)`, actionable: false };
        }
        const carriedName = this.carriedName();
        if (carried.chore !== interact.accepts) {
          return { label: `The ${carriedName} doesn't go there`, actionable: false };
        }
        return { label: `E — Put ${carriedName} in ${interact.name}`, actionable: true };
      }
    }
  }

  private carriedName(): string {
    const carried = this.tracker.carried;
    if (!carried) return 'item';
    return this.room.items.find((i) => i.id === carried.id)?.name ?? 'item';
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
    const slot = this.slotByItem.get(itemId);
    if (!slot) return;
    this.slotByItem.delete(itemId);
    this.usedSlots[slot.target].delete(slot.index);
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
