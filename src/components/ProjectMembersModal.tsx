import { useState } from 'react';
import { X } from 'lucide-react';
import { ProjectMember, ProjectPlan } from '../types/schedule';
import { normalizeMembers } from '../data/projectMembers';
import { ProjectMembersFields } from './ProjectMembersFields';

interface ProjectMembersModalProps {
  project: ProjectPlan;
  onClose: () => void;
  onSave: (members: ProjectMember[]) => void;
}

/** 修改既有專案的成員。 */
export function ProjectMembersModal({ project, onClose, onSave }: ProjectMembersModalProps) {
  const [members, setMembers] = useState(() => normalizeMembers(project.members));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(members);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[92vh] shadow-lg overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">專案成員 (Project member)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {project.code} · {project.name}
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <ProjectMembersFields members={members} onChange={setMembers} />

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
              儲存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
