import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyLogCsv,
  buildPeriodLogCsv,
  calculateCalorieProgress,
  calculateDailyTotals,
  escapeCsvCell,
  getCsvFilename,
  getMonthDateRange,
  getWeekDateRange,
  groupItemsByMeal,
  isValidDateString,
  sanitizeFoodEntryForStorage,
  scaleNutritionValues,
  shiftDateByDays,
  shiftMonth,
  summarizePeriodLogs,
  validateFoodRows,
} from './nutrition';
import type { LoggedFoodItem } from '../types/nutrition';

const sampleItems: LoggedFoodItem[] = [
  {
    id: 'item-1',
    meal: 'Breakfast',
    foodItem: 'Bread slices',
    quantity: 2,
    measurement: 'Pcs',
    calories: 160,
    protein: 5.4,
    carbs: 30.2,
    fat: 2.0,
    sugar: 3.2,
    createdAt: '2026-11-21T08:00:00.000Z',
  },
  {
    id: 'item-2',
    meal: 'Breakfast',
    foodItem: 'Whole egg',
    quantity: 2,
    measurement: 'Pcs',
    calories: 144,
    protein: 12.6,
    carbs: 0.8,
    fat: 9.6,
    sugar: 0.4,
    createdAt: '2026-11-21T08:00:00.000Z',
  },
  {
    id: 'item-3',
    meal: 'Lunch',
    foodItem: 'Red rice, dhal & chicken curry',
    quantity: 350,
    measurement: 'g',
    calories: 520,
    protein: 32.5,
    carbs: 64.0,
    fat: 14.5,
    sugar: 4.1,
    createdAt: '2026-11-21T13:00:00.000Z',
  },
];

test('calculateDailyTotals sums calories, macros, and sugar accurately', () => {
  const totals = calculateDailyTotals(sampleItems);
  assert.equal(totals.calories, 824);
  assert.equal(totals.protein, 50.5);
  assert.equal(totals.carbs, 95);
  assert.equal(totals.fat, 26.1);
  assert.equal(totals.sugar, 7.7);
});

test('calculateCalorieProgress calculates remaining and clamps percentage against 2300 kcal target', () => {
  const under = calculateCalorieProgress(1150, 2300);
  assert.equal(under.percent, 50);
  assert.equal(under.clampedPercent, 50);
  assert.equal(under.remaining, 1150);
  assert.equal(under.isOverTarget, false);

  const over = calculateCalorieProgress(2600, 2300);
  assert.equal(over.percent, 113);
  assert.equal(over.clampedPercent, 100);
  assert.equal(over.remaining, -300);
  assert.equal(over.isOverTarget, true);
});

test('groupItemsByMeal groups into Breakfast, Lunch, Dinner, Snack', () => {
  const grouped = groupItemsByMeal(sampleItems);
  assert.equal(grouped.Breakfast.length, 2);
  assert.equal(grouped.Lunch.length, 1);
  assert.equal(grouped.Dinner.length, 0);
  assert.equal(grouped.Snack.length, 0);
});

test('validateFoodRows rejects empty or invalid quantities and accepts decimals', () => {
  const emptyCheck = validateFoodRows([
    { rowId: '1', foodItem: '   ', quantity: '1', measurement: 'Pcs' },
  ]);
  assert.ok(emptyCheck.error);

  const zeroQty = validateFoodRows([
    { rowId: '1', foodItem: 'Mayonnaise', quantity: '0', measurement: 'tbsp' },
  ]);
  assert.ok(zeroQty.error);

  const valid = validateFoodRows([
    { rowId: '1', foodItem: 'Mayonnaise', quantity: '0.5', measurement: 'tbsp' },
    { rowId: '2', foodItem: 'Cooked chicken breast', quantity: '150', measurement: 'g' },
  ]);
  assert.equal(valid.error, null);
  assert.equal(valid.validItems.length, 2);
  assert.equal(valid.validItems[0].quantity, 0.5);
  assert.equal(valid.validItems[1].measurement, 'g');
});

test('buildDailyLogCsv outputs exact headers, escaped cells, and nutrition values', () => {
  const csv = buildDailyLogCsv('2026-11-21', sampleItems);
  const lines = csv.split('\r\n');
  assert.equal(
    lines[0],
    'Date,Meal,Food Item,Quantity,Measurement,Calories (kcal),Protein (g),Carbs (g),Fat (g),Sugar (g)'
  );
  assert.equal(lines[1], '2026-11-21,Breakfast,Bread slices,2,Pcs,160,5.4,30.2,2,3.2');
  assert.equal(
    lines[3],
    '2026-11-21,Lunch,"Red rice, dhal & chicken curry",350,g,520,32.5,64,14.5,4.1'
  );
  assert.equal(getCsvFilename('2026-11-21'), 'food-log-2026-11-21.csv');
});

test('escapeCsvCell handles commas and quotes', () => {
  assert.equal(escapeCsvCell('Egg, "boiled"'), '"Egg, ""boiled"""');
});

test('isValidDateString validates calendar dates strictly', () => {
  assert.equal(isValidDateString('2026-11-21'), true);
  assert.equal(isValidDateString('2026-02-30'), false);
  assert.equal(isValidDateString('not-a-date'), false);
});

test('scaleNutritionValues scales calories, macros, and sugar proportionally when quantity changes', () => {
  const scaled = scaleNutritionValues(sampleItems[0], 3);
  assert.equal(scaled.quantity, 3);
  assert.equal(scaled.calories, 240);
  assert.equal(scaled.protein, 8.1);
  assert.equal(scaled.carbs, 45.3);
  assert.equal(scaled.fat, 3);
  assert.equal(scaled.sugar, 4.8);
});

test('sanitizeFoodEntryForStorage enforces schema bounds and defaults legacy sugar', () => {
  const dirty = sanitizeFoodEntryForStorage({
    id: 'bad id!@#',
    meal: 'Breakfast',
    foodItem: 'A'.repeat(250),
    quantity: 2,
    measurement: 'g',
    calories: -10,
    protein: 10,
    carbs: 20,
    fat: 5,
    sugar: -3,
    createdAt: '2026-11-21T08:00:00.000Z',
  });
  assert.equal(dirty.id, 'badid');
  assert.equal(dirty.foodItem.length, 160);
  assert.equal(dirty.calories, 0);
  assert.equal(dirty.sugar, 0);
});

test('getWeekDateRange returns Monday-to-Sunday window for a date', () => {
  const week = getWeekDateRange('2026-11-21');
  assert.equal(week.startDate, '2026-11-16');
  assert.equal(week.endDate, '2026-11-22');
  assert.equal(week.dates.length, 7);
  assert.equal(week.dates[5], '2026-11-21');
});

test('getMonthDateRange returns all days in month and Monday-based leading offset', () => {
  const month = getMonthDateRange('2026-11-21');
  assert.equal(month.monthKey, '2026-11');
  assert.equal(month.startDate, '2026-11-01');
  assert.equal(month.endDate, '2026-11-30');
  assert.equal(month.dates.length, 30);
  assert.equal(month.leadingEmptyDays, 6);
});

test('shiftDateByDays and shiftMonth clamp month-end dates properly', () => {
  assert.equal(shiftDateByDays('2026-11-21', -7), '2026-11-14');
  assert.equal(shiftMonth('2026-01-31', 1), '2026-02-28');
});

test('summarizePeriodLogs computes totals, averages, sugar, and on-target days', () => {
  const week = getWeekDateRange('2026-11-21');
  const logsByDate: Record<string, LoggedFoodItem[]> = {
    '2026-11-20': [sampleItems[0]],
    '2026-11-21': sampleItems,
  };

  const summary = summarizePeriodLogs(week.dates, logsByDate, 2300);
  assert.equal(summary.loggedDaysCount, 2);
  assert.equal(summary.onTargetDaysCount, 2);
  assert.equal(summary.totalItemsCount, 4);
  assert.equal(summary.avgItemsPerLoggedDay, 2);
  assert.equal(summary.totals.calories, 984);
  assert.equal(summary.totals.sugar, 10.9);
  assert.equal(summary.averages.calories, 492);
  assert.equal(summary.averages.sugar, 5.5);
  assert.equal(summary.mealCounts.Breakfast, 3);
  assert.equal(summary.mealCounts.Lunch, 1);
  assert.equal(summary.mealCounts.Dinner, 0);
});

test('buildPeriodLogCsv outputs chronological entries with nutrition columns across days', () => {
  const csv = buildPeriodLogCsv(['2026-11-20', '2026-11-21'], {
    '2026-11-20': [sampleItems[0]],
    '2026-11-21': [sampleItems[2]],
  });
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(
    lines[0],
    'Date,Meal,Food Item,Quantity,Measurement,Calories (kcal),Protein (g),Carbs (g),Fat (g),Sugar (g)'
  );
  assert.equal(lines[1], '2026-11-20,Breakfast,Bread slices,2,Pcs,160,5.4,30.2,2,3.2');
  assert.equal(
    lines[2],
    '2026-11-21,Lunch,"Red rice, dhal & chicken curry",350,g,520,32.5,64,14.5,4.1'
  );
});
