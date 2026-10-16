import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { SCENE_TRIGGERS, diffCheck, startMonitor } from '../src/monitor.js';
import { normalizeConfig } from '../src/config.js';
import { DAILY, MAJOR_WARNING, MINOR_WARNING, NOW, mockBom } from './helpers.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const HOUR = 3_600_000;
const LOCATION = {
  geohash: 'r3gx2f',
  name: 'Testville',
  state: 'NSW',
  timezone: 'Australia/Sydney',
};

test('the first check records the situation silently', () => {
  const { events, state } = diffCheck(null, LOCATION, [MAJOR_WARNING], DAILY, NOW);
  assert.deepEqual(events, []);
  assert.ok(state.warnings[MAJOR_WARNING.id]);
  assert.equal(state.fire_danger, 'high');
});

test('a new warning fires warning_issued once', () => {
  const first = diffCheck(null, LOCATION, [], DAILY, NOW).state;
  const { events, state } = diffCheck(first, LOCATION, [MAJOR_WARNING], DAILY, NOW);
  assert.equal(events.length, 1);
  assert.equal(events[0].key, SCENE_TRIGGERS.WARNING_ISSUED);
  assert.equal(events[0].data.warning_type, 'thunderstorm');
  assert.equal(events[0].data.severity, 'major');
  assert.equal(events[0].data.location, 'Testville (NSW)');
  assert.deepEqual(diffCheck(state, LOCATION, [MAJOR_WARNING], DAILY, NOW).events, []);
});

test('a cancelled or vanished warning fires warning_cancelled', () => {
  const state = diffCheck(null, LOCATION, [MAJOR_WARNING, MINOR_WARNING], DAILY, NOW).state;
  const { events } = diffCheck(
    state,
    LOCATION,
    [{ ...MAJOR_WARNING, phase: 'cancelled' }],
    DAILY,
    NOW,
  );
  assert.deepEqual(
    events.map((e) => [e.key, e.data.warning_id, e.data.phase]),
    [
      [SCENE_TRIGGERS.WARNING_CANCELLED, MAJOR_WARNING.id, 'cancelled'],
      [SCENE_TRIGGERS.WARNING_CANCELLED, MINOR_WARNING.id, 'cancelled'],
    ],
  );
});

test('a fire danger change fires fire_danger_changed', () => {
  const state = diffCheck(null, LOCATION, [], DAILY, NOW).state;
  const extreme = [{ ...DAILY[0], fire_danger: 'Extreme' }, ...DAILY.slice(1)];
  const { events } = diffCheck(state, LOCATION, [], extreme, NOW);
  assert.deepEqual(events, [
    {
      key: SCENE_TRIGGERS.FIRE_DANGER_CHANGED,
      data: {
        rating: 'extreme',
        previous_rating: 'high',
        rating_label: 'Extreme',
        location: 'Testville (NSW)',
      },
    },
  ]);
});

test('moving the monitored location records silently again', () => {
  const state = diffCheck(null, LOCATION, [], DAILY, NOW).state;
  const { events } = diffCheck(
    state,
    { ...LOCATION, geohash: 'r1r0fs' },
    [MAJOR_WARNING],
    DAILY,
    NOW,
  );
  assert.deepEqual(events, []);
});

test('event data only carries keys the triggers declare, as primitives', () => {
  const state = diffCheck(null, LOCATION, [], DAILY, NOW).state;
  const extreme = [{ ...DAILY[0], fire_danger: 'Catastrophic' }];
  const { events } = diffCheck(state, LOCATION, [MAJOR_WARNING], extreme, NOW);
  assert.equal(events.length, 2);
  for (const { key, data } of events) {
    const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
    const declared = [...trigger.fields, ...trigger.variables].map((entry) => entry.key);
    for (const [name, value] of Object.entries(data)) {
      assert.ok(declared.includes(name), `${key}: data.${name} is not declared`);
      assert.ok(
        value === null || typeof value !== 'object',
        `${key}: data.${name} is not a primitive`,
      );
    }
    // Filter values must be among the declared options.
    for (const field of trigger.fields) {
      if (field.options && data[field.key] !== undefined) {
        assert.ok(
          field.options.some((option) => option.value === data[field.key]),
          `${key}: ${field.key}="${data[field.key]}" is not an option`,
        );
      }
    }
  }
});

test('the monitor publishes scene events and keeps its state across restarts', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'bom-'));
  process.env.DATA_DIR = dir;
  t.after(async () => {
    delete process.env.DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  });
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const gladys = createFakeGladys();
  const config = normalizeConfig({ location: 'Testville' });
  let changes = 0;

  mockBom(t, { warnings: [] });
  const stop = startMonitor(gladys, () => config, {
    onChange: () => (changes += 1),
    firstCheckDelayMs: HOUR,
  });
  t.after(stop);
  assert.deepEqual(await stop.checkNow(), [], 'first check: silent');

  mockBom(t, { warnings: [MAJOR_WARNING] });
  const events = await stop.checkNow();
  assert.equal(events.length, 1);
  assert.equal(gladys.fake.sceneEvents.length, 1);
  assert.equal(gladys.fake.sceneEvents[0].key, 'warning_issued');
  assert.equal(changes, 1);
  stop();

  // A restarted monitor remembers the warning already announced.
  mockBom(t, { warnings: [MAJOR_WARNING] });
  const restarted = startMonitor(gladys, () => config, { firstCheckDelayMs: HOUR });
  t.after(restarted);
  assert.deepEqual(await restarted.checkNow(), []);
  assert.equal(gladys.fake.sceneEvents.length, 1);
});
