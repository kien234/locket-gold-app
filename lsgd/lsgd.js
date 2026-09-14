/**
 * ====================================================================
 * 🏦 SCRIPT LẤY LỊCH SỬ GIAO DỊCH (LSGD) TỰ ĐỘNG - BANK ACB (NODE.JS)
 * ====================================================================
 * Chạy bằng lệnh: node get_lsgd.js
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
  // 1. Kiểm tra cache token nếu không ép làm mới
  if (!forceRefresh && fs.existsSync(CONFIG.tokenCacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CONFIG.tokenCacheFile, 'utf8'));
      // Token ACB hết hạn sau 15p -> dùng cache 10p cho an toàn
      if (cached.accessToken && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
        return cached.accessToken;
      }
    } catch(e) {
      // Bỏ qua lỗi cache
    }
  }

  // 2. Gửi request đăng nhập lấy token mới
  console.log('🔄 Đang đăng nhập ACB để lấy token mới...');
  const res = await acbRequest('/mb/v2/auth/tokens', 'POST', {
    username: CONFIG.username,
    password: CONFIG.password,
    clientId: CONFIG.clientId
  });

  if (res && res.accessToken) {
    fs.writeFileSync(CONFIG.tokenCacheFile, JSON.stringify({
      accessToken: res.accessToken,
      timestamp: Date.now()
    }), 'utf8');
    console.log('✅ Đăng nhập ACB thành công!');
    return res.accessToken;
  }

  throw new Error(`Đăng nhập ACB thất bại: ${JSON.stringify(res)}`);
}

// ── LẤY LỊCH SỬ GIAO DỊCH (LSGD) ──────────────────────────────────────
async function getLichSuGiaoDich(limit = 20) {
  let token = await getAccessToken();

  try {
    // Gọi API thông báo giao dịch biến động số dư ACB
    let res = await acbRequest(`/mb/legacy/ss/cs/bankservice/v2/notifications?page=0&size=${limit}&language=en`, 'GET', null, {
      'Authorization': 'bearer ' + token
    });

    // Nếu token hết hạn (401 / Unauthorized), thử làm mới token 1 lần
    if (res.message === 'Unauthorized' || res.codeStatus === 401) {
      console.log('⚠️ Token hết hạn, đang lấy lại token mới...');
      token = await getAccessToken(true);
      res = await acbRequest(`/mb/legacy/ss/cs/bankservice/v2/notifications?page=0&size=${limit}&language=en`, 'GET', null, {
        'Authorization': 'bearer ' + token
      });
    }

    if (res.codeStatus === 200 && Array.isArray(res.data)) {
      // Chuẩn hóa danh sách giao dịch
      const transactions = res.data.map(item => {
        const text = (item.title || '') + ' ' + (item.message || '');
        const isIncome = text.includes('+') || text.includes('GHI CÓ') || text.includes('CREDITED');

        // Tách số tiền giao dịch
        let amount = 0;
        const amtMatch = text.match(/[\+\-]\s*([\d,.]+)/);
        if (amtMatch) {
          amount = parseInt(amtMatch[1].replace(/[,.]/g, ''), 10);
        }

        return {
          id: item.id || '',
          type: isIncome ? 'IN' : 'OUT', // IN = Tiền vào (Cộng), OUT = Tiền ra (Trừ)
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
(async () => {
  console.log('🚀 Đang tải lịch sử giao dịch ACB...');
  const result = await getLichSuGiaoDich(20);
  
  console.log('\n📊 KẾT QUẢ LỊCH SỬ GIAO DỊCH (LSGD):');
  console.log(JSON.stringify(result, null, 2));
})();
