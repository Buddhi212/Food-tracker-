import React from 'react';
import {
  DAILY_CALORIE_TARGET,
  MAINTENANCE_CALORIE_REFERENCE,
  MEAL_TYPES,
  type DailyTotals,
  type LoggedFoodItem,
} from '../types/nutrition';
import {
  calculateCalorieProgress,
  calculateDailyTotals,
  getLocalDateString,
  groupItemsByMeal,
  type MealCounts,
} from '../utils/nutrition';

interface DailySummaryBarProps {
  selectedDate: string;
  items: LoggedFoodItem[];
  totals: DailyTotals;
  mealCounts: MealCounts;
  targetCalories?: number;
}

export const DailySummaryBar: React.FC<DailySummaryBarProps> = ({
  selectedDate,
  items,
  totals,
  mealCounts,
  targetCalories = DAILY_CALORIE_TARGET,
}) => {
  const isToday = selectedDate === getLocalDateString();
  const progress = calculateCalorieProgress(totals.calories, targetCalories);
  const grouped = groupItemsByMeal(items);

  const barColor = progress.isOverTarget
    ? 'bg-rose-600'
    : progress.percent >= 85
      ? 'bg-amber-500'
      : 'bg-emerald-600';

  const statusTextColor = progress.isOverTarget
    ? 'text-rose-700'
    : progress.percent >= 85
      ? 'text-amber-700'
      : 'text-emerald-700';

  const maintenanceDiff = MAINTENANCE_CALORIE_REFERENCE - totals.calories;

  return (
    <section
      aria-label="Daily nutrition summary"
      className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>{isToday ? 'Today' : selectedDate}</span>
            <span aria-hidden="true">·</span>
            <span>{items.length} {items.length === 1 ? 'item' : 'items'}</span>
            <span aria-hidden="true">·</span>
            <span>Target {targetCalories.toLocaleString()} kcal</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Daily Summary</h2>
        </div>

        <div className="sm:text-right">
          <div
            data-testid="daily-calories-value"
            className="font-mono text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 tabular-nums"
          >
            {totals.calories.toLocaleString()}
            <span className="text-sm sm:text-base font-normal text-slate-500 ml-1.5">
              / {targetCalories.toLocaleString()} kcal
            </span>
          </div>
          <p className={`mt-0.5 text-xs font-semibold tabular-nums ${statusTextColor}`}>
            {progress.isOverTarget
              ? `${Math.abs(progress.remaining).toLocaleString()} kcal over target (${progress.percent}%)`
              : `${progress.remaining.toLocaleString()} kcal remaining (${progress.percent}%)`}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div
          role="progressbar"
          aria-label="Daily calorie target progress"
          aria-valuenow={totals.calories}
          aria-valuemin={0}
          aria-valuemax={targetCalories}
          className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${progress.clampedPercent}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
          <span>
            {totals.calories > 0
              ? maintenanceDiff >= 0
                ? `${maintenanceDiff.toLocaleString()} kcal below ${MAINTENANCE_CALORIE_REFERENCE.toLocaleString()} kcal maintenance`
                : `${Math.abs(maintenanceDiff).toLocaleString()} kcal above ${MAINTENANCE_CALORIE_REFERENCE.toLocaleString()} kcal maintenance`
              : `Reference maintenance: ${MAINTENANCE_CALORIE_REFERENCE.toLocaleString()} kcal/day`}
          </span>
          <span className="font-mono">{progress.percent}% of target</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-0 sm:divide-x divide-slate-200 pt-3 border-t border-slate-100">
        <div className="sm:pr-4">
          <div className="text-xs font-medium text-slate-500">Protein</div>
          <div
            data-testid="daily-protein-value"
            className="mt-1 font-mono text-lg sm:text-xl font-semibold text-slate-900 tabular-nums"
          >
            {totals.protein}
            <span className="text-xs font-normal text-slate-500 ml-1">g</span>
          </div>
        </div>

        <div className="sm:px-4">
          <div className="text-xs font-medium text-slate-500">Carbs</div>
          <div
            data-testid="daily-carbs-value"
            className="mt-1 font-mono text-lg sm:text-xl font-semibold text-slate-900 tabular-nums"
          >
            {totals.carbs}
            <span className="text-xs font-normal text-slate-500 ml-1">g</span>
          </div>
        </div>

        <div className="sm:px-4">
          <div className="text-xs font-medium text-slate-500">Fat</div>
          <div
            data-testid="daily-fat-value"
            className="mt-1 font-mono text-lg sm:text-xl font-semibold text-slate-900 tabular-nums"
          >
            {totals.fat}
            <span className="text-xs font-normal text-slate-500 ml-1">g</span>
          </div>
        </div>

        <div className="sm:pl-4">
          <div className="text-xs font-medium text-slate-500">Sugar</div>
          <div
            data-testid="daily-sugar-value"
            className="mt-1 font-mono text-lg sm:text-xl font-semibold text-amber-700 tabular-nums"
          >
            {totals.sugar}
            <span className="text-xs font-normal text-slate-500 ml-1">g</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
        {MEAL_TYPES.map((meal) => {
          const mealTotals = calculateDailyTotals(grouped[meal]);
          return (
            <div key={meal}>
              <div className="text-xs font-medium text-slate-500">{meal}</div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {mealTotals.calories.toLocaleString()} kcal
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                {mealCounts[meal]} {mealCounts[meal] === 1 ? 'item' : 'items'}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
