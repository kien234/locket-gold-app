const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  username: "21456181",      // Tên đăng nhập ACB
  password: "09042006Kien@", // Mật khẩu ACB
  accountNo: "21456181",     // Số tài khoản ACB
  clientId: "iuSuHYVufIUuNIREV0FB9EoLn9kHsDbm",
  tokenCacheFile: path.join(__dirname, '.acb_token_cache.json')
};

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

async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh && fs.existsSync(CONFIG.tokenCacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CONFIG.tokenCacheFile, 'utf8'));
      if (cached.accessToken && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
        return cached.accessToken;
      }
    } catch(e) {}
  }

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
    return res.accessToken;
  }

  throw new Error(`Đăng nhập ACB thất bại: ${JSON.stringify(res)}`);
}

async function getLichSuGiaoDich(limit = 20) {
  let token = await getAccessToken();

  try {
    let res = await acbRequest(`/mb/legacy/ss/cs/bankservice/v2/notifications?page=0&size=${limit}&language=en`, 'GET', null, {
      'Authorization': 'bearer ' + token
    });

    if (res.message === 'Unauthorized' || res.codeStatus === 401) {
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

module.exports = {
  getLichSuGiaoDich,
  CONFIG,
};
