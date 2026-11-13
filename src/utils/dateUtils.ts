import { PhaseInfo, ScheduleTask, TaskDiff, DiffStatus } from '../types/schedule';

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const dt = parseDate(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatISO(dt);
}

export function diffDays(startStr: string, endStr: string): number {
  const a = parseDate(startStr);
  const b = parseDate(endStr);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

export function computeEndDate(startDate: string, durationDays: number, isMilestone: boolean): string {
  if (isMilestone || durationDays <= 0) {
    return startDate;
  }
  return addDays(startDate, durationDays - 1);
}

export function computeDurationDays(startDate: string, endDate: string, isMilestone: boolean): number {
  if (isMilestone) return 0;
  const d = diffDays(startDate, endDate) + 1;
  return d < 1 ? 1 : d;
}

export function formatMonthDay(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

export function formatROCDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y - 1911}.${m}.${d}`;
}

export interface PhaseComputedRange {
  phase: PhaseInfo;
  startDate: string;
  endDate: string;
  durationDays: number;
  tasks: ScheduleTask[];
}

export function computePhaseRanges(
  phases: PhaseInfo[],
  tasks: ScheduleTask[],
): PhaseComputedRange[] {
  return phases.map((phase) => {
    const phaseTasks = tasks.filter((t) => t.phaseId === phase.id);
    if (phaseTasks.length === 0) {
      return {
        phase,
        startDate: '',
        endDate: '',
        durationDays: 0,
        tasks: [],
      };
    }
    const sortedStarts = [...phaseTasks].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const sortedEnds = [...phaseTasks].sort((a, b) => a.endDate.localeCompare(b.endDate));
    const startDate = sortedStarts[0].startDate;
    const endDate = sortedEnds[sortedEnds.length - 1].endDate;
    const durationDays = diffDays(startDate, endDate) + 1;
    return {
      phase,
      startDate,
      endDate,
      durationDays: durationDays < 1 ? 1 : durationDays,
      tasks: phaseTasks,
    };
  });
}

export function computeTaskDiffs(
  baseTasks: ScheduleTask[],
  targetTasks: ScheduleTask[],
): TaskDiff[] {
  const baseMap = new Map(baseTasks.map((t) => [t.id, t]));
  const targetMap = new Map(targetTasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const diffs: TaskDiff[] = [];

  for (const target of targetTasks) {
    seen.add(target.id);
    const base = baseMap.get(target.id) || null;
    if (!base) {
      diffs.push({
        taskId: target.id,
        taskName: target.name,
        taskType: target.type,
        phaseId: target.phaseId,
        baseTask: null,
        targetTask: target,
        startDeltaDays: 0,
        endDeltaDays: 0,
        durationDeltaDays: target.durationDays,
        status: 'added',
      });
      continue;
    }

    const startDeltaDays = diffDays(base.startDate, target.startDate);
    const endDeltaDays = diffDays(base.endDate, target.endDate);
    const durationDeltaDays = target.durationDays - base.durationDays;

    let status: DiffStatus = 'unchanged';
    if (startDeltaDays !== 0 && durationDeltaDays !== 0) {
      status = 'shifted_and_resized';
    } else if (startDeltaDays !== 0 || endDeltaDays !== 0) {
      status = 'shifted';
    } else if (durationDeltaDays !== 0) {
      status = 'duration_changed';
    }

    diffs.push({
      taskId: target.id,
      taskName: target.name,
      taskType: target.type,
      phaseId: target.phaseId,
      baseTask: base,
      targetTask: target,
      startDeltaDays,
      endDeltaDays,
      durationDeltaDays,
      status,
    });
  }

  for (const base of baseTasks) {
    if (!seen.has(base.id)) {
      diffs.push({
        taskId: base.id,
        taskName: base.name,
        taskType: base.type,
        phaseId: base.phaseId,
        baseTask: base,
        targetTask: null,
        startDeltaDays: 0,
        endDeltaDays: 0,
        durationDeltaDays: -base.durationDays,
        status: 'removed',
      });
    }
  }

  return diffs;
}

export function formatDeltaDays(delta: number): string {
  if (delta === 0) return '0d';
  return delta > 0 ? `+${delta}d` : `${delta}d`;
}

export function getTaskStatusLabel(status: ScheduleTask['status']): string {
  switch (status) {
    case 'completed':
      return '已完成';
    case 'in_progress':
      return '進行中';
    case 'waiting_client':
      return '待客戶確認';
    case 'delayed':
      return '時程延遲';
    default:
      return '未開始';
  }
}

export function cascadeDownstreamTasks(
  tasks: ScheduleTask[],
  changedTaskId: string,
): ScheduleTask[] {
  const updated = tasks.map((t) => ({ ...t }));
  const queue = [changedTaskId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    if (visited.has(parentId)) continue;
    visited.add(parentId);

    const parent = updated.find((t) => t.id === parentId);
    if (!parent) continue;

    for (const child of updated) {
      if (child.dependsOn === parentId) {
        const nextStart = addDays(parent.endDate, parent.type === 'milestone' ? 0 : 1);
        child.startDate = nextStart;
        child.endDate = computeEndDate(nextStart, child.durationDays, child.type === 'milestone');
        queue.push(child.id);
      }
    }
  }
  return updated;
}
