#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 檢查是否在 CI/CD 或 Docker build 環境
if (process.env.CI || process.env.DOCKER_BUILD || !fs.existsSync('.git')) {
  console.log('📦 偵測到 build 環境，跳過 Git hooks 安裝');
  process.exit(0);
}

console.log('🔧 正在安裝 Git Hooks...');

// 檢查是否在 git repository 中
try {
  execSync('git rev-parse --git-dir', { stdio: 'ignore' });
} catch (error) {
  console.log('⚠️  不在 Git repository 中，跳過 hooks 安裝');
  process.exit(0);
}

// 取得專案根目錄和 .git/hooks 目錄
const projectRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const hooksDir = path.join(projectRoot, '.git', 'hooks');

// 檢查 Node.js 路徑
let nodePath = '';
try {
  nodePath = execSync('which node', { encoding: 'utf8' }).trim();
  console.log(`📍 找到 Node.js: ${nodePath}`);
} catch (error) {
  console.error('❌ 錯誤：找不到 Node.js，請確保已安裝 Node.js');
  process.exit(1);
}

// Pre-commit hook 內容
const preCommitHook = `#!/bin/sh
# Pre-commit hook to update version information
# 此檔案由 scripts/install-hooks.js 自動生成

# 設定 Node.js 路徑
export PATH="${path.dirname(nodePath)}:$PATH"

# 確保在正確的目錄執行
cd "$(git rev-parse --show-toplevel)"

# 寫入 log 檔案以便除錯
echo "$(date): Pre-commit hook 執行中" >> .git/hook-debug.log

# 檢查是否有 staged files（準備 commit 的檔案）
if git diff --cached --quiet; then
  echo "$(date): 沒有 staged files，跳過版本更新" >> .git/hook-debug.log
  exit 0
fi

echo "正在更新版本資訊..."
echo "$(date): 開始更新版本（pre-commit）" >> .git/hook-debug.log

# 嘗試多種方法執行版本更新
if npm run version:update >> .git/hook-debug.log 2>&1; then
  git add version.json public/version.json
  echo "版本更新完成！"
  echo "$(date): 版本更新成功" >> .git/hook-debug.log
elif node scripts/update-version.js >> .git/hook-debug.log 2>&1; then
  git add version.json public/version.json
  echo "版本更新完成！"
  echo "$(date): 版本更新成功（fallback）" >> .git/hook-debug.log
else
  echo "$(date): 版本更新失敗，但不阻止 commit" >> .git/hook-debug.log
  # 不阻止 commit，只是跳過版本更新
fi

exit 0
`;

// Post-commit hook 內容（備用方案）
const postCommitHook = `#!/bin/sh
# Post-commit hook to update version information (fallback)
# 此檔案由 scripts/install-hooks.js 自動生成

# 設定 Node.js 路徑
export PATH="${path.dirname(nodePath)}:$PATH"

# 避免無限迴圈
if git log -1 --pretty=%B | grep -q "版本更新"; then
  exit 0
fi

# 確保在正確的目錄執行
cd "$(git rev-parse --show-toplevel)"

echo "$(date): Post-commit hook 執行中" >> .git/hook-debug.log

# 只有在 pre-commit 沒成功時才執行
if ! git show --name-only | grep -q "version.json"; then
  echo "偵測到版本檔案未更新，執行補救措施..."
  
  if npm run version:update >> .git/hook-debug.log 2>&1; then
    git add version.json public/version.json
    BUILD_NUM=$(cat version.json | grep '"build"' | grep -o '[0-9]*')
    git commit -m "版本更新: $BUILD_NUM" --no-verify
    echo "版本更新完成！"
  fi
fi

exit 0
`;

try {
  // 寫入 pre-commit hook
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  fs.writeFileSync(preCommitPath, preCommitHook);
  fs.chmodSync(preCommitPath, 0o755);
  console.log('✅ Pre-commit hook 已安裝');

  // 寫入 post-commit hook（備用）
  const postCommitPath = path.join(hooksDir, 'post-commit');
  fs.writeFileSync(postCommitPath, postCommitHook);
  fs.chmodSync(postCommitPath, 0o755);
  console.log('✅ Post-commit hook 已安裝（備用）');

  console.log('\n🎉 Git Hooks 安裝完成！');
  console.log('\n📝 現在每次 commit 時會自動更新版本號');
  console.log('🔍 如有問題，請檢查 .git/hook-debug.log');
  
} catch (error) {
  console.error('❌ 安裝失敗:', error.message);
  process.exit(1);
}