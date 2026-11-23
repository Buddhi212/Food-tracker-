import React, { useState } from 'react';
import { Check, Loader2, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import {
  MEAL_TYPES,
  MEASUREMENT_UNITS,
  type LoggedFoodItem,
  type MealType,
  type MeasurementUnit,
} from '../types/nutrition';
import {
  calculateDailyTotals,
  groupItemsByMeal,
  scaleNutritionValues,
} from '../utils/nutrition';

interface MealLogListProps {
  items: LoggedFoodItem[];
  onUpdateItem: (updated: LoggedFoodItem) => Promise<void> | void;
  onRecalculateItem: (item: LoggedFoodItem) => Promise<void>;
  onDeleteItem: (itemId: string) => void;
  isLoading: boolean;
  recalculatingId: string | null;
}

interface EditDraft {
  id: string;
  meal: MealType;
  foodItem: string;
  quantity: string;
  measurement: MeasurementUnit;
}

export const MealLogList: React.FC<MealLogListProps> = ({
  items,
  onUpdateItem,
  onRecalculateItem,
  onDeleteItem,
  isLoading,
  recalculatingId,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const grouped = groupItemsByMeal(items);

  const startEditing = (item: LoggedFoodItem) => {
    setEditingId(item.id);
    setEditError(null);
    setDraft({
      id: item.id,
      meal: item.meal,
      foodItem: item.foodItem,
      quantity: String(item.quantity),
      measurement: item.measurement,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraft(null);
    setEditError(null);
    setIsSavingEdit(false);
  };

  const saveEdit = async (original: LoggedFoodItem) => {
    if (!draft) return;
    const foodItem = draft.foodItem.trim();
    const quantity = Number(draft.quantity);

    if (!foodItem) {
      setEditError('Food item name cannot be empty.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setEditError('Quantity must be greater than zero.');
      return;
    }

    const roundedQty = Math.round(quantity * 1000) / 1000;
    const foodChanged =
      foodItem !== original.foodItem || draft.measurement !== original.measurement;
    const hasExistingNutrition =
      original.calories > 0 ||
      original.protein > 0 ||
      original.carbs > 0 ||
      original.fat > 0 ||
      (original.sugar ?? 0) > 0;

    setIsSavingEdit(true);
    setEditError(null);
    try {
      if (foodChanged || !hasExistingNutrition) {
        const updatedCandidate: LoggedFoodItem = {
          ...original,
          meal: draft.meal,
          foodItem,
          quantity: roundedQty,
          measurement: draft.measurement,
        };
        await onRecalculateItem(updatedCandidate);
      } else {
        const scaled = scaleNutritionValues(original, roundedQty);
        await onUpdateItem({
          ...original,
          meal: draft.meal,
          foodItem,
          measurement: draft.measurement,
          ...scaled,
        });
      }
      cancelEditing();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to update item.');
      setIsSavingEdit(false);
    }
  };

  return (
    <section aria-label="Today's meal log" className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-slate-900">Today&apos;s Meal Log</h2>
        {isLoading && (
          <span className="text-xs font-medium text-slate-500">Syncing...</span>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200">
        {MEAL_TYPES.map((meal) => {
          const mealItems = grouped[meal];
          const mealTotals = calculateDailyTotals(mealItems);

          return (
            <div key={meal} className="p-5 sm:p-6">
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <h3 className="text-base font-bold text-slate-900">{meal}</h3>
                <div className="flex items-center gap-2 font-mono text-xs font-medium text-slate-500 tabular-nums">
                  <span>{mealTotals.calories.toLocaleString()} kcal</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {mealItems.length} {mealItems.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>

              {mealItems.length === 0 ? (
                <p className="text-sm text-slate-400">No items logged for {meal}.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {mealItems.map((item) => {
                    const isEditing = editingId === item.id && draft !== null;
                    const isRecalculating = recalculatingId === item.id;

                    if (isEditing && draft) {
                      return (
                        <li key={item.id} className="py-3.5 first:pt-1 last:pb-1 space-y-3">
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-12 sm:col-span-5">
                              <label
                                htmlFor={`edit-food-${item.id}`}
                                className="block text-xs font-medium text-slate-500 mb-1"
                              >
                                Food Item
                              </label>
                              <input
                                id={`edit-food-${item.id}`}
                                type="text"
                                value={draft.foodItem}
                                onChange={(e) =>
                                  setDraft({ ...draft, foodItem: e.target.value })
                                }
                                disabled={isSavingEdit}
                                className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
                              />
                            </div>

                            <div className="col-span-4 sm:col-span-2">
                              <label
                                htmlFor={`edit-qty-${item.id}`}
                                className="block text-xs font-medium text-slate-500 mb-1"
                              >
                                Qty
                              </label>
                              <input
                                id={`edit-qty-${item.id}`}
                                type="number"
                                step="any"
                                min="0.01"
                                value={draft.quantity}
                                onChange={(e) =>
                                  setDraft({ ...draft, quantity: e.target.value })
                                }
                                disabled={isSavingEdit}
                                className="w-full min-h-[40px] rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
                              />
                            </div>

                            <div className="col-span-4 sm:col-span-2">
                              <label
                                htmlFor={`edit-unit-${item.id}`}
                                className="block text-xs font-medium text-slate-500 mb-1"
                              >
                                Unit
                              </label>
                              <select
                                id={`edit-unit-${item.id}`}
                                value={draft.measurement}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    measurement: e.target.value as MeasurementUnit,
                                  })
                                }
                                disabled={isSavingEdit}
                                className="w-full min-h-[40px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
                              >
                                {MEASUREMENT_UNITS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="col-span-4 sm:col-span-3">
                              <label
                                htmlFor={`edit-meal-${item.id}`}
                                className="block text-xs font-medium text-slate-500 mb-1"
                              >
                                Meal
                              </label>
                              <select
                                id={`edit-meal-${item.id}`}
                                value={draft.meal}
                                onChange={(e) =>
                                  setDraft({ ...draft, meal: e.target.value as MealType })
                                }
                                disabled={isSavingEdit}
                                className="w-full min-h-[40px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
                              >
                                {MEAL_TYPES.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {editError && (
                            <p className="text-xs font-medium text-rose-700">{editError}</p>
                          )}

                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEditing}
                              disabled={isSavingEdit}
                              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Cancel</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void saveEdit(item)}
                              disabled={isSavingEdit}
                              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {isSavingEdit ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                                  <span>Updating...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Save</span>
                                </>
                              )}
                            </button>
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li
                        key={item.id}
                        className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {item.foodItem}
                            </div>
                            <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap shrink-0">
                              {item.calories.toLocaleString()} kcal
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-mono tabular-nums">
                            <span>
                              {item.quantity} {item.measurement}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>P {item.protein}g</span>
                            <span aria-hidden="true">·</span>
                            <span>C {item.carbs}g</span>
                            <span aria-hidden="true">·</span>
                            <span>F {item.fat}g</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-700">Sugar {item.sugar ?? 0}g</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void onRecalculateItem(item)}
                            disabled={isRecalculating}
                            aria-label={`Recalculate ${item.foodItem} with Gemini`}
                            title="Recalculate with Gemini AI"
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <RefreshCw
                              className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            aria-label={`Edit ${item.foodItem}`}
                            title="Edit item"
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <Pencil className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteItem(item.id)}
                            aria-label={`Delete ${item.foodItem}`}
                            title="Delete item"
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
