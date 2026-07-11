# Just Five More Minutes

[![CI](https://github.com/Giftedx/just-five-more-minutes/actions/workflows/ci.yml/badge.svg)](https://github.com/Giftedx/just-five-more-minutes/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[▶ Play in your browser](https://ha.ggis.xyz/just-five-more-minutes/)** — no install, no login, no microtransactions. Just goblins.

Also on [Cloudflare Pages](https://just-five-more-minutes.pages.dev/) if you prefer the direct link.

Dinner is in five minutes, and your room is a mild disgrace. Unfortunately, the goblins of **Mudwick Online** — a lovingly stupid, 2004-flavoured mini-MMO that lives inside your bedroom PC — are not going to grind themselves.

Walk around your room in first person, sit at the CRT to click goblins, chop allegedly wood-bearing trees, and sell flax to a man who has seen your spreadsheet and is not impressed. Meanwhile, a very reasonable voice at the door asks you, three separate times, to do extremely small chores.

It's also not just one evening any more. It's **the School Week**: five weeknight acts, Monday to Friday, each five minutes long. Your Mudwick character persists between nights — coins, levels, and the bridge toll you paid on Tuesday all carry forward — and so does Mum's suspicion, at half strength, because she sleeps on it. Friday ends with the whole week stapled together and judged.

The week escalates. Tuesday the bed needs making. **Wednesday, Auntie Carol calls and the modem dies mid-combat** (you cannot log out in combat; those were the rules in 2004 and they are the rules now). Thursday Mum has noticed things, and if her suspicion is high enough she comes in for an inspection — press **F** to flip the CRT to `homework.doc`, the oldest trick in the book. Friday the Hendersons are coming, the wrapper count is up, and Mudwick is running double XP, which is torture.

Mudwick itself grew a far bank: pay the 10 gp toll once and it's yours forever — oaks worth 15 gp (Woodcutting 5), hobgoblins that hit harder and start fights on their own, plus a fishing spot and a campfire that turns raw shrimp into either food or regret. Dying drops your inventory at a gravestone for sixty seconds; whether you rush the corpse run or do the laundry is between you and your conscience. Before you stand up, set your **standing orders** — keep working, eat at low health, run home, sell when full — four toggles of period-authentic auto-piloting, all off by default because walking away mid-combat is a personal choice.

Mum, meanwhile, keeps score in her own way. Every excuse now does something: "One sec!" buys you fifteen real seconds and one unit of lie-debt; "I'm in combat!" is oddly honest and calms her down; "The economy needs me!" only lands if you have receipts; the historical preservation defence works exactly once a week. Ignore her and the **MUM:** chip in the corner climbs from *unbothered* to *at the door*.

After each five minutes you receive a typewritten **HOUSEHOLD INCIDENT REPORT** grading MMO progress (a milestone ladder of what you earned *tonight*), household responsibility, vibe preservation, and comedy output. After Friday's report comes **THE WEEK VERDICT** — a 3×3 matrix of endings from *The Lost Week* to *Time Wizard*, with stamps for perfect chores, reliable economies, and lies that were never one sec. Endings collect in a gallery on the title screen. Everything lives in a small local career file; no account, no analytics.

Everything — art, audio, goblins, the modem screech — is generated at runtime. There are no asset files and no third-party content.

<p align="center">
  <img src="docs/screenshots/poster.png" alt="Mudwick Online poster — Your goblins miss you" width="480">
</p>

## Screenshots

<table>
  <tr>
    <td align="center" colspan="2"><img src="docs/screenshots/title.png" alt="Just Five More Minutes title screen with its tiny live Mudwick CRT and Mum's five-minute warning" width="800"><br><sub>One domestic incident, five minutes, several terrible priorities</sub></td>
  </tr>
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
| `E` | Interact: pick up, place, tug straight, sit at the PC / stand up from the PC |
| `F` | Panic — flip the CRT to `homework.doc` (defuses inspections) |
| `1`–`4` | Answer the voice at the door (works in both modes) |
| Left click (Mudwick) | Default action — Attack / Chop / Fish / Pick / Trade / Walk here |
| Right click (Mudwick) | Context menu, including Examine. This is non-negotiable. |
| `AWAY PLAN` chips (Mudwick) | Toggle standing orders for while you're off doing chores |

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
npm test           # vitest — director, nights, score, week, career, sim, chores, input
npm run build      # tsc --noEmit && vite build -> dist/
npm run size:check # verify compressed JS/CSS budgets for the current dist/
npm run test:browser # managed preview + isolated smoke + full interaction E2E
npm run verify     # unit, standalone build, size, browser, and mounted build gates
npm run preview    # manually serve the current production build
```

Dev affordances (query params):

| Param | Effect |
|---|---|
| `?speed=N` | Multiply the session clock and sim tick rate (e.g. `?speed=10`) |
| `?t=SECONDS` | Seed the session clock (e.g. `?t=250` to jump near dinner) |
| `?seed=N` | Reproduce a run with a decimal or `0x`-prefixed integer seed (the report shows a copy-ready form such as `0x00C0FFEE`) |
| `?night=N` | Play a specific weeknight, 0 (Monday) to 4 (Friday), ignoring the career pointer |
| `?skipTitle=1` | Auto-start without the title screen |
| `?dev=mmo` | Standalone Mudwick dev route |
| `?dev=room` | Standalone bedroom dev route |
| `?dev=host` | Standalone mode-switching dev route |

Browser checks need Playwright's Chromium installed once (`npx playwright install chromium`). `npm run test:browser` then starts and owns a strict local preview of the current `dist/`, runs both browser suites, and stops the preview even if a check fails. For the complete local release gate, use `npm run verify`.

## Deploying

The live build is on **ha.ggis.xyz**: https://ha.ggis.xyz/just-five-more-minutes/

The old `just-five-more-minutes.pages.dev` URL redirects there automatically.

The build is fully static and self-contained (`base: './'`, no network assets). Connect the repo in the Cloudflare dashboard, or deploy from the CLI:

| Setting | Value |
|---|---|
| Framework preset | **None** |
| Build command | `npm run build` |
| Build output directory | `dist` |

```bash
npm run build
npx wrangler pages deploy dist --project-name=just-five-more-minutes
```

## Contributing

Bug reports and ideas are welcome — use the issue templates. For code changes, fork, branch, and open a PR. See [CONTRIBUTING.md](CONTRIBUTING.md) for the short version.

## License

[MIT](LICENSE) — do what you like, but Mum would like you to tidy up after yourself.
