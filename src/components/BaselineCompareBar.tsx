import { useState } from 'react';
import { History, ChevronDown, ChevronUp, Info, Check } from 'lucide-react';
import { PlanRevision } from '../types/schedule';

export const BASELINE_COLORS = [
  {
    name: 'amber',
    swatch: 'bg-amber-500',
    border: 'border-amber-500',
    text: 'text-amber-700',
    bgSoft: 'bg-amber-50',
    hatchClass: 'baseline-hatch-amber',
    ringColor: '#d97706',
  },
  {
    name: 'rose',
    swatch: 'bg-rose-500',
    border: 'border-rose-500',
    text: 'text-rose-700',
    bgSoft: 'bg-rose-50',
    hatchClass: 'baseline-hatch-rose',
    ringColor: '#e11d48',
  },
  {
    name: 'teal',
    swatch: 'bg-teal-600',
    border: 'border-teal-600',
    text: 'text-teal-700',
    bgSoft: 'bg-teal-50',
    hatchClass: 'baseline-hatch-teal',
    ringColor: '#0d9488',
  },
] as const;

interface BaselineCompareBarProps {
  revisions: PlanRevision[];
  checkedRevisionIds: string[];
  onToggleRevision: (revisionId: string) => void;
  onClearAll: () => void;
  hasUnsavedChanges: boolean;
  onOpenSaveModal: () => void;
}

export function BaselineCompareBar({
  revisions,
  checkedRevisionIds,
  onToggleRevision,
  onClearAll,
  hasUnsavedChanges,
  onOpenSaveModal,
}: BaselineCompareBarProps) {
  const [expandedReasons, setExpandedReasons] = useState(false);

  const checkedRevisions = revisions.filter((r) => checkedRevisionIds.includes(r.id));

  return (
    <section
      aria-label="版本對照控制台"
      className="bg-white border border-slate-200 rounded-xl px-4 py-3 no-print"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">
            <History className="w-4 h-4 text-slate-500" />
            <span>勾選歷史版本與現行計畫對照</span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex flex-wrap items-center gap-2">
            {revisions.map((rev, idx) => {
              const isChecked = checkedRevisionIds.includes(rev.id);
              const colorIdx = checkedRevisions.findIndex((c) => c.id === rev.id);
              const style =
                colorIdx >= 0
                  ? BASELINE_COLORS[colorIdx % BASELINE_COLORS.length]
                  : BASELINE_COLORS[idx % BASELINE_COLORS.length];

              return (
                <button
                  key={rev.id}
                  type="button"
                  onClick={() => onToggleRevision(rev.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isChecked
                      ? `${style.bgSoft} ${style.border} ${style.text} font-semibold`
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                      isChecked
                        ? `${style.swatch} border-transparent text-white`
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </span>
                  <span className="font-mono-tabular">{rev.version}</span>
                  <span className="text-slate-400">·</span>
                  <span className="max-w-[160px] truncate">{rev.title}</span>
                </button>
              );
            })}

            {checkedRevisionIds.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                清除勾選
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={onOpenSaveModal}
              className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 whitespace-nowrap cursor-pointer"
            >
              目前有未存檔變更，點此記錄修訂原因
            </button>
          )}

          {checkedRevisions.length > 0 && (
            <button
              type="button"
              onClick={() => setExpandedReasons((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>{expandedReasons ? '收合修正原因' : `查看已勾選修正原因 (${checkedRevisions.length})`}</span>
              {expandedReasons ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {expandedReasons && checkedRevisions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {checkedRevisions.map((rev, idx) => {
            const style = BASELINE_COLORS[idx % BASELINE_COLORS.length];
            return (
              <div
                key={rev.id}
                className="border border-slate-200 rounded-lg p-3 bg-slate-50/70 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <span className={`w-2.5 h-2.5 rounded-sm ${style.swatch}`} />
                    <span className="font-mono-tabular">{rev.version}</span>
                    <span>·</span>
                    <span>{rev.category}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono-tabular">
                    {rev.createdAt.split(' ')[0]} · {rev.author}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800">{rev.title}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{rev.reason}</p>
                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/80">
                  影響摘要：{rev.impactSummary}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
