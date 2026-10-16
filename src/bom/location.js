// -----------------------------------------------------------------------------
// Which place to read the weather of.
//
// In order of precedence:
//   1. an explicit query (a scene action or widget `location` field);
//   2. the `location` of the configuration (suburb, town, postcode, "lat,lon");
//   3. the coordinates Gladys gave (a weather request), or the position of the
//      first located Gladys house (manifest `"location": true`).
//
// Resolves `{ geohash, name, state, timezone }`, `geohash` 6 characters long.
// -----------------------------------------------------------------------------

import { BomApiError, getLocation, searchLocations } from './client.js';
import { encodeGeohash } from './geohash.js';
import { T, fill } from '../i18n.js';

/** An error whose multi-language message is meant for the user. */
export class UserFacingError extends Error {
  constructor(message) {
    super(message.en);
    this.name = 'UserFacingError';
    this.userMessage = message;
  }
}

/** Search a place and keep the best match. */
export async function locationFromQuery(query) {
  const [match] = await searchLocations(query);
  if (!match) {
    throw new UserFacingError(fill(T.locationNotFound, { query }));
  }
  const details = await getLocation(match.geohash);
  return {
    geohash: match.geohash.slice(0, 6),
    name: match.name,
    state: match.state ?? details?.state ?? null,
    timezone: details?.timezone ?? null,
  };
}

/** The BoM location covering a position. */
export async function locationFromCoordinates(latitude, longitude) {
  const geohash = encodeGeohash(Number(latitude), Number(longitude), 6);
  try {
    const details = await getLocation(geohash);
    return {
      geohash,
      name: details?.name ?? `${Number(latitude).toFixed(2)}, ${Number(longitude).toFixed(2)}`,
      state: details?.state ?? null,
      timezone: details?.timezone ?? null,
    };
  } catch (err) {
    if (err instanceof BomApiError && err.outsideArea) {
      throw new UserFacingError(T.outsideAustralia);
    }
    throw err;
  }
}

/** First Gladys house with a position, `null` when none (or not allowed). */
async function houseCoordinates(gladys) {
  const houses = await gladys.getHouses();
  return (
    houses.find((house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude)) ??
    null
  );
}

/**
 * Resolve the location to read.
 * @param {object} gladys the SDK client
 * @param {object} config normalized config
 * @param {{ query?: string, latitude?: number, longitude?: number }} [hint]
 */
export async function resolveLocation(gladys, config, hint = {}) {
  const query = typeof hint.query === 'string' ? hint.query.trim() : '';
  if (query) {
    return locationFromQuery(query);
  }
  if (config.location) {
    return locationFromQuery(config.location);
  }
  if (Number.isFinite(hint.latitude) && Number.isFinite(hint.longitude)) {
    return locationFromCoordinates(hint.latitude, hint.longitude);
  }
  const house = await houseCoordinates(gladys);
  if (!house) {
    throw new UserFacingError(T.noLocation);
  }
  return locationFromCoordinates(house.latitude, house.longitude);
}

/** "Sydney (NSW)" */
export function locationLabel(location) {
  return location.state ? `${location.name} (${location.state})` : location.name;
}
