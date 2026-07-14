# Objective Flash Contrast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Keep the objective-completion flash celebratory while making its small OBJECTIVE eyebrow readable throughout the animation.

**Architecture:** Make the pseudo-element inherit the objective card's foreground at reduced opacity and replace the unsafe eased cross-fade with a two-state pulse that preserves duration and iteration count. Guard both iterations over time in the existing production browser smoke, then reconcile the game-wide program with Mudwick work that already ships.

**Tech Stack:** TypeScript 7, DOM/CSS, Playwright 1.61.1, Vite 8.1.4, Vitest 4.1.10

## Global Constraints

- Preserve hudflash duration, iteration count, background endpoints, body colours, panel geometry, and responsive rules; replace only the unsafe easing behavior.
- Do not raise the CSS gzip ceiling above 10,112 bytes or the JavaScript ceiling above 204,800 bytes.
- Add no dependency, asset, runtime state, timer, event listener, or JavaScript animation.
- Preserve normal-state hierarchy and reduced-motion behaviour.
- Do not change Mudwick sprites, renderer behaviour, simulation, input, audio, bedroom, Mum, title, scorecard, or deployment state.
- Keep screenshots and temporary proof in ignored paths.

---

## File responsibilities

- scripts/smoke.mjs owns the production-browser contrast contract.
- src/ui/style.css owns the objective card and completion-flash presentation.
- docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md owns program-wide completion truth.
- docs/superpowers/plans/2026-07-13-mudwick-jewellers-pass.md owns the historical Mudwick execution record.

### Task 1: Guard and repair the objective-flash eyebrow

**Files:**
- Modify: scripts/smoke.mjs in the dialogue-staging scenario
- Modify: src/ui/style.css in .hud-objective::before, .hud-flash, and @keyframes hudflash

**Interfaces:**
- Consumes: the real .hud-objective element, its ::before pseudo-element, and the existing hudflash colour endpoints.
- Produces: computed-style evidence that the pseudo-element follows the foreground at opacity 0.7 and clears 4.5:1 at 12 points spanning both animation iterations over a conservative black backdrop.

- [x] **Step 1: Add the initial failing endpoint contract (superseded by Task 1B)**

After the short-screen prompt style assertions in the dialogue-staging scenario, add the initial style probe that freezes the objective at the gold flash endpoint. This was the first RED/GREEN contract and is retained below as execution history; Task 1B replaces it with the final temporal guard.

~~~js
    const objectiveFlash = await page.locator('.hud-objective').evaluate((element) => {
      const previous = {
        animation: element.style.animation,
        background: element.style.background,
        color: element.style.color,
      };
      try {
        const keyframes = Array.from(document.styleSheets)
          .flatMap((sheet) => Array.from(sheet.cssRules))
          .find((rule) => rule.type === CSSRule.KEYFRAMES_RULE && rule.name === 'hudflash');
        const startFrame = keyframes
          ? Array.from(keyframes.cssRules).find((rule) => rule.keyText === '0%' || rule.keyText === 'from')
          : null;
        if (!startFrame) throw new Error('hudflash start frame is missing');
        element.style.animation = 'none';
        element.style.background = startFrame.style.background;
        element.style.color = startFrame.style.color;
        const card = getComputedStyle(element);
        const eyebrow = getComputedStyle(element, '::before');
        const channels = (value) => (value.match(/[\d.]+/g) ?? []).map(Number);
        const composite = (foreground, background, alpha) =>
          foreground.map((channel, index) =>
            Math.round(channel * alpha + (background[index] ?? 0) * (1 - alpha)));
        const luminance = (rgb) => {
          const linear = rgb.map((channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
        };
        const alpha = Number(eyebrow.opacity);
        const cardChannels = channels(card.backgroundColor);
        const cardAlpha = cardChannels[3] ?? 1;
        // Black is the conservative room backdrop for this translucent gold flash.
        const background = cardChannels.slice(0, 3).map((channel) => Math.round(channel * cardAlpha));
        const foreground = composite(channels(eyebrow.color).slice(0, 3), background, alpha);
        const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        return {
          bodyColor: card.color,
          flashBackground: card.backgroundColor,
          eyebrowColor: eyebrow.color,
          eyebrowOpacity: eyebrow.opacity,
          contrast: ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05),
        };
      } finally {
        element.style.animation = previous.animation;
        element.style.background = previous.background;
        element.style.color = previous.color;
      }
    });
    assert.equal(objectiveFlash.eyebrowColor, objectiveFlash.bodyColor);
    assert.ok(objectiveFlash.contrast >= 4.5, JSON.stringify(objectiveFlash));
    assert.equal(objectiveFlash.eyebrowOpacity, '0.7');
~~~

- [x] **Step 2: Build and run the production browser gate to verify RED**

Run:

~~~powershell
npm run build
npm run test:browser
~~~

Expected: the gate stops in the dialogue-staging scenario because the current eyebrow computes to rgb(184, 149, 74), opacity 1, and about 1.66:1 contrast on the gold phase.

- [x] **Step 3: Apply the initial CSS repair**

Replace the fixed eyebrow colour:

~~~css
  color: currentColor;
  opacity: 0.7;
~~~

Do not change the hudflash keyframes in this initial pass.

- [x] **Step 4: Rebuild and rerun the production browser gate to verify GREEN**

Run the same build and npm run test:browser commands.

Expected: all isolated scenarios and the full interaction E2E pass; computed eyebrow colour equals the body colour, opacity is 0.7, and worst-case composited contrast is at least 4.5:1.

Red-team note: the first green check used an opaque-gold surrogate and overstated contrast. Reading the real 90%-alpha keyframe exposed a 4.065:1 dark-backdrop failure at opacity 0.65. Independent review then sampled the real eased animation and exposed a deeper 1.101:1 failure at 225ms. Task 1B is the final repair.

- [x] **Step 5: Verify artifact budgets**

Run:

~~~powershell
npm run size:check
~~~

Expected: JavaScript gzip remains at or below 204,800 bytes and CSS gzip remains at or below 10,112 bytes.

- [x] **Step 6: Commit the tested repair**

~~~powershell
git add scripts/smoke.mjs src/ui/style.css
git commit -m "fix: preserve objective flash contrast"
~~~

### Task 1B: Harden the complete animation timeline

- [x] **Step 1: Replace the endpoint probe with a temporal browser contract**

Clone the real objective element into the document as a hidden isolated probe, run its production `hudflash` animation, pause it through WAAPI at 12 points spanning both 0.9-second iterations and both sides of every 450ms boundary, and remove the clone in `finally`. At each point, composite the background colour and any gradient stop over black, composite the 0.7-opacity eyebrow, and require at least 4.5:1.

- [x] **Step 2: Verify the temporal contract fails against the eased cross-fade**

Expected RED: the dialogue-staging scenario reports 1.101:1 at 225ms while the foreground is `rgb(113, 101, 72)` over `rgba(232, 195, 63, 0.56)`.

- [x] **Step 3: Replace unsafe interpolation with a two-state pulse**

Keep `0.9s` and two iterations. Use `step-end`, keep gold/dark at 0%, and enter the existing dark-glass/cream state at 50%:

~~~css
.hud-flash { animation: hudflash 0.9s step-end 2; }

@keyframes hudflash {
  0% { background: rgba(232, 195, 63, 0.9); color: #1a1408; }
  50%, 100% { background: linear-gradient(165deg, rgba(34, 24, 13, 0.88), rgba(18, 13, 8, 0.88)); color: #ffe9b0; }
}
~~~

- [x] **Step 4: Verify the full temporal GREEN and budgets**

Expected: the complete browser suite and full E2E pass; all 12 contrast samples clear 4.5:1; JavaScript remains 201,766 gzip bytes; CSS remains at or below 10,112 gzip bytes; fresh gold-state proof is clean.

- [x] **Step 5: Commit the temporal repair and synchronized evidence**

### Task 2: Reconcile the jeweller's-program truth surfaces

**Files:**
- Modify: docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md
- Modify: docs/superpowers/plans/2026-07-13-mudwick-jewellers-pass.md
- Modify: docs/superpowers/plans/2026-07-14-objective-flash-contrast-pass.md

**Interfaces:**
- Consumes: shipped commits 719d385, 4c44aab, 249da15, 4f93ee3, and 2bb4fc1 plus current source/test evidence.
- Produces: documentation that distinguishes completed Mudwick work from the newly closed objective-flash defect.

- [x] **Step 1: Update the game-wide gap table**

Change the four Mudwick gap rows to repaired status:

~~~markdown
| Mudwick action pose | Four registered target-facing weapon variants with body-topology tests | Repaired and guarded locally | Preserve |
| Mudwick player and trader faces | Restrained eye cues with palette and dimension tests | Repaired and guarded locally | Preserve |
| Hobgoblin silhouette | Shared armoured/tusked silhouette distinct from ordinary goblins | Repaired and guarded locally | Preserve |
| Mudwick HP display | Matched-topology full/empty pixel hearts in the existing two-row panel | Repaired and guarded locally | Preserve |
~~~

Append an objective-flash closure section with the failing 1.66:1 state, the currentColor/0.7 repair, final computed contrast, artifact sizes, capture path, and verification result.

- [x] **Step 2: Add a Mudwick plan status note**

After the Mudwick plan's Tech Stack line, add:

~~~markdown
**Status:** Implemented by commits 719d385, 4c44aab, and 249da15, then extended with target-facing attacks in 4f93ee3 and 2bb4fc1. The checklist below is the retained execution record; the current tree's sprite topology tests and renderer paths are authoritative.
~~~

- [x] **Step 3: Mark this plan's completed steps**

Change each completed checkbox in this file from - [ ] to - [x] only after its command or edit has succeeded.

- [x] **Step 4: Self-review and commit**

Run:

~~~powershell
rg -n "[T]BD|[T]ODO|[F]IXME" docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md docs/superpowers/plans/2026-07-13-mudwick-jewellers-pass.md docs/superpowers/plans/2026-07-14-objective-flash-contrast-pass.md
rg -n "Mudwick action pose|Mudwick player and trader faces|Hobgoblin silhouette|Mudwick HP display" docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md
rg -n "^\*\*Status:\*\*" docs/superpowers/plans/2026-07-13-mudwick-jewellers-pass.md
git diff --check
~~~

Expected: no stale Mudwick defect classification, placeholder, or whitespace error remains.

~~~powershell
git add docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md docs/superpowers/plans/2026-07-13-mudwick-jewellers-pass.md docs/superpowers/plans/2026-07-14-objective-flash-contrast-pass.md
git commit -m "docs: reconcile jeweller's program status"
~~~

### Task 3: Production proof and integration

**Files:**
- Create ignored proof: shots/objective-flash-contrast.png
- Modify only if proof exposes a directly related defect: src/ui/style.css, scripts/smoke.mjs

**Interfaces:**
- Consumes: the production build and existing audit capture tooling.
- Produces: a fresh flash-state frame, full release-gate evidence, and a locally integrated clean master.

- [x] **Step 1: Capture the repaired flash state**

Use an owned production preview and Playwright to freeze the real objective at the gold endpoint, then save shots/objective-flash-contrast.png at 1280 by 720. Reject the result if the eyebrow is invisible, the body hierarchy reverses, the panel geometry changes, or the flash no longer reads as gold.

- [x] **Step 2: Red-team the bounded change**

Verify the normal and gold states, both complete animation iterations, pseudo-element inheritance, opacity, reduced-motion behaviour, preserved duration/iteration count, intentional step transition, unchanged layout, unchanged script/style budgets, clean console, and absence of staged proof artifacts.

- [ ] **Step 3: Run the complete feature-tree gate**

Run:

~~~powershell
npm run verify
~~~

Expected: 18 test files / 208 tests, standalone build, both size budgets, all isolated browser scenarios, full interaction E2E, and mounted build pass.

- [ ] **Step 4: Integrate locally and verify again**

Fast-forward the verified feature branch onto master and rerun npm run verify. Do not pull, push, or deploy.

- [ ] **Step 5: Clean up and reflect**

Remove only the task-owned worktree and merged feature branch. Append one valid JSON line with keys date, task, outcome, surprise, and next-time to C:\Users\aggis\.Codex\memory\reflections.jsonl using apply_patch, then parse every line to validate the JSONL file.
