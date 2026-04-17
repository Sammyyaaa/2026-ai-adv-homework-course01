# 花卉電商平台

全棧花卉電商系統，提供商品瀏覽、購物車、結帳下單、訂單管理與管理員後台功能。

> 本專案由 [Claude Code](https://claude.ai/code)（Anthropic AI 開發助手）全程協助開發。

## 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| 後端框架 | Express.js | ~4.16.1 |
| 資料庫 | better-sqlite3 (WAL 模式) | ^12.8.0 |
| 認證 | jsonwebtoken (HS256) | ^9.0.2 |
| 密碼雜湊 | bcrypt | ^6.0.0 |
| 模板引擎 | EJS | ^5.0.1 |
| 前端框架 | Vue 3 (CDN) | latest |
| CSS 框架 | Tailwind CSS CLI | ^4.2.2 |
| 測試 | Vitest + Supertest | 2.1.9 / 7.2.2 |
| API 文件 | swagger-jsdoc (OpenAPI 3.0.3) | ^6.2.8 |
| 唯一識別碼 | uuid | ^11.1.0 |
| 金流 | ECPay AIO（綠界全方位金流） | staging / production |

## 快速開始

```bash
# 1. 安裝依賴
npm install

# 2. 建立環境變數檔案
cp .env.example .env
# 編輯 .env，至少設定 JWT_SECRET

# 3-A. 開發模式（需兩個終端）
npm run dev:server        # 終端一：啟動 Express（port 3001）
npm run dev:css           # 終端二：監視 CSS 變化

# 3-B. 生產模式
npm start

# 4. 開啟瀏覽器
open http://localhost:3001
```

> **注意**：首次啟動會自動建立 `database.sqlite` 並植入種子資料（管理員帳號 + 8 件花卉商品）。

### 預設帳號

| 角色 | Email | 密碼 |
|------|-------|------|
| 管理員 | admin@hexschool.com | 12345678 |

### 測試信用卡（ECPay Staging）

| 卡號 | 有效期 | 安全碼 | 3DS 驗證碼 |
|------|--------|--------|------------|
| 4311-9522-2222-2222 | 任意未到期 | 任意 3 碼 | 1234 |

## 常用指令表

| 指令 | 說明 |
|------|------|
| `npm run dev:server` | 啟動開發伺服器（port 3001） |
| `npm run dev:css` | 監視 Tailwind CSS 並即時重建 |
| `npm run css:build` | 最小化建置 CSS（生產用） |
| `npm start` | 建置 CSS 後啟動伺服器 |
| `npm test` | 執行所有測試（序列） |
| `npm run openapi` | 產生 `openapi.json` API 文件 |

## ECPay 金流整合

本專案整合 **綠界科技 ECPay AIO 全方位金流**，支援信用卡線上付款。

### 付款流程

```
結帳頁面 → 建立訂單 → 前往綠界付款（信用卡）
  → 綠界完成付款 → 跳轉回 OrderResultURL
  → 驗證 CheckMacValue → 主動呼叫 QueryTradeInfo 確認交易
  → 更新訂單狀態 → 導向訂單詳情頁
```

### 相關 API

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/ecpay/checkout/:orderId | 建立 ECPay AIO 訂單，回傳表單參數 |
| POST | /ecpay/result | OrderResultURL：瀏覽器跳轉後驗證付款結果 |
| POST | /ecpay/notify | ReturnURL：伺服器端通知（正式環境用） |

### 環境變數

| 變數 | 說明 | 預設值（Staging） |
|------|------|-----------------|
| `ECPAY_MERCHANT_ID` | 綠界商店代號 | `3002607` |
| `ECPAY_HASH_KEY` | HashKey | `pwFHCqoQZGmho4w6` |
| `ECPAY_HASH_IV` | HashIV | `EkRm7iFT261dpevs` |
| `ECPAY_ENV` | 環境（staging / production） | `staging` |
| `BASE_URL` | 回呼網址基底（組合 OrderResultURL） | `http://localhost:3001` |

> **注意**：本地開發使用 Staging 環境，付款不會產生真實扣款。正式上線時需更換為生產環境憑證，並確保 `BASE_URL` 為公開可達的網址（ReturnURL 才能被綠界伺服器呼叫）。

## 文件索引

| 文件 | 內容 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 目錄結構、啟動流程、API 路由、資料庫 schema、認證機制 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、新增模組步驟、環境變數表 |
| [FEATURES.md](./FEATURES.md) | 功能清單、行為描述、業務邏輯、錯誤碼 |
| [TESTING.md](./TESTING.md) | 測試規範、輔助函式、撰寫新測試、常見陷阱 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新日誌 |

## 專案入口

- 前台首頁：`http://localhost:3001/`
- 管理後台：`http://localhost:3001/admin/products`
- API 根路徑：`http://localhost:3001/api/`
