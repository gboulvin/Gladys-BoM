import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeGeohash } from '../src/bom/geohash.js';
import {
  alertSeverity,
  conditionFromIcon,
  degreesFromCompass,
  fireDangerKey,
  htmlToText,
  isActiveWarning,
  warningCategory,
  warningUrl,
} from '../src/bom/mapping.js';
import { BomApiError, getObservations, getWarnings, searchLocations } from '../src/bom/client.js';
import { GEOHASH, MAJOR_WARNING, MINOR_WARNING, httpError, mockBom } from './helpers.js';

test('encodeGeohash matches the reference geohashes', () => {
  assert.equal(encodeGeohash(-33.8688, 151.2093, 6), 'r3gx2f');
  assert.equal(encodeGeohash(57.64911, 10.40744, 11), 'u4pruydqqvj');
  assert.throws(() => encodeGeohash(Number.NaN, 0), TypeError);
});

test('BoM icons map to pivot conditions', () => {
  assert.equal(conditionFromIcon('sunny'), 'clear');
  assert.equal(conditionFromIcon('mostly_sunny'), 'partly-cloudy');
  assert.equal(conditionFromIcon('heavy_shower'), 'pouring');
  assert.equal(conditionFromIcon('storm'), 'thunderstorm');
  assert.equal(conditionFromIcon('dusty'), 'sandstorm');
  assert.equal(conditionFromIcon('tropical_cyclone'), 'hurricane');
  assert.equal(conditionFromIcon(null), 'unknown');
  assert.equal(conditionFromIcon('something_new'), 'unknown');
});

test('compass points become degrees, calm has none', () => {
  assert.equal(degreesFromCompass('N'), 0);
  assert.equal(degreesFromCompass('ESE'), 112.5);
  assert.equal(degreesFromCompass('nw'), 315);
  assert.equal(degreesFromCompass('CALM'), undefined);
});

test('warning types fall into the trigger categories', () => {
  assert.equal(warningCategory('flood_watch'), 'flood');
  assert.equal(warningCategory('severe_thunderstorm_warning'), 'thunderstorm');
  assert.equal(warningCategory('severe_weather_warning'), 'severe_weather');
  assert.equal(warningCategory('fire_weather_warning'), 'fire_weather');
  assert.equal(warningCategory('heatwave_warning'), 'heatwave');
  assert.equal(warningCategory('tropical_cyclone_warning'), 'tropical_cyclone');
  assert.equal(warningCategory('marine_wind_warning'), 'wind');
  assert.equal(warningCategory('sheep_graziers_warning'), 'cold');
  assert.equal(warningCategory('tsunami_warning'), 'tsunami');
  assert.equal(warningCategory('hazardous_surf_warning'), 'coastal');
  assert.equal(warningCategory('road_weather_alert'), 'other');
});

test('warning severities follow the BoM groups', () => {
  assert.equal(alertSeverity(MAJOR_WARNING), 'severe');
  assert.equal(alertSeverity(MINOR_WARNING), 'moderate');
  assert.equal(alertSeverity({ ...MAJOR_WARNING, type: 'tropical_cyclone_warning' }), 'extreme');
});

test('a cancelled or expired warning is not active', () => {
  const now = Date.parse('2026-01-15T01:00:00Z');
  assert.ok(isActiveWarning(MAJOR_WARNING, now));
  assert.ok(!isActiveWarning({ ...MAJOR_WARNING, phase: 'cancelled' }, now));
  assert.ok(!isActiveWarning(MAJOR_WARNING, Date.parse('2026-01-15T07:00:00Z')));
});

test('fire danger ratings are normalized', () => {
  assert.equal(fireDangerKey('Extreme'), 'extreme');
  assert.equal(fireDangerKey('No Rating'), 'no_rating');
  assert.equal(fireDangerKey(null), 'no_rating');
  assert.equal(fireDangerKey('Very High'), 'no_rating');
});

test('warning links point at the BoM product page', () => {
  assert.equal(warningUrl(MAJOR_WARNING), 'https://www.bom.gov.au/products/IDN21033.shtml');
  assert.equal(warningUrl({ id: 'x' }), 'https://www.bom.gov.au/australia/warnings/');
});

test('htmlToText strips tags, images and entities', () => {
  assert.equal(
    htmlToText('<h2>Title</h2><img src="data:x"><p>A &amp; B<br>C</p>'),
    'Title\nA & B\nC',
  );
});

test('the client caches responses and shares concurrent requests', async (t) => {
  const requests = mockBom(t);
  await Promise.all([getObservations(GEOHASH), getObservations(GEOHASH)]);
  await getObservations(GEOHASH);
  assert.equal(requests.filter((p) => p.endsWith('/observations')).length, 1);
});

test('the client sends 6-character geohashes only', async (t) => {
  const requests = mockBom(t);
  await getWarnings('r3gx2sp');
  assert.deepEqual(requests, ['/locations/r3gx2s/warnings']);
  await assert.rejects(getWarnings('abc'), TypeError);
});

test('an observation-less location resolves null, other errors throw', async (t) => {
  mockBom(t, { observations: httpError(404, 'No station') });
  assert.equal(await getObservations(GEOHASH), null);
  mockBom(t, { search: httpError(503, 'down') });
  await assert.rejects(
    searchLocations('x'),
    (err) => err instanceof BomApiError && err.status === 503,
  );
});

test('a position outside Australia is recognised', () => {
  assert.ok(new BomApiError(400, 'Outside of allowed area.').outsideArea);
  assert.ok(!new BomApiError(400, 'The geohash string was not 6 character.').outsideArea);
});
