const https = require('https');
const fs = require('fs');
const path = require('path');

// Auto-load .env file if available (always overwrite process.env with latest .env values)
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] ? match[2].trim() : '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  } catch (_e) {}
}

const CONFIG = {
  get apiKey() { return process.env.SEPAY_API_KEY || ''; },
  get accountNo() { return process.env.SEPAY_ACCOUNT_NO || ''; },
  get bankBrand() { return process.env.SEPAY_BANK_BRAND || 'ACB'; },
  get accountName() { return process.env.SEPAY_ACCOUNT_NAME || ''; }
};

// Parse 1 giao dịch từ SePay v2 response sang định dạng nội bộ
function parseSePayTransaction(item) {
  if (!item) return null;
  const amountIn  = Number(item.amount_in  || item.transferAmount || item.amountIn  || 0);
  const amountOut = Number(item.amount_out || item.amountOut || 0);
  const isIncome  = amountIn > 0 || item.transfer_type === 'in' || item.transferType === 'in' || item.type === 'IN';

  const rawDateStr = item.transaction_date || item.transactionDate || item.createdAt || new Date().toISOString();
  let rawTimestamp = new Date(rawDateStr.replace(' ', 'T')).getTime();
  if (isNaN(rawTimestamp)) rawTimestamp = Date.now();

  const title   = String(item.code || item.reference_number || item.referenceCode || item.id || '');
  // SePay webhook chuẩn dùng field "content" (không phải "transaction_content")
  // Thứ tự ưu tiên: content → transaction_content → body → message → description → title
  const message = String(item.content || item.transaction_content || item.body || item.message || item.description || title);

  return {
    id: String(item.id || item.reference_number || item.referenceCode || `SP_${Date.now()}`),
    type: isIncome ? 'IN' : 'OUT',
    amount: isIncome ? amountIn : amountOut,
    title,
    message,
    createdAt: new Date(rawTimestamp).toLocaleString('vi-VN'),
    rawTimestamp,
    accountNumber: item.account_number || item.accountNumber || CONFIG.accountNo,
    bankBrand: item.bank_brand_name || item.gateway || CONFIG.bankBrand,
    referenceCode: item.reference_number || item.referenceCode || String(item.id || '')
  };
}

// Gọi SePay API v2: GET https://userapi.sepay.vn/v2/transactions
function sePayV2Request(queryParams = {}) {
  return new Promise((resolve, reject) => {
    const apiKey = CONFIG.apiKey;
    if (!apiKey) {
      return resolve({ status: 'error', error: 'SEPAY_API_KEY chưa được cấu hình trong file .env (Nhận webhook real-time vẫn hoạt động)' });
    }

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const apiPath = `/v2/transactions${qs.toString() ? '?' + qs.toString() : ''}`;

    const req = https.request({
      hostname: 'userapi.sepay.vn',
      path: apiPath,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'LocketGold-SePayClient/3.0'
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch(e) {
          resolve({ status: 'error', error: 'Lỗi parse JSON từ SePay', rawBody: body });
        }
      });
    });

    req.on('timeout', () => req.destroy(new Error('Kết nối tới SePay API bị Timeout (10s)')));
    req.on('error', err => reject(err));
    req.end();
  });
}

// Lấy lịch sử giao dịch ngân hàng từ SePay API v2
async function getLichSuGiaoDich(limit = 20, extraParams = {}) {
  try {
    const apiKey = CONFIG.apiKey;
    if (!apiKey) {
      return {
        success: false,
        error: 'SEPAY_API_KEY chưa được cấu hình trong file .env (Nhận webhook real-time vẫn hoạt động)',
        total: 0,
        data: []
      };
    }

    const params = {
      per_page: Math.min(limit, 100),
      transfer_type: 'in',            // Chỉ lấy giao dịch tiền vào
      transaction_date_sort: 'desc',  // Mới nhất trước
      ...extraParams
    };

    // Lọc theo số tài khoản nếu có cấu hình
    if (CONFIG.accountNo) params.q = CONFIG.accountNo;

    const res = await sePayV2Request(params);

    if (res.status === 'success' && Array.isArray(res.data)) {
      const transactions = res.data.map(parseSePayTransaction).filter(Boolean);
      return {
        success: true,
        total: res.meta?.pagination?.total || transactions.length,
        data: transactions,
        meta: res.meta
      };
    }

    const errMsg = res.error || res.message || 'Không thể tải lịch sử giao dịch từ SePay v2';
    return { success: false, error: errMsg, raw: res, data: [] };

  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
}

module.exports = {
  getLichSuGiaoDich,
  parseSePayTransaction,
  CONFIG
};
