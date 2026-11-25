import { ProjectMember } from '../types/schedule';
import { MEMBER_DIRECTORY, isRequiredMemberRole } from '../data/projectMembers';

interface ProjectMembersFieldsProps {
  members: ProjectMember[];
  onChange: (members: ProjectMember[]) => void;
}

/**
 * 專案成員表：每個角色一個下拉選單，可選名單內所有 Email。
 * 橘色 = 開新案時必填；灰色 = 已帶入預設人選，可修改。
 */
export function ProjectMembersFields({ members, onChange }: ProjectMembersFieldsProps) {
  const setEmail = (id: string, email: string) =>
    onChange(members.map((m) => (m.id === id ? { ...m, email } : m)));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-200" />
          必填
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-300" />
          已帶入預設人選，可修改
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
        {members.map((m) => {
          const required = isRequiredMemberRole(m.id);
          const known = !m.email || MEMBER_DIRECTORY.some((d) => d.email === m.email);
          return (
            <label
              key={m.id}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
                required ? 'bg-orange-50 border border-orange-200' : 'bg-slate-100 border border-slate-200'
              }`}
            >
              <span className="w-32 shrink-0 text-xs font-medium text-slate-700">
                {m.role}
                {required && <span className="text-rose-500"> *</span>}
              </span>
              <select
                value={m.email}
                required={required}
                onChange={(e) => setEmail(m.id, e.target.value)}
                className="min-w-0 flex-1 px-2 py-1 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">（未指定）</option>
                {!known && <option value={m.email}>{m.email}</option>}
                {MEMBER_DIRECTORY.map((d) => (
                  <option key={d.email} value={d.email}>
                    {d.email}（{d.title}）
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}
