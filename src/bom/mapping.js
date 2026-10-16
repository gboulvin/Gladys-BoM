// -----------------------------------------------------------------------------
// From the BoM vocabulary to the Gladys one: icon descriptors to pivot weather
// conditions, warning types to alert types and scene trigger categories,
// compass points to degrees, fire danger ratings to normalized keys.
// -----------------------------------------------------------------------------

import {
  WEATHER_ALERT_SEVERITIES,
  WEATHER_ALERT_TYPES,
  WEATHER_CONDITIONS,
} from '@gladysassistant/integration-sdk';
import { FIRE_DANGER_LABELS, L, WARNING_CATEGORY_LABELS } from '../i18n.js';

// BoM `icon_descriptor` -> pivot condition.
const ICON_CONDITIONS = {
  sunny: WEATHER_CONDITIONS.CLEAR,
  clear: WEATHER_CONDITIONS.CLEAR,
  mostly_sunny: WEATHER_CONDITIONS.PARTLY_CLOUDY,
  partly_cloudy: WEATHER_CONDITIONS.PARTLY_CLOUDY,
  cloudy: WEATHER_CONDITIONS.CLOUD,
  hazy: WEATHER_CONDITIONS.FOG,
  haze: WEATHER_CONDITIONS.FOG,
  fog: WEATHER_CONDITIONS.FOG,
  light_rain: WEATHER_CONDITIONS.DRIZZLE,
  light_shower: WEATHER_CONDITIONS.DRIZZLE,
  rain: WEATHER_CONDITIONS.RAIN,
  shower: WEATHER_CONDITIONS.RAIN,
  heavy_shower: WEATHER_CONDITIONS.POURING,
  storm: WEATHER_CONDITIONS.THUNDERSTORM,
  snow: WEATHER_CONDITIONS.SNOW,
  // A frosty morning is a clear sky; the frost itself is a temperature.
  frost: WEATHER_CONDITIONS.CLEAR,
  dusty: WEATHER_CONDITIONS.SANDSTORM,
  dust: WEATHER_CONDITIONS.SANDSTORM,
  windy: WEATHER_CONDITIONS.WIND,
  cyclone: WEATHER_CONDITIONS.HURRICANE,
  tropical_cyclone: WEATHER_CONDITIONS.HURRICANE,
};

/** Pivot condition of a BoM icon descriptor (`unknown` when absent or new). */
export function conditionFromIcon(icon) {
  return ICON_CONDITIONS[icon] ?? WEATHER_CONDITIONS.UNKNOWN;
}

const COMPASS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
]; // prettier-ignore

/** Degrees (0-360) of a compass point, `undefined` for calm or unknown. */
export function degreesFromCompass(direction) {
  const index = COMPASS.indexOf(String(direction ?? '').toUpperCase());
  return index === -1 ? undefined : index * 22.5;
}

// --- Warnings ------------------------------------------------------------------

/**
 * Category of a BoM warning `type` (e.g. `severe_thunderstorm_warning`): the
 * value the `warning_type` filter of the scene triggers compares with.
 */
export function warningCategory(type) {
  const t = String(type ?? '').toLowerCase();
  if (t.includes('tsunami')) return 'tsunami';
  if (t.includes('cyclone')) return 'tropical_cyclone';
  if (t.includes('flood')) return 'flood';
  if (t.includes('thunderstorm')) return 'thunderstorm';
  if (t.includes('fire')) return 'fire_weather';
  if (t.includes('heat')) return 'heatwave';
  if (t.includes('severe_weather')) return 'severe_weather';
  if (t.includes('sheep') || t.includes('frost') || t.includes('cold')) return 'cold';
  if (t.includes('surf') || t.includes('coastal') || t.includes('tide')) return 'coastal';
  if (t.includes('wind') || t.includes('gale')) return 'wind';
  return 'other';
}

export const WARNING_CATEGORIES = Object.keys(WARNING_CATEGORY_LABELS);

// Category -> pivot alert type. Fire weather and "severe weather" (damaging
// winds, heavy rain, blizzards...) have no faithful pivot type: no type, the
// core renders the alert from its text.
const CATEGORY_ALERT_TYPES = {
  flood: WEATHER_ALERT_TYPES.FLOOD,
  thunderstorm: WEATHER_ALERT_TYPES.THUNDERSTORM,
  heatwave: WEATHER_ALERT_TYPES.HEAT,
  tropical_cyclone: WEATHER_ALERT_TYPES.WIND,
  wind: WEATHER_ALERT_TYPES.WIND,
  cold: WEATHER_ALERT_TYPES.COLD,
  tsunami: WEATHER_ALERT_TYPES.COASTAL,
  coastal: WEATHER_ALERT_TYPES.COASTAL,
};

export function alertTypeOfCategory(category) {
  return CATEGORY_ALERT_TYPES[category];
}

/** `major` | `minor`, the BoM warning group. */
export function warningSeverityKey(warning) {
  return warning?.warning_group_type === 'major' ? 'major' : 'minor';
}

/**
 * CAP severity of a BoM warning. The BoM sorts its warnings in two groups:
 * major (severe weather, floods, storms...) and minor (marine wind, sheep
 * graziers...). A major cyclone or tsunami warning is the top of the scale.
 */
export function alertSeverity(warning) {
  if (warningSeverityKey(warning) === 'major') {
    const category = warningCategory(warning.type);
    return category === 'tropical_cyclone' || category === 'tsunami'
      ? WEATHER_ALERT_SEVERITIES.EXTREME
      : WEATHER_ALERT_SEVERITIES.SEVERE;
  }
  return WEATHER_ALERT_SEVERITIES.MODERATE;
}

/** A warning is in force unless the BoM marked it cancelled or expired. */
export function isActiveWarning(warning, now = Date.now()) {
  if (!warning || warning.phase === 'cancelled') {
    return false;
  }
  const expiry = Date.parse(warning.expiry_time);
  return Number.isNaN(expiry) || expiry > now;
}

/** Public BoM product page of a warning (`NSW_FL049_IDN36503` -> IDN36503). */
export function warningUrl(warning) {
  const product = String(warning?.id ?? '').match(/ID[A-Z]\d{5}/);
  return product
    ? `https://www.bom.gov.au/products/${product[0]}.shtml`
    : 'https://www.bom.gov.au/australia/warnings/';
}

/** Plain text of the HTML `message` of a warning (images and tags removed). */
export function htmlToText(html) {
  return String(html ?? '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<(br|\/p|\/h\d|\/li|\/div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// --- Fire danger -----------------------------------------------------------------

export const FIRE_DANGER_RATINGS = Object.keys(FIRE_DANGER_LABELS);

/** Normalized fire danger rating: `no_rating` | `moderate` | `high` | `extreme` | `catastrophic`. */
export function fireDangerKey(rating) {
  const key = String(rating ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return FIRE_DANGER_RATINGS.includes(key) ? key : 'no_rating';
}

// Ratings from "High" up are reported as Gladys alerts (when enabled).
const FIRE_DANGER_SEVERITIES = {
  high: WEATHER_ALERT_SEVERITIES.MODERATE,
  extreme: WEATHER_ALERT_SEVERITIES.SEVERE,
  catastrophic: WEATHER_ALERT_SEVERITIES.EXTREME,
};

export function fireDangerSeverity(key) {
  return FIRE_DANGER_SEVERITIES[key];
}

/** Widget color of a fire danger rating (AFDRS: green, yellow, orange, red). */
export function fireDangerColor(key) {
  return (
    { moderate: 'success', high: 'warning', extreme: 'danger', catastrophic: 'danger' }[key] ??
    'neutral'
  );
}

export const FIRE_DANGER_EVENT = L(
  'Fire danger rating: {rating}',
  "Danger d'incendie : {rating}",
  'Brandgefahrenstufe: {rating}',
  'Peligro de incendio: {rating}',
);
