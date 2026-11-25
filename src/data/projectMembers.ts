import { ProjectMember } from '../types/schedule';

// 來源：Google Sheet「Project member」與其下拉選單分頁。
// 名單有異動時，同步修改下面兩個清單即可。

/** 下拉選單可選的所有人（Email 與其職務）。 */
export const MEMBER_DIRECTORY: { email: string; title: string }[] = [
  { email: 'james.wang@nadisystem.com.tw', title: 'SV' },
  { email: 'hugo.wang@nadisystem.com.tw', title: 'BRD' },
  { email: 'eric.zeng@nadisystem.com.tw', title: 'BRD' },
  { email: 'vincent.lee@nadisystem.com.tw', title: 'Backend leader(EVP)' },
  { email: 'q-devops@nadisystem.com.tw', title: 'DevOps' },
  { email: 'mulderx.hsu@nadisystem.com.tw', title: 'DevOps' },
  { email: 'taro.kuo@nadisystem.com.tw', title: 'DevOps leader' },
  { email: 'thomas.wang@nadisystem.com.tw', title: 'FRD' },
  { email: 'cherlyn.liu@nadisystem.com.tw', title: 'FRD Leader' },
  { email: 'hobbes.lu@nadisystem.com.tw', title: 'FRD' },
  { email: 'dan.lin@nadisystem.com.tw', title: 'FRD Leader' },
  { email: 'weihao.hiew@nadisystem.com.tw', title: 'FRD' },
  { email: 'zidan.chien@nadisystem.com.tw', title: 'FRD_Production' },
  { email: 'roy.you@nadisystem.com.tw', title: 'FRD_Production' },
  { email: 'maggie.chou@nadisystem.com.tw', title: 'GM' },
  { email: 'tina.wang@nadisystem.com.tw', title: 'GM assistant' },
  { email: 'simon.mac@nadisystem.com.tw', title: 'PM leader' },
  { email: 'julian.tseng@nadisystem.com.tw', title: 'PM' },
  { email: 'henry.chien@nadisystem.com.tw', title: 'PM' },
  { email: 'renee.hsueh@nadisystem.com.tw', title: 'PM' },
  { email: 'monty.huang@nadisystem.com.tw', title: 'PM' },
  { email: 'rubens.chu@nadisystem.com.tw', title: 'UIX leader' },
  { email: 'iverson.yeh@nadisystem.com.tw', title: 'UIX' },
  { email: 'fima.chou@nadisystem.com.tw', title: 'UIX' },
  { email: 'william.chuang@nadisystem.com.tw', title: 'Consultant' },
];

/**
 * 專案角色範本。
 * required = 開新案時要先填（Sheet 中的橘色列）；
 * defaultEmail = 預設人選（Sheet 中的灰色列），可再修改。
 */
export const MEMBER_ROLE_TEMPLATE: {
  id: string;
  role: string;
  defaultEmail: string;
  required: boolean;
}[] = [
  { id: 'pm', role: 'PM', defaultEmail: '', required: true },
  { id: 'frontend-rd-1', role: 'Frontend RD', defaultEmail: '', required: true },
  { id: 'frontend-rd-2', role: 'Frontend RD', defaultEmail: '', required: true },
  { id: 'backend-rd-1', role: 'Backend RD', defaultEmail: '', required: true },
  { id: 'backend-rd-2', role: 'Backend RD', defaultEmail: '', required: true },
  { id: 'uix', role: 'UIX', defaultEmail: '', required: true },
  { id: 'production', role: 'Production', defaultEmail: '', required: true },
  { id: 'production-2', role: 'Production', defaultEmail: '', required: true },
  { id: 'sv', role: 'SV', defaultEmail: 'james.wang@nadisystem.com.tw', required: false },
  { id: 'devops', role: 'DevOps', defaultEmail: 'mulderx.hsu@nadisystem.com.tw', required: false },
  { id: 'devops-leader', role: 'DevOps leader', defaultEmail: 'taro.kuo@nadisystem.com.tw', required: false },
  { id: 'pm-leader', role: 'PM leader', defaultEmail: 'simon.mac@nadisystem.com.tw', required: false },
  { id: 'uix-leader', role: 'UIX leader', defaultEmail: 'rubens.chu@nadisystem.com.tw', required: false },
  { id: 'frontend-leader-1', role: 'Frontend leader', defaultEmail: 'dan.lin@nadisystem.com.tw', required: false },
  { id: 'frontend-leader-2', role: 'Frontend leader', defaultEmail: 'cherlyn.liu@nadisystem.com.tw', required: false },
  { id: 'backend-leader', role: 'Backend leader(EVP)', defaultEmail: 'vincent.lee@nadisystem.com.tw', required: false },
  { id: 'gm', role: 'GM', defaultEmail: 'maggie.chou@nadisystem.com.tw', required: false },
  { id: 'others', role: 'Others', defaultEmail: '', required: false },
];

export const isRequiredMemberRole = (id: string) =>
  MEMBER_ROLE_TEMPLATE.some((t) => t.id === id && t.required);

/** 專案負責人 = PM 的 Email（沒選 PM 時為空字串）。 */
export const pmEmail = (members?: ProjectMember[]) =>
  (members || []).find((m) => m.id === 'pm')?.email || '';

/** 新專案的預設成員（灰色列帶入預設 Email，橘色列留空待填）。 */
export function defaultMembers(): ProjectMember[] {
  return MEMBER_ROLE_TEMPLATE.map((t) => ({ id: t.id, role: t.role, email: t.defaultEmail }));
}

/**
 * 依範本補齊成員清單：舊專案沒有 members 時，橘色列為空、灰色列帶預設值；
 * 已存的值保留。範本以外的角色（若有）接在最後。
 */
export function normalizeMembers(members?: ProjectMember[]): ProjectMember[] {
  const saved = new Map((members || []).map((m) => [m.id, m]));
  const fromTemplate = MEMBER_ROLE_TEMPLATE.map((t) => {
    const m = saved.get(t.id);
    return { id: t.id, role: t.role, email: m ? m.email : members ? '' : t.defaultEmail };
  });
  const extra = (members || []).filter((m) => !MEMBER_ROLE_TEMPLATE.some((t) => t.id === m.id));
  return [...fromTemplate, ...extra];
}
