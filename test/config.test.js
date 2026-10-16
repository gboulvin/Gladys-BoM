import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('normalizeConfig trims the location and coerces form values', () => {
  const config = normalizeConfig({
    location: '  Parramatta ',
    warning_check_minutes: '15',
    fire_danger_alerts: 'false',
  });
  assert.equal(config.location, 'Parramatta');
  assert.equal(config.warning_check_minutes, 15);
  assert.equal(config.fire_danger_alerts, false);
});

test('normalizeConfig keeps the check interval within 5 to 60 minutes', () => {
  assert.equal(normalizeConfig({ warning_check_minutes: 1 }).warning_check_minutes, 5);
  assert.equal(normalizeConfig({ warning_check_minutes: 600 }).warning_check_minutes, 60);
  assert.equal(normalizeConfig({ warning_check_minutes: 'abc' }).warning_check_minutes, 10);
});

test('a null location falls back to the house position', () => {
  assert.equal(normalizeConfig({ location: null }).location, '');
});
