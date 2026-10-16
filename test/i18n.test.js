import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  FIRE_DANGER_LABELS,
  LANGUAGES,
  T,
  WARNING_CATEGORY_LABELS,
  fill,
  pick,
} from '../src/i18n.js';

test('every runtime text exists in the four languages', () => {
  for (const [name, catalog] of Object.entries({
    T,
    FIRE_DANGER_LABELS,
    WARNING_CATEGORY_LABELS,
  })) {
    for (const [key, text] of Object.entries(catalog)) {
      for (const lang of LANGUAGES) {
        assert.ok(text[lang], `${name}.${key}.${lang} is missing`);
      }
    }
  }
});

test('placeholders are the same in every language', () => {
  for (const [key, text] of Object.entries(T)) {
    const names = (value) => (value.match(/\{\w+\}/g) ?? []).sort().join();
    for (const lang of LANGUAGES) {
      assert.equal(names(text[lang]), names(text.en), `T.${key}.${lang}`);
    }
  }
});

test('fill and pick', () => {
  const text = fill(T.expires, { time: '10:00' });
  assert.equal(pick(text, 'fr'), 'Expire 10:00');
  assert.equal(pick(text, 'de-DE'), 'Läuft ab 10:00');
  assert.equal(pick(text, 'it'), 'Expires 10:00', 'English fallback');
});

test('the user documentation exists in the four languages', async () => {
  for (const lang of LANGUAGES) {
    const doc = await readFile(new URL(`../docs/${lang}.md`, import.meta.url), 'utf8');
    assert.ok(doc.length >= 300, `docs/${lang}.md must hold at least 300 characters`);
  }
});
