# 更新日誌 (Changelog)

本專案採用語意化版號規範（Semantic Versioning），軟體版號以 `package.json` 為單一來源。

## [1.2.0] - 2026-11-23

### 新增 (Added)
- **查核點 Milestone → Task 階層排程**（`CheckpointScheduleTable`）：
  - 查核點即 Milestone，可於其下新增 / 刪除多個 Task，並可展開或收合。
  - Task 可設定 Start、Duration（工作天）、OOO（Out of Office），表格內直接編輯。
  - 自動計算 Holiday（週六日 + 台灣國定假日），並推算 `End = Start + Duration + Holiday + OOO`。
  - Task 可「接續上一個 Task」，開始日自動為上一個 Task 完成後的下一個工作天。
  - Milestone 自動彙總旗下 Task：起訖日、Duration / OOO 加總、期間 Holiday 與總日曆天，查核點日期同步更新為完成日。
- 新增工作日曆工具 `src/utils/workCalendar.ts`，內含 2026 年台灣國定假日清單。

### 變更 (Changed)
- `CheckpointItem` 新增選填 `tasks` 欄位；`firestore.rules` 與 `firebase-blueprint.json` 允許查核點文件寫入 `tasks`（上限 50 筆）。**升級後需重新部署 Firestore 規則。**

### 修正 (Fixed)
- 修正既有查核點內容變更不會同步至 Firestore 的問題（先前僅同步新增與刪除）。

---

## [1.1.0] - 2026-11-22

### 新增 (Added)
- **雲端資料庫持久化與 Google 帳號同步**：
  - 整合 Firebase Authentication（`signInWithPopup` Google 登入）與 Cloud Firestore（資料庫 `ai-studio-9d411267-f48a-4992-aa88-631914c84b52`）。
  - 新增 `src/lib/firebase.ts`、`src/lib/firestoreError.ts` 與 `src/services/projectRepository.ts`，支援專案建立、任務防抖（450ms debounce）批次同步、查核點與備註更新，以及刪除專案時先清除子集合再移除主文件。
  - 首次使用 Google 登入且雲端尚無專案時，自動匯入預設 `J261113 · 月球寧靜海熔岩管基地專案` 至使用者工作區。
- **Firestore 安全架構與規則驗證**：
  - 新增結構藍圖 `firebase-blueprint.json`、安全規格 `security_spec.md` 與硬化安全規則 `firestore.rules`（強制 `email_verified == true`、擁有者權限檢查、不可變 `revisions`/`snapshotTasks` 保護、欄位白名單與陣列上限控制）。
  - 新增 `eslint.config.js` 整合 `@firebase/eslint-plugin-security-rules` 進行安全規則靜態稽核。

### 修正與相容性 (Fixed)
- 新增 `.npmrc`（`legacy-peer-deps=true`），解決 Windows 環境執行 `npm install` 時因 `vite@8` 可選相依與 `esbuild` 產生的 `ERESOLVE` 衝突。
- 於 `tsconfig.json` 啟用 `"resolveJsonModule": true` 以支援靜態匯入 `firebase-applet-config.json`。
- 更新頁尾軟體版本顯示為 `v1.1.0` 及對應雲端/本機同步狀態說明。

---

## [1.0.0] - 2026-11-12

### 新增 (Added)
- **任務與工期管理 (`TasksEditorView`)**：
  - 支援 Task 與 Milestone 類型切換、開始日期 / 工期天數 (Duration) / 結束日期自動連動推算。
  - 支援前置相依設定與「調整工期時自動順延相依後續任務」開關。
  - 支援里程碑交付物標籤 (`tags`) 行內編輯。
- **Milestone 里程碑視圖 (`MilestoneRoadmapView`)**：
  - 提供狀態快照（問題總數 / 已解決 / 未解 / 待確認）、水平主時程軸線、`001 / 002 / 003` 階段區間條與任務細項卡片、可編輯補充備註與查核點溝通紀錄表。
  - 支援勾選歷史版本並於主軸線上疊加原訂節點、虛線位移連線與天數變化，點擊節點可檢視跨版本修正事由。
- **Gantt Chart 甘特圖 (`GanttChartView`)**：
  - 支援一鍵切換至甘特圖，提供日 / 週 / 月縮放比例、階段篩選與「只看有差異之任務」篩選器。
  - 支援於現行任務條下方同時疊加多個已勾選歷史版本之斜紋基準條與位移/工期差值標籤，並可在上方檢視器即時調整起日與工期。
- **版本對照與稽核 (`BaselineCompareBar`, `RevisionDiffView`, `SaveRevisionModal`)**：
  - 提供多版本勾選對照控制台與修正原因速查展開面板。
  - 提供「儲存修訂版」對話框，自動比對前一版任務差異並提供 `+修訂` / `+次版` / `+主版` 版號遞增控制。
  - 提供「修訂對照表」視圖，支援任選兩版次產出逐項變更表、匯出 `.md` 對照報告與列印簡報頁。
- **專案範本與建置**：
  - 預設載入 **`J261113 · 月球寧靜海熔岩管基地專案`**（含 `v1.0`、`v1.1`、`v1.2` 完整修訂履歷）。
  - 支援 **`+ New 專案`** 自訂初始版號（如 `v1.0.0`、`v1.0`、`v0.1.0`）、三大階段名稱與範本任務。
  - 透過 `vite.config.ts` 讀取 `package.json` 版號並於頁尾顯示軟體版本 `v1.0.0`。
