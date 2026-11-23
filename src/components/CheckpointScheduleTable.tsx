import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Flag, Link2, ListPlus, Plus, Trash2 } from 'lucide-react';
import { CheckpointItem, CheckpointTask, ProjectPlan } from '../types/schedule';
import { formatISO } from '../utils/dateUtils';
import { formatMonthDay } from '../utils/dateUtils';
import { computeCheckpointSummary, nextWorkingDay } from '../utils/workCalendar';

interface CheckpointScheduleTableProps {
  project: ProjectPlan;
  onUpdateCheckpoints: (next: CheckpointItem[]) => void;
}

/** Text/number input that keeps a local draft and only commits on blur / Enter (避免每個按鍵都寫入 Firestore). */
function CommitInput({
  value,
  onCommit,
  type = 'text',
  className = '',
  placeholder,
  min,
}: {
  value: string | number;
  onCommit: (v: string) => void;
  type?: 'text' | 'number';
  className?: string;
  placeholder?: string;
  min?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    if (draft !== String(value)) onCommit(draft);
  };
  return (
    <input
      type={type}
      min={min}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={`px-1.5 py-1 text-xs border border-transparent hover:border-slate-200 focus:border-indigo-400 rounded bg-transparent focus:bg-white focus:outline-none ${className}`}
    />
  );
}

/** Normalise legacy "10/26" style dates to M/D display */
function displayCheckpointDate(date: string) {
  return date.includes('-') ? formatMonthDay(date) : date;
}

export function CheckpointScheduleTable({ project, onUpdateCheckpoints }: CheckpointScheduleTableProps) {
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [cpDate, setCpDate] = useState('');
  const [cpTitle, setCpTitle] = useState('');
  const [cpOwner, setCpOwner] = useState(project.owner);
  const [cpNote, setCpNote] = useState('');
  const [cpVersion, setCpVersion] = useState(
    project.revisions[project.revisions.length - 1]?.version.replace('v', '') || '1.0',
  );

  const checkpoints = project.checkpoints;

  /** Replace one checkpoint; if it has tasks, keep its `date` in sync with the computed milestone end date. */
  const commitCheckpoint = (next: CheckpointItem) => {
    const summary = computeCheckpointSummary(next);
    const withDate = summary ? { ...next, date: summary.endDate } : next;
    onUpdateCheckpoints(checkpoints.map((c) => (c.id === next.id ? withDate : c)));
  };

  const updateTask = (cp: CheckpointItem, taskId: string, patch: Partial<CheckpointTask>) => {
    commitCheckpoint({
      ...cp,
      tasks: (cp.tasks || []).map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    });
  };

  const addTask = (cp: CheckpointItem) => {
    const existing = cp.tasks || [];
    const today = nextWorkingDay(formatISO(new Date()));
    const task: CheckpointTask = {
      id: `cpt-${Date.now()}`,
      title: `Task ${existing.length + 1}`,
      owner: cp.owner,
      startDate: today,
      chainPrev: existing.length > 0,
      durationDays: 5,
      oooDays: 0,
      note: '',
    };
    setCollapsed((s) => ({ ...s, [cp.id]: false }));
    commitCheckpoint({ ...cp, tasks: [...existing, task] });
  };

  const removeTask = (cp: CheckpointItem, taskId: string) => {
    const remaining = (cp.tasks || []).filter((t) => t.id !== taskId);
    // 第一個 task 不能接續前一個
    if (remaining[0]?.chainPrev) remaining[0] = { ...remaining[0], chainPrev: false };
    const next = { ...cp, tasks: remaining };
    if (remaining.length === 0) {
      onUpdateCheckpoints(checkpoints.map((c) => (c.id === cp.id ? next : c)));
    } else {
      commitCheckpoint(next);
    }
  };

  const handleAddCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpTitle.trim()) return;
    const next: CheckpointItem = {
      id: `cp-${Date.now()}`,
      date: cpDate.trim() || '-',
      title: cpTitle.trim(),
      owner: cpOwner.trim() || project.owner,
      note: cpNote.trim(),
      version: cpVersion.trim() || '1.0',
      tasks: [],
    };
    onUpdateCheckpoints([...checkpoints, next]);
    setCpTitle('');
    setCpNote('');
    setCpDate('');
    setAdding(false);
  };

  return (
    <div className="pt-2 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h3 className="text-sm font-bold text-slate-900">查核點時程與溝通紀錄</h3>
          <span className="text-[11px] text-slate-500">
            End = Start + Duration（工作天）+ Holiday（週六日／國定假日）+ OOO
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer no-print"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新增查核點（Milestone）</span>
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleAddCheckpoint}
          className="grid grid-cols-1 sm:grid-cols-6 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 no-print"
        >
          <input
            type="text"
            value={cpDate}
            onChange={(e) => setCpDate(e.target.value)}
            placeholder="日期（有 task 時自動計算）"
            className="px-2.5 py-1.5 text-xs font-mono-tabular border border-slate-200 rounded bg-white"
          />
          <input
            type="text"
            required
            value={cpTitle}
            onChange={(e) => setCpTitle(e.target.value)}
            placeholder="查核點項目"
            className="sm:col-span-2 px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white"
          />
          <input
            type="text"
            value={cpOwner}
            onChange={(e) => setCpOwner(e.target.value)}
            placeholder="權責角色"
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white"
          />
          <input
            type="text"
            value={cpNote}
            onChange={(e) => setCpNote(e.target.value)}
            placeholder="說明 / 回覆紀錄"
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={cpVersion}
              onChange={(e) => setCpVersion(e.target.value)}
              placeholder="版本"
              className="w-16 px-2 py-1.5 text-xs font-mono-tabular border border-slate-200 rounded bg-white"
            />
            <button
              type="submit"
              className="flex-1 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded cursor-pointer"
            >
              加入
            </button>
          </div>
        </form>
      )}

      <div className="border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left border-collapse text-xs">
          <thead>
            <tr className="bg-amber-50/70 border-b border-slate-200 text-slate-700 font-semibold">
              <th className="py-2 px-3 w-14 text-center">項次</th>
              <th className="py-2 px-3">項目</th>
              <th className="py-2 px-3 w-24">權責角色</th>
              <th className="py-2 px-2 w-36">Start</th>
              <th className="py-2 px-2 w-20 text-center">Duration</th>
              <th className="py-2 px-2 w-20 text-center">Holiday</th>
              <th className="py-2 px-2 w-16 text-center">OOO</th>
              <th className="py-2 px-2 w-24">End</th>
              <th className="py-2 px-3">說明</th>
              <th className="py-2 px-3 w-16 text-center">版本</th>
              <th className="py-2 px-3 w-16 text-right no-print" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {checkpoints.map((cp, index) => {
              const summary = computeCheckpointSummary(cp);
              const isCollapsed = !!collapsed[cp.id];
              const hasTasks = !!summary;
              return (
                <Fragment key={cp.id}>
                  {/* Milestone row */}
                  <tr className="bg-slate-50/60 hover:bg-slate-50">
                    <td className="py-2 px-3 text-center font-mono-tabular text-slate-500">
                      <div className="flex items-center justify-center gap-0.5">
                        {hasTasks ? (
                          <button
                            type="button"
                            onClick={() => setCollapsed((s) => ({ ...s, [cp.id]: !isCollapsed }))}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer no-print"
                            title={isCollapsed ? '展開 task' : '收合 task'}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-3.5" />
                        )}
                        <span>{index + 1}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      <span className="inline-flex items-center gap-1.5">
                        <Flag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        {cp.title}
                        {hasTasks && (
                          <span className="text-[10px] font-normal text-slate-500">
                            （{summary.tasks.length} 項 task）
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700">{cp.owner}</td>
                    <td className="py-2 px-2 font-mono-tabular font-medium text-slate-800">
                      {hasTasks ? formatMonthDay(summary.startDate) : '—'}
                    </td>
                    <td className="py-2 px-2 text-center font-mono-tabular font-semibold text-slate-800">
                      {hasTasks ? `${summary.durationDays}d` : '—'}
                    </td>
                    <td className="py-2 px-2 text-center font-mono-tabular text-slate-600">
                      {hasTasks ? `${summary.holidayDays}d` : '—'}
                    </td>
                    <td className="py-2 px-2 text-center font-mono-tabular text-slate-600">
                      {hasTasks ? `${summary.oooDays}d` : '—'}
                    </td>
                    <td className="py-2 px-2 font-mono-tabular font-bold text-amber-700">
                      {hasTasks ? formatMonthDay(summary.endDate) : displayCheckpointDate(cp.date)}
                      {hasTasks && (
                        <span className="block text-[10px] font-normal text-slate-500">
                          共 {summary.calendarDays} 日曆天
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-600">{cp.note}</td>
                    <td className="py-2 px-3 text-center font-mono-tabular text-slate-700">
                      {cp.version}
                    </td>
                    <td className="py-2 px-3 text-right no-print whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => addTask(cp)}
                        className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                        title="新增 task"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateCheckpoints(checkpoints.filter((c) => c.id !== cp.id))}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="刪除查核點"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>

                  {/* Task rows */}
                  {hasTasks &&
                    !isCollapsed &&
                    summary.tasks.map((t, tIdx) => {
                      const canChain = tIdx > 0;
                      const chained = canChain && t.chainPrev;
                      return (
                        <tr key={t.id} className="hover:bg-indigo-50/30">
                          <td className="py-1.5 px-3 text-center font-mono-tabular text-[11px] text-slate-400">
                            {index + 1}.{tIdx + 1}
                          </td>
                          <td className="py-1.5 pl-8 pr-2">
                            <CommitInput
                              value={t.title}
                              onCommit={(v) => updateTask(cp, t.id, { title: v.trim() || t.title })}
                              className="w-full text-slate-800"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <CommitInput
                              value={t.owner}
                              onCommit={(v) => updateTask(cp, t.id, { owner: v.trim() })}
                              className="w-full text-slate-700"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-1">
                              {chained ? (
                                <span
                                  className="px-1.5 py-1 font-mono-tabular text-slate-700"
                                  title="接續上一個 task 完成後的下一個工作天"
                                >
                                  {formatMonthDay(t.span.startDate)}
                                </span>
                              ) : (
                                <input
                                  type="date"
                                  value={t.span.startDate}
                                  onChange={(e) =>
                                    e.target.value && updateTask(cp, t.id, { startDate: e.target.value })
                                  }
                                  className="w-[118px] px-1 py-0.5 text-xs font-mono-tabular border border-slate-200 rounded bg-white"
                                />
                              )}
                              {canChain && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateTask(cp, t.id, {
                                      chainPrev: !t.chainPrev,
                                      startDate: t.span.startDate,
                                    })
                                  }
                                  className={`p-0.5 rounded cursor-pointer no-print ${
                                    chained
                                      ? 'text-indigo-600 bg-indigo-50'
                                      : 'text-slate-300 hover:text-slate-500'
                                  }`}
                                  title={chained ? '已接續上一個 task（點擊改為自訂開始日）' : '改為接續上一個 task'}
                                >
                                  <Link2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <CommitInput
                              type="number"
                              min={0}
                              value={t.durationDays}
                              onCommit={(v) =>
                                updateTask(cp, t.id, { durationDays: Math.max(0, Math.floor(Number(v) || 0)) })
                              }
                              className="w-14 text-center font-mono-tabular"
                            />
                          </td>
                          <td
                            className="py-1.5 px-2 text-center font-mono-tabular text-slate-500"
                            title="期間內的週六日與國定假日（自動計算）"
                          >
                            {t.span.holidayDays}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <CommitInput
                              type="number"
                              min={0}
                              value={t.oooDays}
                              onCommit={(v) =>
                                updateTask(cp, t.id, { oooDays: Math.max(0, Math.floor(Number(v) || 0)) })
                              }
                              className="w-12 text-center font-mono-tabular"
                            />
                          </td>
                          <td className="py-1.5 px-2 font-mono-tabular font-medium text-slate-800">
                            {formatMonthDay(t.span.endDate)}
                          </td>
                          <td className="py-1.5 px-2" colSpan={2}>
                            <CommitInput
                              value={t.note}
                              placeholder="備註"
                              onCommit={(v) => updateTask(cp, t.id, { note: v.trim() })}
                              className="w-full text-slate-600"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right no-print">
                            <button
                              type="button"
                              onClick={() => removeTask(cp, t.id)}
                              className="p-1 text-slate-300 hover:text-rose-600 cursor-pointer"
                              title="刪除 task"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
