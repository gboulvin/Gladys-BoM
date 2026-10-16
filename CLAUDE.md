# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** serving the Australian weather of
the **Bureau of Meteorology (BoM)**: a Node.js service (Node 22+, ESM, no build
step) running in its own sandboxed Docker container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official
[JavaScript template](https://github.com/GladysAssistant/integration-template-js).

Manifest `type: "weather"` (a weather provider: no devices), `transports:
["cloud"]` (it only talks to the BoM over the Internet), `location: true` (the
warning monitor reads the house position), plus three capability fields:
`scene_triggers`, `scene_actions` and `widgets` (Gladys >= 5.1.0).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/weather.test.js          # one file
node --test --test-name-pattern "alerts"  # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npm run deps:check                        # what Dependabot would propose (network)
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                SDK wiring only: handlers registered before connect()
src/bom/client.js       BoM API client (fetch, per-URL cache, shared in-flight requests)
src/bom/geohash.js      position -> 6-character geohash (the BoM location key)
src/bom/location.js     which place to read: query > config `location` > coordinates > house
src/bom/mapping.js      BoM vocabulary -> Gladys (icons, warnings, compass, fire danger)
src/weather.js          onWeatherGet: the pivot weather payload (current, hours, days, alerts)
src/monitor.js          periodic warning / fire danger check -> scene triggers (publishSceneEvent)
src/scenes.js           scene actions (manifest `scene_actions`)
src/widgets.js          dashboard widgets (manifest `widgets`)
src/actions.js          Configuration screen buttons (manifest `actions`)
src/config.js           DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/i18n.js             every runtime text in en / fr / de / es
src/units.js            °C, km/h, mm -> metric pivot (m/s) or us (°F, mph, in)
docs/{en,fr,de,es}.md   user documentation, re-hosted by Gladys (en and fr mandatory)
test/                   node --test, fake Gladys of the SDK + fake BoM API (test/helpers.js)
.github/scripts/release.mjs  release helpers (manifest bump, changelog), tested in test/
```

## Rules

- **Keys are forever.** Manifest `config_schema`, `actions`, widget keys,
  scene trigger and action keys, their `fields`, `variables` and `outputs`
  keys, and the filter option values (`warning_type` categories, fire danger
  ratings) are stored by Gladys and by the users' scenes: never rename or
  remove one, only add.
- **Tests never touch the network.** Use `mockBom(t, overrides)` from
  `test/helpers.js`; its data is synthetic. Never commit real BoM responses:
  the API's terms forbid copying its data.
- **The BoM API**: location endpoints take a 6-character geohash (7 is a 400);
  a position outside Australia answers `400 Outside of allowed area`
  (`BomApiError.outsideArea`). Keep the cache TTLs in `src/bom/client.js`:
  widgets, the weather provider and the monitor share them.
- **The container rootfs is read-only.** Write only under `/data` (the monitor
  keeps `bom-state.json` there; `DATA_DIR` overrides it in tests). Never log
  tokens or personal data beyond the place name.
- **Translations.** Every user-facing text exists in English, French, German
  and Spanish: manifest texts (checked by `test/manifest.test.js`), runtime
  texts in `src/i18n.js` (checked by `test/i18n.test.js`) and `docs/*.md`,
  kept in sync. BoM data (forecast texts, warning titles) stays in English.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Manifest.** Texts are multi-language objects, never plain strings. The
  catalog `description` holds 10 to 100 characters per language, widget
  labels 3 to 30. Scene trigger `fields` cannot be `boolean`. Event `data` is
  flat (primitives) and limited to the declared `fields` / `variables` keys.
- **Stay ahead of Dependabot.** Dependabot opens a pull request for every
  outdated npm package, every new major of a GitHub Action and every
  advisory, right after each push. Before every push or release, run
  `npm run deps:check` and ship what it lists in the same work: `npm install
<pkg>@^<latest>` (dev tools) or `npm audit fix`, and bump the `@vN` of an
  action in every workflow after reading its release notes (a new major can
  rename inputs). An SDK update (`@gladysassistant/integration-sdk`) may
  bring new categories or contracts: read its changelog and run the tests.
  Then `npm run format:check && npm run lint && npm test`. Open Dependabot
  pull requests made obsolete this way close themselves on its next run.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.
