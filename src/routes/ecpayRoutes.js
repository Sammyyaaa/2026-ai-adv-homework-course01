'use strict';

const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const {
  ECPAY_URLS,
  generateCheckMacValue,
  verifyCheckMacValue,
  queryTradeInfo,
  getMerchantTradeDate,
} = require('../utils/ecpay');

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || '3002607';
const HASH_KEY    = process.env.ECPAY_HASH_KEY    || 'pwFHCqoQZGmho4w6';
const HASH_IV     = process.env.ECPAY_HASH_IV     || 'EkRm7iFT261dpevs';
const ENV         = process.env.ECPAY_ENV         || 'staging';
const BASE_URL    = process.env.BASE_URL          || 'http://localhost:3001';

// ─── API Router（需 JWT 認證，由 app.js 掛載在 /api/ecpay） ─────────────────

const apiRouter = express.Router();

/**
 * POST /api/ecpay/checkout/:orderId
 * 建立 ECPay AIO 訂單，回傳表單參數供前端提交
 */
apiRouter.post('/checkout/:orderId', authMiddleware, (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ data: null, error: 'UNAUTHORIZED', message: '請先登入' });
    }

    const order = db
      .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
      .get(req.params.orderId, req.user.userId);

    if (!order) {
      return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({
        data: null,
        error: 'INVALID_STATUS',
        message: '訂單已付款或已失敗，無法再次付款',
      });
    }

    // MerchantTradeNo：去除 order_no 中的破折號（最多 20 字元）
    const merchantTradeNo = order.order_no.replace(/-/g, '');

    // 儲存 merchant_trade_no 以便 result/notify 反查訂單
    db.prepare('UPDATE orders SET merchant_trade_no = ? WHERE id = ?')
      .run(merchantTradeNo, order.id);

    // 組合 ItemName（多商品以 # 分隔，限 200 字元）
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const itemName = items.map(i => i.product_name).join('#').substring(0, 200);

    const params = {
      MerchantID:        MERCHANT_ID,
      MerchantTradeNo:   merchantTradeNo,
      MerchantTradeDate: getMerchantTradeDate(),
      PaymentType:       'aio',
      TotalAmount:       order.total_amount,
      TradeDesc:         '花卉電商訂單',
      ItemName:          itemName,
      ReturnURL:         `${BASE_URL}/ecpay/notify`,      // 伺服器通知（本地無法接收，預留）
      OrderResultURL:    `${BASE_URL}/ecpay/result`,     // 瀏覽器跳轉（可到達 localhost）
      ClientBackURL:     `${BASE_URL}/orders/${order.id}`, // 消費者取消時返回
      ChoosePayment:     'Credit',
      EncryptType:       '1',
      CustomField1:      order.id,                        // 備用：內部訂單 ID
    };

    params.CheckMacValue = generateCheckMacValue(params, HASH_KEY, HASH_IV);

    return res.json({
      data: {
        actionUrl: ECPAY_URLS[ENV].aio,
        params,
      },
      error: null,
      message: '成功',
    });
  } catch (err) {
    next(err);
  }
});

// ─── Page Router（無認證，由 app.js 掛載在 /ecpay） ─────────────────────────

const pageRouter = express.Router();

/**
 * POST /ecpay/result（OrderResultURL）
 * 綠界付款完成後透過瀏覽器 Form POST 跳轉至此
 * 1. 驗證 CheckMacValue
 * 2. 主動呼叫 QueryTradeInfo 確認
 * 3. 更新訂單狀態
 * 4. 導向訂單詳情頁
 */
pageRouter.post('/result', async (req, res) => {
  const body = req.body;

  // 驗證 CheckMacValue
  if (!verifyCheckMacValue(body, HASH_KEY, HASH_IV)) {
    console.error('[ECPay] /ecpay/result CheckMacValue 驗證失敗', body.MerchantTradeNo);
    return res.redirect('/orders');
  }

  const merchantTradeNo = body.MerchantTradeNo;

  const order = db
    .prepare('SELECT * FROM orders WHERE merchant_trade_no = ?')
    .get(merchantTradeNo);

  if (!order) {
    console.error('[ECPay] /ecpay/result 找不到訂單', merchantTradeNo);
    return res.redirect('/orders');
  }

  // 若訂單已非 pending，直接導回（冪等保護）
  if (order.status !== 'pending') {
    return res.redirect(`/orders/${order.id}`);
  }

  try {
    // 主動向綠界查詢以確認付款結果
    const tradeInfo = await queryTradeInfo(
      merchantTradeNo, MERCHANT_ID, HASH_KEY, HASH_IV, ENV
    );
    const newStatus = tradeInfo.TradeStatus === '1' ? 'paid' : 'failed';
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, order.id);
  } catch (err) {
    console.error('[ECPay] QueryTradeInfo 失敗，改以 OrderResultURL 回傳結果判斷:', err.message);
    // Fallback：以 OrderResultURL 回傳的 RtnCode 判斷（AIO Callback RtnCode 為字串）
    const newStatus = body.RtnCode === '1' ? 'paid' : 'failed';
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, order.id);
  }

  return res.redirect(`/orders/${order.id}`);
});

/**
 * POST /ecpay/notify（ReturnURL）
 * 預留給伺服器端通知（本地端不會被呼叫，正式上線時使用）
 * 必須回應純文字 1|OK，HTTP 200
 */
pageRouter.post('/notify', (req, res) => {
  const body = req.body;

  if (!verifyCheckMacValue(body, HASH_KEY, HASH_IV)) {
    console.error('[ECPay] /ecpay/notify CheckMacValue 驗證失敗');
    // 仍需回 1|OK，否則綠界最多重試 4 次
    return res.type('text').send('1|OK');
  }

  const order = db
    .prepare('SELECT * FROM orders WHERE merchant_trade_no = ?')
    .get(body.MerchantTradeNo);

  if (order && order.status === 'pending') {
    // AIO ReturnURL 的 RtnCode 是字串 '1'
    const newStatus = body.RtnCode === '1' ? 'paid' : 'failed';
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, order.id);
  }

  return res.type('text').send('1|OK');
});

module.exports = { apiRouter, pageRouter };
