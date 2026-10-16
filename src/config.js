// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`; the SDK fetches it
// (`gladys.getConfig()`) and notifies every change (`onConfigUpdated`). This
// module only provides the defaults and normalizes the received object.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // Suburb, town, postcode or "lat,lon". Empty: the position of the Gladys
  // house (weather requests carry it, the warning monitor reads the houses).
  location: '',
  // Minutes between two checks of the warnings and the fire danger rating,
  // which fire the scene triggers.
  warning_check_minutes: 10,
  // Report the fire danger ratings from "High" up as Gladys weather alerts.
  fire_danger_alerts: true,
};

const MIN_CHECK_MINUTES = 5;
const MAX_CHECK_MINUTES = 60;

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const minutes = Number(raw.warning_check_minutes ?? DEFAULT_CONFIG.warning_check_minutes);
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    location: typeof raw.location === 'string' ? raw.location.trim() : DEFAULT_CONFIG.location,
    warning_check_minutes: Number.isFinite(minutes)
      ? Math.min(MAX_CHECK_MINUTES, Math.max(MIN_CHECK_MINUTES, Math.round(minutes)))
      : DEFAULT_CONFIG.warning_check_minutes,
    // Anything but an explicit false (or "false" from a form) means true.
    fire_danger_alerts: raw.fire_danger_alerts !== false && raw.fire_danger_alerts !== 'false',
  };
}
