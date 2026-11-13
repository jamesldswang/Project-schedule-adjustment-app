import { useState } from 'react';
import { X } from 'lucide-react';
import { ProjectPlan } from '../types/schedule';
import { addDays, formatISO } from '../utils/dateUtils';

interface NewProjectModalProps {
  existingCount: number;
  onClose: () => void;
  onCreateProject: (project: ProjectPlan) => void;
}

const VERSION_PRESETS = ['v1.0.0', 'v1.0', 'v0.1.0'];

export function NewProjectModal({
  existingCount,
  onClose,
  onCreateProject,
}: NewProjectModalProps) {
  const today = formatISO(new Date());
  const defaultCode = `J2611${String(14 + existingCount).padStart(2, '0')}`;

  const [code, setCode] = useState(defaultCode);
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('Julian');
  const [initialVersion, setInitialVersion] = useState('v1.0.0');
  const [initialNote, setInitialNote] = useState('專案建立時之初始核定基準時程。');
  const [startDate, setStartDate] = useState(today);
  const [phase1Name, setPhase1Name] = useState('啟動與場域探勘');
  const [phase2Name, setPhase2Name] = useState('核心系統建置');
  const [phase3Name, setPhase3Name] = useState('整合測試與驗收');
  const [includeStarterTasks, setIncludeStarterTasks] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const uid = Date.now();
    const versionStr = initialVersion.trim() || 'v1.0.0';
    const phases = [
      { id: 'p1', code: '001', name: phase1Name.trim() || '第一階段', color: 'amber' as const },
      { id: 'p2', code: '002', name: phase2Name.trim() || '第二階段', color: 'blue' as const },
      { id: 'p3', code: '003', name: phase3Name.trim() || '第三階段', color: 'red' as const },
    ];

    const m1End = startDate;
    const t1Start = addDays(startDate, 1);
    const t1End = addDays(t1Start, 13);
    const t2Start = addDays(t1End, 1);
    const t2End = addDays(t2Start, 20);
    const t3Start = addDays(t2End, 1);
    const t3End = addDays(t3Start, 13);
    const m2Date = addDays(t3End, 1);

    const initialTasks = includeStarterTasks
      ? [
          {
            id: `t-${uid}-1`,
            phaseId: 'p1',
            name: '專案啟動 Kickoff',
            type: 'milestone' as const,
            startDate,
            durationDays: 0,
            endDate: m1End,
            owner: owner.trim() || 'PM',
            status: 'not_started' as const,
            progress: 0,
            dependsOn: null,
            tags: ['需求與規格定案'],
          },
          {
            id: `t-${uid}-2`,
            phaseId: 'p1',
            name: '前置調研與基礎架構規劃',
            type: 'task' as const,
            startDate: t1Start,
            durationDays: 14,
            endDate: t1End,
            owner: owner.trim() || 'PM',
            status: 'not_started' as const,
            progress: 0,
            dependsOn: `t-${uid}-1`,
          },
          {
            id: `t-${uid}-3`,
            phaseId: 'p2',
            name: '主體工程與系統整合開發',
            type: 'task' as const,
            startDate: t2Start,
            durationDays: 21,
            endDate: t2End,
            owner: '工程組',
            status: 'not_started' as const,
            progress: 0,
            dependsOn: `t-${uid}-2`,
          },
          {
            id: `t-${uid}-4`,
            phaseId: 'p3',
            name: '整合測試與缺失複驗',
            type: 'task' as const,
            startDate: t3Start,
            durationDays: 14,
            endDate: t3End,
            owner: 'QA組',
            status: 'not_started' as const,
            progress: 0,
            dependsOn: `t-${uid}-3`,
          },
          {
            id: `t-${uid}-5`,
            phaseId: 'p3',
            name: '正式驗收結案',
            type: 'milestone' as const,
            startDate: m2Date,
            durationDays: 0,
            endDate: m2Date,
            owner: owner.trim() || 'PM',
            status: 'not_started' as const,
            progress: 0,
            dependsOn: `t-${uid}-4`,
            tags: ['驗收報告簽核'],
          },
        ]
      : [
          {
            id: `t-${uid}-1`,
            phaseId: 'p1',
            name: '專案啟動 Kickoff',
            type: 'milestone' as const,
            startDate,
            durationDays: 0,
            endDate: m1End,
            owner: owner.trim() || 'PM',
            status: 'not_started' as const,
            progress: 0,
            dependsOn: null,
          },
        ];

    const newProject: ProjectPlan = {
      id: `proj-${uid}`,
      code: code.trim() || defaultCode,
      name: name.trim(),
      owner: owner.trim() || 'PM',
      referenceDate: today,
      issueStats: {
        total: 0,
        resolved: 0,
        unresolved: 0,
        pendingLabel: '進度正常',
      },
      pendingNote: '請補充待確認事項與複驗條件',
      phases,
      tasks: initialTasks,
      checkpoints: [],
      revisions: [
        {
          id: `rev-${uid}`,
          version: versionStr,
          title: '初始基準計畫',
          createdAt: `${today} 09:00`,
          author: owner.trim() || 'PM',
          category: '初始基準',
          reason: initialNote.trim() || '專案建立時之初始核定基準時程。',
          impactSummary: `初始建立 ${initialTasks.length} 項基礎時程（基準版號 ${versionStr}）。`,
          snapshotPhases: JSON.parse(JSON.stringify(phases)),
          snapshotTasks: JSON.parse(JSON.stringify(initialTasks)),
        },
      ],
    };

    onCreateProject(newProject);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">New 新建專案時程計畫</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              建立時可指定初始版控版號（如 v1.0.0），作為後續每次修訂的基準起點
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">專案編號</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">負責人</label>
              <input
                type="text"
                required
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Kickoff 起始日</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">專案名稱</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：月球南極水冰鑽探中繼站專案"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                初始版控版號 (Initial Version)
              </label>
              <input
                type="text"
                required
                value={initialVersion}
                onChange={(e) => setInitialVersion(e.target.value)}
                placeholder="v1.0.0"
                className="w-full px-3 py-1.5 text-sm font-mono-tabular font-semibold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                {VERSION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setInitialVersion(preset)}
                    className={`px-2 py-0.5 text-[11px] font-mono-tabular rounded border cursor-pointer ${
                      initialVersion === preset
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                初始基準備註
              </label>
              <input
                type="text"
                value={initialNote}
                onChange={(e) => setInitialNote(e.target.value)}
                placeholder="初始立項核定基準"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              三大階段名稱設定 (001 / 002 / 003)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={phase1Name}
                onChange={(e) => setPhase1Name(e.target.value)}
                placeholder="001 階段名稱"
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={phase2Name}
                onChange={(e) => setPhase2Name(e.target.value)}
                placeholder="002 階段名稱"
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={phase3Name}
                onChange={(e) => setPhase3Name(e.target.value)}
                placeholder="003 階段名稱"
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeStarterTasks}
              onChange={(e) => setIncludeStarterTasks(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>自動帶入標準階段範本任務與起訖里程碑（可後續自行增刪）</span>
          </label>

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
              className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
            >
              建立新專案 ({initialVersion || 'v1.0.0'})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
