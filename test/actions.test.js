import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { ACTIONS } from '../src/actions.js';
import { UserFacingError } from '../src/bom/location.js';
import { normalizeConfig } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';
import { httpError, mockBom } from './helpers.js';

const config = normalizeConfig({ location: 'Testville' });

test('test_connection reports the observation, in every language', async (t) => {
  mockBom(t);
  const message = await ACTIONS.test_connection(createFakeGladys(), { fields: {}, config });
  assert.deepEqual(Object.keys(message), LANGUAGES);
  assert.equal(
    message.en,
    'Connected to the BoM: Testville (NSW), 24.3 °C observed at Testville Airport.',
  );
});

test('test_connection works without an observation station', async (t) => {
  mockBom(t, { observations: httpError(404, 'none') });
  const message = await ACTIONS.test_connection(createFakeGladys(), { fields: {}, config });
  assert.match(message.fr, /prévisions uniquement/);
});

test('search_location lists the matches', async (t) => {
  mockBom(t);
  const message = await ACTIONS.search_location(createFakeGladys(), {
    fields: { query: 'Test' },
    config,
  });
  assert.match(message.en, /Testville NSW 2000 · North Testville NSW 2060/);
});

test('search_location without a match is a user-facing error', async (t) => {
  mockBom(t, { search: [] });
  await assert.rejects(
    ACTIONS.search_location(createFakeGladys(), { fields: { query: 'Paris' }, config }),
    (err) => err instanceof UserFacingError && err.userMessage.de.includes('Paris'),
  );
});
