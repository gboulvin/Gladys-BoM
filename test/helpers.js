// -----------------------------------------------------------------------------
// Test helpers: a fake BoM API.
//
// Tests never touch the network: `mockBom(t)` replaces the global `fetch` with
// a router serving SYNTHETIC responses — the shape of the real BoM API, with
// made-up values — and records the requested paths. Each test can override a
// route (`mockBom(t, { warnings: [...] })`).
// -----------------------------------------------------------------------------

import { clearCache } from '../src/bom/client.js';

export const NOW = Date.parse('2026-01-15T00:30:00Z');

// Geohash of the fake place (latitude -33.87, longitude 151.21).
export const GEOHASH = 'r3gx2f';

export const SEARCH = [
  {
    geohash: 'r3gx2sp',
    id: 'Testville-r3gx2sp',
    name: 'Testville',
    postcode: '2000',
    state: 'NSW',
  },
  {
    geohash: 'r3gx8b6',
    id: 'North Testville-r3gx8b6',
    name: 'North Testville',
    postcode: '2060',
    state: 'NSW',
  },
];

export const LOCATION = {
  geohash: GEOHASH,
  timezone: 'Australia/Sydney',
  latitude: -33.868,
  longitude: 151.21,
  id: 'Testville-r3gx2f',
  name: 'Testville',
  state: 'NSW',
};

export const OBSERVATIONS = {
  temp: 24.3,
  temp_feels_like: 25.1,
  wind: { speed_kilometre: 18, speed_knot: 10, direction: 'NE' },
  gust: { speed_kilometre: 30, speed_knot: 16 },
  max_gust: null,
  max_temp: { time: '2026-01-15T00:00:00Z', value: 24.5 },
  min_temp: { time: '2026-01-14T19:00:00Z', value: 19.2 },
  rain_since_9am: 1.4,
  humidity: 61,
  station: { bom_id: '000000', name: 'Testville Airport', distance: 1200 },
};

const day = (date, overrides = {}) => ({
  rain: { amount: { min: 0, max: 4, units: 'mm' }, chance: 60 },
  uv: { category: 'extreme', end_time: null, max_index: 12, start_time: null },
  astronomical: { sunrise_time: '2026-01-14T18:55:00Z', sunset_time: '2026-01-15T09:10:00Z' },
  date,
  temp_max: 29,
  temp_min: 20,
  extended_text: 'Partly cloudy. Medium chance of showers. Winds northeasterly 20 km/h.',
  icon_descriptor: 'shower',
  short_text: 'Possible shower.',
  fire_danger: 'High',
  now: { is_night: false, temp_now: 24, temp_later: 29 },
  ...overrides,
});

export const DAILY = [
  day('2026-01-14T13:00:00Z', { temp_min: null }),
  day('2026-01-15T13:00:00Z', { icon_descriptor: 'sunny', short_text: 'Sunny.', fire_danger: 'Moderate', rain: { amount: { min: 0, max: 0, units: 'mm' }, chance: 5 } }),
  day('2026-01-16T13:00:00Z', { icon_descriptor: 'storm', short_text: 'Thunderstorms.' }),
  day('2026-01-17T13:00:00Z', { icon_descriptor: 'cloudy' }),
  day('2026-01-18T13:00:00Z', { icon_descriptor: 'mostly_sunny', fire_danger: null }),
  day('2026-01-19T13:00:00Z', { fire_danger: null }),
  day('2026-01-20T13:00:00Z', { fire_danger: null }),
  day('2026-01-21T13:00:00Z', { icon_descriptor: null, temp_min: null, temp_max: null, fire_danger: null }),
]; // prettier-ignore

export const HOURLY = Array.from({ length: 30 }, (_, i) => ({
  rain: { amount: { min: 0, max: i % 3 === 0 ? 1 : null, units: 'mm' }, chance: 10 + i },
  temp: 22 + (i % 6),
  temp_feels_like: 23 + (i % 6),
  dew_point: 15,
  wind: { speed_kilometre: 15, speed_knot: 8, direction: 'NE', gust_speed_kilometre: 25 },
  relative_humidity: 65,
  uv: i < 8 ? 9 : 0,
  icon_descriptor: i % 2 ? 'mostly_sunny' : 'shower',
  time: new Date(Date.parse('2026-01-15T00:00:00Z') + i * 3_600_000)
    .toISOString()
    .replace('.000', ''),
  is_night: i >= 9,
}));

export const MAJOR_WARNING = {
  id: 'NSW_PW005_IDN21033',
  type: 'severe_thunderstorm_warning',
  title: 'Severe Thunderstorm Warning for Testville',
  short_title: 'Severe Thunderstorm Warning',
  state: 'NSW',
  warning_group_type: 'major',
  issue_time: '2026-01-15T00:00:00Z',
  expiry_time: '2026-01-15T06:00:00Z',
  phase: 'new',
};

export const MINOR_WARNING = {
  id: 'NSW_MW009_IDN11001',
  type: 'marine_wind_warning',
  title: 'Gale Warning for Testville Coast',
  short_title: 'Marine Wind Warning',
  state: 'NSW',
  warning_group_type: 'minor',
  issue_time: '2026-01-14T20:00:00Z',
  expiry_time: '2026-01-16T12:00:00Z',
  phase: 'renewal',
};

const WARNING_DETAIL = {
  ...MAJOR_WARNING,
  message:
    '<div><h2>Severe Thunderstorm Warning</h2><img src="data:image/png;base64,AAAA"><p>For people in <b>Testville</b>.<br>Heavy rainfall &amp; damaging winds.</p></div>',
};

/**
 * Replace `fetch` with the fake BoM API for the duration of the test.
 * @param {import('node:test').TestContext} t
 * @param {object} [overrides] { search, location, observations, daily, hourly, warnings, warning }
 *   — a value replaces the `data` of the route, an Error makes it fail.
 */
export function mockBom(t, overrides = {}) {
  clearCache();
  const routes = {
    search: SEARCH,
    location: LOCATION,
    observations: OBSERVATIONS,
    daily: DAILY,
    hourly: HOURLY,
    warnings: [],
    warning: WARNING_DETAIL,
    ...overrides,
  };
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace(/^\/v1/, '');
    requests.push(path + (searchParams.size ? `?${searchParams}` : ''));
    let route;
    if (path === '/locations') route = 'search';
    else if (/^\/locations\/\w+$/.test(path)) route = 'location';
    else if (path.endsWith('/observations')) route = 'observations';
    else if (path.endsWith('/forecasts/daily')) route = 'daily';
    else if (path.endsWith('/forecasts/hourly')) route = 'hourly';
    else if (path.endsWith('/warnings')) route = 'warnings';
    else if (path.startsWith('/warnings/')) route = 'warning';
    const data = routes[route];
    if (data instanceof Error) {
      const status = data.status ?? 500;
      return Response.json(
        { errors: [{ status: String(status), detail: data.message }] },
        { status },
      );
    }
    if (route === undefined) {
      return Response.json({ errors: [{ detail: 'not found' }] }, { status: 404 });
    }
    return Response.json({ metadata: { observation_time: '2026-01-15T00:20:00Z' }, data });
  });
  return requests;
}

/** An Error carrying an HTTP status, for `mockBom` overrides. */
export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
