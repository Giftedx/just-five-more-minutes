# Just Five More Minutes

Dinner is in twelve minutes, and your room is a mild disgrace. Unfortunately, the goblins of **Mudwick Online** — a lovingly stupid, 2004-flavoured mini-MMO that lives inside your bedroom PC — are not going to grind themselves. Walk around your room in first person, sit at the CRT to click goblins, chop allegedly wood-bearing trees, and sell flax to a man who has seen your spreadsheet and is not impressed; meanwhile a very reasonable voice at the door asks you, three separate times, to do extremely small chores. The mini-MMO keeps ticking whether you're at the keyboard or not (walking away mid-combat is a personal choice), and after twelve minutes you receive a typewritten **HOUSEHOLD INCIDENT REPORT** grading your MMO progress, household responsibility, vibe preservation, and comedy output. Everything — art, audio, goblins — is generated at runtime; there are no asset files and no third-party content.

## Controls

| Input | Action |
|---|---|
| `WASD` | Move (Room Mode) |
| Mouse | Look (Room Mode) / play Mudwick (PC Mode) |
| `E` | Interact: pick up, place, sit at the PC |
| `Esc` / `Q` | Stand up from the PC |
| `1`–`4` | Answer the voice at the door (works in both modes) |
| Left click (Mudwick) | Default action — Attack / Chop / Pick / Trade / Walk here |
| Right click (Mudwick) | Context menu, including Examine. This is non-negotiable. |

## Local development

```bash
npm install
npm run dev        # dev server
npm test           # vitest (director, score, sim, chores)
npm run build      # tsc --noEmit && vite build -> dist/
npm run preview    # serve the production build
```

Dev affordances (query params):

- `?speed=N` — multiply the session clock and sim tick rate (e.g. `?speed=10`)
- `?t=SECONDS` — seed the session clock (e.g. `?t=600` to jump near dinner)
- `?skipTitle=1` — auto-start without the title screen
- `?dev=mmo` / `?dev=room` / `?dev=host` — standalone dev routes for the mini-MMO, the bedroom, and mode switching

Smoke test (optional, needs Playwright + chromium): run `npm run preview`, then `node scripts/smoke.mjs`.

## Deploying to Cloudflare Pages

The build is fully static and self-contained (`base: './'`, no network assets).

Dashboard settings:

| Setting | Value |
|---|---|
| Framework preset | **None** |
| Build command | `npm run build` |
| Build output directory | `dist` |

Or deploy straight from the CLI:

```bash
npm run build
npx wrangler pages deploy dist --project-name=just-five-more-minutes
```
