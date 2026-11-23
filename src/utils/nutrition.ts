import {
  DAILY_CALORIE_TARGET,
  MAX_FOOD_ITEM_LENGTH,
  MAX_LOG_ITEMS_PER_DAY,
  MEASUREMENT_UNITS,
  MEAL_TYPES,
  type DailyTotals,
  type FoodRowDraft,
  type LoggedFoodItem,
  type MealType,
  type MeasurementUnit,
  type ValidatedFoodRowInput,
} from '../types/nutrition';

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() === m - 1 &&
    parsed.getDate() === d
  );
}

export function roundMacro(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 10) / 10;
}

export function roundCalories(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}

export function calculateDailyTotals(items: LoggedFoodItem[]): DailyTotals {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let sugar = 0;

  for (const item of items) {
    calories += Number.isFinite(item.calories) ? Math.max(0, item.calories) : 0;
    protein += Number.isFinite(item.protein) ? Math.max(0, item.protein) : 0;
    carbs += Number.isFinite(item.carbs) ? Math.max(0, item.carbs) : 0;
    fat += Number.isFinite(item.fat) ? Math.max(0, item.fat) : 0;
    sugar += Number.isFinite(item.sugar) ? Math.max(0, item.sugar) : 0;
  }

  return {
    calories: roundCalories(calories),
    protein: roundMacro(protein),
    carbs: roundMacro(carbs),
    fat: roundMacro(fat),
    sugar: roundMacro(sugar),
  };
}

export function calculateCalorieProgress(
  consumedCalories: number,
  targetCalories: number = DAILY_CALORIE_TARGET
): {
  percent: number;
  clampedPercent: number;
  remaining: number;
  isOverTarget: boolean;
} {
  if (targetCalories <= 0) {
    return { percent: 0, clampedPercent: 0, remaining: 0, isOverTarget: false };
  }
  const safeConsumed = Math.max(0, roundCalories(consumedCalories));
  const rawPercent = Math.round((safeConsumed / targetCalories) * 100);
  const clampedPercent = Math.min(100, Math.max(0, rawPercent));
  const remaining = targetCalories - safeConsumed;
  return {
    percent: rawPercent,
    clampedPercent,
    remaining,
    isOverTarget: safeConsumed > targetCalories,
  };
}

export function groupItemsByMeal(
  items: LoggedFoodItem[]
): Record<MealType, LoggedFoodItem[]> {
  const grouped: Record<MealType, LoggedFoodItem[]> = {
    Breakfast: [],
    Lunch: [],
    Dinner: [],
    Snack: [],
  };

  for (const item of items) {
    if (MEAL_TYPES.includes(item.meal)) {
      grouped[item.meal].push(item);
    }
  }

  return grouped;
}

export function validateFoodRows(rows: FoodRowDraft[]): {
  validItems: ValidatedFoodRowInput[];
  error: string | null;
} {
  if (rows.length === 0) {
    return { validItems: [], error: 'Add at least one food item row.' };
  }

  const validItems: ValidatedFoodRowInput[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const foodItem = row.foodItem.trim();
    const quantityNum = Number(row.quantity);

    if (!foodItem) {
      return {
        validItems: [],
        error: `Row ${i + 1}: Please enter a food item name.`,
      };
    }
    if (foodItem.length > MAX_FOOD_ITEM_LENGTH) {
      return {
        validItems: [],
        error: `Row ${i + 1}: Food item name must be ${MAX_FOOD_ITEM_LENGTH} characters or fewer.`,
      };
    }
    if (!Number.isFinite(quantityNum) || quantityNum <= 0 || quantityNum > 100000) {
      return {
        validItems: [],
        error: `Row ${i + 1}: Enter a valid positive quantity for "${foodItem}".`,
      };
    }
    if (!MEASUREMENT_UNITS.includes(row.measurement)) {
      return {
        validItems: [],
        error: `Row ${i + 1}: Invalid measurement unit.`,
      };
    }

    validItems.push({
      foodItem,
      quantity: Math.round(quantityNum * 1000) / 1000,
      measurement: row.measurement,
    });
  }

  return { validItems, error: null };
}

export function sanitizeFoodEntryForStorage(entry: LoggedFoodItem): LoggedFoodItem {
  const safeId = entry.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || 'item';
  const safeMeal: MealType = MEAL_TYPES.includes(entry.meal) ? entry.meal : 'Breakfast';
  const safeUnit: MeasurementUnit = MEASUREMENT_UNITS.includes(entry.measurement)
    ? entry.measurement
    : 'Pcs';
  const safeFood = entry.foodItem.trim().slice(0, MAX_FOOD_ITEM_LENGTH) || 'Food item';
  const safeQty =
    Number.isFinite(entry.quantity) && entry.quantity > 0
      ? Math.min(100000, Math.round(entry.quantity * 1000) / 1000)
      : 1;

  return {
    id: safeId,
    meal: safeMeal,
    foodItem: safeFood,
    quantity: safeQty,
    measurement: safeUnit,
    calories: Math.min(50000, roundCalories(entry.calories)),
    protein: Math.min(5000, roundMacro(entry.protein)),
    carbs: Math.min(5000, roundMacro(entry.carbs)),
    fat: Math.min(5000, roundMacro(entry.fat)),
    sugar: Math.min(5000, roundMacro(entry.sugar ?? 0)),
    createdAt: (entry.createdAt || new Date().toISOString()).slice(0, 64),
  };
}

export function enforceDailyItemLimit(items: LoggedFoodItem[]): LoggedFoodItem[] {
  return items.slice(0, MAX_LOG_ITEMS_PER_DAY).map(sanitizeFoodEntryForStorage);
}

export function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildDailyLogCsv(date: string, items: LoggedFoodItem[]): string {
  const headers = [
    'Date',
    'Meal',
    'Food Item',
    'Quantity',
    'Measurement',
    'Calories (kcal)',
    'Protein (g)',
    'Carbs (g)',
    'Fat (g)',
    'Sugar (g)',
  ];

  const orderedItems: LoggedFoodItem[] = [];
  const grouped = groupItemsByMeal(items);
  for (const meal of MEAL_TYPES) {
    orderedItems.push(...grouped[meal]);
  }

  const rows = orderedItems.map((item) =>
    [
      escapeCsvCell(date),
      escapeCsvCell(item.meal),
      escapeCsvCell(item.foodItem),
      escapeCsvCell(item.quantity),
      escapeCsvCell(item.measurement),
      escapeCsvCell(roundCalories(item.calories)),
      escapeCsvCell(roundMacro(item.protein)),
      escapeCsvCell(roundMacro(item.carbs)),
      escapeCsvCell(roundMacro(item.fat)),
      escapeCsvCell(roundMacro(item.sugar ?? 0)),
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\r\n');
}

export function getCsvFilename(date: string): string {
  const safeDate = isValidDateString(date) ? date : getLocalDateString();
  return `food-log-${safeDate}.csv`;
}

export function scaleNutritionValues(
  item: LoggedFoodItem,
  newQuantity: number
): Pick<LoggedFoodItem, 'quantity' | 'calories' | 'protein' | 'carbs' | 'fat' | 'sugar'> {
  if (!Number.isFinite(newQuantity) || newQuantity <= 0 || item.quantity <= 0) {
    return {
      quantity: item.quantity,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      sugar: item.sugar ?? 0,
    };
  }
  const ratio = newQuantity / item.quantity;
  return {
    quantity: Math.round(newQuantity * 1000) / 1000,
    calories: roundCalories(item.calories * ratio),
    protein: roundMacro(item.protein * ratio),
    carbs: roundMacro(item.carbs * ratio),
    fat: roundMacro(item.fat * ratio),
    sugar: roundMacro((item.sugar ?? 0) * ratio),
  };
}

function parseLocalDate(dateStr: string): Date {
  if (!isValidDateString(dateStr)) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDateByDays(dateStr: string, deltaDays: number): string {
  const base = parseLocalDate(dateStr);
  base.setDate(base.getDate() + deltaDays);
  return getLocalDateString(base);
}

export function shiftMonth(dateStr: string, deltaMonths: number): string {
  const base = parseLocalDate(dateStr);
  const targetDay = base.getDate();
  const shifted = new Date(base.getFullYear(), base.getMonth() + deltaMonths, 1);
  const maxDayInMonth = new Date(
    shifted.getFullYear(),
    shifted.getMonth() + 1,
    0
  ).getDate();
  shifted.setDate(Math.min(targetDay, maxDayInMonth));
  return getLocalDateString(shifted);
}

export function getWeekDateRange(anchorDate: string): {
  startDate: string;
  endDate: string;
  dates: string[];
} {
  const base = parseLocalDate(anchorDate);
  // Monday-based week: Monday = 0 ... Sunday = 6
  const mondayOffset = (base.getDay() + 6) % 7;
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - mondayOffset);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    dates.push(getLocalDateString(d));
  }
  return {
    startDate: dates[0],
    endDate: dates[6],
    dates,
  };
}

export function getMonthDateRange(anchorDate: string): {
  year: number;
  monthIndex: number;
  monthKey: string;
  startDate: string;
  endDate: string;
  dates: string[];
  leadingEmptyDays: number;
} {
  const base = parseLocalDate(anchorDate);
  const year = base.getFullYear();
  const monthIndex = base.getMonth();
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const firstDay = new Date(year, monthIndex, 1);
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  // Monday-based leading offset (Mon=0 .. Sun=6)
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;

  const dates: string[] = [];
  for (let day = 1; day <= totalDays; day++) {
    dates.push(getLocalDateString(new Date(year, monthIndex, day)));
  }

  return {
    year,
    monthIndex,
    monthKey,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    dates,
    leadingEmptyDays,
  };
}

export type MealCounts = Record<MealType, number>;

export function countItemsByMeal(items: LoggedFoodItem[]): MealCounts {
  const counts: MealCounts = {
    Breakfast: 0,
    Lunch: 0,
    Dinner: 0,
    Snack: 0,
  };
  for (const item of items) {
    if (MEAL_TYPES.includes(item.meal)) {
      counts[item.meal] += 1;
    }
  }
  return counts;
}

export interface DaySummaryEntry {
  date: string;
  totals: DailyTotals;
  itemCount: number;
  mealCounts: MealCounts;
  percentOfTarget: number;
  clampedPercent: number;
  isOverTarget: boolean;
}

export interface PeriodSummary {
  days: DaySummaryEntry[];
  loggedDaysCount: number;
  onTargetDaysCount: number;
  totalItemsCount: number;
  avgItemsPerLoggedDay: number;
  mealCounts: MealCounts;
  totals: DailyTotals;
  averages: DailyTotals;
}

export function summarizePeriodLogs(
  dates: string[],
  logsByDate: Record<string, LoggedFoodItem[]>,
  targetCalories: number = DAILY_CALORIE_TARGET
): PeriodSummary {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalSugar = 0;
  let loggedDaysCount = 0;
  let onTargetDaysCount = 0;
  let totalItemsCount = 0;
  const mealCounts: MealCounts = {
    Breakfast: 0,
    Lunch: 0,
    Dinner: 0,
    Snack: 0,
  };

  const days: DaySummaryEntry[] = dates.map((date) => {
    const items = logsByDate[date] ?? [];
    const totals = calculateDailyTotals(items);
    const dayMealCounts = countItemsByMeal(items);
    const progress = calculateCalorieProgress(totals.calories, targetCalories);
    const itemCount = items.length;

    if (itemCount > 0) {
      loggedDaysCount += 1;
      if (!progress.isOverTarget) {
        onTargetDaysCount += 1;
      }
      totalItemsCount += itemCount;
      totalCalories += totals.calories;
      totalProtein += totals.protein;
      totalCarbs += totals.carbs;
      totalFat += totals.fat;
      totalSugar += totals.sugar;
      for (const meal of MEAL_TYPES) {
        mealCounts[meal] += dayMealCounts[meal];
      }
    }

    return {
      date,
      totals,
      itemCount,
      mealCounts: dayMealCounts,
      percentOfTarget: progress.percent,
      clampedPercent: progress.clampedPercent,
      isOverTarget: progress.isOverTarget,
    };
  });

  const divisor = loggedDaysCount > 0 ? loggedDaysCount : 1;

  return {
    days,
    loggedDaysCount,
    onTargetDaysCount,
    totalItemsCount,
    avgItemsPerLoggedDay:
      loggedDaysCount > 0 ? Math.round((totalItemsCount / loggedDaysCount) * 10) / 10 : 0,
    mealCounts,
    totals: {
      calories: roundCalories(totalCalories),
      protein: roundMacro(totalProtein),
      carbs: roundMacro(totalCarbs),
      fat: roundMacro(totalFat),
      sugar: roundMacro(totalSugar),
    },
    averages:
      loggedDaysCount > 0
        ? {
            calories: roundCalories(totalCalories / divisor),
            protein: roundMacro(totalProtein / divisor),
            carbs: roundMacro(totalCarbs / divisor),
            fat: roundMacro(totalFat / divisor),
            sugar: roundMacro(totalSugar / divisor),
          }
        : { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0 },
  };
}

export function buildPeriodLogCsv(
  dates: string[],
  logsByDate: Record<string, LoggedFoodItem[]>
): string {
  const headers = [
    'Date',
    'Meal',
    'Food Item',
    'Quantity',
    'Measurement',
    'Calories (kcal)',
    'Protein (g)',
    'Carbs (g)',
    'Fat (g)',
    'Sugar (g)',
  ];

  const rows: string[] = [];
  for (const date of dates) {
    const items = logsByDate[date] ?? [];
    if (items.length === 0) continue;
    const grouped = groupItemsByMeal(items);
    for (const meal of MEAL_TYPES) {
      for (const item of grouped[meal]) {
        rows.push(
          [
            escapeCsvCell(date),
            escapeCsvCell(item.meal),
            escapeCsvCell(item.foodItem),
            escapeCsvCell(item.quantity),
            escapeCsvCell(item.measurement),
            escapeCsvCell(roundCalories(item.calories)),
            escapeCsvCell(roundMacro(item.protein)),
            escapeCsvCell(roundMacro(item.carbs)),
            escapeCsvCell(roundMacro(item.fat)),
            escapeCsvCell(roundMacro(item.sugar ?? 0)),
          ].join(',')
        );
      }
    }
  }

  return [headers.join(','), ...rows].join('\r\n');
}

