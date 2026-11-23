import React from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import {
  DAILY_CALORIE_TARGET,
  MEAL_TYPES,
  type LoggedFoodItem,
} from '../types/nutrition';
import {
  getLocalDateString,
  getMonthDateRange,
  shiftMonth,
  summarizePeriodLogs,
} from '../utils/nutrition';

interface MonthlyLogsViewProps {
  anchorDate: string;
  logsByDate: Record<string, LoggedFoodItem[]>;
  isLoading: boolean;
  onChangeAnchorDate: (date: string) => void;
  onSelectDay: (date: string) => void;
  onDownloadCsv: (dates: string[], filename: string) => void;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatMonthTitle(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatLoggedDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatMealSummary(mealCounts: Record<(typeof MEAL_TYPES)[number], number>): string {
  return MEAL_TYPES.filter((m) => mealCounts[m] > 0)
    .map((m) => `${mealCounts[m]} ${m}`)
    .join(' · ');
}

export const MonthlyLogsView: React.FC<MonthlyLogsViewProps> = ({
  anchorDate,
  logsByDate,
  isLoading,
  onChangeAnchorDate,
  onSelectDay,
  onDownloadCsv,
}) => {
  const today = getLocalDateString();
  const month = getMonthDateRange(anchorDate);
  const summary = summarizePeriodLogs(month.dates, logsByDate, DAILY_CALORIE_TARGET);
  const loggedDays = summary.days.filter((d) => d.itemCount > 0);
  const leadingBlanks = Array.from({ length: month.leadingEmptyDays });
  const monthlyTargetCalories = DAILY_CALORIE_TARGET * month.dates.length;
  const avgDelta = summary.averages.calories - DAILY_CALORIE_TARGET;

  return (
    <div className="space-y-6">
      <section
        aria-label="Monthly nutrition summary"
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>Monthly Summary</span>
              <span aria-hidden="true">·</span>
              <span>
                {summary.loggedDaysCount} / {month.dates.length} days logged
              </span>
              <span aria-hidden="true">·</span>
              <span>Target {DAILY_CALORIE_TARGET.toLocaleString()} kcal/day</span>
              {isLoading && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Syncing...</span>
                </>
              )}
            </div>
            <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-900">
              {formatMonthTitle(month.year, month.monthIndex)}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onChangeAnchorDate(shiftMonth(anchorDate, -1))}
              aria-label="Previous month"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onChangeAnchorDate(today)}
              className="min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => onChangeAnchorDate(shiftMonth(anchorDate, 1))}
              aria-label="Next month"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0 lg:divide-x divide-slate-200 pt-2 border-t border-slate-100">
          <div className="lg:pr-5">
            <div className="text-xs font-medium text-slate-500">Monthly Calories</div>
            <div className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-slate-900 tabular-nums">
              {summary.totals.calories.toLocaleString()}
              <span className="text-xs font-normal text-slate-500 ml-1">kcal</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
              Month budget: {monthlyTargetCalories.toLocaleString()} kcal
            </div>
          </div>

          <div className="lg:px-5">
            <div className="text-xs font-medium text-slate-500">Daily Avg Calories</div>
            <div className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-slate-900 tabular-nums">
              {summary.averages.calories.toLocaleString()}
              <span className="text-xs font-normal text-slate-500 ml-1">kcal</span>
            </div>
            <div
              className={`mt-0.5 text-xs font-medium tabular-nums ${
                summary.loggedDaysCount === 0
                  ? 'text-slate-500'
                  : avgDelta > 0
                    ? 'text-rose-700'
                    : 'text-emerald-700'
              }`}
            >
              {summary.loggedDaysCount === 0
                ? `Target ${DAILY_CALORIE_TARGET.toLocaleString()} kcal/day`
                : avgDelta > 0
                  ? `+${avgDelta.toLocaleString()} kcal above target`
                  : `${Math.abs(avgDelta).toLocaleString()} kcal under target`}
            </div>
          </div>

          <div className="lg:px-5">
            <div className="text-xs font-medium text-slate-500">Days On Target</div>
            <div className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-emerald-700 tabular-nums">
              {summary.onTargetDaysCount}
              <span className="text-xs font-normal text-slate-500 ml-1">
                / {summary.loggedDaysCount} logged
              </span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
              ≤ {DAILY_CALORIE_TARGET.toLocaleString()} kcal/day
            </div>
          </div>

          <div className="lg:pl-5">
            <div className="text-xs font-medium text-slate-500">Monthly Totals (P / C / F / Sugar)</div>
            <div className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
              {summary.totals.protein}g · {summary.totals.carbs}g · {summary.totals.fat}g ·{' '}
              <span className="text-amber-700">{summary.totals.sugar}g</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
              Avg/day: {summary.averages.protein}g P · {summary.averages.carbs}g C ·{' '}
              {summary.averages.fat}g F · {summary.averages.sugar}g sugar
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Monthly calendar grid"
        className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <h3 className="text-base font-bold text-slate-900">Calendar Overview</h3>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Emerald: ≤ {DAILY_CALORIE_TARGET.toLocaleString()} kcal</span>
            <span aria-hidden="true">·</span>
            <span>Rose: &gt; {DAILY_CALORIE_TARGET.toLocaleString()} kcal</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-xs font-medium text-slate-500 py-1">
              {label}
            </div>
          ))}

          {leadingBlanks.map((_, idx) => (
            <div key={`blank-${idx}`} aria-hidden="true" className="min-h-[58px] sm:min-h-[76px]" />
          ))}

          {summary.days.map((day, idx) => {
            const dayNum = idx + 1;
            const isToday = day.date === today;
            const hasLogs = day.itemCount > 0;

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDay(day.date)}
                aria-label={`${day.date}: ${day.totals.calories} kcal, ${day.itemCount} ${day.itemCount === 1 ? 'item' : 'items'}`}
                className={`min-h-[58px] sm:min-h-[76px] rounded-xl border p-1.5 sm:p-2 flex flex-col justify-between text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  !hasLogs
                    ? 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-100'
                    : day.isOverTarget
                      ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-50'
                      : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-50'
                } ${isToday ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
              >
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    isToday ? 'text-slate-900' : 'text-slate-600'
                  }`}
                >
                  {dayNum}
                </span>

                <div className="w-full">
                  {hasLogs ? (
                    <>
                      <div
                        className={`font-mono text-[11px] sm:text-xs font-semibold tabular-nums truncate ${
                          day.isOverTarget ? 'text-rose-800' : 'text-emerald-800'
                        }`}
                      >
                        {day.totals.calories.toLocaleString()}
                      </div>
                      <div className="hidden sm:block text-[10px] text-slate-500 tabular-nums truncate">
                        kcal · {day.totals.sugar}g sug
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section
        aria-label="Logged days this month"
        className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200"
      >
        <div className="p-5 sm:px-6 sm:py-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Logged Days</h3>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {loggedDays.length} {loggedDays.length === 1 ? 'day' : 'days'}
          </span>
        </div>

        {loggedDays.length === 0 ? (
          <div className="p-5 sm:px-6 text-sm text-slate-500">
            No food logs recorded for {formatMonthTitle(month.year, month.monthIndex)}.
          </div>
        ) : (
          loggedDays.map((day) => (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDay(day.date)}
              className="w-full text-left p-4 sm:px-6 sm:py-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span>{formatLoggedDayLabel(day.date)}</span>
                  <span className="text-xs font-normal text-slate-500">
                    · {formatMealSummary(day.mealCounts)}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                  P {day.totals.protein}g · C {day.totals.carbs}g · F {day.totals.fat}g ·{' '}
                  <span className="text-amber-700">Sugar {day.totals.sugar}g</span>
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {day.totals.calories.toLocaleString()} kcal
                </div>
                <div
                  className={`text-xs font-medium tabular-nums ${
                    day.isOverTarget ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {day.isOverTarget
                    ? `${(day.totals.calories - DAILY_CALORIE_TARGET).toLocaleString()} over target`
                    : 'On target'}
                </div>
              </div>
            </button>
          ))
        )}
      </section>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Select any date on the calendar to open or log meals for that day.
        </p>
        <button
          type="button"
          onClick={() =>
            onDownloadCsv(month.dates, `food-log-month-${month.monthKey}.csv`)
          }
          className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>Download Monthly CSV</span>
        </button>
      </div>
    </div>
  );
};
