# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-22

### Changed

- Development tools and CI actions up to date (Prettier 3.9.10, ESLint
  10.13.0, `actions/setup-node` v7, `docker/setup-qemu-action` v4), and a
  `npm run deps:check` command listing what Dependabot would propose.

### Security

- The image is rebuilt on the latest `node:24-alpine` (Node.js and Alpine
  security patches); development tools and CI actions up to date.

## [1.0.0] - 2026-10-16

### Added

- Weather provider for Gladys backed by the Australian Bureau of Meteorology
  (BoM): current conditions from the nearest observation station, 24 hourly
  and up to 8 daily forecasts, warnings in force as Gladys weather alerts, and
  the fire danger rating from "High" up as an alert (can be turned off).
- Location: a suburb, town, postcode or "latitude,longitude" in the
  configuration, or the position of the Gladys house when left empty.
- Scene triggers: BoM warning issued, BoM warning ended (both filterable by
  warning type and severity) and fire danger rating changed.
- Scene actions: get the current conditions, the forecast of a day, and the
  warnings in force, for the configured location or any other one.
- Dashboard widgets: current conditions (with the next 24 hours of
  temperature), 7-day forecast, and warnings with a link to each BoM warning.
- Configuration screen buttons: test the connection, find a location.
- English, French, German and Spanish texts and documentation.
- CI (format, lint, tests on Node 22 and 24, Docker build), multi-arch image
  and GitHub Release workflows from the official integration template.

[Unreleased]: https://github.com/gboulvin/Gladys-BoM/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/gboulvin/Gladys-BoM/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/gboulvin/Gladys-BoM/releases/tag/v1.0.0
