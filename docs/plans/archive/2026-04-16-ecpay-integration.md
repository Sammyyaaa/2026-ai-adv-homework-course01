# ECPay 綠界金流整合

## User Story

身為已登入用戶，我想要使用真實的綠界信用卡付款流程，以便完成花卉電商訂單的付款，不再依賴模擬按鈕。

## Spec（技術規格）

### 架構說明

本專案僅運行於本地端，綠界伺服器無法回呼 `ReturnURL`。  
付款確認流程改為：
1. **`OrderResultURL`**（瀏覽器 Form POST 跳轉）接收初步結果
2. **`QueryTradeInfo`**（本地端主動向綠界查詢 API）做最終驗證

```
使用者點擊「前往綠界付款」
  → POST /api/ecpay/checkout/:orderId (JWT 認證)
  → 後端計算 CheckMacValue，回傳 ECPay 表單參數
  → 前端動態建立 form 並 submit 至 payment-stage.ecpay.com.tw
  → 使用者在綠界頁面完成付款
  → 綠界瀏覽器 Form POST → POST /ecpay/result (OrderResultURL)
  → 後端驗證 CheckMacValue + 呼叫 QueryTradeInfo 確認
  → UPDATE orders.status → redirect /orders/:id
```

### 環境變數（已在 .env.example 預留）

```env
ECPAY_MERCHANT_ID=3002607
ECPAY_HASH_KEY=pwFHCqoQZGmho4w6
ECPAY_HASH_IV=EkRm7iFT261dpevs
ECPAY_ENV=staging
BASE_URL=http://localhost:3001
```

### API 端點設計

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/ecpay/checkout/:orderId | 建立 ECPay 訂單，回傳表單參數（需 JWT） |
| POST | /ecpay/result | OrderResultURL，接收綠界瀏覽器跳轉並更新訂單 |
| POST | /ecpay/notify | ReturnURL（預留），接收綠界伺服器通知（本地不會被呼叫） |

### 資料庫變更

`orders` 表新增欄位：
```sql
merchant_trade_no TEXT UNIQUE  -- ECPay MerchantTradeNo（訂單號去除破折號）
```

### MerchantTradeNo 規則

`order_no = "ORD-20260416-ABCDE"` → 去除破折號 → `"ORD20260416ABCDE"` (16 字元，符合上限 20)

### 新增檔案

| 檔案 | 說明 |
|------|------|
| `src/utils/ecpay.js` | CheckMacValue 計算、驗證、QueryTradeInfo 呼叫工具 |
| `src/routes/ecpayRoutes.js` | ECPay 路由（apiRouter + pageRouter） |

### 修改檔案

| 檔案 | 變更 |
|------|------|
| `src/database.js` | 新增 merchant_trade_no 欄位 |
| `app.js` | 掛載 ecpayApiRouter 與 ecpayPageRouter |
| `public/js/pages/order-detail.js` | 替換模擬付款為真實 ECPay 流程 |
| `views/pages/order-detail.ejs` | 替換付款按鈕 HTML |

## Tasks

- [x] 建立計畫文件
- [x] 新增 merchant_trade_no 欄位（src/database.js）
- [x] 建立 ECPay 工具函式（src/utils/ecpay.js）
- [x] 建立 ECPay 路由（src/routes/ecpayRoutes.js）
- [x] 掛載路由到 app.js
- [x] 更新前端付款邏輯（order-detail.js）
- [x] 更新訂單詳情模板（order-detail.ejs）
- [x] 更新 FEATURES.md 與 CHANGELOG.md

## 測試方式

1. `npm run dev:server` 啟動（需 `.env` 含必要變數）
2. 登入後新增商品至購物車，結帳建立訂單
3. 進入訂單詳情，點擊「前往綠界付款」
4. 確認跳轉至 `payment-stage.ecpay.com.tw`
5. 測試信用卡：`4311-9522-2222-2222`，3DS 碼：`1234`
6. 確認導回訂單頁面且狀態更新為 `paid`
