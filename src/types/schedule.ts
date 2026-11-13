export type TaskType = 'task' | 'milestone';

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_client'
  | 'completed'
  | 'delayed';

export type PhaseColor = 'amber' | 'blue' | 'red' | 'emerald';

export type RevisionCategory =
  | '初始基準'
  | '客戶延遲'
  | '需求變更'
  | '技術調整'
  | '測試複驗';

export interface PhaseInfo {
  id: string;
  code: string;
  name: string;
  color: PhaseColor;
}

export interface ScheduleTask {
  id: string;
  phaseId: string;
  name: string;
  type: TaskType;
  startDate: string; // YYYY-MM-DD
  durationDays: number; // >= 1 for task, 0 for milestone
  endDate: string; // YYYY-MM-DD
  owner: string;
  status: TaskStatus;
  progress: number; // 0-100
  dependsOn: string | null;
  tags?: string[]; // e.g., deliverable callouts above/below milestone node
  notes?: string;
  dateSubLabel?: string; // e.g., "d+20"
}

export interface CheckpointItem {
  id: string;
  date: string; // e.g., "10/26" or "2026-10-26"
  title: string;
  owner: string;
  note: string;
  version: string;
}

export interface PlanRevision {
  id: string;
  version: string; // e.g. "v1.0"
  title: string;
  createdAt: string; // YYYY-MM-DD HH:mm
  author: string;
  category: RevisionCategory;
  reason: string;
  impactSummary: string;
  snapshotTasks: ScheduleTask[];
  snapshotPhases: PhaseInfo[];
}

export interface IssueSnapshot {
  total: number;
  resolved: number;
  unresolved: number;
  pendingLabel: string;
}

export interface ProjectPlan {
  id: string;
  code: string; // e.g. P260102
  name: string;
  owner: string;
  referenceDate: string; // e.g. 2026-11-09
  issueStats: IssueSnapshot;
  pendingNote: string;
  phases: PhaseInfo[];
  tasks: ScheduleTask[];
  checkpoints: CheckpointItem[];
  revisions: PlanRevision[];
}

export type ViewMode = 'tasks' | 'milestone' | 'gantt' | 'diff';

export type ZoomLevel = 'day' | 'week' | 'month';

export type DiffStatus =
  | 'unchanged'
  | 'shifted'
  | 'duration_changed'
  | 'shifted_and_resized'
  | 'added'
  | 'removed';

export interface TaskDiff {
  taskId: string;
  taskName: string;
  taskType: TaskType;
  phaseId: string;
  baseTask: ScheduleTask | null;
  targetTask: ScheduleTask | null;
  startDeltaDays: number;
  endDeltaDays: number;
  durationDeltaDays: number;
  status: DiffStatus;
}
