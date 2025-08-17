# 📦 自動版本號系統

## 🎯 功能概述
本專案實現了自動版本號管理系統，每次 Git commit 時會自動更新版本號並顯示在網頁右下角。

## 🚀 對新開發者的使用說明

### 1. **下載專案後**
```bash
git clone <your-repo>
cd ai-whiteboard
npm install  # 會自動執行 postinstall 安裝 Git hooks
```

### 2. **手動安裝 Git Hooks（如果自動安裝失敗）**
```bash
npm run hooks:install
```

### 3. **手動更新版本號**
```bash
npm run version:update
```

## 📱 使用者體驗

### **在網頁上看到的效果**
- 右下角顯示版本號：`v1.0.0.45`
- 滑鼠懸停展開詳細資訊：
  ```
  v1.0.0
  Build #45
  Commit: e3ca962
  2025/08/17 23:57
  ```

### **開發者工作流程**
```bash
# 正常開發
git add .
git commit -m "新增功能"  # 自動更新版本號 ✨

# 推送到 GitHub
git push
```

## 🔧 系統架構

### **檔案結構**
```
├── scripts/
│   ├── update-version.js      # 版本更新腳本
│   └── install-hooks.js       # Git hooks 安裝腳本
├── app/components/
│   └── VersionDisplay.tsx     # 版本顯示組件
├── version.json               # 版本資訊檔案
├── public/
│   └── version.json          # 前端存取的版本檔案
└── .git/hooks/               # Git hooks（不會上傳到 GitHub）
    ├── pre-commit            # 主要版本更新 hook
    └── post-commit           # 備用 hook
```

### **版本號規則**
- **格式**: `v{主版本}.{次版本}.{建置號}`
- **建置號**: 自動使用 Git commit 總數
- **範例**: `v1.0.0.45` = 第 45 次 commit

## 🛠️ 技術原理

### **Git Hooks 運作流程**
```bash
開發者執行: git commit -m "新功能"
    ↓
觸發 pre-commit hook
    ↓
執行 scripts/update-version.js
    ↓
更新 version.json 和 public/version.json
    ↓
自動 git add version.json public/version.json
    ↓
版本檔案包含在這次 commit 中
```

### **跨平台相容性**
- ✅ **Terminal**: 完整支援
- ✅ **VSCode UI**: 自動偵測 Node.js 路徑
- ✅ **其他 Git GUI**: 通用相容

## 🐛 除錯方法

### **如果版本沒有自動更新**
1. 檢查 Git hooks 是否存在：
   ```bash
   ls -la .git/hooks/pre-commit
   ls -la .git/hooks/post-commit
   ```

2. 手動重新安裝：
   ```bash
   npm run hooks:install
   ```

3. 檢查除錯日誌：
   ```bash
   cat .git/hook-debug.log
   ```

### **常見問題解決**
- **Node.js 找不到**: 安裝腳本會自動處理路徑問題
- **權限問題**: hooks 檔案會自動設定執行權限
- **VSCode UI 不工作**: 使用備用的 npm 執行方式

## 📊 版本資訊說明

### **version.json 格式**
```json
{
  "version": "1.0.0",           // 主要版本號
  "build": 45,                  // 建置號（Git commit 數量）
  "lastCommit": "e3ca962...",   // 最新 commit hash
  "buildDate": "2025-08-17..."  // 建置時間
}
```

### **前端取得版本資訊**
```typescript
// VersionDisplay.tsx
fetch('/version.json')
  .then(res => res.json())
  .then(data => setVersionInfo(data))
```

## 🌟 優點與特色

### **開發團隊協作**
- ✅ **自動化**: 無需手動管理版本號
- ✅ **一致性**: 所有開發者使用相同規則
- ✅ **追蹤性**: 每個部署版本對應具體 commit
- ✅ **除錯友善**: 快速定位問題版本

### **部署與監控**
- ✅ **版本可視化**: 線上版本一目了然
- ✅ **快速定位**: 根據版本號快速找到對應程式碼
- ✅ **自動記錄**: 建置時間和 commit 資訊完整保存

## 🔄 更新版本號策略

### **主版本號更新**（手動）
```bash
# 編輯 version.json
{
  "version": "2.0.0",  # 手動更新主版本
  "build": 45,         # 保持建置號
  ...
}
```

### **自動建置號**（自動）
- 每次 commit 自動遞增
- 基於 Git 歷史記錄，永不重複
- 即使分支合併也能正確計算

---

## 🎉 總結
這個系統讓版本管理變得完全自動化，開發者只需要專注寫程式和 commit，版本號會自動處理。對於團隊協作和產品部署都非常有幫助！