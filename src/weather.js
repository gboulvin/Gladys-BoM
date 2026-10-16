// -----------------------------------------------------------------------------
// The weather provider (manifest `type: "weather"`).
//
// Gladys calls onWeatherGet with the position of the house, the user's
// language and unit system; the answer is the pivot weather format, which
// feeds the dashboard weather widget, the chat assistant and the core's
// weather-alert scene triggers.
//
// Mapping of the BoM data:
//   - current conditions: the latest observation of the nearest station, the
//     sky (icon) and day/night of the current hourly forecast;
//   - `hours`: the next 24 hourly forecasts;
//   - `days`: the daily forecasts (up to 8);
//   - `alerts`: the warnings in force at the location, plus the fire danger
//     rating of the day from "High" up (configurable).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  getDailyForecasts,
  getHourlyForecasts,
  getObservations,
  getWarning,
  getWarnings,
} from './bom/client.js';
import {
  FIRE_DANGER_EVENT,
  alertSeverity,
  alertTypeOfCategory,
  conditionFromIcon,
  degreesFromCompass,
  fireDangerKey,
  fireDangerSeverity,
  htmlToText,
  isActiveWarning,
  warningCategory,
} from './bom/mapping.js';
import { resolveLocation } from './bom/location.js';
import { FIRE_DANGER_LABELS, WARNING_CATEGORY_LABELS, fill, pick } from './i18n.js';
import { isNum, pivotSpeed, precipitation, temperature } from './units.js';

const logger = createLogger({ name: 'weather' });

const MAX_HOURS = 24;
const MAX_DAYS = 8;
const MAX_ALERTS = 10;
const MAX_ALERT_DESCRIPTION = 5000;

/** Everything the BoM knows about a location, fetched in parallel. */
export async function fetchBundle(geohash) {
  const [observations, daily, hourly, warnings] = await Promise.all([
    getObservations(geohash),
    getDailyForecasts(geohash),
    getHourlyForecasts(geohash),
    getWarnings(geohash),
  ]);
  return { observations, daily, hourly, warnings };
}

/** The hourly forecasts from the current hour on. */
export function upcomingHours(hourly, now = Date.now()) {
  const currentHourStart = now - 60 * 60 * 1000;
  return hourly.filter((hour) => Date.parse(hour.time) > currentHourStart);
}

/** Rain amount of a BoM forecast: the upper bound, else the lower one. */
function rainAmount(rain) {
  const amount = rain?.amount ?? {};
  return isNum(amount.max) ? amount.max : isNum(amount.min) ? amount.min : undefined;
}

// Drop the undefined values: the pivot only wants what the provider knows.
function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function toHour(hour, units) {
  return compact({
    temperature: temperature(hour.temp, units),
    weather: conditionFromIcon(hour.icon_descriptor),
    datetime: hour.time,
    apparent_temperature: temperature(hour.temp_feels_like, units),
    humidity: isNum(hour.relative_humidity) ? hour.relative_humidity : undefined,
    wind_speed: pivotSpeed(hour.wind?.speed_kilometre, units),
    wind_direction: degreesFromCompass(hour.wind?.direction),
    wind_gust: pivotSpeed(hour.wind?.gust_speed_kilometre, units),
    precipitation: precipitation(rainAmount(hour.rain), units),
    precipitation_probability: isNum(hour.rain?.chance) ? hour.rain.chance : undefined,
    uv_index: isNum(hour.uv) ? hour.uv : undefined,
    is_day: typeof hour.is_night === 'boolean' ? !hour.is_night : undefined,
  });
}

function toDay(day, index, observations, units) {
  // Once the night is over, the BoM drops today's minimum: the observed one
  // stands in for it.
  const min = isNum(day.temp_min)
    ? day.temp_min
    : index === 0 && isNum(observations?.min_temp?.value)
      ? observations.min_temp.value
      : null;
  const max = isNum(day.temp_max)
    ? day.temp_max
    : index === 0 && isNum(observations?.max_temp?.value)
      ? observations.max_temp.value
      : null;
  if (!isNum(min) || !isNum(max)) {
    return null;
  }
  return compact({
    temperature_min: temperature(Math.min(min, max), units),
    temperature_max: temperature(Math.max(min, max), units),
    datetime: day.date,
    weather: day.icon_descriptor ? conditionFromIcon(day.icon_descriptor) : undefined,
    precipitation: precipitation(rainAmount(day.rain), units),
    precipitation_probability: isNum(day.rain?.chance) ? day.rain.chance : undefined,
    uv_index: isNum(day.uv?.max_index) ? day.uv.max_index : undefined,
    sunrise: day.astronomical?.sunrise_time ?? undefined,
    sunset: day.astronomical?.sunset_time ?? undefined,
  });
}

/** Name of a warning in the user's language (the BoM title stays English). */
export function warningEventName(warning, language) {
  const category = warningCategory(warning.type);
  const lang = String(language ?? 'en').slice(0, 2);
  if (lang === 'en' || category === 'other') {
    return warning.short_title ?? warning.title ?? warning.type;
  }
  return pick(WARNING_CATEGORY_LABELS[category], lang);
}

async function warningDescription(warning) {
  // The full text is a separate request per warning: best effort, the title
  // alone still makes a useful alert.
  try {
    const detail = await getWarning(warning.id);
    const text = htmlToText(detail?.message);
    if (text) {
      return text.slice(0, MAX_ALERT_DESCRIPTION);
    }
  } catch (err) {
    logger.debug(`Warning ${warning.id}: no detail (${err.message})`);
  }
  return [warning.short_title, warning.title].filter(Boolean).join(' — ');
}

/** Pivot alerts: the warnings in force, then the fire danger rating. */
export async function buildAlerts({ warnings, daily }, { language, fireDangerAlerts, now }) {
  const active = warnings.filter((warning) => isActiveWarning(warning, now));
  // Major warnings first: Gladys keeps 10.
  active.sort(
    (a, b) =>
      (a.warning_group_type === 'major' ? 0 : 1) - (b.warning_group_type === 'major' ? 0 : 1),
  );
  const alerts = await Promise.all(
    active.slice(0, MAX_ALERTS).map(async (warning) =>
      compact({
        severity: alertSeverity(warning),
        event: warningEventName(warning, language).slice(0, 100),
        type: alertTypeOfCategory(warningCategory(warning.type)),
        description: await warningDescription(warning),
        start: warning.issue_time ?? undefined,
        end: warning.expiry_time ?? undefined,
      }),
    ),
  );

  const today = daily[0];
  const rating = fireDangerKey(today?.fire_danger);
  const severity = fireDangerSeverity(rating);
  if (fireDangerAlerts && severity && alerts.length < MAX_ALERTS) {
    const label = pick(FIRE_DANGER_LABELS[rating], language);
    alerts.push({
      severity,
      event: pick(fill(FIRE_DANGER_EVENT, { rating: label }), language),
      description: today.extended_text ?? undefined,
    });
  }
  return alerts;
}

/**
 * Build the pivot weather payload of a BoM bundle.
 * @param {{ observations, daily, hourly, warnings }} bundle
 * @param {{ language: string, units: 'metric' | 'us', fireDangerAlerts: boolean, now?: number }} options
 */
export async function buildWeatherPayload(bundle, options) {
  const { observations, daily, hourly } = bundle;
  const { units } = options;
  const hours = upcomingHours(hourly, options.now);
  const current = hours[0];

  const currentTemp = isNum(observations?.temp) ? observations.temp : current?.temp;
  if (!isNum(currentTemp)) {
    throw new Error('The BoM returned no current temperature for this location');
  }
  const feelsLike = isNum(observations?.temp_feels_like)
    ? observations.temp_feels_like
    : current?.temp_feels_like;
  const humidity = isNum(observations?.humidity)
    ? observations.humidity
    : current?.relative_humidity;
  const windKmh = observations?.wind?.speed_kilometre ?? current?.wind?.speed_kilometre;
  const windDirection = observations?.wind?.direction ?? current?.wind?.direction;
  const gustKmh = observations?.gust?.speed_kilometre ?? current?.wind?.gust_speed_kilometre;

  const days = daily
    .slice(0, MAX_DAYS)
    .map((day, index) => toDay(day, index, observations, units))
    .filter(Boolean);

  return compact({
    temperature: temperature(currentTemp, units),
    weather: conditionFromIcon(current?.icon_descriptor ?? daily[0]?.icon_descriptor),
    datetime: observations?.observation_time ?? current?.time ?? new Date().toISOString(),
    apparent_temperature: temperature(feelsLike, units),
    humidity: isNum(humidity) ? humidity : undefined,
    dew_point: temperature(current?.dew_point, units),
    wind_speed: pivotSpeed(windKmh, units),
    wind_direction: degreesFromCompass(windDirection),
    wind_gust: pivotSpeed(gustKmh, units),
    uv_index: isNum(current?.uv) ? current.uv : undefined,
    sunrise: daily[0]?.astronomical?.sunrise_time ?? undefined,
    sunset: daily[0]?.astronomical?.sunset_time ?? undefined,
    is_day: typeof current?.is_night === 'boolean' ? !current.is_night : undefined,
    hours: hours.slice(0, MAX_HOURS).map((hour) => toHour(hour, units)),
    days,
    alerts: await buildAlerts(bundle, {
      language: options.language,
      fireDangerAlerts: options.fireDangerAlerts,
      now: options.now,
    }),
  });
}

/** Handler of `onWeatherGet`. */
export async function getWeather(gladys, config, { latitude, longitude, language, units }) {
  const location = await resolveLocation(gladys, config, { latitude, longitude });
  logger.debug(`Weather request -> ${location.name} (${location.geohash})`);
  const bundle = await fetchBundle(location.geohash);
  return buildWeatherPayload(bundle, {
    language,
    units: units === 'us' ? 'us' : 'metric',
    fireDangerAlerts: config.fire_danger_alerts,
  });
}
