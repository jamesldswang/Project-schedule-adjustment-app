import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Flag,
  ListChecks,
  FileDiff,
  Plus,
  RotateCcw,
  BookmarkCheck,
  Trash2,
} from 'lucide-react';
import { SEED_PROJECTS } from './data/seedProjects';
import {
  CheckpointItem,
  PlanRevision,
  ProjectPlan,
  ScheduleTask,
  ViewMode,
} from './types/schedule';
import { computeTaskDiffs, diffDays } from './utils/dateUtils';
import { BaselineCompareBar } from './components/BaselineCompareBar';
import { TasksEditorView } from './components/TasksEditorView';
import { MilestoneRoadmapView } from './components/MilestoneRoadmapView';
import { GanttChartView } from './components/GanttChartView';
import { RevisionDiffView } from './components/RevisionDiffView';
import { SaveRevisionModal } from './components/SaveRevisionModal';
import { NewProjectModal } from './components/NewProjectModal';

const STORAGE_KEY = 'planpulse_schedule_projects_v2';

export default function App() {
  const [projects, setProjects] = useState<ProjectPlan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to seed data
    }
    return SEED_PROJECTS;
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(
    () => projects[0]?.id || SEED_PROJECTS[0].id,
  );
  const [viewMode, setViewMode] = useState<ViewMode>('milestone');
  const [checkedRevisionIds, setCheckedRevisionIds] = useState<string[]>(() => {
    const firstRev = projects[0]?.revisions[0]?.id;
    return firstRev ? [firstRev] : [];
  });

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // Ignore storage quota errors
    }
  }, [projects]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId],
  );

  // Check if current tasks differ from the latest saved revision
  const latestRevision = activeProject.revisions[activeProject.revisions.length - 1];
  const hasUnsavedChanges = useMemo(() => {
    if (!latestRevision) return false;
    const diffs = computeTaskDiffs(latestRevision.snapshotTasks, activeProject.tasks);
    return diffs.some((d) => d.status !== 'unchanged');
  }, [latestRevision, activeProject.tasks]);

  const checkedRevisions = useMemo(
    () => activeProject.revisions.filter((r) => checkedRevisionIds.includes(r.id)),
    [activeProject.revisions, checkedRevisionIds],
  );

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    const nextProj = projects.find((p) => p.id === projectId);
    const firstRev = nextProj?.revisions[0]?.id;
    setCheckedRevisionIds(firstRev ? [firstRev] : []);
  };

  const updateActiveProject = (updater: (prev: ProjectPlan) => ProjectPlan) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updater(p) : p)),
    );
  };

  const handleChangeTasks = (nextTasks: ScheduleTask[]) => {
    updateActiveProject((proj) => ({ ...proj, tasks: nextTasks }));
  };

  const handleUpdateCheckpoints = (nextCheckpoints: CheckpointItem[]) => {
    updateActiveProject((proj) => ({ ...proj, checkpoints: nextCheckpoints }));
  };

  const handleUpdatePendingNote = (nextNote: string) => {
    updateActiveProject((proj) => ({ ...proj, pendingNote: nextNote }));
  };

  const handleToggleRevision = (revId: string) => {
    setCheckedRevisionIds((prev) =>
      prev.includes(revId) ? prev.filter((id) => id !== revId) : [...prev, revId],
    );
  };

  const handleSaveRevision = (revision: PlanRevision) => {
    updateActiveProject((proj) => ({
      ...proj,
      revisions: [...proj.revisions, revision],
    }));
    setCheckedRevisionIds((prev) =>
      prev.includes(revision.id) ? prev : [...prev, revision.id],
    );
    setShowSaveModal(false);
  };

  const handleCreateProject = (newProj: ProjectPlan) => {
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setCheckedRevisionIds(newProj.revisions[0]?.id ? [newProj.revisions[0].id] : []);
    setViewMode('tasks');
    setShowNewProjectModal(false);
  };

  const handleDeleteActiveProject = () => {
    if (projects.length <= 1) return;
    const remaining = projects.filter((p) => p.id !== activeProject.id);
    setProjects(remaining);
    const nextProj = remaining[0];
    setActiveProjectId(nextProj.id);
    const firstRev = nextProj.revisions[0]?.id;
    setCheckedRevisionIds(firstRev ? [firstRev] : []);
  };

  const handleResetDemo = () => {
    setProjects(SEED_PROJECTS);
    setActiveProjectId(SEED_PROJECTS[0].id);
    setCheckedRevisionIds([SEED_PROJECTS[0].revisions[0].id]);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Summary metrics for project context bar
  const sortedStarts = [...activeProject.tasks].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const sortedEnds = [...activeProject.tasks].sort((a, b) =>
    a.endDate.localeCompare(b.endDate),
  );
  const projectStart = sortedStarts[0]?.startDate || '';
  const projectEnd = sortedEnds[sortedEnds.length - 1]?.endDate || '';
  const totalDuration =
    projectStart && projectEnd ? Math.max(1, diffDays(projectStart, projectEnd) + 1) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8 no-print">
        {/* Zone 1: Single-element Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setViewMode('milestone');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          時程對照台
        </a>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setViewMode('tasks')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer pb-0.5 ${
              viewMode === 'tasks'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            任務工期設定
          </button>
          <button
            type="button"
            onClick={() => setViewMode('milestone')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer pb-0.5 ${
              viewMode === 'milestone'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Milestone 圖
          </button>
          <button
            type="button"
            onClick={() => setViewMode('gantt')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer pb-0.5 ${
              viewMode === 'gantt'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Gantt Chart
          </button>
          <button
            type="button"
            onClick={() => setViewMode('diff')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer pb-0.5 ${
              viewMode === 'diff'
                ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            版本差異稽核
          </button>
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>儲存修訂版</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Workspace Context & View Switcher Strip */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 no-print">
          {/* Left: Project Switcher & Unboxed Metadata */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="選擇專案"
              value={activeProject.id}
              onChange={(e) => handleSelectProject(e.target.value)}
              className="px-3 py-1.5 text-sm font-bold text-slate-900 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>負責人 {activeProject.owner}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                初始基準 {activeProject.revisions[0]?.version || 'v1.0.0'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular font-semibold text-slate-700">
                現行版號 {latestRevision?.version || 'v1.0.0'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                總期程 {totalDuration} 天 ({projectStart} ~ {projectEnd})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowNewProjectModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New 專案</span>
            </button>

            {projects.length > 1 && (
              <button
                type="button"
                onClick={handleDeleteActiveProject}
                title="刪除目前專案"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-rose-600 whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>刪除</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetDemo}
              title="還原預設範例專案資料"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-700 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>重設範例</span>
            </button>
          </div>

          {/* Right: Segmented View Switcher including prominent Gantt Chart button */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('tasks')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'tasks'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Tasks & 工期</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('milestone')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'milestone'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Milestone 圖</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'gantt'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white/60 text-indigo-700 hover:bg-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Gantt Chart</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('diff')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'diff'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileDiff className="w-3.5 h-3.5" />
              <span>修訂對照表</span>
            </button>
          </div>
        </div>

        {/* Baseline Comparison Checkbox Strip (Shown on Milestone & Gantt & Tasks views) */}
        {viewMode !== 'diff' && (
          <BaselineCompareBar
            revisions={activeProject.revisions}
            checkedRevisionIds={checkedRevisionIds}
            onToggleRevision={handleToggleRevision}
            onClearAll={() => setCheckedRevisionIds([])}
            hasUnsavedChanges={hasUnsavedChanges}
            onOpenSaveModal={() => setShowSaveModal(true)}
          />
        )}

        {/* Active Viewport */}
        {viewMode === 'tasks' && (
          <TasksEditorView
            phases={activeProject.phases}
            tasks={activeProject.tasks}
            onChangeTasks={handleChangeTasks}
            onSwitchToMilestone={() => setViewMode('milestone')}
            onSwitchToGantt={() => setViewMode('gantt')}
          />
        )}

        {viewMode === 'milestone' && (
          <MilestoneRoadmapView
            project={activeProject}
            checkedRevisions={checkedRevisions}
            onSwitchToGantt={() => setViewMode('gantt')}
            onUpdateCheckpoints={handleUpdateCheckpoints}
            onUpdatePendingNote={handleUpdatePendingNote}
          />
        )}

        {viewMode === 'gantt' && (
          <GanttChartView
            project={activeProject}
            checkedRevisions={checkedRevisions}
            onChangeTasks={handleChangeTasks}
            onSwitchToMilestone={() => setViewMode('milestone')}
          />
        )}

        {viewMode === 'diff' && <RevisionDiffView project={activeProject} />}
      </main>

      {/* Modals */}
      {showSaveModal && (
        <SaveRevisionModal
          project={activeProject}
          onClose={() => setShowSaveModal(false)}
          onSaveRevision={handleSaveRevision}
        />
      )}

      {showNewProjectModal && (
        <NewProjectModal
          existingCount={projects.length}
          onClose={() => setShowNewProjectModal(false)}
          onCreateProject={handleCreateProject}
        />
      )}

      <footer className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 no-print">
        <div className="flex items-center gap-2">
          <span>時程對照台</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">軟體版本 v{__APP_VERSION__}</span>
        </div>
        <span>專案時程與修訂快照自動儲存於本機瀏覽器</span>
      </footer>
    </div>
  );
}
