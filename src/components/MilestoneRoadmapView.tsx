import { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { CheckpointScheduleTable } from './CheckpointScheduleTable';
import {
  CheckpointItem,
  PlanRevision,
  ProjectPlan,
  ScheduleTask,
} from '../types/schedule';
import {
  computePhaseRanges,
  diffDays,
  formatDeltaDays,
  formatMonthDay,
  formatROCDate,
} from '../utils/dateUtils';
import { BASELINE_COLORS } from './BaselineCompareBar';

interface MilestoneRoadmapViewProps {
  project: ProjectPlan;
  checkedRevisions: PlanRevision[];
  onSwitchToGantt: () => void;
  onUpdateCheckpoints: (nextCheckpoints: CheckpointItem[]) => void;
  onUpdatePendingNote: (nextNote: string) => void;
}

export function MilestoneRoadmapView({
  project,
  checkedRevisions,
  onSwitchToGantt,
  onUpdateCheckpoints,
  onUpdatePendingNote,
}: MilestoneRoadmapViewProps) {
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);

  const milestones = [...project.tasks]
    .filter((t) => t.type === 'milestone')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const phaseRanges = computePhaseRanges(project.phases, project.tasks);

  // Compute timeline bounds across current tasks AND checked revisions so ghost points fit nicely
  const allDates: string[] = [];
  milestones.forEach((m) => allDates.push(m.startDate));
  checkedRevisions.forEach((rev) => {
    rev.snapshotTasks
      .filter((t) => t.type === 'milestone')
      .forEach((m) => allDates.push(m.startDate));
  });
  const sortedAllDates = [...allDates].sort();
  const minDate = sortedAllDates[0] || '2026-05-01';
  const maxDate = sortedAllDates[sortedAllDates.length - 1] || '2026-12-01';
  const totalSpanDays = Math.max(14, diffDays(minDate, maxDate));

  const getPositionPct = (dateStr: string) => {
    const offset = diffDays(minDate, dateStr);
    // Keep 7% padding on left and right edges
    return 7 + (offset / totalSpanDays) * 86;
  };

  const getMilestoneRingStyle = (m: ScheduleTask) => {
    if (m.status === 'completed') return 'border-emerald-600 bg-white';
    if (m.status === 'delayed') return 'border-rose-600 bg-white';
    if (m.status === 'waiting_client') return 'border-red-600 bg-white';
    if (m.phaseId === 'p1') return 'border-amber-500 bg-white';
    return 'border-indigo-600 bg-white';
  };

  const getPhaseBarStyle = (color: string) => {
    switch (color) {
      case 'amber':
        return 'bg-amber-400 text-slate-900 border-amber-500/40';
      case 'blue':
        return 'bg-sky-600 text-white border-sky-700/40';
      case 'red':
        return 'bg-red-600 text-white border-red-700/40';
      default:
        return 'bg-emerald-600 text-white border-emerald-700/40';
    }
  };

  const getPhaseBoxBorder = (color: string) => {
    switch (color) {
      case 'amber':
        return 'border-amber-300 bg-amber-50/30';
      case 'blue':
        return 'border-sky-300 bg-sky-50/30';
      case 'red':
        return 'border-red-300 bg-red-50/30';
      default:
        return 'border-emerald-300 bg-emerald-50/30';
    }
  };

  const selectedMilestone = milestones.find((m) => m.id === selectedMilestoneId) || null;

  return (
    <div className="space-y-5">
      {/* Executive Milestone Briefing Canvas */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        {/* Briefing Header: Title + Status Snapshot + Quick Gantt CTA */}
        <div className="flex flex-wrap items-start justify-between gap-6 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {project.name} · 驗收時程與里程碑圖
              </h2>
              <span className="text-sm font-mono-tabular text-slate-500">
                基準日 {formatROCDate(project.referenceDate)} ({project.referenceDate})
              </span>
            </div>
            <p className="text-xs text-slate-500">
              專案編號 {project.code} · 負責人 {project.owner} · 共 {milestones.length} 個關鍵里程碑
              {checkedRevisions.length > 0 && (
                <span className="text-amber-700 font-medium">
                  {' '}
                  · 正與 {checkedRevisions.map((r) => r.version).join(' / ')} 歷史基準重疊對照中
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            {/* Status Snapshot Strip */}
            <div className="flex items-center gap-5 text-xs">
              <div className="space-y-0.5">
                <div className="text-[11px] text-slate-500 font-medium">狀態快照</div>
                <div className="flex items-baseline gap-3 font-mono-tabular">
                  <span className="text-base font-bold text-slate-900">
                    {project.issueStats.total}{' '}
                    <span className="text-xs font-normal text-slate-600">項問題</span>
                  </span>
                  <span className="text-emerald-700 font-semibold">
                    {project.issueStats.resolved} 已解決
                  </span>
                  <span className="text-rose-700 font-semibold">
                    {project.issueStats.unresolved} 未解
                  </span>
                  <span className="text-amber-700 font-medium">
                    {project.issueStats.pendingLabel}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onSwitchToGantt}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer no-print"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Gantt Chart 甘特圖</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Main Horizontal Milestone Timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">主時程 Milestone 軸線</h3>
            <span className="text-xs text-slate-500">
              點擊任一里程碑節點可查看詳細交付物與歷次版本異動原因
            </span>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="relative min-w-[920px] pt-24 pb-24 px-4">
              {/* Primary horizontal axis line */}
              <div className="relative h-1 bg-slate-800 rounded-full">
                <div className="absolute right-0 -top-1 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[9px] border-l-slate-800" />
              </div>

              {/* Ghost Baseline Milestones for Checked Revisions */}
              {checkedRevisions.map((rev, revIdx) => {
                const style = BASELINE_COLORS[revIdx % BASELINE_COLORS.length];
                const ghostMilestones = rev.snapshotTasks.filter((t) => t.type === 'milestone');

                return ghostMilestones.map((gm) => {
                  const currentM = milestones.find((cm) => cm.id === gm.id);
                  const gx = getPositionPct(gm.startDate);
                  const cx = currentM ? getPositionPct(currentM.startDate) : gx;
                  const delta = currentM ? diffDays(gm.startDate, currentM.startDate) : 0;

                  // Render ghost marker if date shifted or current milestone removed
                  if (currentM && delta === 0) return null;

                  const leftPct = Math.min(gx, cx);
                  const widthPct = Math.abs(cx - gx);

                  return (
                    <div key={`${rev.id}-${gm.id}`}>
                      {/* Dashed connector line showing shift between old date & new date */}
                      {currentM && widthPct > 0.5 && (
                        <div
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            top: `${96 - 18 - revIdx * 16}px`,
                          }}
                          className={`absolute h-3 border-t-2 border-dashed ${style.border} pointer-events-none flex items-center justify-center`}
                        >
                          <span
                            className={`-mt-5 px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-semibold ${style.bgSoft} ${style.text} border ${style.border}`}
                          >
                            {rev.version} {formatDeltaDays(delta)}
                          </span>
                        </div>
                      )}

                      {/* Ghost node */}
                      <div
                        style={{ left: `${gx}%`, top: '96px' }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
                        title={`${rev.version} 原訂 ${gm.name} (${formatMonthDay(gm.startDate)})`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border-2 border-dashed bg-white/90 ${style.border} opacity-90`}
                        />
                        <div
                          className={`mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono-tabular whitespace-nowrap ${style.bgSoft} ${style.text}`}
                        >
                          {rev.version} 原訂 {formatMonthDay(gm.startDate)}
                        </div>
                      </div>
                    </div>
                  );
                });
              })}

              {/* Current Plan Milestone Nodes */}
              {milestones.map((m) => {
                const x = getPositionPct(m.startDate);
                const isSelected = selectedMilestoneId === m.id;

                // Compare against oldest checked revision for primary delta display
                const primaryRev = checkedRevisions[0];
                const primaryOld = primaryRev?.snapshotTasks.find((t) => t.id === m.id);
                const primaryDelta = primaryOld ? diffDays(primaryOld.startDate, m.startDate) : 0;

                return (
                  <div
                    key={m.id}
                    style={{ left: `${x}%`, top: '96px' }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                  >
                    {/* Deliverable tags above node */}
                    {m.tags && m.tags.length > 0 && (
                      <div className="absolute bottom-7 flex flex-col items-center gap-1 w-40">
                        {m.tags.map((tag, i) => (
                          <div
                            key={i}
                            className="px-2 py-1 bg-slate-700 text-white text-[11px] font-medium rounded text-center leading-tight shadow-sm"
                          >
                            {tag}
                          </div>
                        ))}
                        <div className="w-px h-2 bg-slate-400" />
                      </div>
                    )}

                    {/* Clickable Node Circle */}
                    <button
                      type="button"
                      onClick={() => setSelectedMilestoneId(isSelected ? null : m.id)}
                      className={`w-6 h-6 rounded-full border-[4px] flex items-center justify-center transition-transform cursor-pointer ${getMilestoneRingStyle(
                        m,
                      )} ${isSelected ? 'scale-125 ring-4 ring-indigo-200' : 'hover:scale-110'}`}
                      title={`${m.name} (${m.startDate})`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                    </button>

                    {/* Label & Date below node */}
                    <div className="absolute top-8 flex flex-col items-center text-center w-32">
                      <span className="text-xs font-bold text-slate-900 leading-snug">
                        {m.name}
                      </span>
                      <span className="text-sm font-bold font-mono-tabular text-amber-700 mt-0.5">
                        {m.dateSubLabel ? m.dateSubLabel : formatMonthDay(m.startDate)}
                      </span>
                      {m.dateSubLabel && (
                        <span className="text-[11px] font-mono-tabular text-slate-500">
                          ({formatMonthDay(m.startDate)})
                        </span>
                      )}
                      {primaryOld && primaryDelta !== 0 && (
                        <span
                          className={`mt-0.5 text-[11px] font-mono-tabular font-semibold ${
                            primaryDelta > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          較 {primaryRev.version} {formatDeltaDays(primaryDelta)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Milestone Attribution & Boss Q&A Drawer */}
          {selectedMilestone && (
            <div className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span>{selectedMilestone.name}</span>
                  <span className="font-mono-tabular text-indigo-700">
                    {selectedMilestone.startDate}
                  </span>
                  <span className="text-xs font-normal text-slate-500">
                    · 負責人：{selectedMilestone.owner}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMilestoneId(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  關閉說明
                </button>
              </div>
              {selectedMilestone.notes && (
                <p className="text-xs text-slate-700">{selectedMilestone.notes}</p>
              )}

              {/* Show timeline across all saved revisions for this milestone */}
              <div className="pt-2 border-t border-indigo-200/70">
                <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
                  歷次版本日期與修正原因追蹤（老闆提問對照）：
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {project.revisions.map((rev) => {
                    const snap = rev.snapshotTasks.find((t) => t.id === selectedMilestone.id);
                    const delta = snap ? diffDays(snap.startDate, selectedMilestone.startDate) : 0;
                    return (
                      <div
                        key={rev.id}
                        className="bg-white border border-slate-200 rounded p-2.5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono-tabular font-semibold text-slate-900">
                            {rev.version} · {rev.category}
                          </span>
                          <span className="font-mono-tabular text-slate-700">
                            {snap ? formatMonthDay(snap.startDate) : '當時尚未建立'}
                            {snap && delta !== 0 && (
                              <span
                                className={
                                  delta > 0 ? ' text-rose-600 ml-1' : ' text-emerald-600 ml-1'
                                }
                              >
                                ({formatDeltaDays(delta)})
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">
                          {rev.reason}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Phase Chevron Strips (001 / 002 / 003) + Scope Callout Boxes + Pending Note */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
          <div className="lg:col-span-9 space-y-3">
            {/* Phase Chevrons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {phaseRanges.map((pr) => {
                // Compare phase range against first checked revision
                const baseRev = checkedRevisions[0];
                const baseRange = baseRev
                  ? computePhaseRanges(baseRev.snapshotPhases, baseRev.snapshotTasks).find(
                      (b) => b.phase.id === pr.phase.id,
                    )
                  : null;
                const endDelta =
                  baseRange && baseRange.endDate && pr.endDate
                    ? diffDays(baseRange.endDate, pr.endDate)
                    : 0;

                return (
                  <div key={pr.phase.id} className="space-y-2">
                    <div
                      className={`px-4 py-2.5 rounded-lg border flex items-center justify-between text-xs font-bold ${getPhaseBarStyle(
                        pr.phase.color,
                      )}`}
                    >
                      <span className="font-mono-tabular">
                        {pr.phase.code}{' '}
                        {pr.startDate
                          ? `${formatMonthDay(pr.startDate)}–${formatMonthDay(pr.endDate)}`
                          : '尚無任務'}
                      </span>
                      <span className="font-mono-tabular opacity-90">{pr.durationDays}d</span>
                    </div>

                    {baseRange && baseRange.startDate && endDelta !== 0 && (
                      <div className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-mono-tabular flex items-center justify-between">
                        <span>
                          {baseRev.version} 原訂：{formatMonthDay(baseRange.startDate)}–
                          {formatMonthDay(baseRange.endDate)}
                        </span>
                        <span className="font-semibold">{formatDeltaDays(endDelta)}</span>
                      </div>
                    )}

                    {/* Phase Scope Box */}
                    <div
                      className={`border rounded-lg p-3.5 min-h-[148px] ${getPhaseBoxBorder(
                        pr.phase.color,
                      )}`}
                    >
                      <div className="text-xs font-bold text-slate-900 mb-2">
                        {pr.phase.code}：{pr.phase.name}
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {pr.tasks.map((t) => (
                          <li key={t.id} className="flex items-start justify-between gap-2">
                            <span className="leading-relaxed">
                              - {t.name}
                              {t.type === 'milestone' ? ' (里程碑)' : ''}
                            </span>
                            <span className="font-mono-tabular text-[11px] text-slate-500 shrink-0">
                              {t.type === 'milestone'
                                ? formatMonthDay(t.startDate)
                                : `${t.durationDays}d`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Pending Confirmation Note Card */}
          <div className="lg:col-span-3">
            <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-4 h-full flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>補充與待確認事項</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingNote((v) => !v)}
                    className="text-[11px] text-amber-800 hover:underline cursor-pointer no-print"
                  >
                    {editingNote ? '完成' : '編輯'}
                  </button>
                </div>

                {editingNote ? (
                  <textarea
                    rows={5}
                    value={project.pendingNote}
                    onChange={(e) => onUpdatePendingNote(e.target.value)}
                    className="w-full p-2 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                ) : (
                  <div className="text-xs text-amber-950 whitespace-pre-line leading-relaxed font-medium">
                    {project.pendingNote}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-amber-200/70 space-y-1 text-[11px] text-amber-900">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    已完成任務：
                    <strong className="font-mono-tabular">
                      {project.tasks.filter((t) => t.status === 'completed').length}
                    </strong>{' '}
                    項
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                  <span>
                    待客戶確認/延遲：
                    <strong className="font-mono-tabular">
                      {
                        project.tasks.filter(
                          (t) => t.status === 'waiting_client' || t.status === 'delayed',
                        ).length
                      }
                    </strong>{' '}
                    項
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Checkpoint Schedule: Milestone → Tasks */}
        <CheckpointScheduleTable project={project} onUpdateCheckpoints={onUpdateCheckpoints} />
      </div>
    </div>
  );
}
