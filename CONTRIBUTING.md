# Contributing

Thanks for taking an interest. This is a small, self-contained browser game — contributions should stay focused and fun.

## Getting started

```bash
npm install
npm run dev
npm test
```

All tests should pass before you open a PR. CI runs `npm test` and `npm run build` on every push.

## What to work on

- **Bugs** — file an issue first if it's non-obvious; include repro steps and browser.
- **Features** — open an issue to discuss scope before a large change. Small fixes and polish are fine without one.
- **Screenshots** — dev captures live in `shots/` (gitignored). Commit curated images to `docs/screenshots/` only when they belong in the README.

## Code style

Match what's already there: TypeScript, minimal abstractions, no comments unless the logic is genuinely non-obvious. The game generates its own art and audio — don't add external asset dependencies.

## Pull requests

Use the PR template. One logical change per PR when possible. If you touch gameplay, note what you tested manually.

## License

By contributing, you agree your contributions are licensed under the project's [MIT License](LICENSE).
