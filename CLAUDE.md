# CLAUDE.md

## 專案概述

花卉電商平台 — Node.js + Express + SQLite + Vue 3 (CDN) + Tailwind CSS 4

後端提供 RESTful API，前端以 EJS 模板渲染頁面並掛載 Vue 3 應用，資料庫使用 SQLite（WAL 模式）。支援訪客與登入用戶雙模購物車、JWT 認證、管理員後台。

## 常用指令

```bash
# 開發（需兩個終端）
npm run dev:server        # 啟動 Express（port 3001）
npm run dev:css           # 監視 Tailwind CSS 變化

# 生產
npm start                 # 建置 CSS 後啟動

# 測試
npm test                  # 執行所有測試（序列執行）

# 文件
npm run openapi           # 產生 openapi.json
```

## 關鍵規則

- **雙模購物車**：訪客用 `X-Session-Id` header，登入用戶用 `Authorization: Bearer <token>`，兩者共存於同一購物車 API，不可混用 session_id 與 user_id 條件
- **訂單建立必須用 transaction**：同時寫入 orders、order_items、扣庫存、清購物車，缺一不可
- **密碼雜湊 saltRounds**：測試環境用 `1`，生產用 `10`，切勿在測試中使用高 rounds 導致逾時
- **JWT_SECRET 為必要環境變數**：server.js 啟動時若缺少則強制退出，其他變數皆有預設值
- **Vue 3 以 CDN 掛載**：每個頁面獨立 `createApp`，不使用模組打包；前端腳本透過 EJS `pageScript` 變數動態注入
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`

## 詳細文件

- @docs/README.md — 項目介紹與快速開始
- @docs/ARCHITECTURE.md — 架構、目錄結構、資料流
- @docs/DEVELOPMENT.md — 開發規範、命名規則
- @docs/FEATURES.md — 功能列表與完成狀態
- @docs/TESTING.md — 測試規範與指南
- @docs/CHANGELOG.md — 更新日誌
