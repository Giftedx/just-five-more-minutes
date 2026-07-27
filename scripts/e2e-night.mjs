const CHORE_LINES = ['mugs', 'wrappers', 'laundry'];
const PICK_UP = 'Pick up';
const APPROACH_DISTANCE = 0.8;

const positionOf = (entry) => {
  if (
    !Array.isArray(entry?.position)
    || entry.position.length !== 3
    || entry.position.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(`interaction has no world position: ${JSON.stringify(entry)}`);
  }
  return entry.position;
};

/** Move 0.8 m from a prop toward the room centre. */
export function standNear(position) {
  const [x, , z] = position;
  const radius = Math.hypot(x, z);
  const towardX = radius > 0.001 ? -x / radius : 0;
  const towardZ = radius > 0.001 ? -z / radius : 1;
  return [x + towardX * APPROACH_DISTANCE, z + towardZ * APPROACH_DISTANCE];
}

/** Build one action for each live chore item. Keep the host registry order. */
export function planNight(registry) {
  const targetChores = new Set(
    registry.filter((entry) => entry.type === 'target').map((entry) => entry.accepts),
  );

  return registry.flatMap((entry) => {
    if (entry.type !== 'item' && entry.type !== 'tug') return [];
    if (entry.type === 'item' && !targetChores.has(entry.chore)) {
      throw new Error(`no target accepts chore ${entry.chore} for ${entry.itemId}`);
    }
    const look = [...positionOf(entry)];
    return [{
      itemId: entry.itemId,
      verb: entry.type === 'item' ? PICK_UP : entry.action,
      stand: standNear(look),
      look,
    }];
  });
}

/** Match a carry item to the live target that accepts its chore. */
export function planCarryTarget(registry, itemId) {
  const item = registry.find((entry) => entry.type === 'item' && entry.itemId === itemId);
  if (!item) throw new Error(`unknown carry item ${itemId}`);
  const target = registry.find(
    (entry) => entry.type === 'target' && entry.accepts === item.chore,
  );
  if (!target) throw new Error(`no target accepts chore ${item.chore} for ${itemId}`);
  const look = [...positionOf(target)];
  return {
    target: target.target,
    accepts: target.accepts,
    stand: standNear(look),
    look,
  };
}

const snapshotRegistry = (page) => page.evaluate(() => {
  const host = window.__game.host;
  return host.room.interactables.flatMap((object) => {
    const interact = object.userData.interact;
    if (!interact || !['item', 'target', 'tug'].includes(interact.type)) return [];
    object.updateWorldMatrix(true, true);
    let bounds = null;
    object.traverse((member) => {
      let localBounds = null;
      if (member.isInstancedMesh) {
        member.computeBoundingBox();
        localBounds = member.boundingBox;
      } else if (member.geometry) {
        member.geometry.computeBoundingBox();
        localBounds = member.geometry.boundingBox;
      }
      if (!localBounds) return;
      const worldBounds = localBounds.clone().applyMatrix4(member.matrixWorld);
      if (bounds) bounds.union(worldBounds);
      else bounds = worldBounds;
    });
    const position = object.position.clone();
    if (bounds) bounds.getCenter(position);
    else object.getWorldPosition(position);
    return [{ ...interact, position: position.toArray() }];
  });
});

const aimAt = (page, step) => page.evaluate(({ stand, look }) => {
  const host = window.__game.host;
  host.player.pos.set(stand[0], 0, stand[1]);
  const dx = look[0] - stand[0];
  const dz = look[2] - stand[1];
  const dy = look[1] - 1.55;
  host.player.yaw = Math.atan2(-dx, -dz);
  host.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}, step);

const waitForItemPrompt = (page, step) => page.waitForFunction(
  ({ itemId, verb }) => {
    const host = window.__game.host;
    const resolved = host.interact['resolveTarget'](host.camera).action?.interact;
    const expectedType = verb === 'Pick up' ? 'item' : 'tug';
    return host.interact.tracker.item(itemId)?.state === 'world'
      && resolved?.type === expectedType
      && resolved.itemId === itemId
      && host.prompt?.actionable === true
      && host.prompt.label.startsWith(`E — ${verb}`);
  },
  step,
  { timeout: 5_000, polling: 'raf' },
);

const performStep = async (page, registry, step) => {
  await aimAt(page, step);
  await waitForItemPrompt(page, step);
  await page.keyboard.press('e');

  if (step.verb !== PICK_UP) {
    await page.waitForFunction(
      (itemId) => window.__game.host.interact.tracker.item(itemId)?.state === 'placed',
      step.itemId,
      { timeout: 5_000, polling: 'raf' },
    );
    return;
  }

  await page.waitForFunction(
    (itemId) => window.__game.host.interact.tracker.carried?.id === itemId,
    step.itemId,
    { timeout: 5_000, polling: 'raf' },
  );
  const target = planCarryTarget(registry, step.itemId);
  await aimAt(page, target);
  await page.waitForFunction(
    ({ itemId, accepts }) => {
      const host = window.__game.host;
      const resolved = host.interact['resolveTarget'](host.camera).action?.interact;
      return host.interact.tracker.carried?.id === itemId
        && resolved?.type === 'target'
        && resolved.accepts === accepts
        && host.prompt?.actionable === true
        && host.prompt.label.startsWith('E — Put ');
    },
    { itemId: step.itemId, accepts: target.accepts },
    { timeout: 5_000, polling: 'raf' },
  );
  await page.keyboard.press('e');
  await page.waitForFunction(
    (itemId) => window.__game.host.interact.tracker.item(itemId)?.state === 'placed',
    step.itemId,
    { timeout: 5_000, polling: 'raf' },
  );
};

const dumpDirector = async (page, context) => {
  try {
    const state = await page.evaluate(() => {
      const director = window.__game.director;
      return {
        t: Math.round(director.t),
        ended: director.ended,
        prompts: director.prompts.map(
          (prompt) => `${prompt.lineId}@${Math.round(prompt.openedAt)}:${prompt.result}`,
        ),
        chores: Object.values(director.chores).map(
          (chore) => `${chore.id} req@${chore.requestedAt === null ? '-' : Math.round(chore.requestedAt)}`,
        ),
      };
    });
    console.error(`E2E state while ${context}: ${JSON.stringify(state)}`);
  } catch {
    console.error(`E2E state unavailable while ${context}`);
  }
};

const armPrompt = (page, lineId, option) => {
  const armed = (async () => {
    try {
      await page.waitForFunction(
        (line) => window.__game.director.activePrompt?.lineId === line,
        lineId,
        { timeout: 120_000, polling: 100 },
      );
      await page.keyboard.press(String(option));
      await page.waitForFunction(
        (line) => window.__game.director.prompts.some(
          (prompt) => prompt.lineId === line && prompt.result === 'answered',
        ),
        lineId,
        { timeout: 10_000, polling: 100 },
      );
    } catch (error) {
      await dumpDirector(page, `answering prompt "${lineId}"`);
      throw error;
    }
  })();
  armed.catch(() => {});
  return () => armed;
};

/** Answer five prompts and complete the live physical chores. */
export async function playNight(page, answers) {
  if (
    !Array.isArray(answers)
    || answers.length !== 5
    || answers.some((answer) => !Number.isInteger(answer) || answer < 1 || answer > 4)
  ) {
    throw new Error('playNight answers must contain five options from 1 to 4');
  }

  await page.waitForFunction(() => window.__game?.host?.room?.interactables);
  const registry = await snapshotRegistry(page);
  const plan = planNight(registry);
  const itemChores = new Map(
    registry
      .filter((entry) => entry.type === 'item' || entry.type === 'tug')
      .map((entry) => [entry.itemId, entry.chore]),
  );

  await armPrompt(page, 'intro', answers[0])();
  await armPrompt(page, 'mugs', answers[1])();

  for (let index = 0; index < CHORE_LINES.length; index++) {
    const chore = CHORE_LINES[index];
    const nextLine = CHORE_LINES[index + 1] ?? 'warn';
    const nextAnswer = armPrompt(page, nextLine, answers[index + 2]);
    for (const step of plan.filter((candidate) => itemChores.get(candidate.itemId) === chore)) {
      await performStep(page, registry, step);
    }
    await nextAnswer();
  }

  const completed = await page.evaluate(() => {
    const tracker = window.__game.host.interact.tracker;
    return ['mugs', 'wrappers', 'laundry'].map((chore) => tracker.isCompleted(chore));
  });
  if (!completed.every(Boolean)) throw new Error(`chores not all complete: ${completed}`);
}
