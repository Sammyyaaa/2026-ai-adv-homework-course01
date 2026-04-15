# 功能清單

## 完成狀態總覽

| 功能模組 | 狀態 | 說明 |
|---------|------|------|
| 用戶認證 | ✅ 完成 | 註冊、登入、個人資料 |
| 商品瀏覽 | ✅ 完成 | 列表分頁、商品詳情 |
| 購物車（雙模） | ✅ 完成 | 訪客 + 登入用戶，同一套 API |
| 訂單建立 | ✅ 完成 | Transaction 原子操作 |
| 訂單查詢 | ✅ 完成 | 個人訂單列表與詳情 |
| 付款模擬 | ✅ 完成 | 成功/失敗切換 |
| 管理員商品管理 | ✅ 完成 | CRUD，含刪除衝突保護 |
| 管理員訂單管理 | ✅ 完成 | 列表篩選、詳情查看 |
| ECPay 金流整合 | ✅ 完成 | AIO 信用卡，QueryTradeInfo 主動驗證 |

---

## 用戶認證

### 行為描述

**註冊**（POST /api/auth/register）  
接受 `email`、`password`、`name` 三個必填欄位。email 必須唯一，重複時回傳 409 錯誤。密碼使用 bcrypt 雜湊（saltRounds 在測試環境為 1，生產為 10）。成功後立即回傳 JWT token，用戶無需再次登入。

**登入**（POST /api/auth/login）  
接受 `email`、`password`。用 `bcrypt.compare` 驗證密碼。成功後回傳含 `token` 與 `user` 的 data 物件。JWT 有效期 7 天。

**個人資料**（GET /api/auth/profile）  
需要 Authorization Bearer token。回傳當前登入用戶的 id、email、name、role。不回傳 password_hash。

### 端點規格

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| POST | /api/auth/register | 無 | 註冊 |
| POST | /api/auth/login | 無 | 登入 |
| GET | /api/auth/profile | JWT | 個人資料 |

### 請求 Body

**POST /api/auth/register**
```json
{
  "email": "user@example.com",   // 必填，合法 email 格式
  "password": "12345678",        // 必填，最少 6 字元
  "name": "王小明"               // 必填
}
```

**POST /api/auth/login**
```json
{
  "email": "user@example.com",   // 必填
  "password": "12345678"         // 必填
}
```

### 錯誤碼

| error | HTTP | 情境 |
|-------|------|------|
| `VALIDATION_ERROR` | 400 | 欄位缺失、email 格式錯誤、密碼太短 |
| `CONFLICT` | 409 | email 已被註冊 |
| `UNAUTHORIZED` | 401 | 密碼錯誤、email 不存在、token 無效 |

---

## 商品瀏覽

### 行為描述

**商品列表**（GET /api/products）  
支援分頁查詢，預設每頁 10 筆，從第 1 頁開始。回傳 products 陣列與 pagination 物件（含 page、limit、total、totalPages）。所有用戶（含未登入）皆可存取。

**商品詳情**（GET /api/products/:id）  
以商品 id（UUID）查詢單一商品。若不存在回傳 404。回傳欄位包含 id、name、description、price、stock、image_url。

### 查詢參數

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| page | integer | 1 | 頁碼 |
| limit | integer | 10 | 每頁筆數 |

### 錯誤碼

| error | HTTP | 情境 |
|-------|------|------|
| `NOT_FOUND` | 404 | 商品 id 不存在 |

---

## 購物車（雙模認證）

### 行為描述

購物車系統同時支援訪客與登入用戶，使用同一套 API，以不同識別符區分 owner：

- **訪客模式**：前端產生 UUID 存入 `localStorage`，每次請求附加 `X-Session-Id: <uuid>` header。後端以此 session_id 識別購物車。
- **登入模式**：前端附加 `Authorization: Bearer <token>`。後端解析 JWT 取得 user_id，以此識別購物車。

**加入商品**（POST /api/cart）  
若購物車中已有相同商品，累加數量（不重複建立）。加入前檢查庫存，`quantity` 超過 `stock` 則拒絕。

**修改數量**（PATCH /api/cart/:itemId）  
修改指定 cart_item 的 quantity。同樣檢查庫存上限。

**移除商品**（DELETE /api/cart/:itemId）  
刪除單一 cart_item。只能刪除屬於自己的項目（透過 session_id 或 user_id 驗證 ownership）。

**查看購物車**（GET /api/cart）  
回傳當前 owner 的所有 cart_items，並 JOIN products 表取得最新商品資訊（名稱、價格、庫存、圖片），同時計算 `totalAmount`。

### Owner 條件判斷邏輯

```js
// cartRoutes.js 內部
function getOwnerCondition(req) {
  if (req.user) {
    return { field: 'user_id', value: req.user.userId };
  }
  return { field: 'session_id', value: req.sessionId };
}
```

**重要**：兩者不可混用。同一購物車項目的 session_id 或 user_id 欄位只會有一個有值。

### 請求 Body

**POST /api/cart**
```json
{
  "productId": "uuid-string",   // 必填
  "quantity": 2                 // 選填，預設 1
}
```

**PATCH /api/cart/:itemId**
```json
{
  "quantity": 3    // 必填，正整數
}
```

### 錯誤碼

| error | HTTP | 情境 |
|-------|------|------|
| `VALIDATION_ERROR` | 400 | productId 缺失、quantity 非正整數 |
| `NOT_FOUND` | 404 | 商品不存在、cart_item 不存在 |
| `INSUFFICIENT_STOCK` | 400 | 請求數量超過庫存 |
| `FORBIDDEN` | 403 | 嘗試操作不屬於自己的 cart_item |

---

## 訂單建立

### 行為描述

**建立訂單**（POST /api/orders）  
需要登入（JWT）。從當前用戶的購物車取出所有商品，檢查每件商品的庫存是否充足。若任一商品庫存不足則全部拒絕（不進行任何寫入）。

通過檢查後，以 SQLite transaction 原子執行以下操作：
1. 產生訂單號（格式：`ORD-YYYYMMDD-XXXXX`，其中 XXXXX 為 5 碼隨機英數）
2. INSERT 一筆 orders 記錄（含收件人資訊、總金額、status='pending'）
3. INSERT 多筆 order_items 記錄（快照當時的商品名稱與單價）
4. UPDATE products 的 stock（每件商品扣減對應數量）
5. DELETE 當前用戶的所有 cart_items（清空購物車）

以上 5 步驟全部成功才提交，任一失敗則全部 rollback。

### 請求 Body

```json
{
  "recipientName": "王小明",              // 必填
  "recipientEmail": "user@example.com",   // 必填
  "recipientAddress": "台北市信義區..."   // 必填
}
```

### 錯誤碼

| error | HTTP | 情境 |
|-------|------|------|
| `VALIDATION_ERROR` | 400 | 收件人欄位缺失 |
| `CART_EMPTY` | 400 | 購物車為空 |
| `INSUFFICIENT_STOCK` | 400 | 有商品庫存不足（回應中指出哪件商品） |

---

## 訂單查詢

### 行為描述

**訂單列表**（GET /api/orders）  
僅回傳當前登入用戶的訂單，按建立時間降序排列。回傳欄位包含 id、order_no、total_amount、status、created_at。不含 order_items 明細。

**訂單詳情**（GET /api/orders/:id）  
回傳單一訂單完整資訊，包含 order_items 陣列（每項含 product_name、product_price、quantity）。只能查詢自己的訂單，若 id 不存在或不屬於自己則回傳 404。

### 錯誤碼

| error | HTTP | 情境 |
|-------|------|------|
| `NOT_FOUND` | 404 | 訂單不存在或不屬於當前用戶 |

---

## 付款模擬

### 行為描述

**模擬付款**（PATCH /api/orders/:id/pay）  
接受 `result` 欄位（`'success'` 或 `'fail'`），直接更新訂單 status：
- `result: 'success'` → status 改為 `'paid'`
- `result: 'fail'` → status 改為 `'failed'`

只能對自己的、狀態為 `'pending'` 的訂單操作。已付款或已失敗的訂單不可再次呼叫。

### 請求 Body

```json
{
  "result": "success"   // 必填，"success" 或 "fail"
}
```

### 訂單狀態流

```
pending → paid     (付款成功)
pending → failed   (付款失敗)
```

paid 與 failed 為最終狀態，不可轉換。

### 錯誤碼

| error | HTTP | 情境 |
|-------|------|------|
| `NOT_FOUND` | 404 | 訂單不存在或不屬於當前用戶 |
| `CONFLICT` | 409 | 訂單狀態非 pending，不可再操作 |
| `VALIDATION_ERROR` | 400 | result 欄位無效 |

---

## ECPay 金流整合

### 行為描述

**建立 ECPay 訂單**（POST /api/ecpay/checkout/:orderId）  
需要登入（JWT）。查詢指定訂單，確認屬於當前用戶且狀態為 `pending`。計算 `MerchantTradeNo`（= `order_no` 去除破折號，最多 20 字元）並寫入 `orders.merchant_trade_no`。組合 AIO 表單所需參數（商品名稱、金額、回呼網址等），計算 `CheckMacValue`（SHA256），回傳 `actionUrl` 與 `params` 供前端動態建立 `<form>` 並提交至綠界。

**付款結果接收**（POST /ecpay/result — OrderResultURL）  
綠界付款完成後，以瀏覽器 Form POST 跳轉至此。流程：
1. 驗證 `CheckMacValue`（timing-safe）；驗證失敗則 redirect 至 `/orders`
2. 以 `MerchantTradeNo` 反查 `orders.merchant_trade_no` 取得內部訂單
3. 主動呼叫 `QueryTradeInfo/V5`（`TradeStatus === '1'` → `paid`，其餘 → `failed`）
4. QueryTradeInfo 失敗時 fallback 使用 Form POST 回傳的 `RtnCode` 判斷
5. 冪等保護：若訂單已非 `pending` 直接導回訂單頁
6. 更新 `orders.status`，redirect 至 `/orders/:id`

**伺服器通知**（POST /ecpay/notify — ReturnURL）  
預留給正式上線環境。本地因網路不可達不會被呼叫。收到後驗證 `CheckMacValue`，更新訂單狀態，必須回應純文字 `1|OK`（HTTP 200）。

### 付款流程

```
前端「前往綠界付款」→ POST /api/ecpay/checkout/:orderId
  → 回傳 { actionUrl, params }
  → 動態建立 <form method="POST" action=actionUrl> + hidden inputs
  → form.submit()
  → 綠界信用卡付款頁面（payment-stage.ecpay.com.tw）
  → 付款完成 → 瀏覽器 Form POST → POST /ecpay/result
  → 驗證 + QueryTradeInfo → 更新狀態 → redirect /orders/:id
```

### 端點規格

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| POST | /api/ecpay/checkout/:orderId | JWT | 建立 ECPay 訂單，回傳表單參數 |
| POST | /ecpay/result | 無（綠界回呼） | OrderResultURL：驗證並更新訂單 |
| POST | /ecpay/notify | 無（綠界回呼） | ReturnURL：伺服器通知（正式環境） |

### 錯誤碼（/api/ecpay/checkout/:orderId）

| error | HTTP | 情境 |
|-------|------|------|
| `UNAUTHORIZED` | 401 | 未登入 |
| `NOT_FOUND` | 404 | 訂單不存在或不屬於當前用戶 |
| `INVALID_STATUS` | 400 | 訂單已付款或已失敗，不可再次發起付款 |

---

## 管理員商品管理

### 行為描述

需要 `Authorization: Bearer <token>`，且 JWT 中 role 必須為 `'admin'`，否則 403。

**商品列表**（GET /api/admin/products）  
與公開商品列表相同，但包含完整資訊（含 stock）且支援分頁。

**新增商品**（POST /api/admin/products）  
建立新商品，id 由伺服器產生（UUID v4）。

**編輯商品**（PUT /api/admin/products/:id）  
覆蓋更新指定商品所有可編輯欄位。`updated_at` 自動更新。

**刪除商品**（DELETE /api/admin/products/:id）  
刪除前檢查是否有 status 為 `'pending'` 的訂單包含此商品。若有則拒絕刪除（409 CONFLICT），需等訂單完成或失敗後才可刪除。已 paid 或 failed 的訂單不阻擋刪除（order_items 使用快照，product_id 可為 null）。

### 請求 Body

**POST /api/admin/products** 與 **PUT /api/admin/products/:id**
```json
{
  "name": "玫瑰花束",          // 必填
  "description": "精選玫瑰",   // 選填
  "price": 1200,               // 必填，正整數
  "stock": 50,                 // 必填，非負整數
  "image_url": "https://..."   // 選填
}
```

### 錯誤碼

| error | HTTP | 情境 |
|-------|------|------|
| `VALIDATION_ERROR` | 400 | 必填欄位缺失、price/stock 非數字 |
| `NOT_FOUND` | 404 | 商品 id 不存在 |
| `CONFLICT` | 409 | 商品有進行中的訂單，無法刪除 |
| `FORBIDDEN` | 403 | 非管理員角色 |

---

## 管理員訂單管理

### 行為描述

**訂單列表**（GET /api/admin/orders）  
可選 `status` 查詢參數篩選訂單狀態（`pending`、`paid`、`failed`）。不篩選時回傳所有訂單。按建立時間降序排列，支援分頁。

**訂單詳情**（GET /api/admin/orders/:id）  
回傳指定訂單完整資訊，包含 order_items 陣列與購買用戶的基本資訊（email、name）。

### 查詢參數（GET /api/admin/orders）

| 參數 | 型別 | 預設值 | 可選值 |
|------|------|--------|--------|
| status | string | （全部） | `pending`、`paid`、`failed` |
| page | integer | 1 | |
| limit | integer | 10 | |

### 錯誤碼

| error | HTTP | 情境 |
|-------|------|------|
| `NOT_FOUND` | 404 | 訂單 id 不存在 |
| `FORBIDDEN` | 403 | 非管理員角色 |
