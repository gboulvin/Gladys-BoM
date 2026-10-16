// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// Each one reads the BoM for the configured location — or the `location`
// field the scene author filled in — and returns scalar outputs the
// following actions of the scene use: in a condition ("only if the rain
// chance is above 60"), or in a message ("{{...temperature_max}} °C today").
//
// Values are metric, as published by the BoM (°C, km/h, mm). A scene action
// is never a condition: an unknown location throws (the action fails, the
// scene logs it and continues), anything else is an output.
//
// The scene TRIGGERS are fired by the warning monitor, see src/monitor.js.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { getDailyForecasts, getObservations, getWarnings } from './bom/client.js';
import { locationLabel, resolveLocation } from './bom/location.js';
import { fireDangerKey, isActiveWarning, warningSeverityKey } from './bom/mapping.js';
import { isNum } from './units.js';

const logger = createLogger({ name: 'scenes' });

const num = (value) => (isNum(value) ? value : null);

export const SCENE_ACTIONS = {
  async get_current_conditions(gladys, { fields, config }) {
    const location = await resolveLocation(gladys, config, { query: fields.location });
    logger.info(`Scene action get_current_conditions <- ${location.name}`);
    const obs = await getObservations(location.geohash);
    return {
      location: locationLabel(location),
      station: obs?.station?.name ?? null,
      temperature: num(obs?.temp),
      apparent_temperature: num(obs?.temp_feels_like),
      humidity: num(obs?.humidity),
      wind_speed: num(obs?.wind?.speed_kilometre),
      wind_direction: obs?.wind?.direction ?? null,
      wind_gust: num(obs?.gust?.speed_kilometre),
      rain_since_9am: num(obs?.rain_since_9am),
      min_temperature: num(obs?.min_temp?.value),
      max_temperature: num(obs?.max_temp?.value),
      observation_time: obs?.observation_time ?? null,
    };
  },

  async get_forecast(gladys, { fields, config }) {
    const location = await resolveLocation(gladys, config, { query: fields.location });
    const dayIndex = Math.min(6, Math.max(0, Number.parseInt(fields.day ?? '0', 10) || 0));
    logger.info(`Scene action get_forecast <- ${location.name}, day +${dayIndex}`);
    const daily = await getDailyForecasts(location.geohash);
    const day = daily[dayIndex];
    if (!day) {
      throw new Error(`The BoM has no forecast for day +${dayIndex} at ${location.name}`);
    }
    return {
      location: locationLabel(location),
      date: day.date ?? null,
      temperature_min: num(day.temp_min),
      temperature_max: num(day.temp_max),
      summary: day.short_text ?? null,
      details: day.extended_text ?? null,
      rain_chance: num(day.rain?.chance),
      rain_min: num(day.rain?.amount?.min),
      rain_max: num(day.rain?.amount?.max),
      uv_max: num(day.uv?.max_index),
      uv_category: day.uv?.category ?? null,
      fire_danger: fireDangerKey(day.fire_danger),
      sunrise: day.astronomical?.sunrise_time ?? null,
      sunset: day.astronomical?.sunset_time ?? null,
    };
  },

  async get_warnings(gladys, { fields, config }) {
    const location = await resolveLocation(gladys, config, { query: fields.location });
    logger.info(`Scene action get_warnings <- ${location.name}`);
    const active = (await getWarnings(location.geohash)).filter((w) => isActiveWarning(w));
    const major = active.filter((w) => warningSeverityKey(w) === 'major');
    return {
      location: locationLabel(location),
      count: active.length,
      major_count: major.length,
      minor_count: active.length - major.length,
      has_major: major.length > 0,
      titles: active.map((w) => w.short_title ?? w.type).join('; '),
    };
  },
};
