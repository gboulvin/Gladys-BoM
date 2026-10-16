// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen.
//
//   - test_connection  resolve the configured location and read its latest
//                      observation: proves the whole chain works;
//   - search_location  list the BoM places matching a name or a postcode, to
//                      fill the Location field with the right one.
//
// The resolved multi-language message is shown under the button; a thrown
// error is shown too.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { getObservations, searchLocations } from './bom/client.js';
import { UserFacingError, locationLabel, resolveLocation } from './bom/location.js';
import { T, fill } from './i18n.js';

const logger = createLogger({ name: 'actions' });

const MAX_SEARCH_RESULTS = 8;

export const ACTIONS = {
  async test_connection(gladys, { config }) {
    logger.info('Action test_connection');
    const location = await resolveLocation(gladys, config);
    const obs = await getObservations(location.geohash);
    if (!obs || typeof obs.temp !== 'number') {
      return fill(T.testOkNoObs, { location: locationLabel(location) });
    }
    return fill(T.testOk, {
      location: locationLabel(location),
      temperature: obs.temp,
      station: obs.station?.name ?? '?',
    });
  },

  async search_location(gladys, { fields }) {
    const query = String(fields.query ?? '').trim();
    logger.info(`Action search_location <- "${query}"`);
    const matches = await searchLocations(query);
    if (matches.length === 0) {
      throw new UserFacingError(fill(T.locationNotFound, { query }));
    }
    const list = matches
      .slice(0, MAX_SEARCH_RESULTS)
      .map((m) => [m.name, m.state, m.postcode].filter(Boolean).join(' '))
      .join(' · ');
    return fill(T.searchResults, { list });
  },
};
