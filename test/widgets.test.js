import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { WIDGETS, WIDGET_KEYS, refreshWidgets } from '../src/widgets.js';
import { normalizeConfig } from '../src/config.js';
import { MAJOR_WARNING, MINOR_WARNING, NOW, httpError, mockBom } from './helpers.js';

const config = normalizeConfig({ location: 'Testville' });
const get = (key, request = {}) =>
  WIDGETS[key].get(createFakeGladys(), {
    settings: {},
    language: 'en',
    units: 'metric',
    config,
    ...request,
  });

for (const key of Object.values(WIDGET_KEYS)) {
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const units of ['metric', 'us']) {
      test(`${key} is rendered exactly as sent (${language}, ${units})`, async (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: NOW });
        mockBom(t, { warnings: [MAJOR_WARNING, MINOR_WARNING] });
        assert.deepEqual(validateWidgetContent(await get(key, { language, units })), []);
      });
    }
  }
}

test('bom_current shows the observation and the next hours', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  mockBom(t);
  const { components } = await get(WIDGET_KEYS.CURRENT);
  const values = components.filter((c) => c.type === 'value').map((c) => c.value);
  assert.deepEqual(values, [24.3, 25.1, 61, 18]);
  const chart = components.find((c) => c.type === 'chart');
  assert.equal(chart.series[0].points.length, 24);
  const status = components.find((c) => c.type === 'status');
  assert.ok(status.items.some((item) => item.value.en === 'High' && item.color === 'warning'));
});

test('bom_warnings lists major warnings first, with their BoM page', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  mockBom(t, { warnings: [MINOR_WARNING, MAJOR_WARNING] });
  const { components } = await get(WIDGET_KEYS.WARNINGS, { language: 'fr' });
  const list = components.find((c) => c.type === 'card-list');
  assert.equal(list.items[0].title, 'Severe Thunderstorm Warning');
  assert.deepEqual(list.items[0].badge, { text: 'Majeure', color: 'danger' });
  assert.equal(list.items[0].links[0].url, 'https://www.bom.gov.au/products/IDN21033.shtml');
});

test('bom_warnings without warnings says so', async (t) => {
  mockBom(t);
  const { components } = await get(WIDGET_KEYS.WARNINGS);
  assert.equal(components.find((c) => c.type === 'status').items[0].color, 'success');
});

test('a widget instance can show another place', async (t) => {
  const requests = mockBom(t);
  await get(WIDGET_KEYS.FORECAST, { settings: { location: 'Elsewhere' } });
  assert.ok(requests.includes('/locations?search=Elsewhere'));
});

test('an unreadable place shows the reason instead of failing', async (t) => {
  mockBom(t, { search: [] });
  const content = await get(WIDGET_KEYS.CURRENT, { language: 'es' });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.match(content.components[0].text, /Ningún lugar australiano/);
  mockBom(t, { daily: httpError(500, 'boom') });
  const down = await get(WIDGET_KEYS.FORECAST);
  assert.match(down.components[0].text, /cannot be reached/);
});

test('the refresh button runs the refresh and answers a short toast', async () => {
  let refreshed = 0;
  for (const widget of Object.values(WIDGETS)) {
    const message = await widget.action(createFakeGladys(), {
      actionKey: 'refresh',
      refresh: async () => (refreshed += 1),
    });
    assert.ok(message.en.length <= 200);
  }
  assert.equal(refreshed, 3);
  await assert.rejects(
    WIDGETS.bom_warnings.action(createFakeGladys(), { actionKey: 'nope' }),
    /Unknown widget action/,
  );
});

test('every button action of the contents is handled', async (t) => {
  mockBom(t, { warnings: [MAJOR_WARNING] });
  for (const key of Object.values(WIDGET_KEYS)) {
    const { components } = await get(key);
    for (const button of components.filter((c) => c.type === 'button' && c.action)) {
      await WIDGETS[key].action(createFakeGladys(), { actionKey: button.action.key });
    }
  }
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.keys(WIDGETS));
});
