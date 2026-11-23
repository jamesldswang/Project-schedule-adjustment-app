import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Flag,
  ListChecks,
  FileDiff,
  Plus,
  RotateCcw,
  BookmarkCheck,
  Trash2,
  LogIn,
  LogOut,
} from 'lucide-react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase';
import {
  addRevisionInDb,
  createProjectInDb,
  deleteProjectInDb,
  fetchUserProjects,
  syncCheckpointsInDb,
  syncProjectTasksInDb,
  updateProjectPendingNoteInDb,
} from './services/projectRepository';
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

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Refs for debounced task/note sync to Firestore
  const tasksSyncTimerRef = useRef<number | null>(null);
  const noteSyncTimerRef = useRef<number | null>(null);
  const lastSyncedTasksMapRef = useRef<Map<string, ScheduleTask[]>>(new Map());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // Ignore storage quota errors
    }
  }, [projects]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      setSyncError(null);

      if (!firebaseUser) {
        lastSyncedTasksMapRef.current.clear();
        return;
      }

      try {
        let remoteProjects = await fetchUserProjects(firebaseUser.uid);
        if (remoteProjects.length === 0) {
          // Seed the default J261113 project for the newly signed-in user
          const initialSeed = JSON.parse(JSON.stringify(SEED_PROJECTS[0])) as ProjectPlan;
          await createProjectInDb(firebaseUser.uid, initialSeed);
          remoteProjects = [initialSeed];
        }

        const nextMap = new Map<string, ScheduleTask[]>();
        remoteProjects.forEach((p) => nextMap.set(p.id, p.tasks));
        lastSyncedTasksMapRef.current = nextMap;

        setProjects(remoteProjects);
        setActiveProjectId(remoteProjects[0].id);
        const firstRev = remoteProjects[0].revisions[0]?.id;
        setCheckedRevisionIds(firstRev ? [firstRev] : []);
      } catch (err) {
        console.error('Failed to load user projects:', err);
        setSyncError('載入雲端專案資料時發生錯誤，目前先以本機資料顯示。');
      }
    });

    return () => unsubscribe();
  }, []);

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

  const handleSignIn = async () => {
    setSyncError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      console.error('Google sign-in failed:', err);
      setSyncError('Google 登入未完成，請確認瀏覽器未阻擋彈出視窗。');
    }
  };

  const handleSignOut = async () => {
    setSyncError(null);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

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
    const projectId = activeProject.id;
    updateActiveProject((proj) => ({ ...proj, tasks: nextTasks }));

    if (user) {
      if (tasksSyncTimerRef.current) {
        window.clearTimeout(tasksSyncTimerRef.current);
      }
      const prevSynced = lastSyncedTasksMapRef.current.get(projectId) || activeProject.tasks;
      tasksSyncTimerRef.current = window.setTimeout(async () => {
        try {
          await syncProjectTasksInDb(user.uid, projectId, prevSynced, nextTasks);
          lastSyncedTasksMapRef.current.set(projectId, nextTasks);
        } catch (err) {
          console.error('Failed to sync tasks:', err);
          setSyncError('儲存任務變更至雲端失敗，請稍後再試。');
        }
      }, 450);
    }
  };

  const handleUpdateCheckpoints = async (nextCheckpoints: CheckpointItem[]) => {
    const projectId = activeProject.id;
    const prevCheckpoints = activeProject.checkpoints;
    updateActiveProject((proj) => ({ ...proj, checkpoints: nextCheckpoints }));

    if (user) {
      try {
        await syncCheckpointsInDb(user.uid, projectId, prevCheckpoints, nextCheckpoints);
      } catch (err) {
        console.error('Failed to sync checkpoints:', err);
        setSyncError('同步查核點紀錄失敗，請稍後再試。');
      }
    }
  };

  const handleUpdatePendingNote = (nextNote: string) => {
    const projectId = activeProject.id;
    updateActiveProject((proj) => ({ ...proj, pendingNote: nextNote }));

    if (user) {
      if (noteSyncTimerRef.current) {
        window.clearTimeout(noteSyncTimerRef.current);
      }
      noteSyncTimerRef.current = window.setTimeout(async () => {
        try {
          await updateProjectPendingNoteInDb(projectId, nextNote);
        } catch (err) {
          console.error('Failed to update pending note:', err);
          setSyncError('儲存備註失敗，請稍後再試。');
        }
      }, 450);
    }
  };

  const handleToggleRevision = (revId: string) => {
    setCheckedRevisionIds((prev) =>
      prev.includes(revId) ? prev.filter((id) => id !== revId) : [...prev, revId],
    );
  };

  const handleSaveRevision = async (revision: PlanRevision) => {
    const projectId = activeProject.id;
    updateActiveProject((proj) => ({
      ...proj,
      revisions: [...proj.revisions, revision],
    }));
    setCheckedRevisionIds((prev) =>
      prev.includes(revision.id) ? prev : [...prev, revision.id],
    );
    setShowSaveModal(false);

    if (user) {
      try {
        await addRevisionInDb(user.uid, projectId, revision);
      } catch (err) {
        console.error('Failed to save revision:', err);
        setSyncError('儲存修訂版快照至雲端失敗。');
      }
    }
  };

  const handleCreateProject = async (newProj: ProjectPlan) => {
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setCheckedRevisionIds(newProj.revisions[0]?.id ? [newProj.revisions[0].id] : []);
    setViewMode('tasks');
    setShowNewProjectModal(false);

    if (user) {
      try {
        await createProjectInDb(user.uid, newProj);
        lastSyncedTasksMapRef.current.set(newProj.id, newProj.tasks);
      } catch (err) {
        console.error('Failed to create project in Firestore:', err);
        setSyncError('建立雲端專案失敗，請檢查權限或網路連線。');
      }
    }
  };

  const handleDeleteActiveProject = async () => {
    if (projects.length <= 1) return;
    const deletedId = activeProject.id;
    const remaining = projects.filter((p) => p.id !== deletedId);
    setProjects(remaining);
    const nextProj = remaining[0];
    setActiveProjectId(nextProj.id);
    const firstRev = nextProj.revisions[0]?.id;
    setCheckedRevisionIds(firstRev ? [firstRev] : []);

    if (user) {
      try {
        await deleteProjectInDb(user.uid, deletedId);
        lastSyncedTasksMapRef.current.delete(deletedId);
      } catch (err) {
        console.error('Failed to delete project from Firestore:', err);
        setSyncError('刪除雲端專案失敗。');
      }
    }
  };

  const handleResetDemo = async () => {
    if (user) {
      const resetCopy = JSON.parse(JSON.stringify(SEED_PROJECTS[0])) as ProjectPlan;
      resetCopy.id = `proj-j261113-${Date.now()}`;
      setProjects((prev) => [resetCopy, ...prev]);
      setActiveProjectId(resetCopy.id);
      setCheckedRevisionIds(
        resetCopy.revisions[0]?.id ? [resetCopy.revisions[0].id] : [],
      );
      try {
        await createProjectInDb(user.uid, resetCopy);
        lastSyncedTasksMapRef.current.set(resetCopy.id, resetCopy.tasks);
      } catch (err) {
        console.error('Failed to seed sample project:', err);
        setSyncError('建立範例專案失敗。');
      }
      return;
    }

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
        {syncError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs no-print">
            <span>{syncError}</span>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="text-rose-700 underline cursor-pointer shrink-0"
            >
              關閉
            </button>
          </div>
        )}

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
              title={user ? '新增預設範例專案至雲端' : '還原預設範例專案資料'}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-700 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{user ? '匯入範例' : '重設範例'}</span>
            </button>

            {!authLoading && (
              <div className="pl-2 border-l border-slate-200 flex items-center gap-2">
                {user ? (
                  <>
                    <span className="text-xs text-slate-600 max-w-[140px] truncate">
                      {user.displayName || user.email}
                    </span>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>登出</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Google 登入同步</span>
                  </button>
                )}
              </div>
            )}
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
        <span>
          {user
            ? `已啟用帳號雲端同步 (${user.email})`
            : '目前為本機瀏覽器儲存，登入 Google 帳號可跨裝置同步'}
        </span>
      </footer>
    </div>
  );
}
