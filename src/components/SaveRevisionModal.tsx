import { useState } from 'react';
import { X } from 'lucide-react';
import { PlanRevision, ProjectPlan, RevisionCategory } from '../types/schedule';
import { computeTaskDiffs, formatDeltaDays } from '../utils/dateUtils';

interface SaveRevisionModalProps {
  project: ProjectPlan;
  onClose: () => void;
  onSaveRevision: (revision: PlanRevision) => void;
}

const CATEGORIES: RevisionCategory[] = [
  '客戶延遲',
  '需求變更',
  '技術調整',
  '測試複驗',
  '初始基準',
];

function computeNextVersion(currentVer: string, level: 'patch' | 'minor' | 'major'): string {
  const hasPrefixV = currentVer.trim().toLowerCase().startsWith('v');
  const clean = currentVer.trim().replace(/^v/i, '');
  const parts = clean.split('.').map((n) => Number(n) || 0);

  if (parts.length >= 3) {
    const [maj, min, pat] = parts;
    const prefix = hasPrefixV ? 'v' : '';
    if (level === 'major') return `${prefix}${maj + 1}.0.0`;
    if (level === 'minor') return `${prefix}${maj}.${min + 1}.0`;
    return `${prefix}${maj}.${min}.${pat + 1}`;
  }

  const [maj = 1, min = 0] = parts;
  const prefix = hasPrefixV ? 'v' : '';
  if (level === 'major') return `${prefix}${maj + 1}.0`;
  return `${prefix}${maj}.${min + 1}`;
}

export function SaveRevisionModal({
  project,
  onClose,
  onSaveRevision,
}: SaveRevisionModalProps) {
  const lastRev = project.revisions[project.revisions.length - 1];
  const baseVersionStr = lastRev?.version || 'v1.0.0';
  const suggestedNext = computeNextVersion(baseVersionStr, 'minor');

  const [version, setVersion] = useState(suggestedNext);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RevisionCategory>('客戶延遲');
  const [author, setAuthor] = useState(project.owner);
  const [reason, setReason] = useState('');

  const diffs = lastRev
    ? computeTaskDiffs(lastRev.snapshotTasks, project.tasks).filter(
        (d) => d.status !== 'unchanged',
      )
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !reason.trim()) return;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const createdAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate(),
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const autoImpact =
      diffs.length > 0
        ? diffs
            .slice(0, 4)
            .map(
              (d) =>
                `${d.taskName} (${
                  d.status === 'added'
                    ? '新增'
                    : d.status === 'removed'
                      ? '移除'
                      : `起日${formatDeltaDays(d.startDeltaDays)} / 工期${formatDeltaDays(
                          d.durationDeltaDays,
                        )}`
                })`,
            )
            .join('、') + (diffs.length > 4 ? ` 等共 ${diffs.length} 項變動` : '')
        : '確認快照存檔（與前一版時程一致）';

    const newRev: PlanRevision = {
      id: `rev-${Date.now()}`,
      version: version.trim() || suggestedNext,
      title: title.trim(),
      createdAt,
      author: author.trim() || project.owner,
      category,
      reason: reason.trim(),
      impactSummary: autoImpact,
      snapshotTasks: JSON.parse(JSON.stringify(project.tasks)),
      snapshotPhases: JSON.parse(JSON.stringify(project.phases)),
    };

    onSaveRevision(newRev);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              儲存新版本修訂快照（記錄修正原因）
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              上一版號：{baseVersionStr} · 存檔後可在 Milestone 圖與 Gantt Chart 勾選對照
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Diff Preview Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
            <div className="text-xs font-semibold text-slate-700">
              自動偵測較 {lastRev?.version || '前一版'} 的時程變動（{diffs.length} 項）：
            </div>
            {diffs.length === 0 ? (
              <p className="text-xs text-slate-500">
                目前日期與工期尚未與上一版不同（仍可儲存為里程碑核定紀錄點）。
              </p>
            ) : (
              <ul className="space-y-1 max-h-28 overflow-y-auto text-xs text-slate-700">
                {diffs.map((d) => (
                  <li key={d.taskId} className="flex items-center justify-between gap-2">
                    <span className="truncate">• {d.taskName}</span>
                    <span className="font-mono-tabular text-[11px] font-semibold text-rose-700 shrink-0">
                      {d.status === 'added'
                        ? '新增項目'
                        : d.status === 'removed'
                          ? '移除項目'
                          : `起日 ${formatDeltaDays(d.startDeltaDays)} · 工期 ${formatDeltaDays(
                              d.durationDeltaDays,
                            )}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">版本編號</label>
              <input
                type="text"
                required
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder={suggestedNext}
                className="w-full px-3 py-1.5 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="mt-1 flex items-center gap-1">
                {baseVersionStr.split('.').length >= 3 && (
                  <button
                    type="button"
                    onClick={() => setVersion(computeNextVersion(baseVersionStr, 'patch'))}
                    className="px-1.5 py-0.5 text-[10px] font-mono-tabular bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                  >
                    +修訂
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setVersion(computeNextVersion(baseVersionStr, 'minor'))}
                  className="px-1.5 py-0.5 text-[10px] font-mono-tabular bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                >
                  +次版
                </button>
                <button
                  type="button"
                  onClick={() => setVersion(computeNextVersion(baseVersionStr, 'major'))}
                  className="px-1.5 py-0.5 text-[10px] font-mono-tabular bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                >
                  +主版
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">變更歸因分類</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RevisionCategory)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">紀錄/提案人</label>
              <input
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              修訂版標題（簡述本次調整主題）
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：業主新增報表匯出需求，整合測試順延一週"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              詳細修正原因與依據（供日後會議與老闆提問對照）
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="請填寫具體變數來源、會議決議日期、外部等待事項或工期調整理由..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
            >
              確認儲存為 {version} 基準
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
