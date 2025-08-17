# 版本管理說明（簡化版）

## 版本資訊

版本管理腳本 `update-version.js` 現在只追蹤兩個簡單的資訊：

### 1. Commit 編號 (commit)
- **來源**: Git commit hash 的短版本
- **命令**: `git rev-parse --short HEAD`
- **範例**: `"9dbee63"`
- **Production 支援**: 
  - Vercel: `process.env.VERCEL_GIT_COMMIT_SHA`
  - 其他 CI/CD: `process.env.GIT_COMMIT`

### 2. 建構時間 (buildDate)
- **來源**: 當前時間戳記
- **格式**: ISO 8601 時間格式
- **範例**: `"2025-08-17T16:50:21.603Z"`

## Production 環境設置

### Vercel 部署
Vercel 會自動提供以下環境變數：
- `VERCEL_GIT_COMMIT_SHA`: Git commit hash
- 腳本會自動使用這些變數

### 其他 CI/CD 平台
可以設置以下環境變數：
- `GIT_COMMIT`: Git commit hash

## 使用方式

### 開發環境
```bash
# 更新版本信息
npm run version:update

# 構建時自動更新版本
npm run build
```

### 生產環境
構建時會自動根據環境情況選擇適當的版本信息來源。

## 檔案位置

- `version.json`: 根目錄版本文件
- `public/version.json`: 前端可訪問的版本文件
- `app/components/VersionDisplay.tsx`: 版本顯示元件

## 版本格式（簡化版）

```json
{
  "commit": "9dbee63",
  "buildDate": "2025-08-17T16:50:21.603Z"
}
```

## 顯示說明

- **縮小狀態**: 只顯示 commit 編號
- **展開狀態**: 顯示 commit 編號和建構時間
- **位置**: 右下角固定位置