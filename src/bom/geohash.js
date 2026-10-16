// -----------------------------------------------------------------------------
// Geohash encoding: the BoM API addresses a location by the geohash of its
// position, 6 characters long (a cell of about 1.2 km × 0.6 km).
// -----------------------------------------------------------------------------

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode a position as a geohash.
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} [precision=6]
 */
export function encodeGeohash(latitude, longitude, precision = 6) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new TypeError('encodeGeohash needs a finite latitude and longitude');
  }
  const lat = [-90, 90];
  const lon = [-180, 180];
  let hash = '';
  let bits = 0;
  let bitCount = 0;
  let evenBit = true;
  while (hash.length < precision) {
    const range = evenBit ? lon : lat;
    const value = evenBit ? longitude : latitude;
    const mid = (range[0] + range[1]) / 2;
    bits <<= 1;
    if (value >= mid) {
      bits |= 1;
      range[0] = mid;
    } else {
      range[1] = mid;
    }
    evenBit = !evenBit;
    bitCount += 1;
    if (bitCount === 5) {
      hash += BASE32[bits];
      bits = 0;
      bitCount = 0;
    }
  }
  return hash;
}
