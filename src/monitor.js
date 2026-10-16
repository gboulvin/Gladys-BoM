// -----------------------------------------------------------------------------
// Warning monitor: the source of the scene triggers.
//
// Every `warning_check_minutes`, read the warnings in force and the fire
// danger rating of the configured location, compare them with the previous
// check, and fire one scene event per transition:
//   - `warning_issued`     a warning appeared (new BoM warning id);
//   - `warning_cancelled`  a warning was cancelled, expired or disappeared;
//   - `fire_danger_changed` today's fire danger rating changed.
//
// What was seen is kept in /data (the only writable volume), so a restart
// does not fire again for the warnings already announced. On the very first
// check after installation, the current situation is recorded silently: the
// triggers announce what changes, not what already was.
//
// On a change, the monitor also nudges the core (requestWeatherRefresh: the
// weather-alert triggers of Gladys re-evaluate within seconds instead of 30
// minutes) and the warnings widget.
// -----------------------------------------------------------------------------

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';
import { getDailyForecasts, getWarnings } from './bom/client.js';
import { resolveLocation, locationLabel } from './bom/location.js';
import {
  fireDangerKey,
  isActiveWarning,
  warningCategory,
  warningSeverityKey,
} from './bom/mapping.js';
import { FIRE_DANGER_LABELS } from './i18n.js';

const logger = createLogger({ name: 'monitor' });

export const SCENE_TRIGGERS = {
  WARNING_ISSUED: 'warning_issued',
  WARNING_CANCELLED: 'warning_cancelled',
  FIRE_DANGER_CHANGED: 'fire_danger_changed',
};

// Every key the integration fires (test/manifest.test.js ties it to the
// manifest `scene_triggers`).
export const SCENE_TRIGGER_KEYS = Object.values(SCENE_TRIGGERS);

const stateFile = () => join(process.env.DATA_DIR ?? '/data', 'bom-state.json');

async function loadState() {
  try {
    return JSON.parse(await readFile(stateFile(), 'utf8'));
  } catch {
    return null;
  }
}

async function saveState(state) {
  try {
    await mkdir(process.env.DATA_DIR ?? '/data', { recursive: true });
    await writeFile(stateFile(), JSON.stringify(state));
  } catch (err) {
    // Not fatal: at worst a restart announces the current warnings again.
    logger.warn(`Cannot save the monitor state: ${err.message}`);
  }
}

/** Flat scene event data of a warning (only declared keys, primitives). */
export function warningEventData(warning, location) {
  return {
    warning_type: warningCategory(warning.type),
    severity: warningSeverityKey(warning),
    warning_id: String(warning.id ?? ''),
    title: String(warning.short_title ?? warning.type ?? ''),
    area: String(warning.title ?? ''),
    bom_type: String(warning.type ?? ''),
    phase: warning.phase ?? null,
    issue_time: warning.issue_time ?? null,
    expiry_time: warning.expiry_time ?? null,
    location: locationLabel(location),
  };
}

/**
 * Compare a check with the previous state and list the events to fire.
 * Pure: the tests drive it directly.
 * @returns {{ events: Array<{ key, data }>, state, changed: boolean }}
 */
export function diffCheck(previous, location, warnings, daily, now = Date.now()) {
  const active = warnings.filter((warning) => isActiveWarning(warning, now));
  const fireDanger = fireDangerKey(daily[0]?.fire_danger);
  const next = {
    geohash: location.geohash,
    warnings: Object.fromEntries(active.map((warning) => [warning.id, warning])),
    fire_danger: fireDanger,
  };

  // First check, or the user moved the monitored location: record silently.
  if (!previous || previous.geohash !== location.geohash) {
    return { events: [], state: next, changed: true };
  }

  const events = [];
  for (const warning of active) {
    if (!previous.warnings?.[warning.id]) {
      events.push({
        key: SCENE_TRIGGERS.WARNING_ISSUED,
        data: warningEventData(warning, location),
      });
    }
  }
  for (const [id, warning] of Object.entries(previous.warnings ?? {})) {
    if (!next.warnings[id]) {
      // The location endpoint may drop a cancelled warning instead of listing
      // it with `phase: cancelled`: report the last known state as cancelled.
      const ended = warnings.find((w) => w.id === id) ?? { ...warning, phase: 'cancelled' };
      events.push({
        key: SCENE_TRIGGERS.WARNING_CANCELLED,
        data: warningEventData(ended, location),
      });
    }
  }
  if (previous.fire_danger && previous.fire_danger !== fireDanger) {
    events.push({
      key: SCENE_TRIGGERS.FIRE_DANGER_CHANGED,
      data: {
        rating: fireDanger,
        previous_rating: previous.fire_danger,
        rating_label: FIRE_DANGER_LABELS[fireDanger].en,
        location: locationLabel(location),
      },
    });
  }
  return { events, state: next, changed: events.length > 0 };
}

/**
 * Start the periodic check. Returns the stop function.
 * @param {object} gladys the SDK client
 * @param {() => object} getConfig current normalized config
 * @param {{ onChange?: () => void, firstCheckDelayMs?: number }} [hooks]
 */
export function startMonitor(gladys, getConfig, hooks = {}) {
  let timer = null;
  let stopped = false;

  async function check() {
    const config = getConfig();
    const location = await resolveLocation(gladys, config);
    const [warnings, daily] = await Promise.all([
      getWarnings(location.geohash),
      getDailyForecasts(location.geohash),
    ]);
    const previous = await loadState();
    const { events, state, changed } = diffCheck(previous, location, warnings, daily);
    for (const { key, data } of events) {
      logger.info(`Scene event ${key} <- ${data.title ?? data.rating} (${data.location})`);
      try {
        await gladys.publishSceneEvent(key, data);
      } catch (err) {
        logger.error(`Scene event ${key} refused`, err);
      }
    }
    if (changed) {
      await saveState(state);
    }
    if (events.length > 0) {
      hooks.onChange?.();
    }
    return events;
  }

  // Checks run one at a time (the timer and the Refresh button may overlap):
  // two concurrent checks would both see the old state and fire twice.
  let chain = Promise.resolve();
  const enqueue = () => {
    const run = chain.then(check);
    chain = run.catch(() => {});
    return run;
  };

  async function tick() {
    if (stopped) return;
    try {
      await enqueue();
    } catch (err) {
      logger.warn(`Warning check failed: ${err.userMessage?.en ?? err.message}`);
    } finally {
      if (!stopped) {
        timer = setTimeout(tick, getConfig().warning_check_minutes * 60 * 1000);
      }
    }
  }

  // First check right away: the location is validated and the state recorded.
  timer = setTimeout(tick, hooks.firstCheckDelayMs ?? 0);

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
  };
  // Run a check now (widget "Refresh" button), resolving its events.
  stop.checkNow = enqueue;
  return stop;
}
