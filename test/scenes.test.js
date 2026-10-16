import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { normalizeConfig } from '../src/config.js';
import { MAJOR_WARNING, MINOR_WARNING, NOW, mockBom } from './helpers.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const config = normalizeConfig({ location: 'Testville' });

function assertDeclaredOutputs(key, outputs) {
  const declared = manifest.scene_actions.find((a) => a.key === key).outputs;
  const types = Object.fromEntries(declared.map((o) => [o.key, o.type]));
  for (const [name, value] of Object.entries(outputs)) {
    assert.ok(name in types, `${key}: output "${name}" is not declared, the core would drop it`);
    if (value !== null) {
      assert.equal(typeof value, types[name], `${key}: output "${name}" must be a ${types[name]}`);
    }
  }
}

test('get_current_conditions returns the observation', async (t) => {
  mockBom(t);
  const outputs = await SCENE_ACTIONS.get_current_conditions(createFakeGladys(), {
    fields: {},
    config,
  });
  assertDeclaredOutputs('get_current_conditions', outputs);
  assert.equal(outputs.temperature, 24.3);
  assert.equal(outputs.wind_speed, 18);
  assert.equal(outputs.wind_gust, 30);
  assert.equal(outputs.station, 'Testville Airport');
  assert.equal(outputs.location, 'Testville (NSW)');
});

test('get_forecast returns the chosen day', async (t) => {
  mockBom(t);
  const outputs = await SCENE_ACTIONS.get_forecast(createFakeGladys(), {
    fields: { day: '1' },
    config,
  });
  assertDeclaredOutputs('get_forecast', outputs);
  assert.equal(outputs.summary, 'Sunny.');
  assert.equal(outputs.rain_chance, 5);
  assert.equal(outputs.fire_danger, 'moderate');
  assert.equal(outputs.temperature_max, 29);
});

test('get_warnings counts the warnings in force', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  mockBom(t, {
    warnings: [MAJOR_WARNING, MINOR_WARNING, { ...MINOR_WARNING, id: 'x', phase: 'cancelled' }],
  });
  const outputs = await SCENE_ACTIONS.get_warnings(createFakeGladys(), { fields: {}, config });
  assertDeclaredOutputs('get_warnings', outputs);
  assert.deepEqual(outputs, {
    location: 'Testville (NSW)',
    count: 2,
    major_count: 1,
    minor_count: 1,
    has_major: true,
    titles: 'Severe Thunderstorm Warning; Marine Wind Warning',
  });
});

test('a location field overrides the configured one', async (t) => {
  const requests = mockBom(t);
  await SCENE_ACTIONS.get_warnings(createFakeGladys(), {
    fields: { location: 'Elsewhere' },
    config,
  });
  assert.ok(requests.includes('/locations?search=Elsewhere'));
});

test('scene actions run through the fake Gladys and answer outputs', async (t) => {
  mockBom(t);
  const gladys = createFakeGladys();
  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(key, (fields) => handler(gladys, { fields, config }));
  }
  const ack = await gladys.fake.sceneAction('get_forecast', { day: '0' });
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.outputs.summary, 'Possible shower.');
});
