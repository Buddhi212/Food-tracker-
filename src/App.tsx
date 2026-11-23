import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { AlertCircle, Cloud, HardDrive } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import {
  CsvImportModal,
  type CsvImportMode,
  type CsvImportProgress,
} from './components/CsvImportModal';
import { DailySummaryBar } from './components/DailySummaryBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FooterActions } from './components/FooterActions';
import { Header } from './components/Header';
import { MealEntryForm } from './components/MealEntryForm';
import { MealLogList } from './components/MealLogList';
import { MonthlyLogsView } from './components/MonthlyLogsView';
import { OfflineBanner } from './components/OfflineBanner';
import { WeeklyLogsView } from './components/WeeklyLogsView';
import {
  readLocalDayItems,
  readLocalRangeItems,
  readUserDayLog,
  saveUserDayLog,
  subscribeUserDayLog,
  subscribeUserLogsMap,
  writeLocalDayItems,
} from './services/foodLogStorage';
import { calculateNutritionWithGemini } from './services/nutritionApi';
import {
  DAILY_CALORIE_TARGET,
  MAX_LOG_ITEMS_PER_DAY,
  type CalculatedNutritionItem,
  type FoodRowDraft,
  type LoggedFoodItem,
  type MealType,
} from './types/nutrition';
import { chunkArray, type ParsedCsvMealRow } from './utils/csvImport';
import {
  buildDailyLogCsv,
  buildPeriodLogCsv,
  calculateDailyTotals,
  countItemsByMeal,
  enforceDailyItemLimit,
  getCsvFilename,
  getLocalDateString,
  getMonthDateRange,
  getWeekDateRange,
  isValidDateString,
  validateFoodRows,
} from './utils/nutrition';

type ViewMode = 'daily' | 'weekly' | 'monthly';

const LOCAL_MODE_STORAGE_KEY = 'nutrilog:localModeConfirmed';

function createEmptyRow(index: number): FoodRowDraft {
  return {
    rowId: `row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    foodItem: '',
    quantity: '1',
    measurement: 'Pcs',
  };
}

function TrackerApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [localModeConfirmed, setLocalModeConfirmed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return true;
    return window.localStorage.getItem(LOCAL_MODE_STORAGE_KEY) === 'true';
  });

  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString());
  const [selectedMeal, setSelectedMeal] = useState<MealType>('Breakfast');
  const [rows, setRows] = useState<FoodRowDraft[]>(() => [createEmptyRow(0)]);

  const [items, setItems] = useState<LoggedFoodItem[]>(() =>
    readLocalDayItems(getLocalDateString())
  );
  const [periodLogsByDate, setPeriodLogsByDate] = useState<Record<string, LoggedFoodItem[]>>({});
  const [isPeriodSyncing, setIsPeriodSyncing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setAuthReady(true);
      },
      (err) => {
        setAuthError(err.message);
        setAuthReady(true);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setItems(readLocalDayItems(selectedDate));
      setIsSyncing(false);
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    const unsubscribe = subscribeUserDayLog(
      user.uid,
      selectedDate,
      (cloudItems) => {
        setItems(cloudItems);
        setIsSyncing(false);
      },
      (err) => {
        setSyncError(err.message);
        setIsSyncing(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, user, selectedDate]);

  useEffect(() => {
    if (!authReady || viewMode === 'daily') return;

    if (!user) {
      const dates =
        viewMode === 'weekly'
          ? getWeekDateRange(selectedDate).dates
          : getMonthDateRange(selectedDate).dates;
      setPeriodLogsByDate(readLocalRangeItems(dates));
      setIsPeriodSyncing(false);
      return;
    }

    setIsPeriodSyncing(true);
    const unsubscribe = subscribeUserLogsMap(
      user.uid,
      (cloudMap) => {
        setPeriodLogsByDate(cloudMap);
        setIsPeriodSyncing(false);
      },
      (err) => {
        setSyncError(err.message);
        setIsPeriodSyncing(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, user, viewMode, selectedDate, items]);

  const dailyTotals = useMemo(() => calculateDailyTotals(items), [items]);
  const mealCounts = useMemo(() => countItemsByMeal(items), [items]);
  const dailyCsv = useMemo(
    () => buildDailyLogCsv(selectedDate, items),
    [selectedDate, items]
  );
  const dailyCsvFilename = useMemo(() => getCsvFilename(selectedDate), [selectedDate]);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to sign out.');
    }
  };

  const handleContinueOffline = () => {
    setLocalModeConfirmed(true);
    try {
      window.localStorage.setItem(LOCAL_MODE_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage error
    }
  };

  const persistDayItems = async (nextItems: LoggedFoodItem[]) => {
    const bounded = enforceDailyItemLimit(nextItems);
    setItems(bounded);

    if (user) {
      setSyncError(null);
      try {
        await saveUserDayLog(user.uid, selectedDate, bounded);
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Failed to sync with Cloud Firestore.');
      }
    } else {
      writeLocalDayItems(selectedDate, bounded);
    }
  };

  const handleRowChange = (
    rowId: string,
    field: keyof Omit<FoodRowDraft, 'rowId'>,
    value: string
  ) => {
    setRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row))
    );
    if (formError) setFormError(null);
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow(prev.length)]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  };

  const handleDateChange = (nextDate: string) => {
    if (!nextDate) return;
    setSelectedDate(nextDate);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isValidDateString(selectedDate)) {
      setFormError('Please select a valid date.');
      return;
    }

    const { validItems, error } = validateFoodRows(rows);
    if (error) {
      setFormError(error);
      return;
    }

    if (items.length + validItems.length > MAX_LOG_ITEMS_PER_DAY) {
      setFormError(
        `Daily logs support up to ${MAX_LOG_ITEMS_PER_DAY} items per day. Please remove items before adding more.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const calculated = await calculateNutritionWithGemini(validItems);
      const nowIso = new Date().toISOString();
      const baseStamp = Date.now();
      const newEntries: LoggedFoodItem[] = validItems.map((input, idx) => {
        const nutrition = calculated[idx];
        return {
          id: `entry-${baseStamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          meal: selectedMeal,
          foodItem: input.foodItem,
          quantity: input.quantity,
          measurement: input.measurement,
          calories: nutrition?.calories ?? 0,
          protein: nutrition?.protein ?? 0,
          carbs: nutrition?.carbs ?? 0,
          fat: nutrition?.fat ?? 0,
          sugar: nutrition?.sugar ?? 0,
          createdAt: nowIso,
        };
      });

      await persistDayItems([...items, ...newEntries]);
      setRows([createEmptyRow(0)]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to calculate nutrition right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateItem = async (updated: LoggedFoodItem) => {
    const next = items.map((it) => (it.id === updated.id ? updated : it));
    await persistDayItems(next);
  };

  const handleRecalculateItem = async (targetItem: LoggedFoodItem) => {
    setRecalculatingId(targetItem.id);
    setSyncError(null);
    try {
      const [calculated] = await calculateNutritionWithGemini([
        {
          foodItem: targetItem.foodItem,
          quantity: targetItem.quantity,
          measurement: targetItem.measurement,
        },
      ]);
      const updatedItem: LoggedFoodItem = {
        ...targetItem,
        calories: calculated?.calories ?? targetItem.calories,
        protein: calculated?.protein ?? targetItem.protein,
        carbs: calculated?.carbs ?? targetItem.carbs,
        fat: calculated?.fat ?? targetItem.fat,
        sugar: calculated?.sugar ?? targetItem.sugar ?? 0,
      };
      const next = items.map((it) => (it.id === updatedItem.id ? updatedItem : it));
      await persistDayItems(next);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to recalculate nutrition with Gemini.';
      setSyncError(message);
      throw err;
    } finally {
      setRecalculatingId(null);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    const next = items.filter((it) => it.id !== itemId);
    void persistDayItems(next);
  };

  const handleClearDay = () => {
    void persistDayItems([]);
  };

  const triggerCsvDownload = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    triggerCsvDownload(dailyCsv, dailyCsvFilename);
  };

  const handleDownloadPeriodCsv = (dates: string[], filename: string) => {
    const csv = buildPeriodLogCsv(dates, periodLogsByDate);
    triggerCsvDownload(csv, filename);
  };

  const handleSelectDayFromOverview = (date: string) => {
    setSelectedDate(date);
    setViewMode('daily');
  };

  const handleImportCsvRows = async (
    parsedRows: ParsedCsvMealRow[],
    mode: CsvImportMode,
    onProgress?: (progress: CsvImportProgress) => void
  ) => {
    const rowsNeedingAi = parsedRows.filter((r) => !r.hasPrecomputedNutrition);
    const aiResultsByLine = new Map<number, CalculatedNutritionItem>();

    if (rowsNeedingAi.length > 0) {
      const batches = chunkArray(rowsNeedingAi, 12);
      let completedCount = 0;
      for (const batch of batches) {
        const calculated = await calculateNutritionWithGemini(
          batch.map((r) => ({
            foodItem: r.foodItem,
            quantity: r.quantity,
            measurement: r.measurement,
          }))
        );
        batch.forEach((row, idx) => {
          const itemResult = calculated[idx];
          if (itemResult) {
            aiResultsByLine.set(row.lineNumber, itemResult);
          }
        });
        completedCount += batch.length;
        onProgress?.({ completed: completedCount, total: rowsNeedingAi.length });
      }
    }

    const nowIso = new Date().toISOString();
    const baseStamp = Date.now();
    const entriesByDate = new Map<string, LoggedFoodItem[]>();

    parsedRows.forEach((row, idx) => {
      const aiData = aiResultsByLine.get(row.lineNumber);
      const entry: LoggedFoodItem = {
        id: `csv-${baseStamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        meal: row.meal,
        foodItem: row.foodItem,
        quantity: row.quantity,
        measurement: row.measurement,
        calories: row.hasPrecomputedNutrition ? (row.calories ?? 0) : (aiData?.calories ?? 0),
        protein: row.hasPrecomputedNutrition ? (row.protein ?? 0) : (aiData?.protein ?? 0),
        carbs: row.hasPrecomputedNutrition ? (row.carbs ?? 0) : (aiData?.carbs ?? 0),
        fat: row.hasPrecomputedNutrition ? (row.fat ?? 0) : (aiData?.fat ?? 0),
        sugar: row.hasPrecomputedNutrition ? (row.sugar ?? 0) : (aiData?.sugar ?? 0),
        createdAt: nowIso,
      };
      const existingList = entriesByDate.get(row.date) ?? [];
      existingList.push(entry);
      entriesByDate.set(row.date, existingList);
    });

    const importedDates = Array.from(entriesByDate.keys()).sort();

    for (const date of importedDates) {
      const incomingEntries = entriesByDate.get(date) ?? [];
      let nextEntries: LoggedFoodItem[];

      if (mode === 'replace') {
        if (incomingEntries.length > MAX_LOG_ITEMS_PER_DAY) {
          throw new Error(
            `${date} has ${incomingEntries.length} items, exceeding the ${MAX_LOG_ITEMS_PER_DAY}-item daily limit.`
          );
        }
        nextEntries = enforceDailyItemLimit(incomingEntries);
      } else {
        const currentDayItems =
          date === selectedDate
            ? items
            : user
              ? await readUserDayLog(user.uid, date)
              : readLocalDayItems(date);

        if (currentDayItems.length + incomingEntries.length > MAX_LOG_ITEMS_PER_DAY) {
          throw new Error(
            `Merging ${incomingEntries.length} items into ${date} exceeds the ${MAX_LOG_ITEMS_PER_DAY}-item daily limit.`
          );
        }
        nextEntries = enforceDailyItemLimit([...currentDayItems, ...incomingEntries]);
      }

      if (user) {
        await saveUserDayLog(user.uid, date, nextEntries);
      } else {
        writeLocalDayItems(date, nextEntries);
      }

      if (date === selectedDate) {
        setItems(nextEntries);
      }
    }

    if (importedDates.length > 0) {
      const targetDate = importedDates.includes(selectedDate)
        ? selectedDate
        : importedDates[0];
      setSelectedDate(targetDate);
      if (!user) {
        setItems(readLocalDayItems(targetDate));
      }
      setViewMode('daily');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header
        user={user}
        authLoading={authLoading}
        onSignIn={() => void handleSignIn()}
        onSignOut={() => void handleSignOut()}
      />
      <OfflineBanner />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {authReady && !user && !localModeConfirmed && (
          <section
            aria-label="Sync mode selection"
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <Cloud className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h1 className="text-sm font-bold text-slate-900">
                  Sync across laptop and phone with Google
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  Sign in for real-time Cloud Firestore backup, or test immediately in Local Mode.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleContinueOffline}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <HardDrive className="w-4 h-4" aria-hidden="true" />
                <span>Continue Offline (Local Mode)</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSignIn()}
                disabled={authLoading}
                className="min-h-[44px] inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                <span>Sign in with Google</span>
              </button>
            </div>
          </section>
        )}

        {(authError || syncError) && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{authError || syncError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Log timeframe"
            className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl"
          >
            {(
              [
                { id: 'daily', label: 'Daily' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
              ] as const
            ).map((tab) => {
              const active = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setViewMode(tab.id)}
                  className={`min-h-[40px] px-4 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <span className="text-xs font-medium text-slate-500">
            {user ? 'Synced with Cloud Firestore' : 'Local Mode'} · Daily target{' '}
            {DAILY_CALORIE_TARGET.toLocaleString()} kcal
          </span>
        </div>

        {viewMode === 'daily' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            <div className="lg:col-span-6 lg:col-start-7">
              <DailySummaryBar
                selectedDate={selectedDate}
                items={items}
                totals={dailyTotals}
                mealCounts={mealCounts}
                targetCalories={DAILY_CALORIE_TARGET}
              />
            </div>

            <div className="lg:col-span-6 lg:col-start-1 lg:row-start-1 lg:row-span-3 lg:sticky lg:top-24">
              <MealEntryForm
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                selectedMeal={selectedMeal}
                onMealChange={setSelectedMeal}
                rows={rows}
                onRowChange={handleRowChange}
                onAddRow={handleAddRow}
                onRemoveRow={handleRemoveRow}
                onOpenImportCsv={() => setIsImportOpen(true)}
                onSubmit={(e) => void handleSubmit(e)}
                isSubmitting={isSubmitting}
                errorMessage={formError}
              />
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <MealLogList
                items={items}
                onUpdateItem={handleUpdateItem}
                onRecalculateItem={handleRecalculateItem}
                onDeleteItem={handleDeleteItem}
                isLoading={isSyncing}
                recalculatingId={recalculatingId}
              />
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <FooterActions
                hasItems={items.length > 0}
                csvContent={dailyCsv}
                csvFilename={dailyCsvFilename}
                onDownloadCsv={handleDownloadCsv}
                onOpenImportCsv={() => setIsImportOpen(true)}
                onClearDay={handleClearDay}
              />
            </div>
          </div>
        )}

        {viewMode === 'weekly' && (
          <WeeklyLogsView
            anchorDate={selectedDate}
            logsByDate={periodLogsByDate}
            isLoading={isPeriodSyncing}
            onChangeAnchorDate={handleDateChange}
            onSelectDay={handleSelectDayFromOverview}
            onDownloadCsv={handleDownloadPeriodCsv}
          />
        )}

        {viewMode === 'monthly' && (
          <MonthlyLogsView
            anchorDate={selectedDate}
            logsByDate={periodLogsByDate}
            isLoading={isPeriodSyncing}
            onChangeAnchorDate={handleDateChange}
            onSelectDay={handleSelectDayFromOverview}
            onDownloadCsv={handleDownloadPeriodCsv}
          />
        )}
      </main>

      <CsvImportModal
        isOpen={isImportOpen}
        defaultDate={selectedDate}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportCsvRows}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TrackerApp />
    </ErrorBoundary>
  );
}
