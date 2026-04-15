'use strict';

const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

const ECPAY_URLS = {
  staging: {
    aio: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
    query: 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
  },
  production: {
    aio: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
    query: 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
  },
};

/**
 * ECPay 專用 URL Encode
 * 規則：encodeURIComponent → %20→+ → ~→%7e → '→%27 → toLowerCase → .NET 字元還原
 */
function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  encoded = encoded
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
  return encoded;
}

/**
 * 計算 CheckMacValue（SHA256）
 * @param {Object} params - 所有表單參數（不含 CheckMacValue）
 * @param {string} hashKey
 * @param {string} hashIv
 * @returns {string} 大寫 SHA256 hex
 */
function generateCheckMacValue(params, hashKey, hashIv) {
  // 1. 過濾掉既有的 CheckMacValue
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  // 2. Key 不分大小寫字典序排序
  const sorted = Object.keys(filtered).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  // 3. 組合字串
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIv}`;
  // 4. ECPay URL Encode
  const encoded = ecpayUrlEncode(raw);
  // 5. SHA256 → 大寫
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

/**
 * 驗證 CheckMacValue（timing-safe）
 * @param {Object} params - 含 CheckMacValue 的回傳參數
 * @param {string} hashKey
 * @param {string} hashIv
 * @returns {boolean}
 */
function verifyCheckMacValue(params, hashKey, hashIv) {
  const received = (params.CheckMacValue || '').toUpperCase();
  const calculated = generateCheckMacValue(params, hashKey, hashIv);
  const a = Buffer.from(received);
  const b = Buffer.from(calculated);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * 呼叫 QueryTradeInfo 主動查詢訂單狀態
 * @param {string} merchantTradeNo
 * @param {string} merchantId
 * @param {string} hashKey
 * @param {string} hashIv
 * @param {string} env - 'staging' | 'production'
 * @returns {Promise<Object>} 解析後的 URL-encoded 回應物件
 */
function queryTradeInfo(merchantTradeNo, merchantId, hashKey, hashIv, env = 'staging') {
  const params = {
    MerchantID: merchantId,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
  };
  params.CheckMacValue = generateCheckMacValue(params, hashKey, hashIv);

  const body = querystring.stringify(params);
  const url = new URL(ECPAY_URLS[env].query);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(querystring.parse(data));
          } catch (err) {
            reject(new Error('QueryTradeInfo 回應解析失敗: ' + data));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 取得 MerchantTradeDate（台灣時間 UTC+8，格式 yyyy/MM/dd HH:mm:ss）
 */
function getMerchantTradeDate() {
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const pad = n => n.toString().padStart(2, '0');
  return (
    `${tw.getUTCFullYear()}/${pad(tw.getUTCMonth() + 1)}/${pad(tw.getUTCDate())} ` +
    `${pad(tw.getUTCHours())}:${pad(tw.getUTCMinutes())}:${pad(tw.getUTCSeconds())}`
  );
}

module.exports = {
  ECPAY_URLS,
  ecpayUrlEncode,
  generateCheckMacValue,
  verifyCheckMacValue,
  queryTradeInfo,
  getMerchantTradeDate,
};
