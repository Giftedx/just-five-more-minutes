import { describe, expect, it } from 'vitest';
import { planCarryTarget, planNight } from './e2e-night.mjs';

describe('planNight', () => {
  it('plans carry and tug items in registry order from their live positions', () => {
    const registry = [
      {
        type: 'target',
        target: 'tray',
        accepts: 'mugs',
        name: 'tray',
        position: [0.05, 0, 1.72],
      },
      {
        type: 'item',
        itemId: 'mug0',
        chore: 'mugs',
        name: 'mug',
        position: [0.28, 0.78, -1.42],
      },
      {
        type: 'tug',
        itemId: 'bed0',
        chore: 'wrappers',
        name: 'duvet corner',
        action: 'Tug the duvet straight',
        position: [-1.68, 0.46, 0.42],
      },
    ];

    const plan = planNight(registry);

    expect(plan.map(({ itemId, verb }) => ({ itemId, verb }))).toEqual([
      { itemId: 'mug0', verb: 'Pick up' },
      { itemId: 'bed0', verb: 'Tug the duvet straight' },
    ]);
    expect(plan).toHaveLength(2);
    for (const [index, item] of [registry[1], registry[2]].entries()) {
      const step = plan[index]!;
      expect(step.look).toEqual(item!.position);
      expect(Math.hypot(
        step.stand[0] - item!.position[0]!,
        step.stand[1] - item!.position[2]!,
      )).toBeLessThanOrEqual(1.2);
    }
    expect(planCarryTarget(registry, 'mug0')).toMatchObject({
      look: [0.05, 0, 1.72],
    });
  });
});
