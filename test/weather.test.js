import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildWeatherPayload, fetchBundle, getWeather } from '../src/weather.js';
import { normalizeConfig } from '../src/config.js';
import { resolveLocation, UserFacingError } from '../src/bom/location.js';
import { GEOHASH, MAJOR_WARNING, MINOR_WARNING, NOW, httpError, mockBom } from './helpers.js';

const HOUSE = { id: 1, name: 'Home', selector: 'home', latitude: -33.8688, longitude: 151.2093 };
const options = { language: 'en', units: 'metric', fireDangerAlerts: true, now: NOW };

test('the pivot payload carries the observation, 24 hours and the days', async (t) => {
  mockBom(t);
  const weather = await buildWeatherPayload(await fetchBundle(GEOHASH), options);
  assert.equal(weather.temperature, 24.3);
  assert.equal(weather.apparent_temperature, 25.1);
  assert.equal(weather.humidity, 61);
  assert.equal(weather.wind_speed, 5, '18 km/h is 5 m/s');
  assert.equal(weather.wind_direction, 45);
  assert.equal(weather.wind_gust, 8.3);
  assert.equal(weather.weather, 'rain', 'the sky of the current hour');
  assert.equal(weather.is_day, true);
  assert.equal(weather.hours.length, 24);
  assert.equal(weather.hours[0].datetime, '2026-01-15T00:00:00Z');
  assert.equal(weather.hours[9].is_day, false);
  // Today lost its forecast minimum: the observed one stands in. The last
  // day has no temperatures and is left out.
  assert.equal(weather.days[0].temperature_min, 19.2);
  assert.equal(weather.days.length, 7);
  assert.equal(weather.days[2].weather, 'thunderstorm');
  assert.equal(weather.days[0].precipitation_probability, 60);
});

test('us units convert temperatures, speeds and rain', async (t) => {
  mockBom(t);
  const weather = await buildWeatherPayload(await fetchBundle(GEOHASH), {
    ...options,
    units: 'us',
  });
  assert.equal(weather.temperature, 75.7);
  assert.equal(weather.wind_speed, 11.2);
  assert.equal(weather.days[0].precipitation, 0.16);
});

test('warnings become alerts, major first, fire danger last', async (t) => {
  mockBom(t, {
    warnings: [MINOR_WARNING, MAJOR_WARNING, { ...MAJOR_WARNING, id: 'old', phase: 'cancelled' }],
  });
  const weather = await buildWeatherPayload(await fetchBundle(GEOHASH), options);
  assert.equal(weather.alerts.length, 3);
  const [major, minor, fire] = weather.alerts;
  assert.equal(major.severity, 'severe');
  assert.equal(major.type, 'thunderstorm');
  assert.equal(major.event, 'Severe Thunderstorm Warning');
  assert.match(major.description, /Heavy rainfall & damaging winds/);
  assert.doesNotMatch(major.description, /base64/);
  assert.equal(minor.severity, 'moderate');
  assert.equal(minor.type, 'wind');
  assert.deepEqual(
    { severity: fire.severity, event: fire.event },
    { severity: 'moderate', event: 'Fire danger rating: High' },
  );
});

test('alerts are named in the user language', async (t) => {
  mockBom(t, { warnings: [MAJOR_WARNING] });
  const bundle = await fetchBundle(GEOHASH);
  const fr = await buildWeatherPayload(bundle, { ...options, language: 'fr' });
  assert.equal(fr.alerts[0].event, 'Orage violent');
  assert.equal(fr.alerts[1].event, "Danger d'incendie : Élevé");
  const es = await buildWeatherPayload(bundle, { ...options, language: 'es' });
  assert.equal(es.alerts[0].event, 'Tormenta severa');
});

test('the fire danger alert can be turned off', async (t) => {
  mockBom(t);
  const weather = await buildWeatherPayload(await fetchBundle(GEOHASH), {
    ...options,
    fireDangerAlerts: false,
  });
  assert.deepEqual(weather.alerts, []);
});

test('without a station, the hourly forecast gives the current conditions', async (t) => {
  mockBom(t, { observations: httpError(404, 'none') });
  const weather = await buildWeatherPayload(await fetchBundle(GEOHASH), options);
  assert.equal(weather.temperature, 22);
  // Today has no forecast minimum and nothing observed: the day is left out.
  assert.equal(weather.days[0].datetime, '2026-01-15T13:00:00Z');
});

test('onWeatherGet answers through the fake Gladys for the requested position', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const requests = mockBom(t);
  const gladys = createFakeGladys();
  const config = normalizeConfig();
  gladys.onWeatherGet((opts) => getWeather(gladys, config, opts));
  const ack = await gladys.fake.weatherGet({
    latitude: -33.8688,
    longitude: 151.2093,
    language: 'de',
    units: 'metric',
  });
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.weather.temperature, 24.3);
  assert.ok(requests.includes(`/locations/${GEOHASH}/observations`));
});

test('outside Australia the request fails, so Gladys falls back to another provider', async (t) => {
  mockBom(t, { location: httpError(400, 'Outside of allowed area.') });
  const gladys = createFakeGladys();
  gladys.onWeatherGet((opts) => getWeather(gladys, normalizeConfig(), opts));
  const ack = await gladys.fake.weatherGet({
    latitude: 48.85,
    longitude: 2.35,
    language: 'en',
    units: 'metric',
  });
  assert.equal(ack.success, false);
  assert.match(ack.error, /outside the area/);
});

test('the configured location wins over the coordinates', async (t) => {
  const requests = mockBom(t);
  const location = await resolveLocation(
    createFakeGladys(),
    normalizeConfig({ location: 'Testville' }),
    {
      latitude: 1,
      longitude: 1,
    },
  );
  assert.equal(location.geohash, 'r3gx2s');
  assert.equal(location.timezone, 'Australia/Sydney');
  assert.ok(requests.includes('/locations?search=Testville'));
});

test('without anything else, the location is the first located house', async (t) => {
  mockBom(t);
  const gladys = createFakeGladys({
    houses: [{ id: 2, name: 'Shed', selector: 'shed', latitude: null, longitude: null }, HOUSE],
  });
  const location = await resolveLocation(gladys, normalizeConfig());
  assert.equal(location.geohash, GEOHASH);
  assert.equal(location.name, 'Testville');
});

test('no location at all is a user-facing error', async (t) => {
  mockBom(t);
  await assert.rejects(resolveLocation(createFakeGladys(), normalizeConfig()), UserFacingError);
  mockBom(t, { search: [] });
  await assert.rejects(
    resolveLocation(createFakeGladys(), normalizeConfig({ location: 'Nowhere' })),
    (err) => err instanceof UserFacingError && /Nowhere/.test(err.userMessage.fr),
  );
});
