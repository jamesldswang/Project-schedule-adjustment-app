import { useState } from 'react';
import { Download, Printer, ArrowRight } from 'lucide-react';
import { ProjectPlan, DiffStatus } from '../types/schedule';
import {
  computeTaskDiffs,
  diffDays,
  formatDeltaDays,
  formatMonthDay,
} from '../utils/dateUtils';

interface RevisionDiffViewProps {
  project: ProjectPlan;
}

export function RevisionDiffView({ project }: RevisionDiffViewProps) {
  const [baseRevId, setBaseRevId] = useState<string>(
    project.revisions[0]?.id || '',
  );
  const [targetRevId, setTargetRevId] = useState<string>('current');

  const baseRev =
    project.revisions.find((r) => r.id === baseRevId) || project.revisions[0];
  const targetRev =
    targetRevId === 'current'
      ? null
      : project.revisions.find((r) => r.id === targetRevId) || null;

  const baseTasks = baseRev ? baseRev.snapshotTasks : [];
  const targetTasks = targetRev ? targetRev.snapshotTasks : project.tasks;
  const targetLabel = targetRev ? `${targetRev.version} (${targetRev.title})` : '現行計畫 (Current)';

  const diffs = computeTaskDiffs(baseTasks, targetTasks);
  const changedDiffs = diffs.filter((d) => d.status !== 'unchanged');

  const baseEnd =
    baseTasks.length > 0
      ? [...baseTasks].sort((a, b) => a.endDate.localeCompare(b.endDate))[baseTasks.length - 1]
          .endDate
      : '';
  const targetEnd =
    targetTasks.length > 0
      ? [...targetTasks].sort((a, b) => a.endDate.localeCompare(b.endDate))[
          targetTasks.length - 1
        ].endDate
      : '';
  const overallSlipDays = baseEnd && targetEnd ? diffDays(baseEnd, targetEnd) : 0;

  const getDiffStatusLabel = (status: DiffStatus) => {
    switch (status) {
      case 'added':
        return '新增項目';
      case 'removed':
        return '移除項目';
      case 'shifted':
        return '時程位移';
      case 'duration_changed':
        return '工期增減';
      case 'shifted_and_resized':
        return '位移且工期調整';
      default:
        return '無變動';
    }
  };

  const handleExportMarkdown = () => {
    const lines: string[] = [
      `# ${project.code} ${project.name} — 版本時程變更對照報告`,
      `對照基準：${baseRev?.version || ''} (${baseRev?.title || ''}) → ${targetLabel}`,
      `整體結案日期變化：${baseEnd} → ${targetEnd} (${formatDeltaDays(overallSlipDays)})`,
      '',
      '## 歷次修訂原因紀錄',
      ...project.revisions.map(
        (r) =>
          `- **${r.version} (${r.createdAt}) [${r.category}] ${r.title}**\n  - 提出/核准：${r.author}\n  - 修正原因：${r.reason}\n  - 影響摘要：${r.impactSummary}`,
      ),
      '',
      '## 任務逐項差異明細',
      '| 項目 | 類型 | 舊版起訖 (工期) | 新版起訖 (工期) | 起日位移 | 工期增減 | 狀態 |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...diffs.map((d) => {
        const oldStr = d.baseTask
          ? `${d.baseTask.startDate}~${d.baseTask.endDate} (${d.baseTask.durationDays}d)`
          : '—';
        const newStr = d.targetTask
          ? `${d.targetTask.startDate}~${d.targetTask.endDate} (${d.targetTask.durationDays}d)`
          : '—';
        return `| ${d.taskName} | ${d.taskType} | ${oldStr} | ${newStr} | ${formatDeltaDays(
          d.startDeltaDays,
        )} | ${formatDeltaDays(d.durationDeltaDays)} | ${getDiffStatusLabel(d.status)} |`;
      }),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.code}_schedule_diff_report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Selector & Export Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">基準舊版：</span>
            <select
              value={baseRev?.id || ''}
              onChange={(e) => setBaseRevId(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {project.revisions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.version} · {r.title}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-400" />

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">對照新版：</span>
            <select
              value={targetRevId}
              onChange={(e) => setTargetRevId(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="current">現行編輯中計畫 (Current Plan)</option>
              {project.revisions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.version} · {r.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>匯出對照報告 (.md)</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>列印簡報對照頁</span>
          </button>
        </div>
      </div>

      {/* Summary Impact Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">基準最終完成日</div>
          <div className="mt-1 text-xl font-bold font-mono-tabular text-slate-900">
            {baseEnd || '—'}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">{baseRev?.version || ''} 基準</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">對照最終完成日</div>
          <div className="mt-1 text-xl font-bold font-mono-tabular text-slate-900">
            {targetEnd || '—'}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">{targetRev ? targetRev.version : '現行計畫'}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">整體完工日期差異</div>
          <div
            className={`mt-1 text-xl font-bold font-mono-tabular ${
              overallSlipDays > 0
                ? 'text-rose-600'
                : overallSlipDays < 0
                  ? 'text-emerald-600'
                  : 'text-slate-900'
            }`}
          >
            {overallSlipDays === 0 ? '無順延 (0天)' : `${formatDeltaDays(overallSlipDays)}`}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {overallSlipDays > 0 ? '較基準版延後' : overallSlipDays < 0 ? '較基準版提前' : '符合基準'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">受影響任務 / 里程碑</div>
          <div className="mt-1 text-xl font-bold font-mono-tabular text-slate-900">
            {changedDiffs.length} <span className="text-xs font-normal text-slate-500">/ {diffs.length} 項</span>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">共記錄 {project.revisions.length} 個修訂版次</div>
        </div>
      </div>

      {/* Revision Reasons Audit Log */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            歷次版本修訂事由與歸因紀錄（老闆提問備查）
          </h3>
          <span className="text-xs text-slate-500">依時間排序</span>
        </div>

        <div className="divide-y divide-slate-100">
          {project.revisions.map((rev) => (
            <div key={rev.id} className="py-3.5 first:pt-1 last:pb-1 grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-3 space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <span className="font-mono-tabular text-indigo-700">{rev.version}</span>
                  <span>·</span>
                  <span>{rev.category}</span>
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500">
                  {rev.createdAt} · 紀錄人 {rev.author}
                </div>
              </div>
              <div className="lg:col-span-5 space-y-1">
                <div className="text-xs font-semibold text-slate-900">{rev.title}</div>
                <p className="text-xs text-slate-600 leading-relaxed">{rev.reason}</p>
              </div>
              <div className="lg:col-span-4 text-xs text-slate-600 bg-slate-50 border border-slate-200/70 rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-slate-500 mb-0.5">時程影響摘要</div>
                <div>{rev.impactSummary}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task-by-Task Diff Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            任務逐項變更對照表（{baseRev?.version} vs {targetRev ? targetRev.version : '現行計畫'}）
          </h3>
          <span className="text-xs text-slate-500 font-mono-tabular">
            僅變動 {changedDiffs.length} 項 · 未變動 {diffs.length - changedDiffs.length} 項
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[880px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-white">
                <th className="py-2.5 px-3">任務 / 里程碑名稱</th>
                <th className="py-2.5 px-3 w-24">類型</th>
                <th className="py-2.5 px-3 w-44">{baseRev?.version} 原訂區間 (工期)</th>
                <th className="py-2.5 px-3 w-44">新版區間 (工期)</th>
                <th className="py-2.5 px-3 w-24 text-right">起日位移</th>
                <th className="py-2.5 px-3 w-24 text-right">工期增減</th>
                <th className="py-2.5 px-3 w-32 text-right">變動判定</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diffs.map((d) => {
                const isChanged = d.status !== 'unchanged';
                return (
                  <tr
                    key={d.taskId}
                    className={isChanged ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-slate-50/70'}
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-900">{d.taskName}</td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {d.taskType === 'milestone' ? 'Milestone' : 'Task'}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-slate-600">
                      {d.baseTask
                        ? `${formatMonthDay(d.baseTask.startDate)}–${formatMonthDay(
                            d.baseTask.endDate,
                          )} (${d.baseTask.durationDays}d)`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-slate-900 font-medium">
                      {d.targetTask
                        ? `${formatMonthDay(d.targetTask.startDate)}–${formatMonthDay(
                            d.targetTask.endDate,
                          )} (${d.targetTask.durationDays}d)`
                        : '已刪除'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                        d.startDeltaDays > 0
                          ? 'text-rose-600'
                          : d.startDeltaDays < 0
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                      }`}
                    >
                      {d.status === 'added' || d.status === 'removed'
                        ? '—'
                        : formatDeltaDays(d.startDeltaDays)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                        d.durationDeltaDays > 0
                          ? 'text-amber-700'
                          : d.durationDeltaDays < 0
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                      }`}
                    >
                      {d.taskType === 'milestone'
                        ? '0d'
                        : formatDeltaDays(d.durationDeltaDays)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`text-xs font-medium ${
                          d.status === 'unchanged'
                            ? 'text-slate-400'
                            : d.status === 'added'
                              ? 'text-indigo-700'
                              : d.status === 'removed'
                                ? 'text-slate-500 line-through'
                                : 'text-rose-700'
                        }`}
                      >
                        {getDiffStatusLabel(d.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
