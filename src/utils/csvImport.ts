import {
  MAX_FOOD_ITEM_LENGTH,
  MEASUREMENT_UNITS,
  MEAL_TYPES,
  type MealType,
  type MeasurementUnit,
} from '../types/nutrition';
import { isValidDateString, roundCalories, roundMacro } from './nutrition';

export interface ParsedCsvMealRow {
  lineNumber: number;
  date: string;
  meal: MealType;
  foodItem: string;
  quantity: number;
  measurement: MeasurementUnit;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  hasPrecomputedNutrition: boolean;
}

export interface CsvImportParseResult {
  rows: ParsedCsvMealRow[];
  dates: string[];
  needsGeminiCount: number;
  error: string | null;
}

const MEAL_ALIASES: Record<string, MealType> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  supper: 'Dinner',
  snack: 'Snack',
  snacks: 'Snack',
};

const UNIT_ALIASES: Record<string, MeasurementUnit> = {
  pcs: 'Pcs',
  pc: 'Pcs',
  piece: 'Pcs',
  pieces: 'Pcs',
  unit: 'Pcs',
  units: 'Pcs',
  g: 'g',
  gram: 'g',
  grams: 'g',
  gm: 'g',
  gms: 'g',
  kg: 'Kg',
  kilogram: 'Kg',
  kilograms: 'Kg',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbs: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
};

export function parseCsvMatrix(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeDateCell(raw: string): string | null {
  const cleaned = raw.trim().replace(/\//g, '-');
  if (isValidDateString(cleaned)) {
    return cleaned;
  }
  return null;
}

function normalizeMealCell(raw: string): MealType | null {
  const key = raw.trim().toLowerCase();
  if (MEAL_ALIASES[key]) {
    return MEAL_ALIASES[key];
  }
  const exact = MEAL_TYPES.find((m) => m.toLowerCase() === key);
  return exact ?? null;
}

function normalizeUnitCell(raw: string): MeasurementUnit | null {
  const key = raw.trim().toLowerCase();
  if (UNIT_ALIASES[key]) {
    return UNIT_ALIASES[key];
  }
  const exact = MEASUREMENT_UNITS.find((u) => u.toLowerCase() === key);
  return exact ?? null;
}

function parseOptionalNonNegativeNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const num = Number(raw.trim());
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function normalizeHeaderName(header: string): string {
  return header.trim().toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
}

export function parseMealCsv(rawText: string, fallbackDate?: string): CsvImportParseResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { rows: [], dates: [], needsGeminiCount: 0, error: 'Paste CSV rows or select a .csv file.' };
  }

  const matrix = parseCsvMatrix(trimmed);
  if (matrix.length === 0) {
    return { rows: [], dates: [], needsGeminiCount: 0, error: 'CSV content is empty.' };
  }

  const firstRowNormalized = matrix[0].map(normalizeHeaderName);
  const hasHeader =
    firstRowNormalized.includes('fooditem') ||
    firstRowNormalized.includes('food') ||
    firstRowNormalized.includes('meal') ||
    firstRowNormalized.includes('quantity');

  let dateIdx = 0;
  let mealIdx = 1;
  let foodIdx = 2;
  let qtyIdx = 3;
  let unitIdx = 4;
  let calIdx = -1;
  let proteinIdx = -1;
  let carbsIdx = -1;
  let fatIdx = -1;
  let sugarIdx = -1;
  let startRow = 0;

  if (hasHeader) {
    startRow = 1;
    dateIdx = firstRowNormalized.findIndex((h) => h === 'date');
    mealIdx = firstRowNormalized.findIndex((h) => h === 'meal' || h === 'mealtype');
    foodIdx = firstRowNormalized.findIndex(
      (h) => h === 'fooditem' || h === 'food' || h === 'item' || h === 'name'
    );
    qtyIdx = firstRowNormalized.findIndex(
      (h) => h === 'quantity' || h === 'qty' || h === 'amount'
    );
    unitIdx = firstRowNormalized.findIndex(
      (h) => h === 'measurement' || h === 'unit' || h === 'units'
    );
    calIdx = firstRowNormalized.findIndex((h) => h === 'calories' || h === 'kcal');
    proteinIdx = firstRowNormalized.findIndex((h) => h === 'protein');
    carbsIdx = firstRowNormalized.findIndex((h) => h === 'carbs' || h === 'carbohydrates');
    fatIdx = firstRowNormalized.findIndex((h) => h === 'fat' || h === 'fats');
    sugarIdx = firstRowNormalized.findIndex((h) => h === 'sugar' || h === 'sugars');

    if (foodIdx === -1 || qtyIdx === -1 || unitIdx === -1 || mealIdx === -1) {
      return {
        rows: [],
        dates: [],
        needsGeminiCount: 0,
        error: 'CSV header must include Meal, Food Item, Quantity, and Measurement columns.',
      };
    }
  }

  if (matrix.length <= startRow) {
    return {
      rows: [],
      dates: [],
      needsGeminiCount: 0,
      error: 'CSV header found, but there are no food rows below it.',
    };
  }

  const parsedRows: ParsedCsvMealRow[] = [];
  const dateSet = new Set<string>();
  let needsGeminiCount = 0;

  for (let i = startRow; i < matrix.length; i++) {
    const cells = matrix[i];
    const lineNumber = i + 1;

    const rawDate = dateIdx >= 0 ? (cells[dateIdx] ?? '') : (fallbackDate ?? '');
    const normalizedDate = normalizeDateCell(rawDate || fallbackDate || '');
    if (!normalizedDate) {
      return {
        rows: [],
        dates: [],
        needsGeminiCount: 0,
        error: `Line ${lineNumber}: Invalid date "${rawDate}". Use YYYY-MM-DD format (e.g., 2026-11-23).`,
      };
    }

    const rawMeal = cells[mealIdx] ?? '';
    const normalizedMeal = normalizeMealCell(rawMeal);
    if (!normalizedMeal) {
      return {
        rows: [],
        dates: [],
        needsGeminiCount: 0,
        error: `Line ${lineNumber}: Invalid meal "${rawMeal}". Expected Breakfast, Lunch, Dinner, or Snack.`,
      };
    }

    const rawFood = (cells[foodIdx] ?? '').trim();
    if (!rawFood) {
      return {
        rows: [],
        dates: [],
        needsGeminiCount: 0,
        error: `Line ${lineNumber}: Food Item cannot be empty.`,
      };
    }
    if (rawFood.length > MAX_FOOD_ITEM_LENGTH) {
      return {
        rows: [],
        dates: [],
        needsGeminiCount: 0,
        error: `Line ${lineNumber}: Food Item exceeds ${MAX_FOOD_ITEM_LENGTH} characters.`,
      };
    }

    const rawQty = cells[qtyIdx] ?? '';
    const qtyNum = Number(rawQty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0 || qtyNum > 100000) {
      return {
        rows: [],
        dates: [],
        needsGeminiCount: 0,
        error: `Line ${lineNumber}: Invalid quantity "${rawQty}" for "${rawFood}".`,
      };
    }

    const rawUnit = cells[unitIdx] ?? '';
    const normalizedUnit = normalizeUnitCell(rawUnit);
    if (!normalizedUnit) {
      return {
        rows: [],
        dates: [],
        needsGeminiCount: 0,
        error: `Line ${lineNumber}: Unsupported unit "${rawUnit}". Allowed units: ${MEASUREMENT_UNITS.join(', ')}.`,
      };
    }

    const cal = calIdx >= 0 ? parseOptionalNonNegativeNumber(cells[calIdx]) : null;
    const protein = proteinIdx >= 0 ? parseOptionalNonNegativeNumber(cells[proteinIdx]) : null;
    const carbs = carbsIdx >= 0 ? parseOptionalNonNegativeNumber(cells[carbsIdx]) : null;
    const fat = fatIdx >= 0 ? parseOptionalNonNegativeNumber(cells[fatIdx]) : null;
    const sugar = sugarIdx >= 0 ? parseOptionalNonNegativeNumber(cells[sugarIdx]) : null;

    const hasPrecomputedNutrition =
      cal !== null && protein !== null && carbs !== null && fat !== null && sugar !== null;

    if (!hasPrecomputedNutrition) {
      needsGeminiCount += 1;
    }

    dateSet.add(normalizedDate);
    parsedRows.push({
      lineNumber,
      date: normalizedDate,
      meal: normalizedMeal,
      foodItem: rawFood,
      quantity: Math.round(qtyNum * 1000) / 1000,
      measurement: normalizedUnit,
      ...(hasPrecomputedNutrition
        ? {
            calories: roundCalories(cal),
            protein: roundMacro(protein),
            carbs: roundMacro(carbs),
            fat: roundMacro(fat),
            sugar: roundMacro(sugar),
          }
        : {}),
      hasPrecomputedNutrition,
    });
  }

  return {
    rows: parsedRows,
    dates: Array.from(dateSet).sort(),
    needsGeminiCount,
    error: null,
  };
}

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}
