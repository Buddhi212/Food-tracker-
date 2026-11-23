import React from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import {
  DAILY_CALORIE_TARGET,
  MAINTENANCE_CALORIE_REFERENCE,
  MEAL_TYPES,
  WEEKLY_CALORIE_TARGET,
  type LoggedFoodItem,
} from '../types/nutrition';
import {
  getLocalDateString,
  getWeekDateRange,
  shiftDateByDays,
  summarizePeriodLogs,
} from '../utils/nutrition';

interface WeeklyLogsViewProps {
  anchorDate: string;
  logsByDate: Record<string, LoggedFoodItem[]>;
  isLoading: boolean;
  onChangeAnchorDate: (date: string) => void;
  onSelectDay: (date: string) => void;
  onDownloadCsv: (dates: string[], filename: string) => void;
}

function formatShortDay(dateStr: string): { weekday: string; monthDay: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return {
    weekday: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
    monthDay: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

function formatRangeHeading(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  const sLabel = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const eLabel = e.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${sLabel} – ${eLabel}`;
}

function formatMealSummary(mealCounts: Record<(typeof MEAL_TYPES)[number], number>): string {
  const parts = MEAL_TYPES.filter((m) => mealCounts[m] > 0).map(
    (m) => `${mealCounts[m]} ${m}`
  );
  return parts.join(' · ');
}

export const WeeklyLogsView: React.FC<WeeklyLogsViewProps> = ({
  anchorDate,
  logsByDate,
  isLoading,
  onChangeAnchorDate,
  onSelectDay,
  onDownloadCsv,
}) => {
  const today = getLocalDateString();
  const week = getWeekDateRange(anchorDate);
  const summary = summarizePeriodLogs(week.dates, logsByDate, DAILY_CALORIE_TARGET);
  const maxDayCalories = Math.max(
    DAILY_CALORIE_TARGET,
    ...summary.days.map((d) => d.totals.calories)
  );
  const targetMarkerPercent = Math.round((DAILY_CALORIE_TARGET / maxDayCalories) * 100);
  const avgDelta = summary.averages.calories - DAILY_CALORIE_TARGET;

  return (
    <div className="space-y-6">
      <section
        aria-label="Weekly nutrition summary"
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>Weekly Summary</span>
              <span aria-hidden="true">·</span>
              <span>{summary.loggedDaysCount} / 7 days logged</span>
              <span aria-hidden="true">·</span>
              <span>Target {WEEKLY_CALORIE_TARGET.toLocaleString()} kcal/wk</span>
              {isLoading && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Syncing...</span>
                </>
              )}
            </div>
            <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-900">
              {formatRangeHeading(week.startDate, week.endDate)}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onChangeAnchorDate(shiftDateByDays(anchorDate, -7))}
              aria-label="Previous week"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onChangeAnchorDate(today)}
              className="min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => onChangeAnchorDate(shiftDateByDays(anchorDate, 7))}
              aria-label="Next week"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0 lg:divide-x divide-slate-200 pt-2 border-t border-slate-100">
          <div className="lg:pr-5">
            <div className="text-xs font-medium text-slate-500">Weekly Calories</div>
            <div className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-slate-900 tabular-nums">
              {summary.totals.calories.toLocaleString()}
              <span className="text-xs font-normal text-slate-500 ml-1">kcal</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
              Target {WEEKLY_CALORIE_TARGET.toLocaleString()} kcal (Maint.{' '}
              {(MAINTENANCE_CALORIE_REFERENCE * 7).toLocaleString()})
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
            <div className="text-xs font-medium text-slate-500">Weekly Totals (P / C / F / Sugar)</div>
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
        aria-label="Weekly daily calorie and macro breakdown"
        className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200"
      >
        {summary.days.map((day) => {
          const { weekday, monthDay } = formatShortDay(day.date);
          const isToday = day.date === today;
          const barWidth =
            day.totals.calories > 0
              ? Math.max(4, Math.round((day.totals.calories / maxDayCalories) * 100))
              : 0;
          const mealText = formatMealSummary(day.mealCounts);

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDay(day.date)}
              className="w-full text-left p-4 sm:px-6 sm:py-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
            >
              <div className="flex items-center justify-between sm:justify-start gap-4 sm:w-44 shrink-0">
                <div>
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>{weekday}</span>
                    <span className="font-normal text-slate-500">{monthDay}</span>
                    {isToday && (
                      <span className="text-xs font-medium text-emerald-700">· Today</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {day.itemCount > 0 ? mealText : 'No entries'}
                  </div>
                </div>

                <div className="sm:hidden text-right">
                  <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                    {day.totals.calories.toLocaleString()} kcal
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 tabular-nums">
                    {day.itemCount > 0 ? (day.isOverTarget ? 'Over' : 'On target') : '—'}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex items-center gap-3">
                <div className="relative flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      day.totals.calories === 0
                        ? 'bg-transparent'
                        : day.isOverTarget
                          ? 'bg-rose-600'
                          : 'bg-emerald-600'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                  <div
                    aria-hidden="true"
                    title={`Daily target: ${DAILY_CALORIE_TARGET} kcal`}
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-400/80"
                    style={{ left: `min(${targetMarkerPercent}%, calc(100% - 2px))` }}
                  />
                </div>
                <span className="hidden sm:inline-block w-24 text-right font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                  {day.totals.calories.toLocaleString()} kcal
                </span>
              </div>

              <div className="sm:w-64 text-xs text-slate-500 sm:text-right shrink-0 font-mono tabular-nums truncate">
                {day.itemCount > 0 ? (
                  <span>
                    P {day.totals.protein}g · C {day.totals.carbs}g · F {day.totals.fat}g ·{' '}
                    <span className="text-amber-700">S {day.totals.sugar}g</span>
                  </span>
                ) : (
                  <span className="font-sans text-slate-400">No entries</span>
                )}
              </div>
            </button>
          );
        })}
      </section>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Target line marks {DAILY_CALORIE_TARGET.toLocaleString()} kcal/day. Click any day to edit meals.
        </p>
        <button
          type="button"
          onClick={() =>
            onDownloadCsv(
              week.dates,
              `food-log-week-${week.startDate}-to-${week.endDate}.csv`
            )
          }
          className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>Download Weekly CSV</span>
        </button>
      </div>
    </div>
  );
};
