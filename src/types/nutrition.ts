export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEASUREMENT_UNITS = ['Pcs', 'g', 'Kg', 'ml', 'tbsp', 'tsp'] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export const DAILY_CALORIE_TARGET = 2300;
export const MAINTENANCE_CALORIE_REFERENCE = 2996;
export const WEEKLY_CALORIE_TARGET = DAILY_CALORIE_TARGET * 7;
export const MAX_FOOD_ITEM_LENGTH = 160;
export const MAX_LOG_ITEMS_PER_DAY = 100;

export interface FoodRowDraft {
  rowId: string;
  foodItem: string;
  quantity: string;
  measurement: MeasurementUnit;
}

export interface CalculatedNutritionItem {
  foodItem: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
}

export interface LoggedFoodItem {
  id: string;
  meal: MealType;
  foodItem: string;
  quantity: number;
  measurement: MeasurementUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  createdAt: string;
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
}

export interface ValidatedFoodRowInput {
  foodItem: string;
  quantity: number;
  measurement: MeasurementUnit;
}
