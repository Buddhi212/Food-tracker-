import React from 'react';
import { AlertCircle, Loader2, Plus, Upload, X } from 'lucide-react';
import {
  MEAL_TYPES,
  MEASUREMENT_UNITS,
  type FoodRowDraft,
  type MealType,
  type MeasurementUnit,
} from '../types/nutrition';

interface MealEntryFormProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedMeal: MealType;
  onMealChange: (meal: MealType) => void;
  rows: FoodRowDraft[];
  onRowChange: (rowId: string, field: keyof Omit<FoodRowDraft, 'rowId'>, value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onOpenImportCsv: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}

export const MealEntryForm: React.FC<MealEntryFormProps> = ({
  selectedDate,
  onDateChange,
  selectedMeal,
  onMealChange,
  rows,
  onRowChange,
  onAddRow,
  onRemoveRow,
  onOpenImportCsv,
  onSubmit,
  isSubmitting,
  errorMessage,
}) => {
  return (
    <section
      aria-label="Log meal entry"
      className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Log a Meal</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter foods and quantities — Gemini AI calculates calories, macros, and sugar.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenImportCsv}
          disabled={isSubmitting}
          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <Upload className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Import CSV</span>
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="log-date-input"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Date
            </label>
            <input
              id="log-date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <div>
            <label
              htmlFor="meal-type-select"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Meal
            </label>
            <select
              id="meal-type-select"
              value={selectedMeal}
              onChange={(e) => onMealChange(e.target.value as MealType)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            >
              {MEAL_TYPES.map((meal) => (
                <option key={meal} value={meal}>
                  {meal}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Food Items</span>
            <button
              type="button"
              onClick={onAddRow}
              disabled={isSubmitting}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Row</span>
            </button>
          </div>

          <div
            aria-hidden="true"
            className="grid grid-cols-[minmax(0,1fr)_56px_74px_44px] sm:grid-cols-[minmax(0,1fr)_72px_88px_44px] gap-1.5 sm:gap-2 px-0.5 text-xs font-medium text-slate-500"
          >
            <span>Food Item</span>
            <span>Qty</span>
            <span>Unit</span>
            <span />
          </div>

          <div className="space-y-2.5" data-testid="food-rows-list">
            {rows.map((row, idx) => (
              <div
                key={row.rowId}
                data-testid={`food-entry-row-${idx}`}
                className="grid grid-cols-[minmax(0,1fr)_56px_74px_44px] sm:grid-cols-[minmax(0,1fr)_72px_88px_44px] gap-1.5 sm:gap-2 items-center"
              >
                <div className="min-w-0">
                  <label htmlFor={`food-item-${row.rowId}`} className="sr-only">
                    {`Food Item ${idx + 1}`}
                  </label>
                  <input
                    id={`food-item-${row.rowId}`}
                    type="text"
                    value={row.foodItem}
                    onChange={(e) => onRowChange(row.rowId, 'foodItem', e.target.value)}
                    placeholder="e.g., Bread slices, Egg"
                    maxLength={160}
                    disabled={isSubmitting}
                    className="w-full min-w-0 min-h-[44px] rounded-xl border border-slate-300 bg-white px-2.5 sm:px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:bg-slate-50"
                  />
                </div>

                <div className="min-w-0">
                  <label htmlFor={`food-qty-${row.rowId}`} className="sr-only">
                    {`Quantity ${idx + 1}`}
                  </label>
                  <input
                    id={`food-qty-${row.rowId}`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0.01"
                    value={row.quantity}
                    onChange={(e) => onRowChange(row.rowId, 'quantity', e.target.value)}
                    placeholder="1"
                    disabled={isSubmitting}
                    className="w-full min-w-0 min-h-[44px] rounded-xl border border-slate-300 bg-white px-2 sm:px-2.5 py-2 font-mono text-sm text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:bg-slate-50"
                  />
                </div>

                <div className="min-w-0">
                  <label htmlFor={`food-unit-${row.rowId}`} className="sr-only">
                    {`Measurement ${idx + 1}`}
                  </label>
                  <select
                    id={`food-unit-${row.rowId}`}
                    value={row.measurement}
                    onChange={(e) =>
                      onRowChange(
                        row.rowId,
                        'measurement',
                        e.target.value as MeasurementUnit
                      )
                    }
                    disabled={isSubmitting}
                    className="w-full min-w-0 min-h-[44px] rounded-xl border border-slate-300 bg-white px-1.5 sm:px-2.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:bg-slate-50"
                  >
                    {MEASUREMENT_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveRow(row.rowId)}
                  disabled={isSubmitting || rows.length <= 1}
                  aria-label={`Remove food row ${idx + 1}`}
                  title="Remove row"
                  className="h-[44px] w-[44px] shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-70 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Calculating with Gemini...</span>
            </>
          ) : (
            <span>Calculate &amp; Add to Log</span>
          )}
        </button>
      </form>
    </section>
  );
};
