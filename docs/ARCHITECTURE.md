# 系統架構與演算法文件

本文說明「時程對照台」的資料模型、日期與相依推算邏輯、跨版本差異（Diff）評估引擎，以及前端狀態持久化設計。

---

## 1. 技術堆疊

- **前端框架**：React 19 + TypeScript 7（Strict ES2022）
- **建置工具**：Vite 8（透過 `define.__APP_VERSION__` 注入 `package.json` 版號）
- **樣式系統**：Tailwind CSS v4（`src/index.css` 定義字體、tabular-nums 數字對齊、基準斜紋樣式與 `@media print` 輸出樣式）
- **圖示套件**：`lucide-react`

---

## 2. 核心資料模型 (`src/types/schedule.ts`)

```text
ProjectPlan
 ├── code, name, owner, referenceDate
 ├── issueStats        # 狀態快照（總問題數、已解決、未解、待確認標籤）
 ├── pendingNote       # 補充與待確認事項
 ├── phases[]          # 階段定義 (001 / 002 / 003, 含顏色分類)
 ├── tasks[]           # 現行編輯中的任務與里程碑清單
 ├── checkpoints[]     # 查核點時程與溝通回覆紀錄
 └── revisions[]       # 不可變的歷史版本快照 (PlanRevision)
       ├── version     # 版號字串 (例如 v1.0, v1.1, v1.2, v1.0.0)
       ├── category    # 變更歸因：初始基準 | 客戶延遲 | 需求變更 | 技術調整 | 測試複驗
       ├── reason      # 詳細修正原因與決議依據
       ├── impactSummary
       ├── snapshotTasks[]   # 該版次凍結的任務與工期快照
       └── snapshotPhases[]  # 該版次凍結的階段定義
```

### 任務與里程碑規格 (`ScheduleTask`)
- `type: 'task' | 'milestone'`
  - 當 `type === 'milestone'` 時，`durationDays` 固定為 `0` 且 `endDate === startDate`，可附帶 `tags[]`（交付物標籤）與 `dateSubLabel`（如 `d+20`）。
  - 當 `type === 'task'` 時，`durationDays >= 1`，採含首尾日曆天計算：`endDate = addDays(startDate, durationDays - 1)`。

---

## 3. 時程計算與差異評估引擎 (`src/utils/dateUtils.ts`)

### 3.1 工期與相依順延 (`cascadeDownstreamTasks`)
1. 當使用者調整某任務之 `startDate`、`durationDays` 或 `endDate` 時，先依「開工日 + 工期」或「起訖差」重算該任務邊界。
2. 若啟用「自動順延相依後續任務」，系統以廣度優先搜尋（BFS）走訪所有 `dependsOn === parentId` 的下游項目：
   - 若前置項目為一般任務（`task`），下游開始日設為 `addDays(parent.endDate, 1)`。
   - 若前置項目為里程碑（`milestone`），下游開始日設為 `parent.endDate`。
   - 使用 `visited` 集合防止循環相依造成無窮迴圈。

### 3.2 跨版本差異評估 (`computeTaskDiffs`)
將任意基準版 (`baseTasks`) 與對照版 (`targetTasks`) 以 `task.id` 對齊比對，產出 `TaskDiff[]`：
- `startDeltaDays = diffDays(base.startDate, target.startDate)`
- `endDeltaDays = diffDays(base.endDate, target.endDate)`
- `durationDeltaDays = target.durationDays - base.durationDays`
- 判定狀態 (`DiffStatus`)：
  - `added` / `removed`：僅存在於新版或舊版之項目
  - `shifted_and_resized`：起日位移且工期長度改變
  - `shifted`：起訖日期位移但工期不變
  - `duration_changed`：起日不變但工期增減
  - `unchanged`：完全一致

### 3.3 階段區間彙總 (`computePhaseRanges`)
各階段（`001` / `002` / `003`）之起訖日期不採用手動填寫，而是由該階段底下所有任務與里程碑的最小 `startDate` 與最大 `endDate` 即時聚合，確保 Milestone 視圖上的階段條永遠與實際任務工期同步。

---

## 4. 多版本視覺重疊渲染機制

1. **Milestone 圖 (`MilestoneRoadmapView.tsx`)**：
   - 取現行里程碑與所有已勾選歷史版本里程碑聯集的時間上下界，計算水平軸百分比座標（保留左右 7% 安全邊界）。
   - 若已勾選之舊版里程碑與現行日期存在差值（`delta !== 0`），於軸線對應位置繪製虛線空心節點，並於上方以同色系虛線連線標註版號與偏移天數（如 `v1.0 +20d`）。
2. **Gantt Chart (`GanttChartView.tsx`)**：
   - 依縮放層級（`day: 28px`, `week: 12px`, `month: 5.5px`）計算每日像素寬度 `dayWidth`。
   - 勾選歷史基準時，列高由 `46px` 自動擴展為 `64px`，於現行實心任務條下方繪製最多三層不同色系（Amber / Rose / Teal）的斜紋虛線基準條與舊版工期標記。

---

## 5. 本地持久化與列印規範

- **LocalStorage 鍵值**：`planpulse_schedule_projects_v2`
- **自動同步**：每次修改任務、查核點、待確認事項、建立新專案或儲存修訂版時，透過 `React.useEffect` 即時序列化儲存，並提供「重設範例」按鈕隨時還原預設 `J261113` 專案狀態。
- **列印樣式**：所有操作按鈕列、控制欄與頁尾均加上 `.no-print` 類別，於列印或轉存 PDF 時僅保留純淨簡報視圖與差異對照表。
