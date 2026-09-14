const express = require('express');
const cors = require('cors');
const https = require('https');
const { connectDb, createOrder, getOrderByUid } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize MongoDB Connection on server boot
connectDb();

function extractLocketUsername(input) {
  if (!input) return '';
  let str = String(input).trim();
  try { str = decodeURIComponent(str); } catch (_) {}
  str = str.replace(/^@+/, '').trim();
  if (str.includes('://') || str.toLowerCase().includes('locket') || str.includes('/')) {
    try {
      const urlStr = str.startsWith('http://') || str.startsWith('https://') ? str : `https://${str}`;
      const urlObj = new URL(urlStr);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        let lastPart = parts[parts.length - 1];
        lastPart = lastPart.split('?')[0].split('#')[0].replace(/^@+/, '').trim();
        lastPart = lastPart.replace(/\.(html|php|aspx|jsx|tsx|png|jpg|jpeg|gif|svg|webp)$/i, '');
        if (lastPart) return lastPart.toLowerCase();
      }
    } catch (_) {
      const match = str.match(/(?:locket[^\/]*\/|\/)([^\/\?\#\s]+)/i);
      if (match && match[1]) {
        let cleaned = match[1].replace(/^@+/, '').trim();
        cleaned = cleaned.replace(/\.(html|php|aspx|jsx|tsx|png|jpg|jpeg|gif|svg|webp)$/i, '');
        if (cleaned) return cleaned.toLowerCase();
      }
    }
  }
  str = str.split('?')[0].split('#')[0].replace(/^@+/, '').trim();
  return str.toLowerCase();
}

// 🔍 Tra Cứu Thông Tin Người Dùng & Gold Live (/api/v1/userinfo)
const handleUserInfoRequest = async (req, res) => {
  const rawUser = req.query.user || req.body?.user || '';
  const user = extractLocketUsername(rawUser);
  if (!user) {
    return res.status(400).json({ status: 'error', message: 'Thiếu tham số user hoặc uid.' });
  }

  try {
    const upstreamRes = await fetch(`https://api.locketgold.click/api/v1/userinfo?user=${encodeURIComponent(user)}`, {
      signal: AbortSignal.timeout(4000)
    });
    if (upstreamRes.ok) {
      const data = await upstreamRes.json();
      return res.json(data);
    }
  } catch (_e) {}

  try {
    const localRes = await fetch(`http://localhost:3000/api/v1/userinfo?user=${encodeURIComponent(user)}`, {
      signal: AbortSignal.timeout(3000)
    });
    if (localRes.ok) {
      const data = await localRes.json();
      return res.json(data);
    }
  } catch (_e) {}

  return res.status(404).json({ status: 'error', code: 404, message: `Tài khoản @${user} không tồn tại trên Locket.` });
};

app.get('/api/v1/userinfo', handleUserInfoRequest);
app.post('/api/v1/userinfo', handleUserInfoRequest);

// 👑 Kích Hoạt Locket Gold (/api/v1/gold & /api/v1/unlock) - GET & POST
const handleGoldActivationRequest = async (req, res) => {
  const rawUser = req.query.user || req.body?.user || '';
  const user = extractLocketUsername(rawUser);
  const category = (req.query.category || req.body?.category || 'yearly').trim().toLowerCase();

  if (!user) {
    return res.status(400).json({ status: 'error', message: 'Thiếu tham số user hoặc uid.' });
  }

  const upstreamUrls = [
    `https://api.locketgold.click/api/v1/gold?user=${encodeURIComponent(user)}&category=${encodeURIComponent(category)}`,
    `https://api.locketgold.click/api/v1/unlock?user=${encodeURIComponent(user)}&category=${encodeURIComponent(category)}`
  ];

  for (const url of upstreamUrls) {
    try {
      const upstreamRes = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (upstreamRes.ok) {
        const data = await upstreamRes.json();
        return res.status(upstreamRes.status).json(data);
      }
    } catch (_e) {}
  }

  try {
    const localRes = await fetch(`http://localhost:3000/api/v1/gold?user=${encodeURIComponent(user)}&category=${encodeURIComponent(category)}`, {
      signal: AbortSignal.timeout(3000)
    });
    if (localRes.ok) {
      const data = await localRes.json();
      return res.status(localRes.status).json(data);
    }
  } catch (_e) {}

  return res.status(500).json({ status: 'error', message: 'Không thể kết nối máy chủ kích hoạt Locket Gold' });
};

app.get('/api/v1/gold', handleGoldActivationRequest);
app.post('/api/v1/gold', handleGoldActivationRequest);
app.get('/api/v1/unlock', handleGoldActivationRequest);
app.post('/api/v1/unlock', handleGoldActivationRequest);

// 6. 📋 Xuất Danh Sách User Trong Database (/api/v1/listusers) - GET & POST
const handleListUsersRequest = async (req, res) => {
  const category = (req.query.category || req.body?.category || 'ALL').trim().toUpperCase();
  const page = parseInt(req.query.page || req.body?.page || '1', 10);
  const limit = parseInt(req.query.limit || req.body?.limit || '50', 10);

  try {
    const upstreamRes = await fetch(
      `https://api.locketgold.click/api/v1/listusers?category=${encodeURIComponent(category)}&page=${page}&limit=${limit}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (upstreamRes.ok) {
      const data = await upstreamRes.json();
      return res.status(upstreamRes.status).json(data);
    }
  } catch (_e) {}

  try {
    const localRes = await fetch(
      `http://localhost:3000/api/v1/listusers?category=${encodeURIComponent(category)}&page=${page}&limit=${limit}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (localRes.ok) {
      const data = await localRes.json();
      return res.status(localRes.status).json(data);
    }
  } catch (_e) {}

  return res.status(500).json({ status: 'error', message: 'Không thể xuất danh sách người dùng Locket Gold' });
};

app.get('/api/v1/listusers', handleListUsersRequest);
app.post('/api/v1/listusers', handleListUsersRequest);

// Proxy helper to fetch locket.cam HTML
app.get('/api/locket/:username', (req, res) => {
  const username = req.params.username;
  const targetUrl = `https://locket.cam/${encodeURIComponent(username)}`;

  const clientReq = https.get(targetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    }
  }, (targetRes) => {
    let body = '';
    targetRes.on('data', chunk => body += chunk);
    targetRes.on('end', () => {
      res.status(targetRes.statusCode).send(body);
    });
  });

  clientReq.on('error', (err) => {
    res.status(500).json({ error: 'Failed to fetch from locket.cam', details: err.message });
  });
});

// Create Order API (Async MongoDB)
app.post('/api/orders/create', async (req, res) => {
  try {
    const { username, uid, packageId } = req.body;
    if (!username || !uid || !packageId) {
      return res.status(400).json({ error: 'Thiếu thông tin username, uid hoặc packageId' });
    }

    const order = await createOrder({ username, uid, packageId });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check Order Status API (Async MongoDB)
app.get('/api/orders/status', async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ error: 'Thiếu tham số uid' });
    }

    const order = await getOrderByUid(uid);
    if (!order) {
      return res.json({ status: 'NOT_FOUND', order: null });
    }

    res.json({ status: order.status, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Locket Gold Express Server + MongoDB running on http://localhost:${PORT}`);
});
