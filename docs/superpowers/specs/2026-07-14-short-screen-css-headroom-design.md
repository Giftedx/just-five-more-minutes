# Short-Screen Cascade and CSS Headroom Design

**Date:** 2026-07-14

## Problem

The standalone CSS artifact is 10,236 gzip bytes against a 10,240-byte release ceiling. Four bytes of margin means a harmless selector or accessibility fix can break the release gate. The same audit found a concrete presentation defect: the `max-height: 520px` rules for `.hud-prompt-hint` and `.hud-prompt-option` appear before their base declarations, so the intended compact margin and padding are always overwritten. The 900 by 400 browser checks prove containment, but they do not pin the compact computed styles and therefore allow this false pass.

## Goals

- Make the short-screen response card actually use `margin-bottom: 0` on its hint and `5px 10px 5px 8px` option padding.
- Consolidate equivalent short-height and reduced-motion cascade fragments without changing their computed results.
- Remove only declarations proved redundant by the global reset or a stronger existing rule.
- Lower the enforced CSS gzip ceiling from 10,240 to 10,112 bytes, guaranteeing at least 128 bytes of headroom.
- Preserve ordinary desktop, title, scorecard, pause, gate, volume, and reduced-motion visuals exactly.

## Non-goals

- No new visual theme, effects, animation, component, font, dependency, build plugin, or runtime JavaScript.
- No class renaming, CSS-to-JavaScript migration, asset deletion, or relaxation of the size gate.
- No layout changes above 520 CSS pixels in viewport height.
- No change to gameplay, input, accessibility semantics, copy, Three.js, or Canvas rendering.

## Evidence and gap classification

| Claim | Existing path | Classification | Action |
|---|---|---|---|
| CSS needs a larger budget | Deterministic 10 KiB gzip gate passes by four bytes | Confirmed release risk | Reduce artifact and tighten the ceiling |
| Short response controls are compact | Media rules declare compact values before later base rules overwrite them | Confirmed defect | Move the rules after their bases and browser-guard computed styles |
| Major surfaces need another decoration layer | Current title, bedroom, Mum, PC, pause, gate, report, and verdict captures are already authored | Already satisfied | Preserve pixels |
| A stronger minifier is required | Current cascade contains local ordering and redundancy opportunities | Not required | Use source-level consolidation |

## Approaches considered

### Targeted cascade consolidation — selected

Keep the existing CSS architecture, move compact overrides to a final shared `max-height: 520px` block, merge the Mum short-height declarations already split across two blocks, remove the later redundant Mum reduced-motion override already covered by the global `!important` rule, and delete reset declarations whose computed value is already guaranteed by `*`. This is reviewable, dependency-free, and reversible.

### Change the CSS toolchain

Add Lightning CSS or a post-processing plugin. This may reduce bytes, but it changes dependencies and the entire emitted stylesheet for a local cascade defect. Rejected as disproportionate and harder to prove visually.

### Raise the budget or cut visual effects

Raising the ceiling hides the release risk. Removing glows, paper texture, CRT treatment, or motion would spend player-visible quality to solve an engineering problem. Both are rejected.

## Cascade design

The final short-height block retains source order after every affected base component. It owns:

- task-stack, objective, chore, and Mum grid placement;
- prompt gap, padding, translation, hint margin, and option padding;
- compact Mum ticket width/padding/rotation;
- existing mobile-gate height adaptations.

Rules remain component-specific inside the shared media boundary. No selector specificity changes. The reduced-motion blanket continues to use `animation: none !important` and `transition: none !important`, so the later Mum-only animation override is redundant and removed.

## Verification contract

1. Tighten the CSS gzip threshold to 10,112 bytes first and prove RED against the current 10,236-byte artifact.
2. Extend the real 900 by 400 dialogue browser scenario to assert the prompt hint has zero bottom margin and the first option computes to `5px 10px 5px 8px` padding. Prove RED before moving the media rule.
3. After consolidation, require both new assertions to pass while preserving the existing geometry, overlap, focus, reduced-motion, and responsive checks.
4. Build baseline and candidate production assets and compare representative screenshots at 1280 by 720, 900 by 400, reduced motion, pause, gate, title, and scorecard states. Ordinary desktop frames must remain pixel-identical; the short dialogue frame may differ only inside the response card.
5. Run `npm run verify` on the feature branch and again after a local fast-forward merge.

## Acceptance and rejection

Accept only if CSS gzip is at most 10,112 bytes, all browser/unit/build gates pass, the compact computed styles are exact, and no unrelated screenshot changes. Reject if the work raises a budget, adds a dependency, removes an authored effect, changes desktop pixels, weakens focus/reduced-motion behavior, or relies on an unguarded cascade assumption.
