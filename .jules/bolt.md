## 2024-07-26 - OSRS XP Algorithm Bottleneck
**Learning:** O(n²) calculation of XP levels in the simulation step can severely impact performance. In `src/mmo/sim/osrs.ts`, `levelOf(xp)` iterated up to `MAX_LEVEL` and inside it `xpForLevel(level)` also iterated from 1 to `level`. This O(n²) math operation running many times per render frame / sim tick burns CPU needlessly.
**Action:** Pre-compute static values (like XP tables) into a lookup array (`Int32Array`) on module load, reducing `levelOf` from O(n²) to O(n) and `xpForLevel` from O(n) to O(1).
