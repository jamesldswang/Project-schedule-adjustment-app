# 系統架構與演算法文件

本文說明「時程對照台」的資料模型、日期與相依推算邏輯、跨版本差異（Diff）評估引擎，以及雲端 Firestore 與本機雙軌持久化設計。

---

## 1. 技術堆疊

- **前端框架**：React 19 + TypeScript 7（Strict ES2022）
- **建置工具**：Vite 8（透過 `define.__APP_VERSION__` 注入 `package.json` 版號）
- **樣式系統**：Tailwind CSS v4（`src/index.css` 定義字體、tabular-nums 數字對齊、基準斜紋樣式與 `@media print` 輸出樣式）
- **雲端資料庫與驗證**：Firebase Authentication（Google Sign-In）+ Cloud Firestore
- **圖示與安全稽核**：`lucide-react`、`@firebase/eslint-plugin-security-rules`

---

## 2. 核心資料模型 (`src/types/schedule.ts` & `firebase-blueprint.json`)

```text
ProjectPlan (/projects/{projectId})
 ├── ownerId, code, name, owner, referenceDate
 ├── issueStats        # 狀態快照（總問題數、已解決、未解、待確認標籤）
 ├── pendingNote       # 補充與待確認事項
 ├── phases[]          # 階段定義 (001 / 002 / 003, 上限 10 筆)
 ├── tasks[]           # 子集合 /tasks/{taskId}：現行任務與里程碑清單
 ├── checkpoints[]     # 子集合 /checkpoints/{checkpointId}：查核點溝通紀錄
 └── revisions[]       # 子集合 /revisions/{revisionId}：不可變歷史版本快照
       ├── version     # 版號字串 (例如 v1.0, v1.1, v1.2, v1.0.0)
       ├── category    # 變更歸因：初始基準 | 客戶延遲 | 需求變更 | 技術調整 | 測試複驗
       ├── reason      # 詳細修正原因與決議依據
       ├── impactSummary
       ├── snapshotPhases[]  # 該版次凍結的階段定義
       └── snapshotTasks[]   # 子集合 /snapshotTasks/{taskId}：凍結的任務與工期快照
```

### 任務與里程碑規格 (`ScheduleTask`)
- `type: 'task' | 'milestone'`
  - 當 `type === 'milestone'` 時，`durationDays` 固定為 `0` 且 `endDate === startDate`，可附帶 `tags[]`（交付物標籤，上限 10 筆）與 `dateSubLabel`（如 `d+20`）。
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

## 5. 雲端同步、安全規則與本機持久化

- **雙軌儲存模式 (`src/App.tsx`, `src/services/projectRepository.ts`)**：
  - **已登入狀態**：透過 `fetchUserProjects(uid)` 載入個人專屬專案樹；任務與備註編輯採用 450ms debounce 批次同步（`writeBatch`），新建專案會先建立父文件再批次寫入子集合，刪除專案則先清除所有子集合再刪除主文件。
  - **未登入狀態**：自動回退至 `localStorage`（鍵值：`planpulse_schedule_projects_v2`），確保零門檻本機評估使用。
- **Firestore 安全規則 (`firestore.rules`)**：
  - 預設全面拒絕（`allow read, write: if false`），所有讀寫要求 `request.auth != null && request.auth.token.email_verified == true` 且 `ownerId == request.auth.uid`。
  - 所有歷史修訂快照（`revisions` 與 `snapshotTasks`）設定 `allow update: if false` 確保審計軌跡不可竄改；詳細紅隊測試情境請見 `security_spec.md`。
- **列印樣式**：所有操作按鈕列、控制欄與頁尾均加上 `.no-print` 類別，於列印或轉存 PDF 時僅保留純淨簡報視圖與差異對照表。
