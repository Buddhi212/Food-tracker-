import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from 'lucide-react';
import { parseMealCsv, type ParsedCsvMealRow } from '../utils/csvImport';

export type CsvImportMode = 'merge' | 'replace';

export interface CsvImportProgress {
  completed: number;
  total: number;
}

interface CsvImportModalProps {
  isOpen: boolean;
  defaultDate: string;
  onClose: () => void;
  onImport: (
    rows: ParsedCsvMealRow[],
    mode: CsvImportMode,
    onProgress?: (progress: CsvImportProgress) => void
  ) => Promise<void>;
}

const EXAMPLE_CSV = `Date,Meal,Food Item,Quantity,Measurement
2026-11-23,Breakfast,Vigna,100,g
2026-11-23,Breakfast,Shredded Coconut,2,tbsp
2026-11-23,Breakfast,Bread,79,g
2026-11-23,Breakfast,Dhal,94,g
2026-11-23,Lunch,kiri kos curry,149,g
2026-11-23,Lunch,Rice,185,g
2026-11-23,Lunch,Fish curry,89,g
2026-11-23,Lunch,Gotukola Mallum,39,g
2026-11-23,Snack,snickers chocolate bar,40,g
2026-11-23,Snack,pringles onion and sour cream,23,g
2026-11-23,Snack,boondi,20,g`;

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  defaultDate,
  onClose,
  onImport,
}) => {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<CsvImportMode>('merge');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<CsvImportProgress | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    if (!csvText.trim()) return null;
    return parseMealCsv(csvText, defaultDate);
  }, [csvText, defaultDate]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      setCsvText(text);
    } catch {
      setImportError('Unable to read the selected CSV file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed || parsed.error || parsed.rows.length === 0) return;
    setIsImporting(true);
    setProgress(
      parsed.needsGeminiCount > 0 ? { completed: 0, total: parsed.needsGeminiCount } : null
    );
    setImportError(null);
    try {
      await onImport(parsed.rows, mode, (nextProgress) => setProgress(nextProgress));
      setCsvText('');
      setFileName(null);
      setProgress(null);
      onClose();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import CSV rows.');
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-import-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="csv-import-title" className="text-lg font-bold text-slate-900">
              Import Meals from CSV
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload a .csv file or paste rows. Gemini AI automatically calculates calories,
              macros, and sugar for any rows without nutrition data.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            aria-label="Close CSV import dialog"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                id="csv-file-upload"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void handleFileChange(e)}
                disabled={isImporting}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>Choose .csv File</span>
              </button>

              {fileName && (
                <span className="text-xs font-mono text-slate-500 truncate max-w-[200px]">
                  {fileName}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setCsvText(EXAMPLE_CSV);
                setFileName(null);
                setImportError(null);
              }}
              disabled={isImporting}
              className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              Load Sample CSV
            </button>
          </div>

          <div>
            <label
              htmlFor="csv-paste-input"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              CSV Content
            </label>
            <textarea
              id="csv-paste-input"
              rows={7}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                if (importError) setImportError(null);
              }}
              disabled={isImporting}
              placeholder={`Date,Meal,Food Item,Quantity,Measurement\n2026-11-23,Breakfast,Vigna,100,g\n2026-11-23,Lunch,kiri kos curry,149,g`}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60"
            />
          </div>

          {parsed && parsed.error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
              <span>{parsed.error}</span>
            </div>
          )}

          {parsed && !parsed.error && parsed.rows.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>
                  Ready to import {parsed.rows.length}{' '}
                  {parsed.rows.length === 1 ? 'item' : 'items'} across {parsed.dates.length}{' '}
                  {parsed.dates.length === 1 ? 'date' : 'dates'} ({parsed.dates.join(', ')})
                </span>
              </div>
              <p className="text-xs text-emerald-800 pl-6">
                {parsed.needsGeminiCount > 0
                  ? `${parsed.needsGeminiCount} ${parsed.needsGeminiCount === 1 ? 'item' : 'items'} will be calculated by Gemini AI for calories, macros, and sugar.`
                  : 'All rows include precomputed nutrition values.'}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <span className="text-sm font-medium text-slate-700">If date already has logs:</span>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="csv-import-mode"
                value="merge"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
                disabled={isImporting}
                className="accent-emerald-600"
              />
              <span>Merge (Append)</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="csv-import-mode"
                value="replace"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
                disabled={isImporting}
                className="accent-emerald-600"
              />
              <span>Replace existing day</span>
            </label>
          </div>

          {importError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
              <span>{importError}</span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isImporting || !parsed || Boolean(parsed.error) || parsed.rows.length === 0}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>
                    {progress && progress.total > 12
                      ? `Calculating ${progress.completed} of ${progress.total} items with Gemini...`
                      : `Calculating ${parsed?.needsGeminiCount ?? ''} items with Gemini...`}
                  </span>
                </>
              ) : (
                <span>
                  {parsed && parsed.needsGeminiCount > 0
                    ? `Import & Calculate (${parsed.rows.length})`
                    : 'Import Meals'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
