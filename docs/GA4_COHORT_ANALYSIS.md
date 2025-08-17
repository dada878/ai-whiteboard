# GA4 Cohort Analysis 完整設定指南

## 🎯 Cohort 分析目標

Cohort 分析幫助我們理解不同用戶群組在時間軸上的行為變化，主要回答：
- 哪些用戶群組價值最高？
- 用戶留存率如何隨時間變化？
- 不同獲客渠道的用戶質量差異？
- 產品改進對新用戶的影響？

## 📊 Cohort 類型設計

### 1. 獲取時間 Cohorts（Acquisition Cohorts）

#### 週 Cohort 設定
```
命名格式: 2024-W47 (2024年第47週)
分組邏輯: 同一週註冊的所有用戶
主要用途: 短期產品迭代效果評估
```

#### 月 Cohort 設定
```
命名格式: 2024-M11 (2024年11月)
分組邏輯: 同一月註冊的所有用戶
主要用途: 長期趨勢分析、季節性分析
```

### 2. 行為 Cohorts（Behavioral Cohorts）

#### 激活速度 Cohorts
| Cohort 名稱 | 定義 | 預期特徵 |
|------------|------|----------|
| Fast Activators | 24小時內創建 ≥3 便利貼 | 高留存、高轉換 |
| Normal Activators | 1-7天內創建首個便利貼 | 標準留存 |
| Slow Activators | 7天後才創建便利貼 | 需要引導 |
| Non-Activators | 從未創建便利貼 | 流失風險高 |

#### AI 採用 Cohorts
| Cohort 名稱 | 定義 | 預期價值 |
|------------|------|----------|
| AI Power Users | 首週使用 AI ≥5 次 | LTV 最高 |
| AI Explorers | 首週使用 AI 1-4 次 | 轉換潛力大 |
| AI Non-Users | 從未使用 AI | 需要教育 |

#### 協作模式 Cohorts
| Cohort 名稱 | 定義 | 特徵 |
|------------|------|----------|
| Team Players | 創建 ≥2 專案且分享 | 企業潛力 |
| Solo Creators | 僅個人使用 | 個人訂閱目標 |
| Browsers | 只瀏覽不創建 | 需要激活 |

### 3. 來源 Cohorts（Source Cohorts）

#### 流量來源分組
- **Organic**: SEO 自然流量
- **Paid Search**: Google Ads 等付費搜尋
- **Social**: Facebook、Twitter、LinkedIn
- **Direct**: 直接訪問
- **Referral**: 部落格、合作夥伴推薦
- **Email**: 電子郵件行銷

## 📈 關鍵 Cohort 指標

### 留存率矩陣

#### 標準留存率基準
| 時間點 | 優秀 | 良好 | 需改進 | 危險 |
|--------|------|------|--------|------|
| Day 1 | >70% | 60-70% | 50-60% | <50% |
| Day 7 | >40% | 30-40% | 20-30% | <20% |
| Day 14 | >30% | 20-30% | 15-20% | <15% |
| Day 30 | >25% | 15-25% | 10-15% | <10% |
| Day 60 | >20% | 12-20% | 8-12% | <8% |
| Day 90 | >15% | 10-15% | 5-10% | <5% |

### 參與度指標

#### 使用頻率分析
```javascript
// 用戶分類標準
Daily Active: 週使用 ≥5 天
Weekly Active: 週使用 2-4 天  
Monthly Active: 月使用 2-7 天
Churned: 30天無活動
```

#### 功能採用深度
```javascript
// 功能採用等級
Level 1: 基礎功能（便利貼）
Level 2: 進階功能（連線、群組）
Level 3: AI 功能
Level 4: 協作功能
Level 5: 付費功能
```

### 價值指標

#### LTV 計算模型
```
LTV = (平均月收入 × 平均留存月數) - CAC

分 Cohort 計算:
- Fast Activators LTV: $120
- Normal Activators LTV: $60
- Slow Activators LTV: $20
```

## 🔧 GA4 實作設定

### Step 1: 用戶屬性設定

在 GA4 中設定以下用戶屬性：

```javascript
// 用戶首次訪問時設定
gtag('set', 'user_properties', {
  // Cohort 識別
  signup_week: '2024-W47',
  signup_month: '2024-M11',
  signup_date: '2024-11-17',
  
  // 用戶分類
  activation_speed: 'fast', // fast/normal/slow/none
  ai_adoption: 'power', // power/explorer/non-user
  collaboration_type: 'team', // team/solo/browser
  
  // 來源資訊
  acquisition_source: 'organic',
  acquisition_campaign: 'blog_post_001',
  
  // 價值分層
  user_tier: 'high_value', // high/medium/low
  predicted_ltv: 120
});
```

### Step 2: 事件追蹤強化

為 Cohort 分析增強事件參數：

```javascript
// 每個關鍵事件都要包含
gtag('event', 'note_created', {
  // Cohort 相關
  days_since_signup: 3,
  weeks_since_signup: 1,
  cohort_week: '2024-W47',
  
  // 行為深度
  total_notes_created: 15,
  session_number: 5,
  cumulative_usage_minutes: 127,
  
  // 參與度指標
  is_first_in_session: true,
  time_since_last_action: 45, // 秒
  action_velocity: 3.2 // 每分鐘動作數
});
```

### Step 3: 自定義維度創建

在 GA4 管理介面創建：

#### 用戶範圍維度
1. `cohort_week` - 註冊週
2. `cohort_month` - 註冊月
3. `activation_speed` - 激活速度
4. `ai_adoption_level` - AI 採用程度
5. `user_tier` - 用戶價值分層

#### 事件範圍維度
1. `days_since_signup` - 註冊後天數
2. `session_depth` - 會話深度
3. `feature_level` - 功能使用等級
4. `engagement_score` - 參與度分數

### Step 4: 探索報表設定

#### A. Cohort 留存探索
1. 進入「探索」→「同類群組探索」
2. 設定：
   - **納入條件**: first_open 或 sign_up
   - **回訪條件**: 任何互動事件
   - **區隔粒度**: 每日/每週/每月
   - **顯示**: 留存率百分比

#### B. LTV 預測探索
1. 進入「探索」→「使用者生命週期」
2. 設定：
   - **指標**: 預測收入、購買可能性
   - **細分維度**: cohort_week、user_tier
   - **時間範圍**: 90天

#### C. 行為路徑探索
1. 進入「探索」→「路徑探索」
2. 針對每個 Cohort 分析：
   - 最常見的使用路徑
   - 轉換路徑
   - 流失路徑

## 📊 分析模板

### 週報模板

```markdown
# Cohort 分析週報 - Week [XX]

## 📈 本週新 Cohort 表現
- 新註冊用戶: XXX
- D1 留存率: XX%（vs 上週: +X%）
- 激活率: XX%（首次創建便利貼）

## 🔄 歷史 Cohort 追蹤
### Week 47 Cohort（2週前）
- D14 留存: XX%（基準: 25%）
- AI 採用率: XX%
- 付費轉換: X 用戶（X%）

### Week 45 Cohort（4週前）
- D30 留存: XX%
- LTV 發展: $XX（預測: $XXX）

## 🎯 關鍵洞察
1. [洞察1: 例如某渠道質量提升]
2. [洞察2: 例如某功能採用率增加]
3. [洞察3: 例如某 Cohort 異常表現]

## 💡 行動建議
1. [建議1: 基於數據的具體行動]
2. [建議2: 需要測試的假設]
```

### 月度深度分析模板

```markdown
# Cohort 深度分析 - [YYYY-MM]

## Executive Summary
[3-5句關鍵發現總結]

## Cohort 表現對比
[表格或圖表展示各 Cohort 關鍵指標]

## 用戶行為演化
### 激活路徑分析
- 最成功路徑: [描述]
- 主要障礙: [描述]

### 功能採用曲線
[不同 Cohort 的功能採用時間軸]

## 預測與建議
### LTV 預測
[基於 Cohort 表現的 LTV 預測]

### 優化優先級
1. 高影響: [具體行動]
2. 中影響: [具體行動]
3. 低影響: [具體行動]
```

## 🎬 實施時間表

### Week 1-2: 基礎設置
- [ ] 配置用戶屬性
- [ ] 更新事件追蹤
- [ ] 創建自定義維度
- [ ] 設定基礎探索報表

### Week 3-4: 數據收集
- [ ] 驗證數據品質
- [ ] 調整追蹤參數
- [ ] 建立數據管道
- [ ] 創建儀表板

### Week 5-8: 分析優化
- [ ] 首次 Cohort 分析
- [ ] 識別關鍵模式
- [ ] 設計 A/B 測試
- [ ] 實施改進措施

### Week 9-12: 規模化
- [ ] 自動化報告
- [ ] 預測模型建立
- [ ] 團隊培訓
- [ ] 流程文檔化

## 🚀 最佳實踐

### Do's ✅
1. **一致的 Cohort 定義** - 確保所有團隊使用相同定義
2. **足夠的樣本量** - 至少 100 用戶才做結論
3. **多維度分析** - 結合時間、行為、來源
4. **持續追蹤** - 至少追蹤 90 天
5. **行動導向** - 每個分析都要有行動計畫

### Don'ts ❌
1. **過度細分** - 避免樣本量過小
2. **忽視季節性** - 考慮外部因素影響
3. **單一指標決策** - 綜合多個指標
4. **短期判斷** - 給 Cohort 足夠成熟時間
5. **忽視質量** - 不只看數量，更看質量

## 🔗 整合點

### 與 Funnel 分析結合
- Cohort 在各漏斗步驟的表現差異
- 不同 Cohort 的轉換路徑差異

### 與產品開發結合
- 功能發布對新 Cohort 的影響
- A/B 測試的 Cohort 層面分析

### 與行銷活動結合
- 不同行銷活動帶來的 Cohort 質量
- ROI 按 Cohort 計算

## 📚 進階主題

### 預測模型建立
使用歷史 Cohort 數據建立：
- 留存率預測模型
- LTV 預測模型
- 流失預警模型

### 個人化策略
基於 Cohort 特徵：
- 個人化 Onboarding 流程
- 針對性的功能推薦
- 客製化的行銷訊息

### 自動化觸發
- 低留存 Cohort 自動觸發召回
- 高價值 Cohort 自動升級提醒
- 風險 Cohort 自動客服介入

---

*文件版本: 1.0*
*最後更新: 2024-11-17*
*下次審查: 2024-12-17*