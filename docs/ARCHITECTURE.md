# 架構文件

## 目錄結構

```
claude-code/
├── app.js                        # Express 應用組裝：載入 DB、掛載 middleware、註冊路由
├── server.js                     # 進程入口：驗證 JWT_SECRET、設定 port、啟動監聽
├── package.json                  # 依賴與 npm scripts
├── vitest.config.js              # 測試序列設定（fileParallelism: false）
├── swagger-config.js             # OpenAPI 基本資訊與 servers 設定
├── generate-openapi.js           # 執行 swagger-jsdoc 並輸出 openapi.json
├── .env                          # 環境變數（不進 git）
├── .env.example                  # 環境變數範本
│
├── src/
│   ├── database.js               # SQLite 初始化：建表、WAL、外鍵、種子資料
│   ├── middleware/
│   │   ├── authMiddleware.js     # 解析 JWT，掛載 req.user；非強制（無 token 不報錯）
│   │   ├── adminMiddleware.js    # 強制 req.user 存在且 role === 'admin'，否則 403
│   │   ├── sessionMiddleware.js  # 從 X-Session-Id header 取出並掛載 req.sessionId
│   │   └── errorHandler.js      # 全域錯誤 middleware：500 統一格式，隱藏 stack trace
│   ├── utils/
│   │   └── ecpay.js              # ECPay 工具：CheckMacValue 計算（SHA256）、timing-safe 驗證、QueryTradeInfo
│   └── routes/
│       ├── pageRoutes.js         # 頁面路由：渲染 EJS 並傳入 pageScript 變數
│       ├── authRoutes.js         # POST /api/auth/register|login，GET /api/auth/profile
│       ├── productRoutes.js      # GET /api/products，GET /api/products/:id
│       ├── cartRoutes.js         # GET|POST /api/cart，PATCH|DELETE /api/cart/:itemId
│       ├── orderRoutes.js        # POST|GET /api/orders，GET|PATCH /api/orders/:id(/pay)
│       ├── ecpayRoutes.js        # ECPay 路由：apiRouter（/api/ecpay）+ pageRouter（/ecpay）
│       ├── adminProductRoutes.js # CRUD /api/admin/products(/:id)，需 adminMiddleware
│       └── adminOrderRoutes.js   # GET /api/admin/orders(/:id)，需 adminMiddleware
│
├── public/
│   ├── css/
│   │   ├── input.css             # Tailwind 指令 + @theme 自定義色彩變數
│   │   └── output.css            # 建置產物（不進 git）
│   └── js/
│       ├── api.js                # apiFetch()：統一加 Authorization 與 X-Session-Id header
│       ├── auth.js               # Auth 物件：getToken、getUser、getAuthHeaders、requireAuth
│       ├── notification.js       # showNotification(msg, type)：Toast，3 秒自動消失
│       ├── header-init.js        # 頁面載入後初始化導覽列的登入狀態與購物車數量
│       └── pages/
│           ├── index.js          # 首頁 Vue App：商品列表、分頁
│           ├── product-detail.js # 商品詳情 Vue App：加入購物車
│           ├── cart.js           # 購物車 Vue App：數量修改、移除、總價
│           ├── checkout.js       # 結帳 Vue App：填寫收件人資料、送出訂單
│           ├── login.js          # 登入/註冊 Vue App：切換表單
│           ├── orders.js         # 訂單列表 Vue App
│           ├── order-detail.js   # 訂單詳情 Vue App：ECPay 付款流程
│           ├── admin-products.js # 管理員商品管理 Vue App：CRUD
│           └── admin-orders.js   # 管理員訂單列表 Vue App：狀態篩選
│
├── views/
│   ├── layouts/
│   │   ├── front.ejs             # 前台布局：引入 head、header、footer、notification
│   │   └── admin.ejs             # 管理員布局：引入 admin-header、admin-sidebar
│   ├── pages/
│   │   ├── index.ejs             # 掛載點 + pageScript=index
│   │   ├── product-detail.ejs    # 掛載點 + pageScript=product-detail
│   │   ├── cart.ejs              # 掛載點 + pageScript=cart
│   │   ├── checkout.ejs          # 掛載點 + pageScript=checkout
│   │   ├── login.ejs             # 掛載點 + pageScript=login
│   │   ├── orders.ejs            # 掛載點 + pageScript=orders
│   │   ├── order-detail.ejs      # 掛載點 + pageScript=order-detail
│   │   ├── 404.ejs               # 靜態 404 頁面
│   │   └── admin/
│   │       ├── products.ejs      # 掛載點 + pageScript=admin-products
│   │       └── orders.ejs        # 掛載點 + pageScript=admin-orders
│   └── partials/
│       ├── head.ejs              # <head>：meta、Tailwind output.css、Google Fonts
│       ├── header.ejs            # 前台導覽列（Vue CDN + header-init.js）
│       ├── footer.ejs            # 頁腳
│       ├── notification.ejs      # Toast 容器 div
│       ├── admin-header.ejs      # 管理員頂部列
│       └── admin-sidebar.ejs     # 管理員側邊欄
│
├── tests/
│   ├── setup.js                  # supertest app、getAdminToken()、registerUser()
│   ├── auth.test.js
│   ├── products.test.js
│   ├── cart.test.js
│   ├── orders.test.js
│   ├── adminProducts.test.js
│   └── adminOrders.test.js
│
└── docs/
    ├── plans/                    # 進行中的開發計畫
    └── plans/archive/            # 已完成計畫歸檔
```

---

## 啟動流程

```
node server.js
  │
  ├─ 驗證 process.env.JWT_SECRET（缺少則 process.exit(1)）
  ├─ require('./app')
  │    ├─ require('./src/database')
  │    │    ├─ 開啟/建立 database.sqlite
  │    │    ├─ PRAGMA journal_mode=WAL
  │    │    ├─ PRAGMA foreign_keys=ON
  │    │    ├─ CREATE TABLE IF NOT EXISTS（5 張表）
  │    │    ├─ Migration：若 orders 表缺少 merchant_trade_no 欄位則自動 ALTER TABLE 補齊
  │    │    └─ 若 users 表為空：INSERT 種子管理員 + 8 件商品
  │    ├─ app.set('view engine', 'ejs')
  │    ├─ app.use(express.static('public'))
  │    ├─ app.use(cors({ origin: FRONTEND_URL }))
  │    ├─ app.use(express.json())
  │    ├─ app.use(express.urlencoded({ extended: false }))
  │    ├─ app.use(sessionMiddleware)        ← 全域，所有路由皆可存取 req.sessionId
  │    ├─ app.use('/api/auth', authRoutes)
  │    ├─ app.use('/api/admin/products', adminProductRoutes)
  │    ├─ app.use('/api/admin/orders', adminOrderRoutes)
  │    ├─ app.use('/api/products', productRoutes)
  │    ├─ app.use('/api/cart', cartRoutes)
  │    ├─ app.use('/api/orders', orderRoutes)
  │    ├─ app.use('/api/ecpay', ecpayRoutes.apiRouter)  ← ECPay API（需 JWT，路由內部驗證）
  │    ├─ app.use('/ecpay', ecpayRoutes.pageRouter)     ← ECPay 回呼（綠界 Form POST 跳轉）
  │    ├─ app.use('/', pageRoutes)
  │    ├─ app.use(404 handler)
  │    └─ app.use(errorHandler)
  └─ server.listen(PORT || 3001)
```

---

## API 路由總覽

### 公開路由（無需認證）

| 方法 | 路徑 | 檔案 | 說明 |
|------|------|------|------|
| POST | /api/auth/register | authRoutes.js | 用戶註冊 |
| POST | /api/auth/login | authRoutes.js | 用戶登入 |
| GET | /api/products | productRoutes.js | 商品列表（分頁） |
| GET | /api/products/:id | productRoutes.js | 商品詳情 |

### 需要 authMiddleware（JWT 或匿名皆可通過，但 req.user 可能為 null）

| 方法 | 路徑 | 檔案 | 認證實際需求 | 說明 |
|------|------|------|------|------|
| GET | /api/cart | cartRoutes.js | JWT 或 X-Session-Id | 取得購物車 |
| POST | /api/cart | cartRoutes.js | JWT 或 X-Session-Id | 加入商品 |
| PATCH | /api/cart/:itemId | cartRoutes.js | JWT 或 X-Session-Id | 修改數量 |
| DELETE | /api/cart/:itemId | cartRoutes.js | JWT 或 X-Session-Id | 移除商品 |

### 需要 JWT（authMiddleware 驗證後 req.user 非 null）

| 方法 | 路徑 | 檔案 | 說明 |
|------|------|------|------|
| GET | /api/auth/profile | authRoutes.js | 取得個人資料 |
| POST | /api/orders | orderRoutes.js | 建立訂單 |
| GET | /api/orders | orderRoutes.js | 我的訂單列表 |
| GET | /api/orders/:id | orderRoutes.js | 訂單詳情 |
| PATCH | /api/orders/:id/pay | orderRoutes.js | 模擬付款（保留，可作為 fallback） |
| POST | /api/ecpay/checkout/:orderId | ecpayRoutes.js | 建立 ECPay AIO 訂單，回傳表單參數 |

### ECPay 回呼路由（無認證，供綠界伺服器 / 瀏覽器 Form POST）

| 方法 | 路徑 | 檔案 | 說明 |
|------|------|------|------|
| POST | /ecpay/result | ecpayRoutes.js | OrderResultURL：瀏覽器跳轉，驗證並更新訂單狀態 |
| POST | /ecpay/notify | ecpayRoutes.js | ReturnURL：伺服器通知（正式環境用，本地預留） |

### 需要 adminMiddleware（JWT + role === 'admin'）

| 方法 | 路徑 | 檔案 | 說明 |
|------|------|------|------|
| GET | /api/admin/products | adminProductRoutes.js | 管理員商品列表 |
| POST | /api/admin/products | adminProductRoutes.js | 新增商品 |
| PUT | /api/admin/products/:id | adminProductRoutes.js | 編輯商品 |
| DELETE | /api/admin/products/:id | adminProductRoutes.js | 刪除商品（有衝突保護） |
| GET | /api/admin/orders | adminOrderRoutes.js | 訂單列表（可篩選狀態） |
| GET | /api/admin/orders/:id | adminOrderRoutes.js | 訂單詳情（含用戶資訊） |

### 頁面路由（EJS 渲染）

| 路徑 | pageScript 值 | 說明 |
|------|------|------|
| / | index | 首頁商品列表 |
| /products/:id | product-detail | 商品詳情 |
| /cart | cart | 購物車 |
| /checkout | checkout | 結帳 |
| /login | login | 登入/註冊 |
| /orders | orders | 我的訂單 |
| /orders/:id | order-detail | 訂單詳情 |
| /admin/products | admin-products | 管理員商品管理 |
| /admin/orders | admin-orders | 管理員訂單管理 |

---

## 統一回應格式

所有 API 皆回傳以下結構：

```json
{
  "data": { },
  "error": null,
  "message": "操作成功"
}
```

**成功範例（商品列表）：**
```json
{
  "data": {
    "products": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 8,
      "totalPages": 1
    }
  },
  "error": null,
  "message": "成功"
}
```

**失敗範例（驗證錯誤）：**
```json
{
  "data": null,
  "error": "VALIDATION_ERROR",
  "message": "電子郵件格式不正確"
}
```

**常見 error 代碼：**

| error 代碼 | HTTP 狀態 | 情境 |
|-----------|----------|------|
| `VALIDATION_ERROR` | 400 | 欄位驗證失敗 |
| `UNAUTHORIZED` | 401 | 未登入或 JWT 無效 |
| `FORBIDDEN` | 403 | 權限不足（非 admin） |
| `NOT_FOUND` | 404 | 資源不存在 |
| `CONFLICT` | 409 | 資源衝突（如刪除有訂單的商品） |
| `INSUFFICIENT_STOCK` | 400 | 庫存不足 |
| `INTERNAL_ERROR` | 500 | 伺服器錯誤 |

---

## 認證與授權機制

### authMiddleware（src/middleware/authMiddleware.js）

**行為：非強制認證**

1. 嘗試從 `Authorization: Bearer <token>` 取出 JWT
2. 若無 token → 設 `req.user = null`，繼續往下
3. 若有 token → 用 `JWT_SECRET` 驗證
   - 驗證成功：`req.user = { userId, email, role }`
   - 驗證失敗（過期/偽造）：回傳 `401 UNAUTHORIZED`

購物車路由套用 authMiddleware 後，路由內部判斷 `req.user` 是否存在來決定用 `user_id` 還是 `session_id` 作為購物車 owner。

### adminMiddleware（src/middleware/adminMiddleware.js）

**行為：強制管理員**

1. 檢查 `req.user` 是否存在（authMiddleware 已先執行）
2. 若無 `req.user` → 401 UNAUTHORIZED
3. 若 `req.user.role !== 'admin'` → 403 FORBIDDEN

### JWT 參數

| 項目 | 值 |
|------|-----|
| 演算法 | HS256 |
| 過期時間 | 7 天（`expiresIn: '7d'`） |
| Payload | `{ userId, email, role }` |
| 密鑰來源 | `process.env.JWT_SECRET` |

### sessionMiddleware（src/middleware/sessionMiddleware.js）

從 `X-Session-Id` header 取出值掛載到 `req.sessionId`。全域套用，所有路由皆可存取。若 header 不存在則 `req.sessionId = null`。

---

## 資料庫 Schema

資料庫使用 SQLite（`better-sqlite3`），WAL 模式，外鍵約束啟用。

### users

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| email | TEXT | NOT NULL UNIQUE | 登入識別碼 |
| password_hash | TEXT | NOT NULL | bcrypt 雜湊 |
| name | TEXT | NOT NULL | 顯示名稱 |
| role | TEXT | NOT NULL, DEFAULT 'user' | 'user' 或 'admin' |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### products

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | 商品名稱 |
| description | TEXT | | 商品描述 |
| price | INTEGER | NOT NULL | 價格（台幣整數） |
| stock | INTEGER | NOT NULL, DEFAULT 0 | 庫存數量 |
| image_url | TEXT | | 商品圖片 URL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### cart_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| session_id | TEXT | | 訪客識別碼（與 user_id 二擇一） |
| user_id | TEXT | REFERENCES users(id) | 登入用戶（與 session_id 二擇一） |
| product_id | TEXT | NOT NULL, REFERENCES products(id) | |
| quantity | INTEGER | NOT NULL, DEFAULT 1 | |

**設計注意**：`session_id` 與 `user_id` 不可同時為非 null，查詢時必須用正確條件。

### orders

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_no | TEXT | NOT NULL UNIQUE | 格式：ORD-YYYYMMDD-XXXXX |
| user_id | TEXT | NOT NULL, REFERENCES users(id) | |
| recipient_name | TEXT | NOT NULL | 收件人姓名 |
| recipient_email | TEXT | NOT NULL | 收件人 Email |
| recipient_address | TEXT | NOT NULL | 收件地址 |
| total_amount | INTEGER | NOT NULL | 訂單總金額 |
| status | TEXT | NOT NULL, DEFAULT 'pending' | 'pending'、'paid'、'failed' |
| merchant_trade_no | TEXT | UNIQUE | ECPay MerchantTradeNo（order_no 去除破折號，最多 20 字元） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### order_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_id | TEXT | NOT NULL, REFERENCES orders(id) | |
| product_id | TEXT | REFERENCES products(id) | 可為 null（商品被刪除後） |
| product_name | TEXT | NOT NULL | 下單時的商品名稱快照 |
| product_price | INTEGER | NOT NULL | 下單時的商品單價快照 |
| quantity | INTEGER | NOT NULL | |

**設計注意**：`product_name` 和 `product_price` 為快照欄位，即使商品日後被修改或刪除，訂單歷史仍保留當時資訊。

---

## 金流整合（ECPay AIO）

### 架構說明

專案僅運行於本地端，綠界伺服器無法回呼 `ReturnURL`（localhost 不可達）。付款結果確認採雙重機制：

```
使用者點擊「前往綠界付款」
  → POST /api/ecpay/checkout/:orderId（JWT 認證）
  → 後端計算 CheckMacValue，回傳 ECPay AIO 表單參數
  → 前端動態建立 <form> 並 submit 至 payment-stage.ecpay.com.tw
  → 使用者於綠界頁面完成信用卡付款
  → 綠界瀏覽器 Form POST → POST /ecpay/result（OrderResultURL）
  → 後端：驗證 CheckMacValue → 呼叫 QueryTradeInfo 主動查詢
  → UPDATE orders.status（paid / failed）→ redirect /orders/:id
```

### 環境變數

| 變數 | 說明 | 預設值（staging） |
|------|------|------|
| `ECPAY_MERCHANT_ID` | 綠界商店代號 | `3002607` |
| `ECPAY_HASH_KEY` | HashKey | `pwFHCqoQZGmho4w6` |
| `ECPAY_HASH_IV` | HashIV | `EkRm7iFT261dpevs` |
| `ECPAY_ENV` | 環境（staging / production） | `staging` |
| `BASE_URL` | 用於組合 OrderResultURL 等回呼網址 | `http://localhost:3001` |

### 工具函式（src/utils/ecpay.js）

| 函式 | 說明 |
|------|------|
| `generateCheckMacValue(params, key, iv)` | 依綠界規範計算 SHA256 CheckMacValue（含 URL Encode） |
| `verifyCheckMacValue(params, key, iv)` | timing-safe 驗證 CheckMacValue |
| `queryTradeInfo(tradeNo, merchantId, key, iv, env)` | 主動呼叫 QueryTradeInfo/V5 查詢交易狀態 |
| `getMerchantTradeDate()` | 取得台灣時間（UTC+8）格式化字串（`yyyy/MM/dd HH:mm:ss`） |

### MerchantTradeNo 規則

`order_no = "ORD-20260416-ABCDE"` → 去除破折號 → `"ORD20260416ABCDE"`（16 字元，符合上限 20）。首次呼叫 `/api/ecpay/checkout/:orderId` 時寫入 `orders.merchant_trade_no`，供 `/ecpay/result` 反查訂單。

### 測試信用卡（Staging）

| 卡號 | 有效期 | 安全碼 | 3DS 驗證碼 |
|------|------|------|------|
| 4311-9522-2222-2222 | 任意未到期 | 任意 3 碼 | 1234 |

---

## 前端 Vue 3 掛載機制

EJS 模板中透過 `pageScript` 變數動態載入對應頁面腳本：

```ejs
<!-- views/layouts/front.ejs -->
<% if (typeof pageScript !== 'undefined' && pageScript) { %>
  <script src="/js/pages/<%= pageScript %>.js"></script>
<% } %>
```

每個頁面腳本自行呼叫 `Vue.createApp({...}).mount('#app')`，Vue 3 以 CDN 方式在 `head.ejs` 全域引入，無需打包。
