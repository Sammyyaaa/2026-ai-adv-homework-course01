# 花卉電商平台

全棧花卉電商系統，提供商品瀏覽、購物車、結帳下單、訂單管理與管理員後台功能。

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

## 常用指令表

| 指令 | 說明 |
|------|------|
| `npm run dev:server` | 啟動開發伺服器（port 3001） |
| `npm run dev:css` | 監視 Tailwind CSS 並即時重建 |
| `npm run css:build` | 最小化建置 CSS（生產用） |
| `npm start` | 建置 CSS 後啟動伺服器 |
| `npm test` | 執行所有測試（序列） |
| `npm run openapi` | 產生 `openapi.json` API 文件 |

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
