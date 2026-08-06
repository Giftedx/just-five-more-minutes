# Contributing

Thanks for taking an interest. This is a small, self-contained browser game — contributions should stay focused and fun.

## Getting started

```bash
npm install
npm run dev
npm test
```

Run `npm run verify` before opening a PR. CI installs Chromium and runs the same authoritative gate: unit tests, type checks, standalone build and size budgets, production browser scenarios, one full interaction E2E per weeknight, mounted-base artifact smoke, and a final root-previewable standalone artifact.

## What to work on

- **Bugs** — file an issue first if it's non-obvious; include repro steps and browser.
- **Features** — open an issue to discuss scope before a large change. Small fixes and polish are fine without one.
- **Screenshots** — dev captures live in `shots/` (gitignored). Commit curated images to `docs/screenshots/` only when they belong in the README.

## Code style

Match what's already there: TypeScript, minimal abstractions, no comments unless the logic is genuinely non-obvious. The game generates its own art and audio. Apart from the two existing RuneScape font files in `public/fonts/`, do not add external asset dependencies.

## Pull requests

Use the PR template. One logical change per PR when possible. If you touch gameplay, note what you tested manually.

## License

By contributing, you agree your contributions are licensed under the project's [MIT License](LICENSE).
