# 測試規範與指南

## 測試技術棧

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | ^2.1.9 | 測試框架（runner、assertion、describe/it） |
| Supertest | ^7.2.2 | HTTP 請求模擬（不實際啟動 port） |

---

## 測試檔案表

| 檔案 | 測試目標 | 主要測試案例 |
|------|---------|-------------|
| `tests/auth.test.js` | 認證 API | 成功註冊、重複 email、密碼驗證、成功登入、錯誤密碼、取得個人資料 |
| `tests/products.test.js` | 商品 API | 商品列表（分頁）、商品詳情、不存在的商品 |
| `tests/cart.test.js` | 購物車 API | 訪客加入、登入加入、相同商品累加、數量修改、移除、庫存驗證 |
| `tests/orders.test.js` | 訂單 API | 建立訂單（transaction）、空購物車保護、訂單列表、詳情、付款模擬 |
| `tests/adminProducts.test.js` | 管理員商品 API | 新增、編輯、刪除、無權限保護、刪除衝突保護 |
| `tests/adminOrders.test.js` | 管理員訂單 API | 訂單列表（含狀態篩選）、訂單詳情 |

---

## 執行順序與依賴關係

**測試必須序列執行**（`vitest.config.js` 中設定 `fileParallelism: false`）。

原因：所有測試共用同一個 SQLite 資料庫（`database.sqlite`），並行執行會造成資料競爭。

**固定執行順序**（由 `vitest.config.js` 的 `sequence.files` 控制）：

```
auth.test.js        → 建立基本用戶，後續測試依賴已存在的種子資料
products.test.js    → 依賴種子商品資料（資料庫初始化時植入）
cart.test.js        → 依賴商品存在；測試結束後購物車應為空或被清理
orders.test.js      → 依賴用戶存在（auth 測試建立）、商品存在
adminProducts.test.js → 依賴管理員帳號（種子資料）
adminOrders.test.js → 依賴已建立的訂單（orders 測試建立）
```

**重要**：若單獨執行某個測試檔案（如 `vitest run tests/orders.test.js`），可能因資料不存在而失敗。建議始終執行 `npm test` 跑全套。

---

## 輔助函式（tests/setup.js）

`setup.js` 匯出三個輔助工具，所有測試檔案必須從此引入：

### `request`

Supertest 請求建構器，綁定 Express app 實例：

```js
import { request } from './setup.js';

const res = await request.get('/api/products');
const res = await request.post('/api/auth/login').send({ email, password });
```

### `getAdminToken()`

登入種子管理員帳號，回傳 JWT token 字串：

```js
import { getAdminToken } from './setup.js';

const adminToken = await getAdminToken();
// 使用方式
const res = await request
  .get('/api/admin/products')
  .set('Authorization', `Bearer ${adminToken}`);
```

管理員帳號由 `.env` 的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 決定，預設為 `admin@hexschool.com` / `12345678`。

### `registerUser(overrides)`

建立一個測試用戶並回傳 `{ token, user }` 物件：

```js
import { registerUser } from './setup.js';

const { token, user } = await registerUser();
// 預設使用隨機 email，避免衝突

const { token } = await registerUser({
  email: 'specific@test.com',
  password: 'password123',
  name: '特定用戶'
});
```

`overrides` 物件中的欄位會覆蓋預設值。每次呼叫都會向 `POST /api/auth/register` 發送真實請求。

---

## 撰寫新測試的步驟

### 1. 基本結構

```js
import { describe, it, expect } from 'vitest';
import { request, getAdminToken, registerUser } from './setup.js';

describe('功能模組名稱', () => {
  it('應該成功執行某操作', async () => {
    const res = await request
      .post('/api/some-endpoint')
      .send({ key: 'value' });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toBeDefined();
  });

  it('缺少必填欄位時應回傳 400', async () => {
    const res = await request.post('/api/some-endpoint').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});
```

### 2. 需要認證的端點

```js
it('已登入用戶可存取', async () => {
  const { token } = await registerUser();

  const res = await request
    .get('/api/orders')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
});

it('管理員可存取', async () => {
  const adminToken = await getAdminToken();

  const res = await request
    .get('/api/admin/orders')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
});
```

### 3. 購物車訪客模式

```js
it('訪客可加入購物車', async () => {
  const sessionId = 'test-session-' + Date.now();
  const productId = '...'; // 從種子資料取得

  const res = await request
    .post('/api/cart')
    .set('X-Session-Id', sessionId)
    .send({ productId, quantity: 1 });

  expect(res.status).toBe(201);
});
```

### 4. 測試檔案加入 sequence 設定

若新增測試檔案，必須在 `vitest.config.js` 的 `sequence.files` 中加入，並放在適當位置：

```js
// vitest.config.js
sequence: {
  files: [
    'tests/auth.test.js',
    'tests/products.test.js',
    'tests/cart.test.js',
    'tests/orders.test.js',
    'tests/adminProducts.test.js',
    'tests/adminOrders.test.js',
    'tests/myNew.test.js',   // 加在依賴資料之後
  ]
}
```

---

## 執行測試

```bash
# 執行所有測試（建議方式）
npm test

# 執行並顯示詳細輸出
npx vitest run --reporter=verbose

# 監視模式（開發中）
npx vitest
```

---

## 常見陷阱

### 1. bcrypt saltRounds 在測試中應為 1

種子管理員密碼在 `database.js` 中建立時使用 `saltRounds=1`（透過測試環境判斷）。若修改此值，`getAdminToken()` 可能因等待時間過長而觸發 `hookTimeout: 10000` 逾時。

### 2. 並行執行會造成資料競爭

不要刪除 `vitest.config.js` 中的 `fileParallelism: false`。若測試突然出現莫名的 404 或 409 錯誤，很可能是測試順序被打亂。

### 3. 單獨執行測試檔案會失敗

部分測試依賴前一個測試所建立的資料（例如 `adminOrders.test.js` 依賴 `orders.test.js` 建立的訂單）。若需要單獨除錯，請在測試開頭手動建立所需資料。

### 4. 資料庫狀態殘留

測試執行後 `database.sqlite` 中會留有測試資料。若需要乾淨狀態，刪除 `database.sqlite` 後重新執行 `npm test`（資料庫會在啟動時重新初始化）。

### 5. 購物車 session_id 衝突

使用固定 session_id（如 `'test-session'`）在多個測試中可能互相干擾。建議使用 `'test-session-' + Date.now()` 產生唯一值。

### 6. 訂單狀態是最終狀態

`paid` 和 `failed` 狀態無法轉換。若測試需要多次測試付款，每次都需要建立新訂單。
