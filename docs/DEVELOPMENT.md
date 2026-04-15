# 開發規範

## 命名規則對照表

| 分類 | 規則 | 範例 |
|------|------|------|
| 路由檔案 | camelCase + Routes 後綴 | `authRoutes.js`、`adminProductRoutes.js` |
| Middleware 檔案 | camelCase + Middleware 後綴 | `authMiddleware.js`、`sessionMiddleware.js` |
| 前端頁面腳本 | kebab-case | `product-detail.js`、`admin-orders.js` |
| EJS 模板頁面 | kebab-case | `product-detail.ejs`、`order-detail.ejs` |
| EJS 模板 partials | kebab-case | `admin-sidebar.ejs`、`admin-header.ejs` |
| 資料庫欄位 | snake_case | `password_hash`、`recipient_name`、`created_at` |
| 前端 JS 變數/函式 | camelCase | `getAdminToken()`、`apiFetch()`、`showNotification()` |
| API 路徑 | kebab-case | `/api/admin/products`、`/api/auth/profile` |
| 資料庫 id | UUID v4（TEXT 型別） | `uuid()` 產生 |

---

## 模組系統說明

### 後端（CommonJS）

後端全部使用 CommonJS（`require` / `module.exports`），Node.js 原生支援，無需編譯。

```js
// 引入
const express = require('express');
const db = require('../database');

// 匯出
module.exports = router;
```

### 前端（全域變數，非模組化）

前端 JS 不使用 ES Module，也不打包。所有腳本在 `<script>` 標籤中按順序載入，依賴全域變數共享：

```html
<!-- head.ejs 中載入 Vue 3 CDN -->
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>

<!-- 所有頁面共用的前端腳本（載入順序重要） -->
<script src="/js/auth.js"></script>           <!-- 定義全域 Auth 物件 -->
<script src="/js/api.js"></script>            <!-- 定義全域 apiFetch() -->
<script src="/js/notification.js"></script>   <!-- 定義全域 showNotification() -->

<!-- 頁面特定腳本（由 EJS pageScript 變數動態插入） -->
<script src="/js/pages/index.js"></script>
```

**新增前端功能時**：若需跨頁面共用，加入 `/public/js/` 根目錄，並在 `head.ejs` 或 `front.ejs` 中手動引入。頁面專用邏輯放入 `/public/js/pages/<page-name>.js`，並在對應的 EJS 模板中設定 `pageScript`。

---

## 新增 API 路由的步驟

1. **建立路由檔案**（若新模組）：

   ```js
   // src/routes/myRoutes.js
   const express = require('express');
   const router = express.Router();
   const db = require('../database');

   /**
    * @swagger
    * /api/my-resource:
    *   get:
    *     summary: 取得資源列表
    *     tags: [MyResource]
    *     responses:
    *       200:
    *         description: 成功
    */
   router.get('/', (req, res, next) => {
     try {
       const items = db.prepare('SELECT * FROM my_table').all();
       res.json({ data: items, error: null, message: '成功' });
     } catch (err) {
       next(err);
     }
   });

   module.exports = router;
   ```

2. **在 app.js 掛載路由**：

   ```js
   const myRoutes = require('./src/routes/myRoutes');
   app.use('/api/my-resource', authMiddleware, myRoutes);
   ```

3. **決定 middleware 組合**：
   - 公開路由：直接掛載，不加 middleware
   - 需登入：加 `authMiddleware`（路由內部再檢查 `req.user`）
   - 需管理員：加 `authMiddleware, adminMiddleware`

4. **統一回應格式**：所有回應必須使用 `{ data, error, message }` 結構（見 ARCHITECTURE.md）

5. **錯誤必須傳遞給 next(err)**：不要在路由中直接處理 500 錯誤，呼叫 `next(err)` 讓全域 errorHandler 處理

---

## 新增 Middleware 的步驟

```js
// src/middleware/myMiddleware.js
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function myMiddleware(req, res, next) {
  // 處理邏輯
  req.myValue = 'something';
  next();
}

module.exports = myMiddleware;
```

在 `app.js` 引入並依需求掛載（全域或路由級別）。

---

## 新增資料庫表的步驟

1. **在 `src/database.js` 的初始化區塊中新增 `CREATE TABLE IF NOT EXISTS`**：

   ```js
   db.exec(`
     CREATE TABLE IF NOT EXISTS my_table (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )
   `);
   ```

2. **若需要種子資料**，在「若 users 表為空」的判斷區塊後新增：

   ```js
   const existingCount = db.prepare('SELECT COUNT(*) as count FROM my_table').get();
   if (existingCount.count === 0) {
     db.prepare('INSERT INTO my_table (id, name) VALUES (?, ?)').run(uuidv4(), '範例');
   }
   ```

3. **在 ARCHITECTURE.md 的 Schema 章節新增表格說明**

---

## 環境變數表

| 變數 | 用途 | 必要 | 預設值 |
|------|------|------|--------|
| `JWT_SECRET` | JWT 簽名密鑰 | **必要** | 無（缺少則啟動失敗） |
| `PORT` | 伺服器監聽 port | 選用 | `3001` |
| `FRONTEND_URL` | CORS 允許來源 | 選用 | `http://localhost:5173` |
| `BASE_URL` | 應用基礎 URL（OpenAPI docs 用） | 選用 | `http://localhost:3001` |
| `ADMIN_EMAIL` | 種子管理員 email | 選用 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 種子管理員密碼 | 選用 | `12345678` |
| `ECPAY_MERCHANT_ID` | 綠界商店代號（未實裝） | 選用 | 無 |
| `ECPAY_HASH_KEY` | 綠界 HashKey（未實裝） | 選用 | 無 |
| `ECPAY_HASH_IV` | 綠界 HashIV（未實裝） | 選用 | 無 |
| `ECPAY_ENV` | 綠界環境（未實裝） | 選用 | `staging` |

> **重要**：`JWT_SECRET` 是唯一一個必要的環境變數。`server.js` 啟動時若 `!process.env.JWT_SECRET` 為真則立即 `process.exit(1)`。

---

## JSDoc 格式說明

後端路由皆使用 Swagger JSDoc 格式標注 OpenAPI 文件。執行 `npm run openapi` 會掃描所有路由檔案中的 JSDoc 並產生 `openapi.json`。

### 路由 JSDoc 範例

```js
/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: 取得商品列表
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每頁筆數
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 */
```

### Schema 定義（複用型別）

複用型別定義在 `swagger-config.js` 的 `components.schemas` 中，路由中以 `$ref` 引用：

```js
// swagger-config.js
components: {
  schemas: {
    Product: {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' }, ... }
    }
  }
}
```

---

## Tailwind CSS 自定義色彩

專案在 `public/css/input.css` 中定義了品牌色彩主題，以 CSS 自定義屬性方式宣告：

```css
@theme {
  --color-rose-primary: #C4727F;    /* 主玫瑰色，用於按鈕、強調 */
  --color-rose-dark: #A85B67;       /* 深玫瑰色，hover 狀態 */
  --color-rose-light: #E8A5AE;      /* 淺玫瑰色，輔助元素 */
  --color-apricot: #D4956A;         /* 杏色，次要強調 */
  --color-sage: #7EA584;            /* 鼠尾草綠，成功/確認 */
  --color-cream: #FBF8F4;           /* 奶油色，頁面背景 */
  --color-blush: #FFF1EC;           /* 緋紅色，淺背景 */
  --color-rose-bg: #FDEAE4;         /* 玫瑰背景色，卡片背景 */
  --color-text-primary: #2C2A28;    /* 主文字色 */
  --color-text-secondary: #6B6560;  /* 副文字色 */
  --color-text-muted: #9A948E;      /* 淡文字色，說明文字 */
}
```

在 HTML 中使用 `bg-rose-primary`、`text-text-primary` 等 class。新增色彩時在此 `@theme` 區塊內宣告。

---

## 計畫歸檔流程

### 1. 建立計畫

新功能開發前，在 `docs/plans/` 下建立計畫文件：

```
docs/plans/YYYY-MM-DD-<feature-name>.md
```

範例：`docs/plans/2026-04-16-ecpay-integration.md`

### 2. 計畫文件結構

```markdown
# 功能名稱

## User Story
身為 <角色>，我想要 <功能>，以便 <目的>。

## Spec（技術規格）
- API 端點設計
- 資料庫變更
- 前端頁面設計
- 第三方整合說明

## Tasks
- [ ] 建立 XX 路由
- [ ] 修改 DB schema
- [ ] 前端頁面實作
- [ ] 撰寫測試
- [ ] 更新文件
```

### 3. 功能完成後

1. 將計畫檔案移至 `docs/plans/archive/`
2. 更新 `docs/FEATURES.md`（標記功能為已完成，補充行為描述）
3. 更新 `docs/CHANGELOG.md`（在對應版本下記錄變更）
