# Just Five More Minutes

[![CI](https://github.com/Giftedx/just-five-more-minutes/actions/workflows/ci.yml/badge.svg)](https://github.com/Giftedx/just-five-more-minutes/actions/workflows/ci.yml)
[![Deploy](https://github.com/Giftedx/just-five-more-minutes/actions/workflows/deploy.yml/badge.svg)](https://github.com/Giftedx/just-five-more-minutes/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[▶ Play in your browser](https://giftedx.github.io/just-five-more-minutes/)** — no install, no login, no microtransactions. Just goblins.

Dinner is in five minutes, and your room is a mild disgrace. Unfortunately, the goblins of **Mudwick Online** — a lovingly stupid, 2004-flavoured mini-MMO that lives inside your bedroom PC — are not going to grind themselves.

Walk around your room in first person, sit at the CRT to click goblins, chop allegedly wood-bearing trees, and sell flax to a man who has seen your spreadsheet and is not impressed. Meanwhile, a very reasonable voice at the door asks you, three separate times, to do extremely small chores.

The mini-MMO keeps ticking whether you're at the keyboard or not (walking away mid-combat is a personal choice). After five minutes you receive a typewritten **HOUSEHOLD INCIDENT REPORT** grading your MMO progress, household responsibility, vibe preservation, and comedy output.

Everything — art, audio, goblins — is generated at runtime. There are no asset files and no third-party content.

<p align="center">
  <img src="docs/screenshots/poster.png" alt="Mudwick Online poster — Your goblins miss you" width="480">
</p>

## Screenshots

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/parity-3d.png" alt="First-person view of the bedroom desk with Mudwick running on the CRT" width="400"><br><sub>Room Mode — the desk, the dread, the deadline</sub></td>
    <td align="center"><img src="docs/screenshots/ui-mmo-full.png" alt="Mudwick Online running on the in-game CRT monitor" width="400"><br><sub>PC Mode — grind goblins, ignore chores</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/ui-mum.png" alt="Mum at the door with dialogue choices" width="400"><br><sub>Mum — reasonable, persistent, unimpressed</sub></td>
    <td align="center"><img src="docs/screenshots/ui-score.png" alt="End-of-session Household Incident Report scorecard" width="400"><br><sub>Scorecard — filed, stamped, judged</sub></td>
  </tr>
</table>

## Controls

| Input | Action |
|---|---|
| `WASD` | Move (Room Mode) |
| Mouse | Look (Room Mode) / play Mudwick (PC Mode) |
| `E` | Interact: pick up, place, sit at the PC / stand up from the PC |
| `1`–`4` | Answer the voice at the door (works in both modes) |
| Left click (Mudwick) | Default action — Attack / Chop / Pick / Trade / Walk here |
| Right click (Mudwick) | Context menu, including Examine. This is non-negotiable. |

## Tech

| Layer | Stack |
|---|---|
| 3D bedroom | [Three.js](https://threejs.org/) · procedural geometry & textures |
| Mini-MMO | Canvas 2D · custom tick sim inspired by old-school MMOs |
| Audio | Web Audio API · procedural synth |
| Build | [Vite](https://vite.dev/) · TypeScript · [Vitest](https://vitest.dev/) |

The game is a single static bundle — no backend, no CDN assets, no analytics.

## Local development

```bash
git clone https://github.com/Giftedx/just-five-more-minutes.git
cd just-five-more-minutes
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # vitest — director, score, sim, chores (73 tests)
npm run build      # tsc --noEmit && vite build -> dist/
npm run preview    # serve the production build
```

Dev affordances (query params):

| Param | Effect |
|---|---|
| `?speed=N` | Multiply the session clock and sim tick rate (e.g. `?speed=10`) |
| `?t=SECONDS` | Seed the session clock (e.g. `?t=250` to jump near dinner) |
| `?skipTitle=1` | Auto-start without the title screen |
| `?dev=mmo` | Standalone Mudwick dev route |
| `?dev=room` | Standalone bedroom dev route |
| `?dev=host` | Standalone mode-switching dev route |

Smoke test (optional, needs Playwright + Chromium): run `npm run preview`, then `node scripts/smoke.mjs`.

## Deploying

### GitHub Pages (automatic)

Pushes to `master` run [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) and publish to:

**https://giftedx.github.io/just-five-more-minutes/**

First-time setup: in repo **Settings → Pages**, set **Source** to **GitHub Actions**.

### Cloudflare Pages (manual)

The build is fully static and self-contained (`base: './'`, no network assets).

| Setting | Value |
|---|---|
| Framework preset | **None** |
| Build command | `npm run build` |
| Build output directory | `dist` |

Or from the CLI:

```bash
npm run build
npx wrangler pages deploy dist --project-name=just-five-more-minutes
```

## Contributing

Bug reports and ideas are welcome — use the issue templates. For code changes, fork, branch, and open a PR. See [CONTRIBUTING.md](CONTRIBUTING.md) for the short version.

## License

[MIT](LICENSE) — do what you like, but Mum would like you to tidy up after yourself.
