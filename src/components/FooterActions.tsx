import React, { useState } from 'react';
import { Check, Copy, Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react';

interface FooterActionsProps {
  hasItems: boolean;
  csvContent: string;
  csvFilename: string;
  onDownloadCsv: () => void;
  onOpenImportCsv: () => void;
  onClearDay: () => void;
}

export const FooterActions: React.FC<FooterActionsProps> = ({
  hasItems,
  csvContent,
  csvFilename,
  onDownloadCsv,
  onOpenImportCsv,
  onClearDay,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCsv = async () => {
    try {
      await navigator.clipboard.writeText(csvContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <section
      aria-label="Daily log export and reset actions"
      className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onDownloadCsv}
            className="min-h-[48px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Download Today&apos;s CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCsv((prev) => !prev)}
            aria-expanded={showCsv}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span>{showCsv ? 'Hide CSV' : 'View CSV'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenImportCsv}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>Import CSV</span>
          </button>
        </div>

        {!confirmClear ? (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={!hasItems}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 disabled:opacity-45 disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:border-slate-200 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span>Clear Day</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="min-h-[48px] flex-1 sm:flex-initial rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onClearDay();
                setConfirmClear(false);
              }}
              className="min-h-[48px] flex-1 sm:flex-initial rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 transition-colors whitespace-nowrap"
            >
              Confirm Clear
            </button>
          </div>
        )}
      </div>

      {showCsv && (
        <div className="border-t border-slate-100 pt-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-slate-500 truncate">{csvFilename}</span>
            <button
              type="button"
              onClick={() => void handleCopyCsv()}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy CSV</span>
                </>
              )}
            </button>
          </div>
          <pre
            data-testid="live-csv-preview"
            className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 font-mono text-xs text-slate-700 overflow-x-auto whitespace-pre leading-relaxed"
          >
            {csvContent}
          </pre>
        </div>
      )}
    </section>
  );
};
