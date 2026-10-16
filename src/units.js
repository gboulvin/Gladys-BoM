// -----------------------------------------------------------------------------
// Unit conversions. The BoM publishes °C, km/h and mm; Gladys asks for
// 'metric' (°C, m/s, mm) or 'us' (°F, mph, in) weather, and the widgets show
// the units an Australian expects (km/h) or the 'us' ones.
// -----------------------------------------------------------------------------

const round = (value, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

/** °C -> the requested system, `undefined` when not a number. */
export function temperature(celsius, units) {
  if (!isNum(celsius)) return undefined;
  return units === 'us' ? round((celsius * 9) / 5 + 32) : round(celsius);
}

/** km/h -> m/s (metric pivot) or mph (us). */
export function pivotSpeed(kmh, units) {
  if (!isNum(kmh)) return undefined;
  return units === 'us' ? round(kmh / 1.609344) : round(kmh / 3.6);
}

/** km/h -> km/h (metric widgets) or mph (us). */
export function displaySpeed(kmh, units) {
  if (!isNum(kmh)) return undefined;
  return units === 'us' ? round(kmh / 1.609344, 0) : round(kmh, 0);
}

/** mm -> mm (metric) or in (us). */
export function precipitation(mm, units) {
  if (!isNum(mm)) return undefined;
  return units === 'us' ? round(mm / 25.4, 2) : round(mm, 1);
}

export function unitLabels(units) {
  return units === 'us'
    ? { temperature: '°F', speed: 'mph', precipitation: 'in' }
    : { temperature: '°C', speed: 'km/h', precipitation: 'mm' };
}

export { isNum };
