# Bureau of Meteorology (BoM) for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
serves the **Australian weather of the Bureau of Meteorology (BoM)**: current
conditions, hourly and 7-day forecasts, warnings and fire danger ratings. No
account, no API key. Built from the official
[JavaScript integration template](https://github.com/GladysAssistant/integration-template-js)
and the [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

> Not affiliated with or endorsed by the Bureau of Meteorology. The integration
> reads the public JSON API behind the BoM website and app
> (`api.weather.bom.gov.au`), which is not an officially supported product:
> it may change without notice. For official warnings, always check
> [bom.gov.au](https://www.bom.gov.au/).

| Manifest         | Value                                             |
| ---------------- | ------------------------------------------------- |
| `type`           | `weather` — the Gladys weather provider           |
| `transports`     | `cloud` — only talks to the BoM over the Internet |
| `location`       | `true` — reads the house position (monitoring)    |
| `categories`     | `environment`, `services`                         |
| `gladys_version` | `>=5.1.0` (scene and widget capabilities)         |
| Languages        | English, French, German, Spanish                  |

## Features

- **Weather provider** (`onWeatherGet`): current conditions from the nearest
  BoM observation station, 24 hourly and up to 8 daily forecasts, warnings in
  force as CAP alerts (major → severe, cyclone/tsunami → extreme, minor →
  moderate) with their full text, and the AFDRS fire danger rating from
  "High" up (optional). Metric or US units, alert names in the user language.
- **Scene triggers** (`publishSceneEvent`), from a warning monitor polling
  every 5–60 minutes:
  - `warning_issued` / `warning_cancelled` — filters: `warning_type`
    (flood, thunderstorm, severe_weather, fire_weather, heatwave,
    tropical_cyclone, wind, cold, tsunami, coastal, other) and `severity`
    (major, minor);
  - `fire_danger_changed` — filter: the new `rating`.
- **Scene actions** (`onSceneAction`): `get_current_conditions`,
  `get_forecast` (today to +6 days), `get_warnings` — each with an optional
  `location` field.
- **Dashboard widgets** (`onWidgetGet`): `bom_current`, `bom_forecast`,
  `bom_warnings` — each with an optional per-instance `location` setting.
- **Configuration buttons**: test the connection, find a location.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## Project structure

```
.
├─ index.js                 # SDK wiring (handlers, lifecycle)
├─ src/
│  ├─ bom/client.js         # BoM API client, cache
│  ├─ bom/geohash.js        # position -> geohash
│  ├─ bom/location.js       # location resolution
│  ├─ bom/mapping.js        # BoM -> Gladys vocabulary
│  ├─ weather.js            # weather provider (pivot format)
│  ├─ monitor.js            # warning monitor -> scene triggers
│  ├─ scenes.js             # scene actions
│  ├─ widgets.js            # dashboard widgets
│  ├─ actions.js            # Configuration screen buttons
│  ├─ config.js             # defaults + normalization
│  ├─ i18n.js               # en / fr / de / es texts
│  └─ units.js              # unit conversions
├─ docs/                    # user documentation (en, fr, de, es)
├─ test/                    # node --test, fake Gladys + fake BoM API
├─ gladys-assistant-integration.json
├─ Dockerfile               # Node 24 Alpine, read-only rootfs ready
├─ CHANGELOG.md · CLAUDE.md · SECURITY.md
└─ .github/                 # CI, build, release workflows, Dependabot
```

## Development

```bash
npm install
npm test               # unit tests (no network: the BoM API is faked)
npm run lint           # ESLint
npm run format:check   # Prettier
npx github:GladysAssistant/integration-store .   # store validation
npm run deps:check     # outdated packages, advisories and GitHub Actions
```

`deps:check` lists what Dependabot would open pull requests for: run it
before each push or release and ship the updates with the work.

Run it against a Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="bureau-of-meteorology-bom" \
DATA_DIR=./data LOG_LEVEL=debug \
npm start
```

`DEBUG=gladys-integration-sdk` makes the SDK validate every widget content.

## Release

1. Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md).
2. **Actions → Release → Run workflow**, pick `patch`, `minor` or `major`: it
   bumps the version everywhere, tags, builds the `linux/amd64` +
   `linux/arm64` image to `ghcr.io/gboulvin/gladys-bom` and publishes the
   GitHub Release.
3. The store indexer picks up the new manifest version. The repository needs
   the `gladys-assistant-integration` topic and a **public** GHCR package.

## License

Apache-2.0. Weather data © Commonwealth of Australia, Bureau of Meteorology.
