// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The store indexer validates the manifest, but nothing there can know which
// handlers the code registers — these tests keep both sides in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTIONS } from '../src/actions.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { SCENE_TRIGGER_KEYS } from '../src/monitor.js';
import { WIDGETS } from '../src/widgets.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { FIRE_DANGER_RATINGS, WARNING_CATEGORIES } from '../src/bom/mapping.js';
import { LANGUAGES } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

const allFields = [
  ...(manifest.config_schema ?? []),
  ...[...manifest.actions, ...manifest.scene_triggers, ...manifest.scene_actions].flatMap(
    (item) => item.fields ?? [],
  ),
  ...manifest.widgets.flatMap((widget) => widget.settings ?? []),
];

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

function isAtLeast(version, required) {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) return version[i] > required[i];
  }
  return true;
}

test('the manifest is a cloud weather provider that reads the house location', () => {
  assert.equal(manifest.type, 'weather');
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.equal(manifest.location, true, 'the warning monitor reads the house position');
});

test('capability fields and categories require Gladys >= 5.1.0', () => {
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
  assert.ok(isAtLeast(minGladysVersion(), [5, 1, 0]), manifest.gladys_version);
});

test('every manifest action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), Object.keys(ACTIONS).sort());
});

test('every scene_actions key has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_actions).sort(), Object.keys(SCENE_ACTIONS).sort());
});

test('every widget has a content handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets).sort(), Object.keys(WIDGETS).sort());
});

test('every scene trigger fired is declared, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), [...SCENE_TRIGGER_KEYS].sort());
});

test('the trigger filter options are the values the code produces', () => {
  for (const key of ['warning_issued', 'warning_cancelled']) {
    const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
    const types = trigger.fields.find((field) => field.key === 'warning_type').options;
    assert.deepEqual(
      types.map((option) => option.value),
      WARNING_CATEGORIES,
    );
  }
  const fire = manifest.scene_triggers.find((entry) => entry.key === 'fire_danger_changed');
  assert.deepEqual(
    fire.fields[0].options.map((option) => option.value),
    FIRE_DANGER_RATINGS,
  );
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  const stored = manifest.config_schema.filter((field) => field.type !== 'section');
  assert.deepEqual(stored.map((field) => field.key).sort(), Object.keys(DEFAULT_CONFIG).sort());
  for (const field of stored) {
    assert.equal(DEFAULT_CONFIG[field.key], field.default, `DEFAULT_CONFIG.${field.key}`);
  }
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.equal(section.placeholder, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('scene trigger filters never use boolean or secret fields', () => {
  for (const trigger of manifest.scene_triggers) {
    for (const field of trigger.fields ?? []) {
      assert.ok(['string', 'number', 'select', 'multi_select'].includes(field.type), field.key);
    }
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`), manifest.docker_image);
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('widget labels hold 3 to 30 characters, descriptions at most 100', () => {
  for (const widget of manifest.widgets) {
    for (const text of Object.values(widget.label))
      assert.ok(text.length >= 3 && text.length <= 30, text);
    for (const text of Object.values(widget.description)) assert.ok(text.length <= 100, text);
  }
});

test('every manifest text is translated in English, French, German and Spanish', () => {
  // Walk the whole manifest: any object with an `en` string is a text.
  const missing = [];
  (function walk(node, path) {
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${path}[${i}]`));
    } else if (node && typeof node === 'object') {
      if (typeof node.en === 'string') {
        for (const lang of LANGUAGES) {
          if (typeof node[lang] !== 'string' || node[lang].length === 0)
            missing.push(`${path}.${lang}`);
        }
        return;
      }
      for (const [key, child] of Object.entries(node)) walk(child, `${path}.${key}`);
    }
  })(manifest, 'manifest');
  assert.deepEqual(missing, []);
});

test('field placeholders are multi-language objects', () => {
  for (const field of allFields.filter((f) => f.placeholder !== undefined)) {
    assert.equal(typeof field.placeholder, 'object', field.key);
  }
});
