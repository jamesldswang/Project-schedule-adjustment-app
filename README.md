# 時程對照台 — 專案時程與版本對照管理平台

> **軟體版本**：`v1.2.0`（單一來源：`package.json` → `__APP_VERSION__`）  
> **預設範例專案**：`J261113 · 月球寧靜海熔岩管基地專案`

「時程對照台」是一個專為工程專案管理、時程基準評估與跨版本差異對照而設計的網頁平台。針對專案執行過程中頻繁發生的需求變更、外部交付延遲與複驗緩衝調整，平台提供**任務工期設定**、**Milestone 里程碑簡報圖**、**互動式 Gantt Chart 甘特圖**、**多版本修正原因記錄與新舊計畫視覺重疊對照**，並支援 **Firebase Firestore 雲端持久化與 Google 帳號同步**，確保每一次時程異動皆有憑有據、可量化追蹤與跨裝置保存。

---

## 核心功能模組

| 模組 | 說明 | 對應元件 |
| :--- | :--- | :--- |
| **Tasks & 工期設定** | 支援 Task 與 Milestone 切換、開始日/結束日/Duration 天數雙向計算、`-1 / +1` 快速微調、前置相依連動順延、里程碑交付標籤編輯。 | `src/components/TasksEditorView.tsx` |
| **Milestone 圖** | 呈現狀態快照、水平主時程里程碑軸線、`001 / 002 / 003` 階段區間與細項清單、待確認備註及查核點溝通紀錄表；點擊節點可展開歷次版次原因追蹤。 | `src/components/MilestoneRoadmapView.tsx` |
| **查核點 Milestone → Task 排程** | 查核點（Milestone）下可新增多個 Task，每個 Task 設定 Start / Duration（工作天）/ OOO，自動扣除週六日與台灣國定假日推算 End（`End = Start + Duration + Holiday + OOO`）；Task 可接續上一個 Task，Milestone 自動彙總旗下 Task 的起訖與總天數。 | `src/components/CheckpointScheduleTable.tsx`<br>`src/utils/workCalendar.ts` |
| **Gantt Chart 甘特圖** | 提供日 / 週 / 月縮放視圖、階段篩選、基準日標線、任務條點擊即時調整起日與工期，以及跨版本歸因檢視面板。 | `src/components/GanttChartView.tsx` |
| **版本對照控制台** | 支援勾選單一或多個歷史基準版次（如 `v1.0`、`v1.1`、`v1.2`），於 Milestone 圖與 Gantt Chart 上同步疊加舊版基準線、虛線位移與天數差異標記。 | `src/components/BaselineCompareBar.tsx` |
| **修訂對照與稽核表** | 任選「基準舊版 vs 對照新版（或現行計畫）」，產出整體完工日位移、受影響任務數、逐項差異明細，並支援一鍵匯出 `.md` 報告與列印簡報。 | `src/components/RevisionDiffView.tsx` |
| **新建專案與版號控制** | 透過 `+ New 專案` 建立新專案時可指定專案編號、三大階段名稱及**初始版控版號**（如 `v1.0.0`），並於儲存修訂時使用語意化版號遞增控制。 | `src/components/NewProjectModal.tsx`<br>`src/components/SaveRevisionModal.tsx` |
| **雲端資料庫與認證同步** | 支援 Google Sign-In 登入，登入後自動同步 `projects`、`tasks`、`checkpoints` 與不可變 `revisions` 至 Cloud Firestore；未登入時維持本機儲存。 | `src/lib/firebase.ts`<br>`src/services/projectRepository.ts` |

---

## 快速開始

### 環境需求
- Node.js 20+
- npm / bun

### 安裝與啟動

```bash
# 安裝依賴（已內建 .npmrc；若舊版環境無 .npmrc 請加上 --legacy-peer-deps）
npm install

# 啟動開發伺服器 (http://localhost:3000)
npm run dev

# TypeScript 型別檢查
npm run lint

# Firestore 安全規則靜態稽核
npx eslint firestore.rules

# 建置正式產物 (輸出至 dist/)
npm run build
```

---

## 專案目錄結構

```text
.
├── docs/
│   ├── ARCHITECTURE.md            # 系統架構、資料模型與差異演算法說明
│   └── USER_GUIDE.md              # 操作指南與版本對照作業流程 (SOP)
├── public/assets/                 # 靜態參考資源
├── src/
│   ├── components/
│   │   ├── BaselineCompareBar.tsx    # 多版本勾選與修正原因速查列
│   │   ├── GanttChartView.tsx        # 互動式甘特圖與舊版基準疊加
│   │   ├── MilestoneRoadmapView.tsx  # 里程碑簡報視圖與階段區塊
│   │   ├── NewProjectModal.tsx       # 新建專案與初始版號設定對話框
│   │   ├── RevisionDiffView.tsx      # 跨版本逐項差異稽核與報告匯出
│   │   ├── SaveRevisionModal.tsx     # 修訂快照存檔與版號遞增對話框
│   │   └── TasksEditorView.tsx       # 任務工期與前置相依編輯器
│   ├── data/
│   │   └── seedProjects.ts           # 預設 J261113 專案與歷史修訂基準
│   ├── lib/
│   │   ├── firebase.ts               # Firebase App / Auth / Firestore 初始化
│   │   └── firestoreError.ts         # 結構化 Firestore 權限錯誤包裝
│   ├── services/
│   │   └── projectRepository.ts      # Firestore CRUD 與批次同步層
│   ├── types/
│   │   └── schedule.ts               # 核心 TypeScript 型別定義
│   ├── utils/
│   │   └── dateUtils.ts              # 工期計算、相依順延與 Diff 演算法
│   ├── App.tsx                       # 主工作區、登入狀態與版控協調
│   ├── index.css                     # Tailwind v4 樣式與列印規則
│   ├── main.tsx                      # React 掛載入口
│   └── vite-env.d.ts                 # __APP_VERSION__ 全域型別宣告
├── .npmrc                            # legacy-peer-deps=true (npm 相容設定)
├── CHANGELOG.md
├── eslint.config.js                  # @firebase/eslint-plugin-security-rules 設定
├── firebase-applet-config.json       # Firebase Web SDK 與資料庫配置
├── firebase-blueprint.json           # Firestore 實體與集合結構藍圖
├── firestore.rules                   # 已部署之 Firestore 安全規則
├── package.json                      # 軟體版號單一來源 ("version": "1.2.0")
├── security_spec.md                  # 安全不變量與紅隊測試規格
├── tsconfig.json
└── vite.config.ts                    # 注入 __APP_VERSION__ 至前端建置
```

---

## 版控與持久化機制

- **軟體本身版控**：以 `package.json` 的 `"version"` 為唯一來源，透過 `vite.config.ts` 注入 `__APP_VERSION__` 並顯示於頁尾，搭配 Git Tag (`v1.2.0`) 進行發版追蹤。
- **GitHub 一鍵發版（`GAIS_release.bat` + `setup_github_auth.bat` + GitHub Actions）**：
  - 專案內建 `.github/workflows/release.yml`、Windows 發版腳本 `GAIS_release.bat`、`setup_github_auth.bat` 與 `start_schedule_app.bat`。
  - 預設綁定遠端 `https://github.com/jamesldswang/Project-schedule-adjustment-app.git`；執行 `GAIS_release.bat` 時若尚未完成 GitHub 登入驗證，會自動啟動 GitHub 瀏覽器登入（GitHub CLI / Git Credential Manager OAuth）或引導產生 Ed25519 SSH Key / 寫入 PAT，隨後自動推送分支與 `v1.2.0` Tag 並觸發 GitHub Actions 發布 Release。
- **雙軌資料持久化**：
  - **雲端同步（已登入 Google 帳號）**：資料寫入 Cloud Firestore（資料庫：`ai-studio-9d411267-f48a-4992-aa88-631914c84b52`），並受 `firestore.rules` 嚴格保護（僅限驗證通過之擁有者存取與修改）。
  - **本機儲存（未登入或離線操作）**：自動儲存於瀏覽器 `localStorage`（鍵值：`planpulse_schedule_projects_v2`）。

---

## 延伸閱讀

- [系統架構與資料庫設計文件 (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)
- [操作手冊與簡報對照指南 (`docs/USER_GUIDE.md`)](./docs/USER_GUIDE.md)
- [安全規格與測試案例 (`security_spec.md`)](./security_spec.md)
- [版本更新日誌 (`CHANGELOG.md`)](./CHANGELOG.md)
