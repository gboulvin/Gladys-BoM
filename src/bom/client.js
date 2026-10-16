// -----------------------------------------------------------------------------
// Bureau of Meteorology API client.
//
// The JSON API behind the BoM website and app (https://api.weather.bom.gov.au):
// no account, no key, Australia only. Every location-scoped endpoint takes a
// 6-character geohash.
//
// The weather provider, the scene actions, the dashboard widgets and the
// warning monitor all read the same data: responses are cached per URL for a
// few minutes, and concurrent requests for the same URL share one call, so a
// dashboard full of widgets costs the BoM a handful of requests.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'bom-client' });

export const API_BASE = 'https://api.weather.bom.gov.au/v1';

const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = 'gladys-bom (+https://github.com/gboulvin/Gladys-BoM)';

// How long each kind of data stays fresh. Observations are issued every
// 10 minutes, the forecasts a few times a day; warnings can be issued at any
// time, so they are kept the shortest.
export const TTL_MS = {
  location: 24 * 60 * 60 * 1000,
  search: 24 * 60 * 60 * 1000,
  observations: 5 * 60 * 1000,
  daily: 15 * 60 * 1000,
  hourly: 15 * 60 * 1000,
  warnings: 2 * 60 * 1000,
  warning: 10 * 60 * 1000,
};

const MAX_CACHE_ENTRIES = 200;

/** Error of the BoM API, carrying the HTTP status and the API error detail. */
export class BomApiError extends Error {
  constructor(status, detail) {
    super(`BoM API HTTP ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'BomApiError';
    this.status = status;
    this.detail = detail;
  }

  /** The position is outside the area the BoM covers (anything but Australia). */
  get outsideArea() {
    return this.status === 400 && /outside of allowed area/i.test(this.detail ?? '');
  }
}

const cache = new Map(); // url -> { expires, value }
const inFlight = new Map(); // url -> Promise

/** Forget every cached response (the widget "Refresh" button, the tests). */
export function clearCache() {
  cache.clear();
}

async function request(path, ttl) {
  const url = `${API_BASE}${path}`;
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }
  if (inFlight.has(url)) {
    return inFlight.get(url);
  }
  const promise = (async () => {
    logger.debug(`GET ${url}`);
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      // A non-JSON answer (proxy error page...): reported by status below.
    }
    if (!response.ok) {
      throw new BomApiError(response.status, body?.errors?.[0]?.detail);
    }
    if (cache.size >= MAX_CACHE_ENTRIES) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(url, { expires: Date.now() + ttl, value: body });
    return body;
  })();
  inFlight.set(url, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(url);
  }
}

function geohash6(geohash) {
  const hash = String(geohash ?? '').slice(0, 6);
  if (!/^[0-9b-hjkmnp-z]{6}$/.test(hash)) {
    throw new TypeError(`Invalid geohash "${geohash}"`);
  }
  return hash;
}

/**
 * Search the BoM locations: a suburb, a town, a postcode or "lat,lon".
 * @returns {Promise<Array<{ geohash, id, name, postcode, state }>>}
 */
export async function searchLocations(query) {
  const body = await request(
    `/locations?search=${encodeURIComponent(String(query).trim())}`,
    TTL_MS.search,
  );
  return body?.data ?? [];
}

/** Location details: `{ geohash, timezone, latitude, longitude, name, state }`. */
export async function getLocation(geohash) {
  const body = await request(`/locations/${geohash6(geohash)}`, TTL_MS.location);
  return body?.data ?? null;
}

/**
 * Latest observation of the nearest station. Resolves `null` when the
 * location has no station nearby (the BoM answers 404).
 */
export async function getObservations(geohash) {
  try {
    const body = await request(`/locations/${geohash6(geohash)}/observations`, TTL_MS.observations);
    if (!body?.data) {
      return null;
    }
    return { ...body.data, observation_time: body.metadata?.observation_time ?? null };
  } catch (err) {
    if (err instanceof BomApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/** Daily forecasts (up to 8 days, today first). */
export async function getDailyForecasts(geohash) {
  const body = await request(`/locations/${geohash6(geohash)}/forecasts/daily`, TTL_MS.daily);
  return body?.data ?? [];
}

/** Hourly forecasts (about 3 days, the current hour first). */
export async function getHourlyForecasts(geohash) {
  const body = await request(`/locations/${geohash6(geohash)}/forecasts/hourly`, TTL_MS.hourly);
  return body?.data ?? [];
}

/** Warnings in force at a location. */
export async function getWarnings(geohash) {
  const body = await request(`/locations/${geohash6(geohash)}/warnings`, TTL_MS.warnings);
  return body?.data ?? [];
}

/** One warning with its full text (`message`, HTML). */
export async function getWarning(id) {
  const body = await request(`/warnings/${encodeURIComponent(id)}`, TTL_MS.warning);
  return body?.data ?? null;
}
