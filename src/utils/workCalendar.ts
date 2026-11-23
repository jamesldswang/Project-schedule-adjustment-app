import { CheckpointItem, CheckpointTask } from '../types/schedule';
import { addDays, diffDays, formatISO, parseDate } from './dateUtils';

/**
 * 台灣國定假日（行政院人事行政總處公告之放假日，僅列平日放假日；週六日已自動視為假日）。
 * 若人事行政總處公告有異動或需加入新年度，請直接在這裡增修。
 */
export const TW_NATIONAL_HOLIDAYS: Record<string, string> = {
  // 2026（民國 115 年）
  '2026-01-01': '元旦',
  '2026-02-16': '春節（除夕）',
  '2026-02-17': '春節',
  '2026-02-18': '春節',
  '2026-02-19': '春節',
  '2026-02-20': '春節補假',
  '2026-02-27': '和平紀念日補假',
  '2026-04-03': '兒童節補假',
  '2026-04-06': '清明節補假',
  '2026-05-01': '勞動節',
  '2026-06-19': '端午節',
  '2026-09-25': '中秋節',
  '2026-09-28': '教師節',
  '2026-10-09': '國慶日補假',
  '2026-10-26': '臺灣光復節補假',
  '2026-12-25': '行憲紀念日',
  // 2027（民國 116 年）— 依行事曆推估，正式公告後請核對
  '2027-01-01': '元旦',
};

export function isWeekend(dateStr: string): boolean {
  const day = parseDate(dateStr).getDay();
  return day === 0 || day === 6;
}

export function isNationalHoliday(dateStr: string): boolean {
  return dateStr in TW_NATIONAL_HOLIDAYS;
}

export function isNonWorkingDay(dateStr: string): boolean {
  return isWeekend(dateStr) || isNationalHoliday(dateStr);
}

export function nextWorkingDay(dateStr: string): string {
  let d = dateStr;
  while (isNonWorkingDay(d)) d = addDays(d, 1);
  return d;
}

export interface WorkSpan {
  startDate: string;
  endDate: string;
  durationDays: number; // 工作天
  holidayDays: number; // 期間內的週六日 + 國定假日
  oooDays: number; // Out of Office 天數
  calendarDays: number; // = duration + holiday + ooo
}

/**
 * End = Start + Duration + Holiday + OOO
 * 從 startDate 起算（含當天），每遇到週六日 / 國定假日就順延一天，
 * 需要的工作天數為 duration + OOO（請假會佔掉工作天）。
 */
export function computeWorkSpan(startDate: string, durationDays: number, oooDays: number): WorkSpan {
  const duration = Math.max(0, Math.floor(durationDays || 0));
  const ooo = Math.max(0, Math.floor(oooDays || 0));
  const needed = duration + ooo;

  if (needed === 0) {
    return { startDate, endDate: startDate, durationDays: 0, holidayDays: 0, oooDays: 0, calendarDays: 0 };
  }

  let cursor = startDate;
  let worked = 0;
  let holidays = 0;
  // Safety cap to avoid infinite loops on bad input
  for (let guard = 0; guard < 5000; guard++) {
    if (isNonWorkingDay(cursor)) {
      holidays++;
    } else {
      worked++;
      if (worked === needed) break;
    }
    cursor = addDays(cursor, 1);
  }

  return {
    startDate,
    endDate: cursor,
    durationDays: duration,
    holidayDays: holidays,
    oooDays: ooo,
    calendarDays: duration + holidays + ooo,
  };
}

export interface ComputedCheckpointTask extends CheckpointTask {
  span: WorkSpan;
}

export interface CheckpointSummary {
  tasks: ComputedCheckpointTask[];
  startDate: string;
  endDate: string;
  durationDays: number;
  holidayDays: number;
  oooDays: number;
  calendarDays: number;
}

/** 依序計算查核點底下每個 task 的起訖，並彙總成 milestone 的起訖與總天數。 */
export function computeCheckpointSummary(cp: CheckpointItem): CheckpointSummary | null {
  const tasks = cp.tasks || [];
  if (tasks.length === 0) return null;

  const computed: ComputedCheckpointTask[] = [];
  let prevEnd: string | null = null;
  for (const t of tasks) {
    let start = t.startDate;
    if ((t.chainPrev || !start) && prevEnd) {
      start = nextWorkingDay(addDays(prevEnd, 1));
    }
    if (!start) start = formatISO(new Date());
    const span = computeWorkSpan(start, t.durationDays, t.oooDays);
    computed.push({ ...t, span });
    prevEnd = span.endDate;
  }

  const starts = computed.map((c) => c.span.startDate).sort();
  const ends = computed.map((c) => c.span.endDate).sort();
  const sum = (k: 'durationDays' | 'holidayDays' | 'oooDays' | 'calendarDays') =>
    computed.reduce((acc, c) => acc + c.span[k], 0);

  const startDate = starts[0];
  const endDate = ends[ends.length - 1];
  // Milestone 的 Holiday 以整段期間（含 task 之間的空檔）實際的週六日／國定假日計
  let holidayDays = 0;
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    if (isNonWorkingDay(d)) holidayDays++;
  }

  return {
    tasks: computed,
    startDate,
    endDate,
    durationDays: sum('durationDays'),
    holidayDays,
    oooDays: sum('oooDays'),
    calendarDays: diffDays(startDate, endDate) + 1,
  };
}
