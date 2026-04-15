# 更新日誌

本專案遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/) 格式。

---

## [1.1.0] - 2026-04-16

### 新增

**ECPay 綠界金流整合（AIO 全方位金流）**
- 新增 `src/utils/ecpay.js`：CheckMacValue 計算（SHA256）、timing-safe 驗證、QueryTradeInfo 主動查詢
- 新增 `src/routes/ecpayRoutes.js`：
  - `POST /api/ecpay/checkout/:orderId`：建立綠界訂單，回傳 AIO 表單參數
  - `POST /ecpay/result`（OrderResultURL）：接收瀏覽器跳轉，驗證並呼叫 QueryTradeInfo 確認付款
  - `POST /ecpay/notify`（ReturnURL）：預留伺服器端通知（本地不接收，正式上線使用）
- `orders` 表新增 `merchant_trade_no` 欄位（用於 OrderResultURL 反查訂單）

### 變更

- 訂單詳情頁（`/orders/:id`）：移除模擬付款按鈕，改為「前往綠界付款」按鈕
- 付款流程改為真實信用卡付款（測試環境使用綠界 staging）

### 架構說明

由於專案僅運行於本地端，綠界伺服器無法回呼 `ReturnURL`。  
付款結果確認改為：`OrderResultURL`（瀏覽器 Form POST，可到達 localhost）+ `QueryTradeInfo` 主動查詢雙重驗證。

---

## [1.0.0] - 2026-04-16

### 新增

**認證系統**
- 用戶註冊（POST /api/auth/register）
- 用戶登入（POST /api/auth/login），JWT 有效期 7 天
- 個人資料查詢（GET /api/auth/profile）

**商品系統**
- 商品列表（GET /api/products），支援分頁
- 商品詳情（GET /api/products/:id）
- 8 件花卉商品種子資料

**購物車系統**
- 雙模購物車（訪客 X-Session-Id + 登入 JWT）
- 加入商品（POST /api/cart），重複商品自動累加
- 查看購物車（GET /api/cart），含商品資訊與總計金額
- 修改數量（PATCH /api/cart/:itemId）
- 移除商品（DELETE /api/cart/:itemId）
- 庫存驗證（加入與修改時皆檢查）

**訂單系統**
- 建立訂單（POST /api/orders），SQLite transaction 原子操作
  - 同時寫入 orders、order_items、扣庫存、清購物車
  - 訂單號格式：ORD-YYYYMMDD-XXXXX
- 訂單列表（GET /api/orders）
- 訂單詳情（GET /api/orders/:id）
- 付款模擬（PATCH /api/orders/:id/pay），支援 success / fail

**管理員後台**
- 商品管理 CRUD（GET/POST/PUT/DELETE /api/admin/products）
  - 刪除保護：有 pending 訂單的商品不可刪除
- 訂單列表（GET /api/admin/orders），支援狀態篩選與分頁
- 訂單詳情（GET /api/admin/orders/:id），含用戶基本資訊

**前端頁面**
- 前台：首頁、商品詳情、購物車、結帳、登入/註冊、訂單列表、訂單詳情
- 管理後台：商品管理、訂單管理
- Vue 3 CDN + Tailwind CSS 4 自定義花卉主題色彩

**基礎設施**
- Express.js + SQLite（WAL 模式，外鍵啟用）
- JWT 認證 + bcrypt 密碼雜湊
- EJS 模板引擎（layouts + partials 架構）
- OpenAPI 3.0.3 文件（`npm run openapi`）
- Vitest + Supertest 完整測試套件（6 個測試檔案，序列執行）

---

## [未發布]

### 待實作

- ECPay 綠界金流整合（環境變數已預留）
