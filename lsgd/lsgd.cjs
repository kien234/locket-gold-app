/**
 * ====================================================================
 * 🏦 SCRIPT LẤY LỊCH SỬ GIAO DỊCH (LSGD) TỰ ĐỘNG - BANK ACB (NODE.JS)
 * ====================================================================
 * Chạy bằng lệnh: node lsgd/lsgd.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── CẤU HÌNH THÔNG TIN TÀI KHOẢN ACB ──────────────────────────────────
const CONFIG = {
  username: "21456181",      // Tên đăng nhập ACB
  password: "09042006Kien@", // Mật khẩu ACB
  accountNo: "21456181",     // Số tài khoản ACB
  clientId: "iuSuHYVufIUuNIREV0FB9EoLn9kHsDbm",
  tokenCacheFile: path.join(__dirname, '.acb_token_cache.json')
};

// ── HELPER TẠO REQUEST HTTPS ĐẾN ACB API ──────────────────────────────
function acbRequest(apiPath, method = 'GET', postData = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payloadStr = postData ? (typeof postData === 'string' ? postData : JSON.stringify(postData)) : null;
    const reqHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': 'ACB-MBA/9 CFNetwork/1399 Darwin/22.1.0',
      'apikey': 'CQk6S5usauGmMgMYLGqCuDtgtqIM8FI1',
      'x-app-version': '3.52.0',
      'x-device-id': 'E80CFFC6-F3CF-4718-B274-97DAFE0BE365',
      ...headers
    };
    if (payloadStr) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payloadStr);
    }

    const req = https.request({
      hostname: 'apiapp.acb.com.vn',
      path: apiPath,
      method,
      headers: reqHeaders,
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch(e) {
          resolve({ error: 'Lỗi parse JSON', rawBody: body });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Kết nối tới ACB bị Timeout (10s)'));
    });

    req.on('error', err => reject(err));
    if (payloadStr) req.write(payloadStr);
    req.end();
  });
}

// ── LẤY HOẶC TÁI SỬ DỤNG ACCESS TOKEN ─────────────────────────────────
async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh && fs.existsSync(CONFIG.tokenCacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CONFIG.tokenCacheFile, 'utf8'));
      if (cached.accessToken && (Date.now() - cached.timestamp < 3 * 60 * 1000)) {
        return cached.accessToken;
      }
    } catch(e) {}
  }

  console.log('🔄 Đang đăng nhập ACB để lấy token mới...');
  const res = await acbRequest('/mb/v2/auth/tokens', 'POST', {
    username: CONFIG.username,
    password: CONFIG.password,
    clientId: CONFIG.clientId
  });

  if (res && res.accessToken) {
    try {
      fs.writeFileSync(CONFIG.tokenCacheFile, JSON.stringify({
        accessToken: res.accessToken,
        timestamp: Date.now()
      }), 'utf8');
    } catch(e) {}
    console.log('✅ Đăng nhập ACB thành công!');
    return res.accessToken;
  }

  throw new Error(`Đăng nhập ACB thất bại: ${JSON.stringify(res)}`);
}

// ── LẤY LỊCH SỬ GIAO DỊCH (LSGD) ──────────────────────────────────────
async function getLichSuGiaoDich(limit = 20) {
  let token = await getAccessToken();

  try {
    let res = await acbRequest(`/mb/legacy/ss/cs/bankservice/v2/notifications?page=0&size=${limit}&language=en`, 'GET', null, {
      'Authorization': 'bearer ' + token
    });

    // Check if token expired (handles exp: "token expired", Unauthorized, 401, 403)
    const isTokenExpired = res.exp === 'token expired' || res.message === 'Unauthorized' || res.codeStatus === 401 || res.codeStatus === 403;

    if (isTokenExpired) {
      console.log('⚠️ Token ACB đã hết hạn, đang đăng nhập lại lấy token mới...');
      try { if (fs.existsSync(CONFIG.tokenCacheFile)) fs.unlinkSync(CONFIG.tokenCacheFile); } catch(e) {}
      token = await getAccessToken(true);
      res = await acbRequest(`/mb/legacy/ss/cs/bankservice/v2/notifications?page=0&size=${limit}&language=en`, 'GET', null, {
        'Authorization': 'bearer ' + token
      });
    }

    if (res.codeStatus === 200 && Array.isArray(res.data)) {
      const transactions = res.data.map(item => {
        const text = (item.title || '') + ' ' + (item.message || '');
        const isIncome = text.includes('+') || text.includes('GHI CÓ') || text.includes('CREDITED');

        let amount = 0;
        const amtMatch = text.match(/[\+\-]\s*([\d,.]+)/);
        if (amtMatch) {
          amount = parseInt(amtMatch[1].replace(/[,.]/g, ''), 10);
        }

        return {
          id: item.id || '',
          type: isIncome ? 'IN' : 'OUT',
          amount: amount,
          title: item.title || '',
          message: item.message || '',
          createdAt: item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '',
          rawTimestamp: item.createdAt || 0
        };
      });

      return {
        success: true,
        total: transactions.length,
        data: transactions
      };
    } else {
      return {
        success: false,
        error: res.message || 'Không thể lấy dữ liệu giao dịch',
        raw: res
      };
    }
  } catch(error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ── THỰC THI CHÍNH ───────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    console.log('🚀 Đang tải lịch sử giao dịch ACB...');
    const result = await getLichSuGiaoDich(20);
    
    console.log('\n📊 KẾT QUẢ LỊCH SỬ GIAO DỊCH (LSGD):');
    console.log(JSON.stringify(result, null, 2));
  })();
}

module.exports = {
  getLichSuGiaoDich,
  CONFIG,
};
