# 版本管理說明

## 版本號來源

版本管理腳本 `update-version.js` 會從以下來源獲取版本信息：

### 1. 版本號 (version)
- **來源**: `package.json` 中的 `version` 字段
- **範例**: `"0.1.0"`
- **說明**: 主版本號，需要手動在 package.json 中更新

### 2. 構建號 (build)
按照優先順序從以下來源獲取：
1. **Git commit count** (開發環境): `git rev-list --count HEAD`
2. **環境變數 BUILD_NUMBER** (CI/CD): `process.env.BUILD_NUMBER`
3. **Vercel Git SHA** (Vercel 部署): `process.env.VERCEL_GIT_COMMIT_SHA` (轉換為數字)
4. **遞增邏輯** (回退): 上次構建號 + 1

### 3. Git Commit Hash (lastCommit)
按照優先順序從以下來源獲取：
1. **Git command** (開發環境): `git rev-parse HEAD`
2. **Vercel Git SHA** (Vercel 部署): `process.env.VERCEL_GIT_COMMIT_SHA`
3. **環境變數 GIT_COMMIT** (其他 CI/CD): `process.env.GIT_COMMIT`
4. **保持原值** (回退): 使用上次的 commit hash

## Production 環境設置

### Vercel 部署
Vercel 會自動提供以下環境變數：
- `VERCEL_GIT_COMMIT_SHA`: Git commit hash
- 腳本會自動使用這些變數

### 其他 CI/CD 平台
可以設置以下環境變數：
- `BUILD_NUMBER`: 構建號
- `GIT_COMMIT`: Git commit hash

### 手動設置範例
```bash
# 設置構建號
export BUILD_NUMBER=123

# 設置 Git commit hash
export GIT_COMMIT=abc123def456

# 運行構建
npm run build
```

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

## 版本格式

```json
{
  "version": "0.1.0",
  "build": 49,
  "lastCommit": "8a2270dbf3dae245b0d7873951e30c89c0619282",
  "buildDate": "2025-08-17T16:34:27.335Z"
}
```

## 注意事項

1. **更新主版本號**: 需要手動修改 `package.json` 中的 `version`
2. **Production 部署**: 確保部署平台提供了正確的環境變數
3. **版本顯示**: 前端會從 `/version.json` 載入並顯示版本信息