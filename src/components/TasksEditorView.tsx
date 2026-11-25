import { useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowRight,
  GitCommitHorizontal,
  Link2,
  Minus,
  Flag,
  CheckSquare,
} from 'lucide-react';
import {
  PhaseInfo,
  ScheduleTask,
  TaskStatus,
  TaskType,
} from '../types/schedule';
import {
  cascadeDownstreamTasks,
  computeDurationDays,
  computeEndDate,
  formatMonthDay,
  getTaskStatusLabel,
} from '../utils/dateUtils';

interface TasksEditorViewProps {
  phases: PhaseInfo[];
  tasks: ScheduleTask[];
  onChangeTasks: (nextTasks: ScheduleTask[]) => void;
  onSwitchToMilestone: () => void;
  onSwitchToGantt: () => void;
}

export function TasksEditorView({
  phases,
  tasks,
  onChangeTasks,
  onSwitchToMilestone,
  onSwitchToGantt,
}: TasksEditorViewProps) {
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [autoCascade, setAutoCascade] = useState<boolean>(true);
  const [editingTagsTaskId, setEditingTagsTaskId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState<string>('');

  // Quick Add Task State
  const [showAddRow, setShowAddRow] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TaskType>('task');
  const [newPhaseId, setNewPhaseId] = useState<string>(phases[0]?.id || 'p1');
  const [newStartDate, setNewStartDate] = useState<string>(
    tasks[tasks.length - 1]?.endDate || '2026-11-12',
  );
  const [newDuration, setNewDuration] = useState<number>(7);
  const [newOwner, setNewOwner] = useState<string>('負責人');
  const [newDependsOn, setNewDependsOn] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');

  const filteredTasks =
    phaseFilter === 'all' ? tasks : tasks.filter((t) => t.phaseId === phaseFilter);

  const totalTasks = tasks.filter((t) => t.type === 'task').length;
  const totalMilestones = tasks.filter((t) => t.type === 'milestone').length;
  const projectStart =
    tasks.length > 0
      ? [...tasks].sort((a, b) => a.startDate.localeCompare(b.startDate))[0].startDate
      : '';
  const projectEnd =
    tasks.length > 0
      ? [...tasks].sort((a, b) => a.endDate.localeCompare(b.endDate))[tasks.length - 1].endDate
      : '';

  const updateTask = (taskId: string, patch: Partial<ScheduleTask>) => {
    let next = tasks.map((t) => {
      if (t.id !== taskId) return t;
      const merged = { ...t, ...patch };
      if (merged.type === 'milestone') {
        merged.durationDays = 0;
        merged.endDate = merged.startDate;
      } else {
        if (patch.startDate !== undefined || patch.durationDays !== undefined) {
          const safeDuration = Math.max(1, merged.durationDays || 1);
          merged.durationDays = safeDuration;
          merged.endDate = computeEndDate(merged.startDate, safeDuration, false);
        } else if (patch.endDate !== undefined) {
          merged.durationDays = computeDurationDays(merged.startDate, merged.endDate, false);
          merged.endDate = computeEndDate(merged.startDate, merged.durationDays, false);
        }
      }
      return merged;
    });

    if (
      autoCascade &&
      (patch.startDate !== undefined ||
        patch.durationDays !== undefined ||
        patch.endDate !== undefined)
    ) {
      next = cascadeDownstreamTasks(next, taskId);
    }

    onChangeTasks(next);
  };

  const handleAdjustDuration = (task: ScheduleTask, delta: number) => {
    if (task.type === 'milestone') return;
    const nextDuration = Math.max(1, task.durationDays + delta);
    updateTask(task.id, { durationDays: nextDuration });
  };

  const handleDeleteTask = (taskId: string) => {
    const next = tasks
      .filter((t) => t.id !== taskId)
      .map((t) => (t.dependsOn === taskId ? { ...t, dependsOn: null } : t));
    onChangeTasks(next);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const isMilestone = newType === 'milestone';
    const dur = isMilestone ? 0 : Math.max(1, newDuration);
    const endDate = computeEndDate(newStartDate, dur, isMilestone);
    const created: ScheduleTask = {
      id: `task-${Date.now()}`,
      phaseId: newPhaseId,
      name: newName.trim(),
      type: newType,
      startDate: newStartDate,
      durationDays: dur,
      endDate,
      owner: newOwner.trim() || '未指派',
      status: 'not_started',
      progress: 0,
      dependsOn: newDependsOn || null,
      notes: newNotes.trim() || undefined,
      tags: isMilestone ? [] : undefined,
    };
    onChangeTasks([...tasks, created]);
    setNewName('');
    setNewNotes('');
    setShowAddRow(false);
  };

  const openTagEditor = (task: ScheduleTask) => {
    setEditingTagsTaskId(task.id);
    setTagDraft((task.tags || []).join(', '));
  };

  const saveTagEditor = (taskId: string) => {
    const parsed = tagDraft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateTask(taskId, { tags: parsed });
    setEditingTagsTaskId(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
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
              全部階段 ({tasks.length})
            </button>
            {phases.map((p) => {
              const count = tasks.filter((t) => t.phaseId === p.id).length;
              return (
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
                  {p.code} {p.name} ({count})
                </button>
              );
            })}
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoCascade}
              onChange={(e) => setAutoCascade(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <Link2 className="w-3.5 h-3.5 text-slate-500" />
            <span>調整工期時自動順延相依後續任務</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddRow((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增任務 / 里程碑</span>
          </button>
          <button
            type="button"
            onClick={onSwitchToMilestone}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5 text-amber-600" />
            <span>預覽 Milestone 圖</span>
          </button>
          <button
            type="button"
            onClick={onSwitchToGantt}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Gantt Chart</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Add Task Drawer Form */}
      {showAddRow && (
        <form
          onSubmit={handleCreateTask}
          className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">新增時程項目</h3>
            <span className="text-xs text-slate-500">
              設定開始日期與 Duration 工期天數後將自動同步至 Milestone 圖與 Gantt Chart
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                任務 / 里程碑名稱
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例：場域端壓力測試與資料驗證"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">類型</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as TaskType)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="task">工作任務 (Task)</option>
                <option value="milestone">里程碑 (Milestone)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">所屬階段</label>
              <select
                value={newPhaseId}
                onChange={(e) => setNewPhaseId(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">開始日期</label>
              <input
                type="date"
                required
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                工期 (Duration 天)
              </label>
              <input
                type="number"
                min={newType === 'milestone' ? 0 : 1}
                disabled={newType === 'milestone'}
                value={newType === 'milestone' ? 0 : newDuration}
                onChange={(e) => setNewDuration(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm font-mono-tabular border border-slate-200 rounded-lg disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">權責角色</label>
              <input
                type="text"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                placeholder="負責人 / 後端組"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">前置相依項目</label>
              <select
                value={newDependsOn}
                onChange={(e) => setNewDependsOn(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">無前置相依</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({formatMonthDay(t.endDate)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">說明 / 交付備註</label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="補充交付項目或驗收條件"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddRow(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
            >
              加入時程表
            </button>
          </div>
        </form>
      )}

      {/* High-density Tasks Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>工作任務 {totalTasks} 項</span>
            <span aria-hidden="true">·</span>
            <span>里程碑 {totalMilestones} 個</span>
            {projectStart && projectEnd && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">
                  總起訖：{projectStart} ～ {projectEnd}
                </span>
              </>
            )}
          </div>
          <span className="text-slate-500">直接修改開始日或工期天數即可即時重算結束日</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1040px]">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-white">
                <th className="py-2.5 px-3 w-24">階段</th>
                <th className="py-2.5 px-3 w-24">類型</th>
                <th className="py-2.5 px-3 min-w-[240px]">任務 / 里程碑名稱</th>
                <th className="py-2.5 px-3 w-36">開始日期</th>
                <th className="py-2.5 px-3 w-40">工期 (Duration)</th>
                <th className="py-2.5 px-3 w-36">結束日期</th>
                <th className="py-2.5 px-3 w-28">權責角色</th>
                <th className="py-2.5 px-3 w-28">狀態</th>
                <th className="py-2.5 px-3 w-40">前置相依</th>
                <th className="py-2.5 px-3 w-14 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    此階段目前尚無任務，請點擊右上角「新增任務 / 里程碑」建立時程。
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const phase = phases.find((p) => p.id === task.phaseId);
                  const isMilestone = task.type === 'milestone';

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="py-2.5 px-3">
                        <select
                          value={task.phaseId}
                          onChange={(e) => updateTask(task.id, { phaseId: e.target.value })}
                          className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded bg-white text-slate-700 font-mono-tabular focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {phases.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateTask(task.id, {
                              type: isMilestone ? 'task' : 'milestone',
                              durationDays: isMilestone ? 5 : 0,
                            })
                          }
                          title="點擊切換 Task / Milestone"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                            isMilestone
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {isMilestone ? (
                            <>
                              <GitCommitHorizontal className="w-3 h-3" />
                              <span>Milestone</span>
                            </>
                          ) : (
                            <>
                              <CheckSquare className="w-3 h-3" />
                              <span>Task</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={task.name}
                          onChange={(e) => updateTask(task.id, { name: e.target.value })}
                          className={`w-full px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:outline-none bg-transparent ${
                            isMilestone ? 'font-semibold text-slate-900' : 'text-slate-800'
                          }`}
                        />
                        {isMilestone && (
                          <div className="mt-1 px-2">
                            {editingTagsTaskId === task.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={tagDraft}
                                  onChange={(e) => setTagDraft(e.target.value)}
                                  placeholder="以逗號分隔交付標籤"
                                  className="flex-1 px-2 py-0.5 text-[11px] border border-indigo-300 rounded focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => saveTagEditor(task.id)}
                                  className="px-2 py-0.5 text-[11px] bg-indigo-600 text-white rounded cursor-pointer"
                                >
                                  確定
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openTagEditor(task)}
                                className="text-[11px] text-slate-500 hover:text-indigo-600 cursor-pointer text-left"
                              >
                                {task.tags && task.tags.length > 0
                                  ? `交付標籤：${task.tags.join(' · ')} (點擊編輯)`
                                  : '+ 設定 Milestone 交付物標籤'}
                              </button>
                            )}
                          </div>
                        )}
                        {task.notes && (
                          <p className="px-2 mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                            {task.notes}
                          </p>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="date"
                          value={task.startDate}
                          onChange={(e) => updateTask(task.id, { startDate: e.target.value })}
                          className="w-full px-2 py-1 font-mono-tabular text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        {isMilestone ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-1 text-xs font-mono-tabular text-amber-700 bg-amber-50 rounded">
                              0d (里程碑點)
                            </span>
                            <input
                              type="text"
                              value={task.dateSubLabel || ''}
                              placeholder="d+20"
                              onChange={(e) =>
                                updateTask(task.id, { dateSubLabel: e.target.value })
                              }
                              title="選填里程碑補充標記（如 d+20）"
                              className="w-14 px-1.5 py-1 text-[11px] font-mono-tabular border border-slate-200 rounded text-slate-700"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustDuration(task, -1)}
                              className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                              title="減少 1 天"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                min={1}
                                value={task.durationDays}
                                onChange={(e) =>
                                  updateTask(task.id, {
                                    durationDays: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="w-14 px-2 py-1 text-center font-mono-tabular text-xs font-semibold border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <span className="ml-1 text-[11px] text-slate-500">天</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAdjustDuration(task, 1)}
                              className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                              title="增加 1 天"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="date"
                          disabled={isMilestone}
                          value={task.endDate}
                          onChange={(e) => updateTask(task.id, { endDate: e.target.value })}
                          className="w-full px-2 py-1 font-mono-tabular text-xs border border-slate-200 rounded bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={task.owner}
                          onChange={(e) => updateTask(task.id, { owner: e.target.value })}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            updateTask(task.id, { status: e.target.value as TaskStatus })
                          }
                          className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                            task.status === 'completed'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : task.status === 'delayed'
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : task.status === 'waiting_client'
                                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                                  : task.status === 'in_progress'
                                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                                    : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <option value="not_started">{getTaskStatusLabel('not_started')}</option>
                          <option value="in_progress">{getTaskStatusLabel('in_progress')}</option>
                          <option value="waiting_client">
                            {getTaskStatusLabel('waiting_client')}
                          </option>
                          <option value="completed">{getTaskStatusLabel('completed')}</option>
                          <option value="delayed">{getTaskStatusLabel('delayed')}</option>
                        </select>
                      </td>

                      <td className="py-2.5 px-3">
                        <select
                          value={task.dependsOn || ''}
                          onChange={(e) =>
                            updateTask(task.id, { dependsOn: e.target.value || null })
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">無前置</option>
                          {tasks
                            .filter((other) => other.id !== task.id)
                            .map((other) => (
                              <option key={other.id} value={other.id}>
                                {other.name.slice(0, 14)}
                              </option>
                            ))}
                        </select>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title={`刪除 ${phase?.code || ''} 項目`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
