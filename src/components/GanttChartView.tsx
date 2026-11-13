import { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Flag,
  Minus,
  Plus,
  X,
  ArrowRightLeft,
} from 'lucide-react';
import {
  PlanRevision,
  ProjectPlan,
  ScheduleTask,
  ZoomLevel,
} from '../types/schedule';
import {
  addDays,
  cascadeDownstreamTasks,
  computeEndDate,
  diffDays,
  formatDeltaDays,
  formatMonthDay,
  parseDate,
} from '../utils/dateUtils';
import { BASELINE_COLORS } from './BaselineCompareBar';

interface GanttChartViewProps {
  project: ProjectPlan;
  checkedRevisions: PlanRevision[];
  onChangeTasks: (nextTasks: ScheduleTask[]) => void;
  onSwitchToMilestone: () => void;
}

export function GanttChartView({
  project,
  checkedRevisions,
  onChangeTasks,
  onSwitchToMilestone,
}: GanttChartViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [onlyChanged, setOnlyChanged] = useState<boolean>(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const dayWidth = zoom === 'day' ? 28 : zoom === 'week' ? 12 : 5.5;

  // Gather all dates across current tasks and checked revisions to compute global chart bounds
  const allStartDates: string[] = [];
  const allEndDates: string[] = [];

  project.tasks.forEach((t) => {
    allStartDates.push(t.startDate);
    allEndDates.push(t.endDate);
  });
  checkedRevisions.forEach((rev) => {
    rev.snapshotTasks.forEach((t) => {
      allStartDates.push(t.startDate);
      allEndDates.push(t.endDate);
    });
  });

  const sortedStarts = [...allStartDates].sort();
  const sortedEnds = [...allEndDates].sort();
  const rawMin = sortedStarts[0] || '2026-05-01';
  const rawMax = sortedEnds[sortedEnds.length - 1] || '2026-12-15';

  const chartStart = addDays(rawMin, -7);
  const chartEnd = addDays(rawMax, 14);
  const totalDays = Math.max(30, diffDays(chartStart, chartEnd) + 1);
  const timelineWidth = totalDays * dayWidth;

  // Build Month Header segments
  const monthSegments: { label: string; leftPx: number; widthPx: number }[] = [];
  {
    let cursor = parseDate(chartStart);
    const endDt = parseDate(chartEnd);
    while (cursor <= endDt) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const firstOfMonth = new Date(y, m, 1);
      const nextMonth = new Date(y, m + 1, 1);
      const segStart = cursor > firstOfMonth ? cursor : firstOfMonth;
      const segEnd = nextMonth <= endDt ? addDays(`${y}-${String(m + 1).padStart(2, '0')}-01`, new Date(y, m + 1, 0).getDate() - 1) : chartEnd;

      const segStartISO = `${segStart.getFullYear()}-${String(segStart.getMonth() + 1).padStart(2, '0')}-${String(segStart.getDate()).padStart(2, '0')}`;
      const startOffset = diffDays(chartStart, segStartISO);
      const span = Math.max(1, diffDays(segStartISO, segEnd) + 1);

      monthSegments.push({
        label: `${y}/${m + 1}月`,
        leftPx: startOffset * dayWidth,
        widthPx: span * dayWidth,
      });

      cursor = nextMonth;
    }
  }

  // Build weekly tick lines
  const weekTicks: { label: string; leftPx: number }[] = [];
  for (let d = 0; d < totalDays; d += zoom === 'day' ? 2 : 7) {
    const dtStr = addDays(chartStart, d);
    weekTicks.push({
      label: formatMonthDay(dtStr),
      leftPx: d * dayWidth,
    });
  }

  // Reference / Today vertical line
  const refOffsetDays = diffDays(chartStart, project.referenceDate);
  const showRefLine = refOffsetDays >= 0 && refOffsetDays <= totalDays;
  const refLeftPx = refOffsetDays * dayWidth;

  // Filtered tasks
  const filteredTasks = project.tasks.filter((t) => {
    if (phaseFilter !== 'all' && t.phaseId !== phaseFilter) return false;
    if (onlyChanged && checkedRevisions.length > 0) {
      const hasAnyDiff = checkedRevisions.some((rev) => {
        const old = rev.snapshotTasks.find((ot) => ot.id === t.id);
        if (!old) return true;
        return old.startDate !== t.startDate || old.endDate !== t.endDate || old.durationDays !== t.durationDays;
      });
      if (!hasAnyDiff) return false;
    }
    return true;
  });

  const getBarColor = (task: ScheduleTask) => {
    const phase = project.phases.find((p) => p.id === task.phaseId);
    if (task.status === 'delayed') return 'bg-rose-600';
    switch (phase?.color) {
      case 'amber':
        return 'bg-amber-500';
      case 'blue':
        return 'bg-indigo-600';
      case 'red':
        return 'bg-red-600';
      default:
        return 'bg-emerald-600';
    }
  };

  const handleAdjustSelectedDuration = (task: ScheduleTask, delta: number) => {
    if (task.type === 'milestone') return;
    const nextDur = Math.max(1, task.durationDays + delta);
    let next = project.tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            durationDays: nextDur,
            endDate: computeEndDate(t.startDate, nextDur, false),
          }
        : t,
    );
    next = cascadeDownstreamTasks(next, task.id);
    onChangeTasks(next);
  };

  const handleShiftSelectedStart = (task: ScheduleTask, deltaDays: number) => {
    const nextStart = addDays(task.startDate, deltaDays);
    let next = project.tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            startDate: nextStart,
            endDate: computeEndDate(nextStart, t.durationDays, t.type === 'milestone'),
          }
        : t,
    );
    next = cascadeDownstreamTasks(next, task.id);
    onChangeTasks(next);
  };

  const selectedTask = project.tasks.find((t) => t.id === selectedTaskId) || null;
  const rowHeight = checkedRevisions.length > 0 ? 64 : 46;

  return (
    <div className="space-y-4">
      {/* Gantt Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setPhaseFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                phaseFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全階段
            </button>
            {project.phases.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPhaseFilter(p.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  phaseFilter === p.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.code}
              </button>
            ))}
          </div>

          {checkedRevisions.length > 0 && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyChanged}
                onChange={(e) => setOnlyChanged(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>只看有差異之任務</span>
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Legend */}
          <div className="hidden xl:flex items-center gap-4 text-[11px] text-slate-600 mr-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm bg-indigo-600 inline-block" />
              現行計畫
            </span>
            {checkedRevisions.map((rev, idx) => {
              const style = BASELINE_COLORS[idx % BASELINE_COLORS.length];
              return (
                <span key={rev.id} className="inline-flex items-center gap-1.5 font-mono-tabular">
                  <span
                    className={`w-3 h-2 rounded-sm border border-dashed inline-block ${style.border} ${style.hatchClass}`}
                  />
                  {rev.version} 舊版基準
                </span>
              );
            })}
          </div>

          {/* Zoom segmented control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <ZoomOut className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
            {(['day', 'week', 'month'] as ZoomLevel[]).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  zoom === z
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {z === 'day' ? '日視圖' : z === 'week' ? '週視圖' : '月視圖'}
              </button>
            ))}
            <ZoomIn className="w-3.5 h-3.5 text-slate-400 mr-1.5 ml-1" />
          </div>

          <button
            type="button"
            onClick={onSwitchToMilestone}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5 text-amber-600" />
            <span>切回 Milestone 圖</span>
          </button>
        </div>
      </div>

      {/* Selected Task Quick Duration & Attribution Inspector */}
      {selectedTask && (
        <div className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-slate-900">{selectedTask.name}</span>
              <span className="text-xs font-mono-tabular text-slate-500">
                {selectedTask.startDate} ～ {selectedTask.endDate} ·{' '}
                {selectedTask.type === 'milestone'
                  ? '里程碑節點'
                  : `工期 ${selectedTask.durationDays} 天`}
              </span>
              <span className="text-xs text-slate-500">· 權責：{selectedTask.owner}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1 text-xs">
                <span className="text-slate-600 mr-1">位移起日</span>
                <button
                  type="button"
                  onClick={() => handleShiftSelectedStart(selectedTask, -1)}
                  className="px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-50 font-mono-tabular cursor-pointer"
                >
                  -1d
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftSelectedStart(selectedTask, 1)}
                  className="px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-50 font-mono-tabular cursor-pointer"
                >
                  +1d
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftSelectedStart(selectedTask, 7)}
                  className="px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-50 font-mono-tabular cursor-pointer"
                >
                  +7d
                </button>
              </div>

              {selectedTask.type === 'task' && (
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1 text-xs">
                  <span className="text-slate-600 mr-1">調整工期</span>
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedDuration(selectedTask, -1)}
                    className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="px-2 font-mono-tabular font-semibold">
                    {selectedTask.durationDays}d
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedDuration(selectedTask, 1)}
                    className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Boss Q&A Revision Trail for this Task */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
              <span>此項目跨版本歷史對照與原因說明</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {project.revisions.map((rev) => {
                const snap = rev.snapshotTasks.find((t) => t.id === selectedTask.id);
                const startDelta = snap ? diffDays(snap.startDate, selectedTask.startDate) : 0;
                const durDelta = snap ? selectedTask.durationDays - snap.durationDays : 0;

                return (
                  <div
                    key={rev.id}
                    className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {rev.version} · {rev.category}
                      </span>
                      {snap ? (
                        <span className="font-mono-tabular text-[11px] text-slate-600">
                          {formatMonthDay(snap.startDate)}–{formatMonthDay(snap.endDate)} (
                          {snap.durationDays}d)
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">此版無此任務</span>
                      )}
                    </div>
                    {snap && (startDelta !== 0 || durDelta !== 0) && (
                      <div className="text-[11px] font-mono-tabular font-semibold text-rose-700">
                        與現行差異：起日 {formatDeltaDays(startDelta)} · 工期{' '}
                        {formatDeltaDays(durDelta)}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-600 leading-relaxed">{rev.reason}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Gantt Chart Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex">
        {/* Left Frozen Task Sidebar */}
        <div className="w-[340px] sm:w-[390px] shrink-0 border-r border-slate-200 bg-white z-10">
          {/* Header */}
          <div className="h-[58px] px-3 border-b border-slate-200 bg-slate-50 flex items-end pb-2 text-[11px] font-semibold text-slate-500">
            <span className="w-10 shrink-0">階段</span>
            <span className="flex-1 truncate">任務 / 里程碑名稱</span>
            <span className="w-14 text-right shrink-0">工期</span>
            <span className="w-24 text-right shrink-0">起訖</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {filteredTasks.map((task) => {
              const phase = project.phases.find((p) => p.id === task.phaseId);
              const isSelected = selectedTaskId === task.id;
              const isMilestone = task.type === 'milestone';

              // Compare against first checked revision for sidebar indicator
              const baseRev = checkedRevisions[0];
              const baseTask = baseRev?.snapshotTasks.find((bt) => bt.id === task.id);
              const endDelta = baseTask ? diffDays(baseTask.endDate, task.endDate) : 0;

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTaskId(isSelected ? null : task.id)}
                  style={{ height: `${rowHeight}px` }}
                  className={`w-full px-3 flex items-center text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="w-10 shrink-0 text-[11px] font-mono-tabular text-slate-500">
                    {phase?.code}
                  </span>
                  <div className="flex-1 min-w-0 pr-2">
                    <div
                      className={`text-xs truncate ${
                        isMilestone ? 'font-bold text-slate-900' : 'font-medium text-slate-800'
                      }`}
                    >
                      {isMilestone ? `◆ ${task.name}` : task.name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {task.owner}
                      {baseRev && baseTask && endDelta !== 0 && (
                        <span
                          className={`ml-1.5 font-mono-tabular font-semibold ${
                            endDelta > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          較{baseRev.version} {formatDeltaDays(endDelta)}
                        </span>
                      )}
                      {baseRev && !baseTask && (
                        <span className="ml-1.5 text-indigo-600 font-medium">
                          {baseRev.version}後新增
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="w-14 text-right shrink-0 text-xs font-mono-tabular text-slate-700">
                    {isMilestone ? '0d' : `${task.durationDays}d`}
                  </span>
                  <span className="w-24 text-right shrink-0 text-[11px] font-mono-tabular text-slate-500">
                    {isMilestone
                      ? formatMonthDay(task.startDate)
                      : `${formatMonthDay(task.startDate)}–${formatMonthDay(task.endDate)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Scrollable Timeline Canvas */}
        <div className="flex-1 overflow-x-auto bg-white">
          <div style={{ width: `${timelineWidth}px` }} className="relative">
            {/* Timeline Header */}
            <div className="h-[58px] border-b border-slate-200 bg-slate-50 relative select-none">
              {/* Top row: Month bands */}
              <div className="h-7 relative border-b border-slate-200/80">
                {monthSegments.map((seg, i) => (
                  <div
                    key={i}
                    style={{ left: `${seg.leftPx}px`, width: `${seg.widthPx}px` }}
                    className="absolute top-0 bottom-0 border-r border-slate-200 px-2 flex items-center text-[11px] font-semibold font-mono-tabular text-slate-700 truncate"
                  >
                    {seg.label}
                  </div>
                ))}
              </div>

              {/* Bottom row: Week/Day ticks */}
              <div className="h-[30px] relative">
                {weekTicks.map((tick, i) => (
                  <div
                    key={i}
                    style={{ left: `${tick.leftPx}px` }}
                    className="absolute top-0 bottom-0 border-l border-slate-200/70 pl-1 flex items-center text-[10px] font-mono-tabular text-slate-400"
                  >
                    {tick.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Gridlines & Reference Date Line */}
            <div className="relative">
              {weekTicks.map((tick, i) => (
                <div
                  key={i}
                  style={{ left: `${tick.leftPx}px` }}
                  className="absolute top-0 bottom-0 border-l border-slate-100 pointer-events-none"
                />
              ))}

              {showRefLine && (
                <div
                  style={{ left: `${refLeftPx}px` }}
                  className="absolute top-0 bottom-0 w-px bg-rose-500/80 z-20 pointer-events-none"
                >
                  <div className="sticky top-0 -translate-x-1/2 bg-rose-600 text-white text-[10px] font-mono-tabular px-1.5 py-0.5 rounded-b whitespace-nowrap w-max">
                    基準日 {formatMonthDay(project.referenceDate)}
                  </div>
                </div>
              )}

              {/* Task Rows */}
              <div className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const isMilestone = task.type === 'milestone';
                  const startOffset = diffDays(chartStart, task.startDate);
                  const leftPx = startOffset * dayWidth;
                  const barWidth = isMilestone
                    ? 14
                    : Math.max(dayWidth, task.durationDays * dayWidth);
                  const isSelected = selectedTaskId === task.id;

                  // First checked revision delta for inline end callout
                  const primaryRev = checkedRevisions[0];
                  const primaryBase = primaryRev?.snapshotTasks.find((bt) => bt.id === task.id);
                  const primaryEndDelta = primaryBase
                    ? diffDays(primaryBase.endDate, task.endDate)
                    : 0;
                  const primaryDurDelta = primaryBase
                    ? task.durationDays - primaryBase.durationDays
                    : 0;

                  return (
                    <div
                      key={task.id}
                      style={{ height: `${rowHeight}px` }}
                      onClick={() => setSelectedTaskId(isSelected ? null : task.id)}
                      className={`relative cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Current Plan Bar or Milestone Diamond */}
                      <div
                        style={{
                          left: `${leftPx}px`,
                          top: checkedRevisions.length > 0 ? '10px' : '13px',
                        }}
                        className="absolute flex items-center z-10"
                      >
                        {isMilestone ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rotate-45 bg-amber-500 border-2 border-white shadow-sm shrink-0"
                              title={`${task.name} (${task.startDate})`}
                            />
                            <span className="text-[11px] font-semibold text-slate-800 font-mono-tabular whitespace-nowrap">
                              {task.dateSubLabel || formatMonthDay(task.startDate)}
                              {primaryBase && primaryEndDelta !== 0 && (
                                <span
                                  className={`ml-1.5 ${
                                    primaryEndDelta > 0 ? 'text-rose-600' : 'text-emerald-600'
                                  }`}
                                >
                                  ({formatDeltaDays(primaryEndDelta)})
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div
                              style={{ width: `${barWidth}px` }}
                              className={`h-5 rounded ${getBarColor(
                                task,
                              )} relative overflow-hidden flex items-center px-2 shadow-xs`}
                              title={`${task.name}: ${task.startDate} ~ ${task.endDate} (${task.durationDays}d)`}
                            >
                              {task.progress > 0 && task.progress < 100 && (
                                <div
                                  style={{ width: `${task.progress}%` }}
                                  className="absolute inset-y-0 left-0 bg-black/15 pointer-events-none"
                                />
                              )}
                              <span className="relative text-[10px] font-mono-tabular text-white font-medium truncate">
                                {barWidth > 48 ? `${task.durationDays}d` : ''}
                              </span>
                            </div>

                            {primaryBase && (primaryEndDelta !== 0 || primaryDurDelta !== 0) && (
                              <span className="text-[10px] font-mono-tabular font-semibold whitespace-nowrap text-rose-700">
                                {primaryEndDelta !== 0
                                  ? `結案${formatDeltaDays(primaryEndDelta)}`
                                  : ''}
                                {primaryDurDelta !== 0
                                  ? ` 工期${formatDeltaDays(primaryDurDelta)}`
                                  : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Ghost Baseline Overlay Bars for Every Checked Revision */}
                      {checkedRevisions.map((rev, revIdx) => {
                        const style = BASELINE_COLORS[revIdx % BASELINE_COLORS.length];
                        const oldTask = rev.snapshotTasks.find((ot) => ot.id === task.id);
                        if (!oldTask) return null;

                        const oldStartOffset = diffDays(chartStart, oldTask.startDate);
                        const oldLeftPx = oldStartOffset * dayWidth;
                        const oldWidthPx =
                          oldTask.type === 'milestone'
                            ? 12
                            : Math.max(dayWidth, oldTask.durationDays * dayWidth);

                        return (
                          <div
                            key={rev.id}
                            style={{
                              left: `${oldLeftPx}px`,
                              top: `${34 + revIdx * 10}px`,
                            }}
                            className="absolute flex items-center z-0"
                            title={`${rev.version} 原訂: ${oldTask.startDate} ~ ${oldTask.endDate} (${oldTask.durationDays}d)`}
                          >
                            {oldTask.type === 'milestone' ? (
                              <div className="flex items-center gap-1.5">
                                <div
                                  className={`w-3 h-3 rotate-45 border-2 border-dashed bg-white ${style.border}`}
                                />
                                <span
                                  className={`text-[10px] font-mono-tabular whitespace-nowrap ${style.text}`}
                                >
                                  {rev.version} {formatMonthDay(oldTask.startDate)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <div
                                  style={{ width: `${oldWidthPx}px` }}
                                  className={`h-2.5 rounded-sm border border-dashed ${style.border} ${style.hatchClass}`}
                                />
                                <span
                                  className={`text-[10px] font-mono-tabular whitespace-nowrap ${style.text}`}
                                >
                                  {rev.version} ({oldTask.durationDays}d)
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
