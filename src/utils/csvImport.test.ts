import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkArray, parseMealCsv } from './csvImport';

const sriLankanSampleCsv = `Date,Meal,Food Item,Quantity,Measurement
2026-11-23,Breakfast,Vigna,100,g
2026-11-23,Breakfast,Shredded Coconut,2,tbsp
2026-11-23,Breakfast,Bread,79,g
2026-11-23,Breakfast,Dhal,94,g
2026-11-23,Lunch,kiri kos curry,149,g
2026-11-23,Lunch,Rice,185,g
2026-11-23,Lunch,Fish curry,89,g
2026-11-23,Lunch,Gotukola Mallum,39,g
2026-11-23,Snack,snickers chocolate bar,40,g
2026-11-23,Snack,pringles onion and sour cream,23,g
2026-11-23,Snack,boondi,20,g`;

test('parseMealCsv parses 5-column Sri Lankan CSV and flags all rows for Gemini calculation', () => {
  const result = parseMealCsv(sriLankanSampleCsv);
  assert.equal(result.error, null);
  assert.equal(result.rows.length, 11);
  assert.deepEqual(result.dates, ['2026-11-23']);
  assert.equal(result.needsGeminiCount, 11);
  assert.equal(result.rows[0].foodItem, 'Vigna');
  assert.equal(result.rows[0].quantity, 100);
  assert.equal(result.rows[0].measurement, 'g');
  assert.equal(result.rows[4].meal, 'Lunch');
  assert.equal(result.rows[4].foodItem, 'kiri kos curry');
  assert.equal(result.rows[10].meal, 'Snack');
  assert.equal(result.rows[10].foodItem, 'boondi');
});

test('parseMealCsv parses exported 10-column CSV with precomputed nutrition and sugar', () => {
  const exportedCsv = [
    'Date,Meal,Food Item,Quantity,Measurement,Calories (kcal),Protein (g),Carbs (g),Fat (g),Sugar (g)',
    '2026-11-23,Breakfast,"Pol sambol, fresh",50,g,145,2.1,5.4,13.2,1.8',
    '2026-11-24,Dinner,String hoppers,6,Pcs,210,4.8,44.0,1.2,0.5',
  ].join('\r\n');

  const result = parseMealCsv(exportedCsv);
  assert.equal(result.error, null);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.dates, ['2026-11-23', '2026-11-24']);
  assert.equal(result.needsGeminiCount, 0);
  assert.equal(result.rows[0].foodItem, 'Pol sambol, fresh');
  assert.equal(result.rows[0].calories, 145);
  assert.equal(result.rows[0].sugar, 1.8);
  assert.equal(result.rows[1].measurement, 'Pcs');
});

test('parseMealCsv normalizes unit aliases and rejects invalid rows with line numbers', () => {
  const aliasCsv = `Date,Meal,Food Item,Quantity,Measurement
2026-11-23,snacks,Hoppers,2,pieces`;
  const ok = parseMealCsv(aliasCsv);
  assert.equal(ok.error, null);
  assert.equal(ok.rows[0].meal, 'Snack');
  assert.equal(ok.rows[0].measurement, 'Pcs');

  const badDate = parseMealCsv(`Date,Meal,Food Item,Quantity,Measurement
2026-02-30,Lunch,Rice,150,g`);
  assert.ok(badDate.error?.includes('Line 2'));

  const badQty = parseMealCsv(`Date,Meal,Food Item,Quantity,Measurement
2026-11-23,Lunch,Rice,-5,g`);
  assert.ok(badQty.error?.includes('Line 2'));
});

test('chunkArray splits large imports into Gemini-sized batches', () => {
  const items = Array.from({ length: 65 }, (_, i) => i);
  const batches = chunkArray(items, 30);
  assert.equal(batches.length, 3);
  assert.equal(batches[0].length, 30);
  assert.equal(batches[1].length, 30);
  assert.equal(batches[2].length, 5);
});
