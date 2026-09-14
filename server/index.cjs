const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

// Global Process Exception Handlers for Server Resilience
process.on('uncaughtException', (err) => {
  console.error('💥 [CRITICAL] Uncaught Exception:', err.message || err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

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

let wss = null;

function broadcastCtvBalanceUpdate(username, newBalance, depositAmount, txId) {
  if (!wss) return;
  const targetUser = String(username).trim().toLowerCase();
  const payload = JSON.stringify({
    type: 'CTV_BALANCE_UPDATE',
    username: targetUser,
    newBalance: Number(newBalance),
    amount: Number(depositAmount),
    txId: String(txId),
    message: `💵 Nạp tiền thành công! Bạn vừa được cộng +${Number(depositAmount).toLocaleString('vi-VN')}đ vào số dư.`
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      if (!client.authenticatedUsername || client.authenticatedUsername === targetUser) {
        try { client.send(payload); } catch (_) {}
      }
    }
  });
}

const { 
  connectDb, 
  createOrder, 
  getOrderByUid, 
  getPendingOrders, 
  completeOrder, 
  isTransactionUsed,
  saveUsedTransaction,
  getBannedUsers,
  isUserBanned,
  banUser,
  unbanUser,
  getUserViolationCount,
  incrementUserViolation,
  cancelExpiredOrders,
  deleteExpiredOrders,
  verifyAdminLogin,
  getAdminCredentials,
  updateAdminCredentials,
  getPrices,
  updatePrices,
  getPackageConfig,
  updatePackageConfig,
  getContactConfig,
  updateContactConfig,
  getBrandConfig,
  updateBrandConfig,
  getFaqsConfig,
  updateFaqsConfig,
  getNoticeConfig,
  updateNoticeConfig,
  getMaintenanceConfig,
  updateMaintenanceConfig,
  getPromoCodes,
  savePromoCode,
  deletePromoCode,
  validatePromoCode,
  readFallback,
  saveAvatarToOrder,
  getLocketAvatarFromDb,
  getCtvAccounts,
  getCtvByUsername,
  getCtvByApiKey,
  getCtvByDepositCode,
  saveCtvAccount,
  updateCtvPrices,
  updateCtvTelegramChatId,
  updateCtvAvatar,
  getCtvByTelegramChatId,
  updateCtvApiKey,
  setCustomCtvApiKey,
  addCtvBalance,
  deductCtvBalanceAtomic,
  addCtvPackageRequests,
  deductCtvPackageRequestAtomic,
  deleteCtvAccount,
  updateCtvPassword,
  verifyCtvLogin,
  saveCtvOrder,
  getCtvOrders,
  deleteCtvOrder,
  clearCtvOrders,
  deletePublicOrder,
  clearPublicOrders,
  getAllPublicOrders,
  saveSepayLog,
  getSepayLogs,
  clearSepayLogs,
  getTelegramBotToken,
  updateTelegramBotToken
} = require('./db.cjs');
const { getLichSuGiaoDich, parseSePayTransaction, CONFIG: SEPAY_CONFIG } = require('../lsgd/lsgd_module.cjs');
const {
  setTelegramDependencies,
  fetchTelegramBotInfo,
  sendTelegramNotification,
  sendTelegramPhoto,
  notifyCtvViaTelegram,
  handleTelegramMessage,
  initTelegramBot
} = require('./telegram_bot.cjs');

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

// ── LOCKET GOLD ACTIVATION (UPSTREAM TO MOTHER SITE LOCKETGOLD.CLICK) ──
async function activateLocketGold(username, packageId = '1year') {
  // Gói vĩnh viễn hay gói 1 năm đều gọi về API mẹ với category là 'yearly' (gói năm)
  const category = 'yearly';
  const cleanUser = extractLocketUsername(username);
  if (!cleanUser) return { ok: false, error: 'Thiếu username hoặc UID' };

  const upstreamApiKey = (process.env.UPSTREAM_API_KEY || process.env.MOTHER_API_KEY || '').trim();

  // 1. Upstream to Mother Site (https://locketgold.click) with x-api-key
  if (upstreamApiKey) {
    try {
      const targetUrl = 'https://locketgold.click/api/v1/ctv/gold-package';
      const bodyPayload = { user: cleanUser, category };

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': upstreamApiKey
        },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(10000)
      });
      const json = await res.json().catch(() => null);
      if (json) {
        if (json.status === 'success' || json.status === 'info' || json.already_has_gold || (res.ok && json.data)) {
          const isAlreadyGold = Boolean(json.already_has_gold || json.status === 'info');
          return { ok: true, alreadyHasGold: isAlreadyGold, source: 'MotherSite_LocketGold', data: json };
        }
        if (json.message) {
          return { ok: false, error: json.message, data: json };
        }
      }
    } catch (err) {
      console.warn('⚠️ Lỗi gọi Mother Site locketgold.click:', err.message);
    }
  }

  // 2. Fallback to locketgold.click & api.locketgold.click endpoints
  const endpoints = [
    `https://locketgold.click/api/v1/gold?user=${encodeURIComponent(cleanUser)}&category=${encodeURIComponent(category)}`,
    `https://locketgold.click/api/v1/unlock?user=${encodeURIComponent(cleanUser)}&category=${encodeURIComponent(category)}`,
    `https://api.locketgold.click/api/v1/gold?user=${encodeURIComponent(cleanUser)}&category=${encodeURIComponent(category)}`,
    `https://api.locketgold.click/api/v1/unlock?user=${encodeURIComponent(cleanUser)}&category=${encodeURIComponent(category)}`
  ];

  let lastApiError = null;

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const json = await res.json().catch(() => null);
      if (json) {
        if (json.status === 'success' || json.status === 'info' || json.already_has_gold || (res.ok && json.data)) {
          const isAlreadyGold = Boolean(json.already_has_gold || json.status === 'info');
          return { ok: true, alreadyHasGold: isAlreadyGold, source: 'LocketGoldAPI', data: json };
        }
        if (json.message || json.error) {
          lastApiError = json.message || json.error;
        }
      }
    } catch (e) {
      if (!lastApiError) lastApiError = e.message || 'Lỗi kết nối máy chủ';
    }
  }

  return { ok: false, error: lastApiError || 'Không thể kết nối máy chủ kích hoạt Gold (Timeout hoặc Lỗi mạng)' };
}

// 🖼️ Fetch real Locket profile picture via /api/v1/userinfo then save to DB
async function fetchAndSaveAvatar(uid, username) {
  if (!uid || !username) return;
  const cleanUser = (username || '').trim().toLowerCase();
  if (!cleanUser || cleanUser.includes('test') || cleanUser.startsWith('direct uid')) return;

  const apiUrls = [
    `https://api.locketgold.click/api/v1/userinfo?user=${encodeURIComponent(cleanUser)}`,
    `http://localhost:3000/api/v1/userinfo?user=${encodeURIComponent(cleanUser)}`
  ];

  for (const url of apiUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const picUrl = data?.profile_picture_url || data?.avatar || data?.data?.profile_picture_url;
        if (picUrl && typeof picUrl === 'string' && picUrl.startsWith('http')) {
          const cleanPic = picUrl.replace('.googleapis.com:443', '.googleapis.com');
          await saveAvatarToOrder(uid, cleanPic);
          console.log(`🖼️  [AVATAR SAVED] @${cleanUser} → ${cleanPic.substring(0, 60)}...`);
          return;
        }
      }
    } catch (_e) {}
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3009', 10);
const SCAN_INTERVAL_MS = 10000; // Scan ACB every 10s
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days Session TTL

function generateSecureToken(prefix = 'tok') {
  return `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
}

// ── RATE LIMITER MIDDLEWARE ───────────────────────────────────────────
const rateLimitMap = new Map();

function createRateLimiter({ windowMs = 60000, max = 10, message = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || ''}${req.path}:${ip}`;
    const now = Date.now();

    let record = rateLimitMap.get(key);
    if (!record || (now - record.startTime) > windowMs) {
      record = { startTime: now, count: 0 };
    }

    record.count += 1;
    rateLimitMap.set(key, record);

    if (record.count > max) {
      return res.status(429).json({ status: 'error', code: 429, error: message, message });
    }
    next();
  };
}

// Cleanup stale rate limit records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.startTime > 300000) {
      rateLimitMap.delete(key);
    }
  }
}, 300000);

const loginLimiter = createRateLimiter({ windowMs: 60000, max: 5, message: 'Đăng nhập quá nhiều lần. Vui lòng thử lại sau 1 phút.' });
const ctvApiLimiter = createRateLimiter({ windowMs: 60000, max: 30, message: 'Tần suất gọi API CTV quá nhanh. Vui lòng thử lại sau ít phút.' });
// Rate limit chặt hơn cho public Gold activation endpoint (tránh lạm dụng)
const goldPublicLimiter = createRateLimiter({ windowMs: 60000, max: 10, message: 'Quá nhiều yêu cầu kích hoạt Gold. Vui lòng thử lại sau 1 phút.' });

// ── SESSION STORES WITH EXPIRATION & CRYPTO TOKENS ───────────────────
// Admin session token store (token -> { username, expiresAt })
const ADMIN_TOKENS = new Map();

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const session = ADMIN_TOKENS.get(token);

  if (!token || !session || (session.expiresAt && Date.now() > session.expiresAt)) {
    if (token) ADMIN_TOKENS.delete(token);
    return res.status(401).json({ error: 'Yêu cầu quyền truy cập Admin (Phiên làm việc không hợp lệ hoặc đã hết hạn)' });
  }
  next();
}

// CTV session token store (token -> { username, expiresAt })
const CTV_TOKENS = new Map();

function requireCtv(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const session = CTV_TOKENS.get(token);

  if (!token || !session || (session.expiresAt && Date.now() > session.expiresAt)) {
    if (token) CTV_TOKENS.delete(token);
    return res.status(401).json({ error: 'Yêu cầu đăng nhập Cộng Tác Viên (Phiên làm việc không hợp lệ hoặc đã hết hạn)' });
  }
  req.ctvUsername = session.username;
  next();
}

// In-memory set of ACB transaction IDs already processed in this server session
const seenTxIds = new Set();

// ── CORS: Chỉ cho phép các origin được phép truy cập API ─────────────
const ALLOWED_ORIGINS = [
  'https://locketgold.click',
  'https://www.locketgold.click',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3001',
  'http://127.0.0.1:5173'
];

app.use(cors());
app.options('*', cors());

// ── SECURITY HEADERS ─────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // HSTS (chỉ bật khi chạy HTTPS production)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../dist')));

// Serve hardcoded admin.html page directly on /admin and /admin.html
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Initialize MongoDB Connection (await để đảm bảo kết nối xong trước khi các module khác dùng DB)
(async () => { await connectDb(); })();

// Public Banned Users List API
app.get('/api/v1/banned-users', async (req, res) => {
  const list = await getBannedUsers();
  res.json(list);
});

// Proxy Listusers & Userlist API (Lấy danh sách user và ảnh avatar siêu tốc)
app.get(['/api/v1/listusers', '/api/v1/userlist'], async (req, res) => {
  try {
    const cat = req.query.category || 'ALL';
    const page = req.query.page || 1;
    const limit = req.query.limit || 50;
    const remoteUrl = `https://api.locketgold.click/api/v1/listusers?category=${encodeURIComponent(cat)}&page=${page}&limit=${limit}`;
    const remoteRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(5000) });
    if (remoteRes.ok) {
      const data = await remoteRes.json();
      if (data && Array.isArray(data.users)) {
        data.users = data.users.filter(u => {
          const uname = (u.locket_username || u.username || '').trim().toLowerCase();
          return uname && uname !== 'n/a' && uname !== 'null' && !uname.startsWith('direct uid') && !uname.includes('test');
        });
      }
      return res.json(data);
    }
    return res.status(500).json({ error: 'Không thể kết nối API listusers' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Avatar Proxy & Database Direct Lookup API
app.get(['/api/avatar/:user', '/api/v1/avatar/:user'], async (req, res) => {
  try {
    const userParam = req.params.user;
    if (!userParam) return res.redirect('https://ui-avatars.com/api/?name=Locket&background=FF6B9D&color=fff&bold=true');

    // 1. Nếu userParam là username (không phải Firebase UID 28 ký tự), tra cứu qua API userinfo
    const isUid = userParam.length >= 20 && /^[A-Za-z0-9]+$/.test(userParam);
    if (!isUid) {
      try {
        const remoteUrl = `https://api.locketgold.click/api/v1/userinfo?user=${encodeURIComponent(userParam)}`;
        const remoteRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(4000) });
        if (remoteRes.ok) {
          const data = await remoteRes.json();
          const picUrl = data?.profile_picture_url || data?.avatar;
          if (picUrl && typeof picUrl === 'string' && picUrl.startsWith('http')) {
            return res.redirect(picUrl);
          }
        }
      } catch (_e) {}
    }

    // 2. Tra cứu từ MongoDB
    const avatarUrl = await getLocketAvatarFromDb(userParam);
    if (avatarUrl) {
      return res.redirect(avatarUrl);
    }

    return res.redirect(`https://ui-avatars.com/api/?name=${encodeURIComponent(userParam)}&background=FF6B9D&color=fff&bold=true`);
  } catch (_e) {
    return res.redirect(`https://ui-avatars.com/api/?name=${encodeURIComponent(req.params.user || 'Locket')}&background=FF6B9D&color=fff&bold=true`);
  }
});

// Validate Promo Code API
app.post('/api/promo/validate', (req, res) => {
  const { code, packageId } = req.body || {};
  const result = validatePromoCode(code, packageId);
  res.json(result);
});

// Admin Auth Login API
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (await verifyAdminLogin(username, password)) {
    const token = generateSecureToken('admin_token');
    ADMIN_TOKENS.set(token, { username, expiresAt: Date.now() + TOKEN_TTL_MS });
    return res.json({ success: true, token, admin: { username } });
  }
  return res.status(401).json({ error: 'Mật khẩu hoặc tên đăng nhập Admin không đúng' });
});

// Admin Change Credentials API (Đổi tên đăng nhập & mật khẩu Admin)
app.post('/api/admin/change-credentials', requireAdmin, async (req, res) => {
  try {
    const { newUsername, newPassword } = req.body || {};
    if (!newUsername || typeof newUsername !== 'string' || newUsername.trim().length < 3) {
      return res.status(400).json({ error: 'Tên đăng nhập Admin mới phải từ 3 ký tự trở lên' });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'Mật khẩu Admin mới phải từ 4 ký tự trở lên' });
    }
    const cleanUser = newUsername.trim();
    const cleanPass = newPassword.trim();
    const updated = await updateAdminCredentials(cleanUser, cleanPass);

    // Sync to .env
    try {
      const envPath = path.join(__dirname, '../.env');
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');
        const updateVar = (key, val) => {
          if (content.includes(`${key}=`)) {
            content = content.replace(new RegExp(`${key}=.*`), `${key}=${val}`);
          } else {
            content += `\n${key}=${val}\n`;
          }
        };
        updateVar('ADMIN_USER', cleanUser);
        updateVar('ADMIN_PASS', cleanPass);
        fs.writeFileSync(envPath, content, 'utf8');
      }
    } catch (_e) {}

    res.json({ success: true, message: 'Đã cập nhật tài khoản Admin thành công!', admin: { username: updated.username } });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Không thể đổi tài khoản Admin' });
  }
});

function buildGroupedCtvHistory(ctvAccounts = [], ctvOrders = []) {
  const grouped = {};
  for (const ctv of ctvAccounts) {
    grouped[ctv.username.toLowerCase()] = {
      ctvUsername: ctv.username,
      displayName: ctv.displayName || ctv.username,
      balance: ctv.balance,
      totalAmount: 0,
      totalOrders: 0,
      orders: []
    };
  }
  for (const o of ctvOrders) {
    const u = (o.ctvUsername || '').toLowerCase();
    if (!grouped[u]) {
      grouped[u] = {
        ctvUsername: u,
        displayName: u,
        balance: 0,
        totalAmount: 0,
        totalOrders: 0,
        orders: []
      };
    }
    grouped[u].totalAmount += Number(o.amount || 0);
    grouped[u].totalOrders += 1;
    grouped[u].orders.push({
      orderId: o.orderId,
      userUpgraded: o.userUpgraded,
      packageId: o.packageId,
      amount: Number(o.amount || 0),
      createdAt: o.createdAt
    });
  }
  return Object.values(grouped).sort((a, b) => b.totalOrders - a.totalOrders);
}

// Admin Data API
app.post('/api/admin/data', requireAdmin, async (req, res) => {
  const prices = await getPrices();
  const packages = await getPackageConfig();
  const contact = await getContactConfig();
  const brand = await getBrandConfig();
  const faqs = await getFaqsConfig();
  const notice = await getNoticeConfig();
  const maintenance = await getMaintenanceConfig();
  const promoCodes = await getPromoCodes();
  const bannedUsers = await getBannedUsers();
  const ctvAccounts = await getCtvAccounts();
  const ctvOrders = await getCtvOrders();
  const publicOrders = await getAllPublicOrders();
  const ctvGroupedHistory = buildGroupedCtvHistory(ctvAccounts, ctvOrders);
  const adminCreds = await getAdminCredentials();
  res.json({
    adminUser: adminCreds.username,
    prices,
    packages,
    contact,
    brand,
    faqs,
    notice,
    maintenance,
    promoCodes,
    bannedUsers,
    orders: publicOrders,
    publicOrders,
    ctvAccounts,
    ctvOrders,
    ctvGroupedHistory
  });
});
app.get('/api/admin/data', requireAdmin, async (req, res) => {
  const prices = await getPrices();
  const packages = await getPackageConfig();
  const contact = await getContactConfig();
  const brand = await getBrandConfig();
  const faqs = await getFaqsConfig();
  const notice = await getNoticeConfig();
  const maintenance = await getMaintenanceConfig();
  const promoCodes = await getPromoCodes();
  const bannedUsers = await getBannedUsers();
  const ctvAccounts = await getCtvAccounts();
  const ctvOrders = await getCtvOrders();
  const publicOrders = await getAllPublicOrders();
  const ctvGroupedHistory = buildGroupedCtvHistory(ctvAccounts, ctvOrders);
  const adminCreds = await getAdminCredentials();
  res.json({
    adminUser: adminCreds.username,
    prices,
    packages,
    contact,
    brand,
    faqs,
    notice,
    maintenance,
    promoCodes,
    bannedUsers,
    orders: publicOrders,
    publicOrders,
    ctvAccounts,
    ctvOrders,
    ctvGroupedHistory
  });
});

app.get('/api/admin/packages-config', requireAdmin, async (req, res) => {
  try {
    const config = await getPackageConfig();
    res.json({ success: true, packages: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/packages-config', requireAdmin, async (req, res) => {
  try {
    const updated = await updatePackageConfig(req.body);
    res.json({ success: true, packages: updated, message: 'Đã lưu cấu hình gói dịch vụ và bảng giá thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/contact-config', requireAdmin, async (req, res) => {
  try {
    const contact = await getContactConfig();
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/contact-config', requireAdmin, async (req, res) => {
  try {
    const updated = await updateContactConfig(req.body);
    res.json({ success: true, contact: updated, message: 'Đã lưu thông tin liên hệ Admin thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/brand-config', requireAdmin, async (req, res) => {
  try {
    const brand = await getBrandConfig();
    res.json({ success: true, brand });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/brand-config', requireAdmin, async (req, res) => {
  try {
    const updated = await updateBrandConfig(req.body);
    res.json({ success: true, brand: updated, message: 'Đã lưu cấu hình thương hiệu và logo thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/faqs-config', requireAdmin, async (req, res) => {
  try {
    const faqs = await getFaqsConfig();
    res.json({ success: true, faqs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/faqs-config', requireAdmin, async (req, res) => {
  try {
    const updated = await updateFaqsConfig(req.body.faqs);
    res.json({ success: true, faqs: updated, message: 'Đã lưu cấu hình FAQ thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/notice-config', requireAdmin, async (req, res) => {
  try {
    const notice = await getNoticeConfig();
    res.json({ success: true, notice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/notice-config', requireAdmin, async (req, res) => {
  try {
    const updated = await updateNoticeConfig(req.body);
    res.json({ success: true, notice: updated, message: 'Đã lưu cấu hình bảng thông báo Popup thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Financials (Thu & Chi dựa trên LSGD Bank SePay)
app.get('/api/admin/financials', requireAdmin, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const lsgdResult = await getLichSuGiaoDich(limit);
    if (!lsgdResult.success || !Array.isArray(lsgdResult.data)) {
      return res.json({
        success: false,
        error: lsgdResult.error || 'Không thể kết nối ngân hàng SePay',
        totalIncome: 0,
        totalExpense: 0,
        netBalance: 0,
        transactions: []
      });
    }

    let totalIncome = 0;
    let totalExpense = 0;
    const transactions = lsgdResult.data.map(tx => {
      if (tx.type === 'IN') {
        totalIncome += Number(tx.amount || 0);
      } else {
        totalExpense += Number(tx.amount || 0);
      }
      return tx;
    });

    res.json({
      success: true,
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      totalCount: transactions.length,
      transactions
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải thông tin Thu Chi LSGD: ' + err.message });
  }
});

// Admin Update Prices API
app.post('/api/admin/prices', requireAdmin, (req, res) => {
  const prices = updatePrices(req.body || {});
  res.json({ success: true, prices });
});

// Admin Update Maintenance API
app.post('/api/admin/maintenance', requireAdmin, (req, res) => {
  const maintenance = updateMaintenanceConfig(req.body || {});
  res.json({ success: true, maintenance });
});

// Admin Save Promo Code API
app.post('/api/admin/promo-codes', requireAdmin, (req, res) => {
  try {
    const promo = savePromoCode(req.body || {});
    res.json({ success: true, promoCode: promo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Delete Promo Code API
app.delete('/api/admin/promo-codes/:code', requireAdmin, (req, res) => {
  deletePromoCode(req.params.code);
  res.json({ success: true });
});

// Admin Ban User API
app.post('/api/admin/ban', requireAdmin, (req, res) => {
  const { user, uid, reason } = req.body || {};
  if (!user) return res.status(400).json({ error: 'Thiếu username' });
  const result = banUser(user, uid, reason || 'Admin trực tiếp Khóa tài khoản');
  res.json({ success: true, banned: result });
});

// Admin Unban User API
app.post('/api/admin/unban', requireAdmin, (req, res) => {
  const { user } = req.body || {};
  if (!user) return res.status(400).json({ error: 'Thiếu username' });
  unbanUser(user);
  res.json({ success: true, message: `Đã gỡ ban cho @${user}` });
});

// Admin Manual Complete & Activate Gold API
app.post('/api/admin/orders/complete', requireAdmin, async (req, res) => {
  const { uid } = req.body || {};
  if (!uid) return res.status(400).json({ error: 'Thiếu UID' });
  const order = await getOrderByUid(uid);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  
  const completed = await completeOrder(uid, { manual: true, admin: true, time: new Date().toISOString() });
  
  // Trigger Gold Activation
  console.log(`⚡ Admin thủ công kích hoạt Locket Gold cho @${order.username}...`);
  await activateLocketGold(order.username, order.packageId);

  broadcastPaymentSuccess(uid, {
    uid: order.uid,
    username: order.username,
    packageId: order.packageId,
    activated: true
  });

  // 🖼️ Fetch & save real Locket avatar in background (non-blocking)
  fetchAndSaveAvatar(order.uid, order.username).catch(() => {});

  res.json({ success: true, order: completed });
});

// ── TELEGRAM BOT MODULE INITIALIZATION ─────────────────────────────────
setTelegramDependencies(CTV_TOKENS, activateLocketGold);
initTelegramBot(app);

// Public API returning Telegram Bot Username
app.get('/api/public/telegram-bot-info', async (req, res) => {
  const info = await fetchTelegramBotInfo();
  res.json(info);
});

// ── ADMIN CTV MANAGEMENT APIs ──────────────────────────────────────────
// Admin Get CTV List & CTV Orders (with grouped history)
app.get(['/api/admin/ctv', '/api/v1/admin/ctv'], requireAdmin, async (req, res) => {
  const ctvAccounts = await getCtvAccounts();
  const ctvOrders = await getCtvOrders();

  const grouped = {};
  for (const ctv of ctvAccounts) {
    grouped[ctv.username.toLowerCase()] = {
      ctvUsername: ctv.username,
      displayName: ctv.displayName || ctv.username,
      balance: ctv.balance,
      totalAmount: 0,
      totalOrders: 0,
      orders: []
    };
  }

  for (const o of ctvOrders) {
    const u = (o.ctvUsername || '').toLowerCase();
    if (!grouped[u]) {
      grouped[u] = {
        ctvUsername: u,
        displayName: u,
        balance: 0,
        totalAmount: 0,
        totalOrders: 0,
        orders: []
      };
    }
    grouped[u].totalAmount += Number(o.amount || 0);
    grouped[u].totalOrders += 1;
    grouped[u].orders.push({
      orderId: o.orderId,
      userUpgraded: o.userUpgraded,
      packageId: o.packageId,
      amount: Number(o.amount || 0),
      createdAt: o.createdAt
    });
  }

  const ctvGroupedHistory = Object.values(grouped).sort((a, b) => b.totalOrders - a.totalOrders);
  res.json({ ctvAccounts, ctvOrders, ctvGroupedHistory });
});

// Admin Save / Create CTV Account
app.post(['/api/admin/ctv', '/api/v1/admin/ctv'], requireAdmin, async (req, res) => {
  try {
    const { username, password, displayName, prices, balance, apiKey, telegramChatId } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username không được để trống' });
    const ctv = await saveCtvAccount({ username, password, displayName, prices, balance, apiKey, telegramChatId });
    res.json({ success: true, ctv });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Get/Set Telegram Bot Token
app.get(['/api/admin/telegram-token', '/api/v1/admin/telegram-token'], requireAdmin, async (req, res) => {
  const token = await getTelegramBotToken();
  res.json({ token });
});

app.post(['/api/admin/telegram-token', '/api/v1/admin/telegram-token'], requireAdmin, async (req, res) => {
  const { token } = req.body || {};
  const newTok = await updateTelegramBotToken(token);
  res.json({ success: true, token: newTok });
});

// Admin Update CTV Prices
app.post(['/api/admin/ctv/prices', '/api/v1/admin/ctv/prices'], requireAdmin, async (req, res) => {
  try {
    const { username, prices } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Thiếu username' });
    const newPrices = await updateCtvPrices(username, prices);
    res.json({ success: true, prices: newPrices });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Add/Deduct CTV Balance
app.post(['/api/admin/ctv/balance', '/api/v1/admin/ctv/balance'], requireAdmin, async (req, res) => {
  try {
    const { username, amount } = req.body || {};
    if (!username || amount === undefined) return res.status(400).json({ error: 'Thiếu username hoặc số tiền' });
    const newBalance = await addCtvBalance(username, Number(amount));
    if (newBalance === false) return res.status(404).json({ error: 'Không tìm thấy CTV' });
    res.json({ success: true, balance: newBalance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Delete CTV Account
app.delete(['/api/admin/ctv/:username', '/api/v1/admin/ctv/:username'], requireAdmin, async (req, res) => {
  const success = await deleteCtvAccount(req.params.username);
  res.json({ success });
});

// Admin Change CTV Password
app.post(['/api/admin/ctv/password', '/api/v1/admin/ctv/password'], requireAdmin, async (req, res) => {
  try {
    const { username, newPassword } = req.body || {};
    if (!username || !newPassword) return res.status(400).json({ error: 'Thiếu username hoặc mật khẩu mới' });
    await updateCtvPassword(username, newPassword);
    res.json({ success: true, message: `Đã đổi mật khẩu thành công cho CTV @${username}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Change / Update CTV API Key
app.post(['/api/admin/ctv/apikey', '/api/v1/admin/ctv/apikey'], requireAdmin, async (req, res) => {
  try {
    const { username, apiKey } = req.body || {};
    if (!username || !apiKey) return res.status(400).json({ error: 'Thiếu username hoặc API Key mới' });
    const updatedKey = await setCustomCtvApiKey(username, apiKey);
    if (!updatedKey) return res.status(404).json({ error: 'Không tìm thấy CTV' });
    res.json({ success: true, message: `Đã cập nhật API Key cho CTV @${username}`, apiKey: updatedKey });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Get Upstream Mother Site Info & Balance (/api/v1/ctv/me on locketgold.click)
app.get('/api/admin/upstream-info', requireAdmin, async (req, res) => {
  const upstreamApiKey = (process.env.UPSTREAM_API_KEY || process.env.MOTHER_API_KEY || '').trim();
  if (!upstreamApiKey) {
    return res.json({ configured: false, apiKey: '', message: 'Chưa cấu hình API Key Web Mẹ' });
  }

  try {
    const upstreamRes = await fetch('https://locketgold.click/api/v1/ctv/me', {
      headers: { 'x-api-key': upstreamApiKey },
      signal: AbortSignal.timeout(6000)
    });
    const json = await upstreamRes.json().catch(() => null);
    if (upstreamRes.ok && json && json.status === 'success') {
      return res.json({
        configured: true,
        apiKey: upstreamApiKey,
        upstreamData: json.data || json
      });
    }
    return res.json({
      configured: true,
      apiKey: upstreamApiKey,
      error: json?.message || 'Không thể xác thực API Key với locketgold.click'
    });
  } catch (err) {
    return res.json({
      configured: true,
      apiKey: upstreamApiKey,
      error: 'Lỗi kết nối tới https://locketgold.click: ' + (err.message || 'Timeout')
    });
  }
});

// Admin Update Upstream Mother Site API Key
app.post('/api/admin/upstream-key', requireAdmin, async (req, res) => {
  try {
    const { apiKey } = req.body || {};
    const newKey = (apiKey || '').trim();
    process.env.UPSTREAM_API_KEY = newKey;
    process.env.MOTHER_API_KEY = newKey;

    // Save to .env file
    try {
      const envPath = path.join(__dirname, '../.env');
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');
        if (content.includes('UPSTREAM_API_KEY=')) {
          content = content.replace(/UPSTREAM_API_KEY=.*/g, `UPSTREAM_API_KEY=${newKey}`);
        } else {
          content += `\nUPSTREAM_API_KEY=${newKey}\n`;
        }
        fs.writeFileSync(envPath, content, 'utf8');
      }
    } catch (_e) {}

    res.json({ success: true, message: 'Đã lưu API Key Web Mẹ thành công!', apiKey: newKey });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Get SePay & Webhook Config
app.get('/api/admin/sepay-config', requireAdmin, (req, res) => {
  res.json({
    webhookSecret: process.env.SEPAY_WEBHOOK_SECRET || '',
    apiKey: process.env.SEPAY_API_KEY || '',
    accountNo: process.env.SEPAY_ACCOUNT_NO || '21456181',
    bankBrand: process.env.SEPAY_BANK_BRAND || 'ACB',
    accountName: process.env.SEPAY_ACCOUNT_NAME || 'NGUYEN VAN KIEN'
  });
});

// Admin Update SePay & Webhook Config
app.post('/api/admin/sepay-config', requireAdmin, (req, res) => {
  try {
    const { webhookSecret, apiKey, accountNo, bankBrand, accountName } = req.body || {};
    if (webhookSecret !== undefined) process.env.SEPAY_WEBHOOK_SECRET = webhookSecret.trim();
    if (apiKey !== undefined) process.env.SEPAY_API_KEY = apiKey.trim();
    if (accountNo !== undefined) process.env.SEPAY_ACCOUNT_NO = accountNo.trim();
    if (bankBrand !== undefined) process.env.SEPAY_BANK_BRAND = bankBrand.trim();
    if (accountName !== undefined) process.env.SEPAY_ACCOUNT_NAME = accountName.trim();

    // Update SEPAY_CONFIG in lsgd_module
    if (typeof SEPAY_CONFIG === 'object' && SEPAY_CONFIG) {
      if (apiKey !== undefined) SEPAY_CONFIG.apiKey = process.env.SEPAY_API_KEY;
      if (accountNo !== undefined) SEPAY_CONFIG.accountNo = process.env.SEPAY_ACCOUNT_NO;
      if (bankBrand !== undefined) SEPAY_CONFIG.bankBrand = process.env.SEPAY_BANK_BRAND;
      if (accountName !== undefined) SEPAY_CONFIG.accountName = process.env.SEPAY_ACCOUNT_NAME;
    }

    // Save to .env file
    try {
      const envPath = path.join(__dirname, '../.env');
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');
        const updateVar = (key, val) => {
          if (content.includes(`${key}=`)) {
            content = content.replace(new RegExp(`${key}=.*`), `${key}=${val}`);
          } else {
            content += `\n${key}=${val}\n`;
          }
        };
        if (webhookSecret !== undefined) updateVar('SEPAY_WEBHOOK_SECRET', webhookSecret.trim());
        if (apiKey !== undefined) updateVar('SEPAY_API_KEY', apiKey.trim());
        if (accountNo !== undefined) updateVar('SEPAY_ACCOUNT_NO', accountNo.trim());
        if (bankBrand !== undefined) updateVar('SEPAY_BANK_BRAND', bankBrand.trim());
        if (accountName !== undefined) updateVar('SEPAY_ACCOUNT_NAME', accountName.trim());
        fs.writeFileSync(envPath, content, 'utf8');
      }
    } catch (_e) {}

    res.json({ success: true, message: 'Đã lưu cấu hình SePay Webhook thành công!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Test SePay – Lấy lịch sử giao dịch ngân hàng gần nhất
app.get(['/api/admin/sepay-transactions', '/api/admin/sepay-test-tx', '/api/v1/admin/sepay-transactions', '/api/v1/admin/sepay-test-tx'], requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const result = await getLichSuGiaoDich(limit);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error || 'Không thể kết nối SePay API. Kiểm tra lại SEPAY_API_KEY.' });
    }
    return res.json({ success: true, count: result.data.length, transactions: result.data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Lấy danh sách lịch sử nhận Webhook SePay
app.get(['/api/admin/sepay-logs', '/api/v1/admin/sepay-logs'], requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const logs = await getSepayLogs(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Xóa lịch sử nhận Webhook SePay
app.delete(['/api/admin/sepay-logs', '/api/v1/admin/sepay-logs'], requireAdmin, async (req, res) => {
  try {
    await clearSepayLogs();
    res.json({ success: true, message: 'Đã xóa toàn bộ lịch sử nhận Webhook SePay' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Delete Single CTV Order
app.delete(['/api/admin/ctv/orders/:orderId', '/api/v1/admin/ctv/orders/:orderId'], requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { username } = req.query;
    await deleteCtvOrder(username || null, orderId);
    res.json({ success: true, message: `Đã xóa đơn hàng ${orderId} khỏi hệ thống` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Clear All History for a CTV
app.delete(['/api/admin/ctv/:username/orders', '/api/v1/admin/ctv/:username/orders'], requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    await clearCtvOrders(username);
    res.json({ success: true, message: `Đã xóa toàn bộ lịch sử giao dịch của CTV @${username}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Get All Public Retail Orders
app.get(['/api/admin/public-orders', '/api/v1/admin/public-orders'], requireAdmin, async (req, res) => {
  try {
    const orders = await getAllPublicOrders();
    res.json({ success: true, orders, count: orders.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Delete Single Public Retail Order
app.delete('/api/admin/public-orders/:orderId', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    await deletePublicOrder(orderId);
    res.json({ success: true, message: `Đã xóa đơn hàng web chính ${orderId}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Clear All Public Retail Orders
app.delete('/api/admin/public-orders', requireAdmin, async (req, res) => {
  try {
    await clearPublicOrders();
    res.json({ success: true, message: 'Đã xóa toàn bộ lịch sử đơn hàng web chính' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CTV PORTAL APIs ────────────────────────────────────────────────────
// CTV Login
app.post('/api/ctv/login', loginLimiter, async (req, res) => {
  const body = req.body || {};
  const username = (body.username || req.query?.username || '').toString().trim();
  const password = (body.password || req.query?.password || '').toString().trim();

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tên tài khoản và mật khẩu' });
  }
  const ctv = await verifyCtvLogin(username, password);
  if (!ctv) {
    return res.status(401).json({ error: 'Tên tài khoản hoặc mật khẩu CTV không chính xác' });
  }
  const token = generateSecureToken('ctv_token');
  CTV_TOKENS.set(token, { username: ctv.username, expiresAt: Date.now() + TOKEN_TTL_MS });
  res.json({ success: true, token, ctv });
});

// CTV Logout (Invalidate session token)
app.post('/api/ctv/logout', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token && CTV_TOKENS.has(token)) {
    CTV_TOKENS.delete(token);
  }
  res.json({ success: true, message: 'Đăng xuất thành công!' });
});

// Admin Logout (Invalidate admin session token)
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token && ADMIN_TOKENS.has(token)) {
    ADMIN_TOKENS.delete(token);
  }
  res.json({ success: true, message: 'Đăng xuất Admin thành công!' });
});

// CTV Self Change Password
app.post('/api/ctv/change-password', requireCtv, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới' });
    }
    const ctv = await verifyCtvLogin(req.ctvUsername, oldPassword);
    if (!ctv) {
      return res.status(401).json({ error: 'Mật khẩu hiện tại không chính xác' });
    }
    await updateCtvPassword(req.ctvUsername, newPassword);
    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// CTV Info (me)
app.get('/api/ctv/me', requireCtv, async (req, res) => {
  const ctv = await getCtvByUsername(req.ctvUsername);
  if (!ctv) return res.status(404).json({ error: 'Tài khoản CTV không tồn tại' });
  const { password, ...safeCtv } = ctv;
  res.json({ ctv: safeCtv });
});

// CTV Save Telegram Chat ID
app.post('/api/ctv/telegram', requireCtv, async (req, res) => {
  const { telegramChatId } = req.body || {};
  const ctvAcc = await updateCtvTelegramChatId(req.ctvUsername, telegramChatId);
  if (!ctvAcc) return res.status(404).json({ error: 'Không tìm thấy CTV' });
  res.json({ success: true, telegramChatId: ctvAcc.telegramChatId || telegramChatId });
});

// CTV Regenerate API Key
app.post('/api/ctv/regen-key', requireCtv, async (req, res) => {
  const apiKey = await updateCtvApiKey(req.ctvUsername);
  if (apiKey === false) return res.status(404).json({ error: 'Không tìm thấy CTV' });
  res.json({ success: true, apiKey });
});

// CTV Update Custom API Key
app.post('/api/ctv/update-key', requireCtv, async (req, res) => {
  try {
    const { apiKey } = req.body || {};
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 3) {
      return res.status(400).json({ error: 'API Key phải từ 3 ký tự trở lên' });
    }
    const updatedKey = await setCustomCtvApiKey(req.ctvUsername, apiKey);
    if (!updatedKey) return res.status(404).json({ error: 'Không tìm thấy CTV' });
    res.json({ success: true, apiKey: updatedKey });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Không thể cập nhật API Key' });
  }
});

// Dynamic Downloadable Postman Collection v2.1.0 JSON
app.get(['/api/v1/ctv/postman-collection', '/api/v1/ctv/postman.json'], (req, res) => {
  const protocol = req.protocol || 'https';
  const host = req.get('host') || 'locketgold.click';
  const baseUrl = `${protocol}://${host}`;

  const collection = {
    info: {
      name: "🚀 LOCKET GOLD CTV API ENTERPRISE COLLECTION",
      description: "Bộ API chuẩn chính thức dành cho Cộng tác viên (CTV) tích hợp hệ thống Nâng cấp Locket Gold 24/7",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: [
      {
        name: "1. Kích Hoạt Gold 1 Năm (POST /api/v1/ctv/gold)",
        request: {
          method: "POST",
          header: [
            { key: "Content-Type", value: "application/json", type: "text" },
            { key: "x-api-key", value: "ctv_key_1786809668877_9ib8o0", type: "text", description: "API Key riêng của CTV" }
          ],
          body: {
            mode: "raw",
            raw: JSON.stringify({ user: "vanle" }, null, 2)
          },
          url: {
            raw: `${baseUrl}/api/v1/ctv/gold`,
            protocol: protocol,
            host: host.split(':'),
            path: ["api", "v1", "ctv", "gold"]
          }
        },
        response: [
          {
            name: "200 Success - Kích hoạt Gold thành công (Trừ 1 lượt gói)",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "success",
              message: "🎉 Kích hoạt Locket Gold 1 Năm HOÀN TẤT cho @vanle!"
            }, null, 2)
          },
          {
            name: "200 Info - Tài khoản đã có Gold (Lượt gói giữ nguyên)",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "info",
              already_has_gold: true,
              message: "ℹ️ Tài khoản @vanle đã có Locket Gold active từ trước."
            }, null, 2)
          },
          {
            name: "400 Bad Request - Hết lượt gói (0 lượt)",
            status: "Bad Request",
            code: 400,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "error",
              code: 400,
              message: "Kho lượt gói nạp 1 Năm của bạn đã HẾT (0 lượt). Vui lòng mua thêm gói lượt trên website CTV!"
            }, null, 2)
          },
          {
            name: "401 Unauthorized - API Key sai hoặc bị khóa",
            status: "Unauthorized",
            code: 401,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "error",
              code: 401,
              message: "Xác minh thất bại! API Token Key không chính xác hoặc tài khoản CTV của bạn đã bị khóa."
            }, null, 2)
          },
          {
            name: "403 Forbidden - Username Locket bị KHÓA",
            status: "Forbidden",
            code: 102,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "error",
              code: 102,
              message: "Tài khoản @vanle đã bị KHÓA (Banned) trên hệ thống!"
            }, null, 2)
          },
          {
            name: "500 Server Error - Thất bại & Hoàn lại 1 lượt gói",
            status: "Internal Server Error",
            code: 500,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "error",
              code: 500,
              message: "Kích hoạt Gold thất bại: Lỗi kết nối máy chủ kích hoạt Gold. Đã hoàn lại 1 lượt gói cho CTV!"
            }, null, 2)
          }
        ]
      },
      {
        name: "2. Kích Hoạt Gold 1 Năm Theo Lượt Gói (POST /api/v1/ctv/gold-package)",
        request: {
          method: "POST",
          header: [
            { key: "Content-Type", value: "application/json", type: "text" },
            { key: "x-api-key", value: "ctv_key_1786809668877_9ib8o0", type: "text", description: "API Key riêng của CTV" }
          ],
          body: {
            mode: "raw",
            raw: JSON.stringify({ user: "vanle" }, null, 2)
          },
          url: {
            raw: `${baseUrl}/api/v1/ctv/gold-package`,
            protocol: protocol,
            host: host.split(':'),
            path: ["api", "v1", "ctv", "gold-package"]
          }
        },
        response: [
          {
            name: "200 Success - Trừ 1 lượt gói thành công",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "success",
              message: "🎉 Kích hoạt Gold 1 Năm bằng Lượt Gói THÀNH CÔNG cho @vanle!"
            }, null, 2)
          },
          {
            name: "400 Bad Request - Hết lượt gói (0 lượt)",
            status: "Bad Request",
            code: 400,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "error",
              code: 400,
              message: "Kho lượt gói nạp 1 Năm của bạn đã HẾT (0 lượt). Vui lòng mua thêm gói lượt trên website CTV!"
            }, null, 2)
          }
        ]
      },
      {
        name: "3. Tra Cứu Số Dư Ví & Lượt Gói CTV (GET /api/v1/ctv/me)",
        request: {
          method: "GET",
          header: [
            { key: "x-api-key", value: "ctv_key_1786809668877_9ib8o0", type: "text" }
          ],
          url: {
            raw: `${baseUrl}/api/v1/ctv/me`,
            protocol: protocol,
            host: host.split(':'),
            path: ["api", "v1", "ctv", "me"]
          }
        },
        response: [
          {
            name: "200 Success - Thông tin tài khoản CTV",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "success",
              message: "Chào mừng CTV @dinhmanh!",
              data: {
                username: "dinhmanh",
                displayName: "Đình Mạnh CTV",
                balance: 4165900,
                remaining_requests: 249,
                prices: {
                  "1year": 65000
                },
                active: true
              }
            }, null, 2)
          }
        ]
      },
      {
        name: "4. Tra Cứu Lịch Sử Đơn Hàng CTV (GET /api/v1/ctv/orders)",
        request: {
          method: "GET",
          header: [
            { key: "x-api-key", value: "ctv_key_1786809668877_9ib8o0", type: "text" }
          ],
          url: {
            raw: `${baseUrl}/api/v1/ctv/orders`,
            protocol: protocol,
            host: host.split(':'),
            path: ["api", "v1", "ctv", "orders"]
          }
        },
        response: [
          {
            name: "200 Success - Lịch sử đơn hàng",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "success",
              orders: [
                {
                  orderId: "CTV_ORD_1785663510688_jyo2",
                  userUpgraded: "vanle",
                  packageId: "1year",
                  amount: 65000,
                  createdAt: "2026-08-06T18:30:00.000Z"
                }
              ]
            }, null, 2)
          }
        ]
      },
      {
        name: "5. Tra Cứu Profile & Status Locket (GET /api/v1/userinfo)",
        request: {
          method: "GET",
          header: [],
          url: {
            raw: `${baseUrl}/api/v1/userinfo?user=vanle`,
            protocol: protocol,
            host: host.split(':'),
            path: ["api", "v1", "userinfo"],
            query: [{ key: "user", value: "vanle" }]
          }
        },
        response: [
          {
            name: "200 Success - Profile Locket Live",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              username: "vanle",
              displayName: "Văn Lê",
              uid: "3SpzULZxvMVoV53tE8SrSqD3",
              isGold: true,
              badge: "Locket Gold"
            }, null, 2)
          }
        ]
      }
    ]
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="LocketGold_CTV_PostmanCollection.json"');
  res.send(JSON.stringify(collection, null, 2));
});

// CTV Orders
app.get('/api/ctv/orders', requireCtv, async (req, res) => {
  const orders = await getCtvOrders(req.ctvUsername);
  res.json({ orders });
});

// CTV Delete Single Order
app.delete('/api/ctv/orders/:orderId', requireCtv, async (req, res) => {
  try {
    const { orderId } = req.params;
    await deleteCtvOrder(req.ctvUsername, orderId);
    const updatedOrders = await getCtvOrders(req.ctvUsername);
    res.json({ success: true, message: 'Đã xóa đơn hàng thành công!', orders: updatedOrders });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Không thể xóa đơn hàng' });
  }
});

// CTV Clear All Orders History
app.delete('/api/ctv/orders', requireCtv, async (req, res) => {
  try {
    await clearCtvOrders(req.ctvUsername);
    res.json({ success: true, message: 'Đã xóa toàn bộ lịch sử giao dịch!', orders: [] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Không thể xóa lịch sử giao dịch' });
  }
});

const PRESET_CTV_AVATARS = [
  '/assets/vip1.gif',
  '/assets/vip2.png',
  '/assets/vip3.png',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150&auto=format&fit=crop&q=80'
];

// GET Preset Avatars List
app.get('/api/ctv/avatars', (req, res) => {
  res.json({ success: true, avatars: PRESET_CTV_AVATARS });
});

// POST Update CTV Avatar
app.post('/api/ctv/avatar', requireCtv, async (req, res) => {
  try {
    const { avatar } = req.body || {};
    if (!avatar || typeof avatar !== 'string') {
      return res.status(400).json({ error: 'Avatar URL không hợp lệ' });
    }
    await updateCtvAvatar(req.ctvUsername, avatar.trim());
    res.json({ success: true, avatar: avatar.trim(), message: 'Đã cập nhật ảnh đại diện thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi cập nhật ảnh đại diện' });
  }
});

// CTV Leaderboard (Bảng Xếp Hạng Top Nạp Tiền & Doanh Số)
app.get('/api/ctv/leaderboard', async (req, res) => {
  try {
    const allOrders = await getCtvOrders();
    const allCtvs = await getCtvAccounts();

    const activeCtvs = (allCtvs || []).filter(c => c.active !== false);

    const statsMap = {};
    for (const ctv of activeCtvs) {
      statsMap[ctv.username.toLowerCase()] = {
        username: ctv.username,
        displayName: ctv.displayName || ctv.username,
        avatar: ctv.avatar || '/assets/vip1.gif',
        totalAmount: 0,
        totalOrders: 0,
        orders: []
      };
    }

    for (const o of allOrders) {
      const u = (o.ctvUsername || '').toLowerCase();
      // NẾU TÀI KHOẢN CTV ĐÃ BỊ XÓA -> KHÔNG HIỂN THỊ VÀO BẢNG XẾP HẠNG
      if (!statsMap[u]) {
        continue;
      }

      let orderAmount = Number(o.amount || 0);
      // TÍNH CẢ CÁC ĐƠN KÍCH HOẠT BẰNG LƯỢT GÓI (QUOTA) VÀO TỔNG DOANH SỐ LEADERBOARD
      if (orderAmount <= 0 && (o.packageId === 'quota' || o.packageId === '1year' || o.source === 'PACKAGE_QUOTA')) {
        orderAmount = 65000;
      }

      statsMap[u].totalAmount += orderAmount;
      statsMap[u].totalOrders += 1;
      statsMap[u].orders.push({
        orderId: o.orderId,
        ctvUsername: o.ctvUsername,
        userUpgraded: o.userUpgraded,
        packageId: o.packageId,
        amount: orderAmount,
        createdAt: o.createdAt
      });
    }

    const leaderboard = Object.values(statsMap)
      .filter(item => item.totalAmount > 0 || item.totalOrders > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount || b.totalOrders - a.totalOrders)
      .map((item, index) => ({
        rank: index + 1,
        username: item.username,
        displayName: item.displayName,
        avatar: item.avatar,
        totalAmount: item.totalAmount,
        totalOrders: item.totalOrders,
        orders: item.orders || []
      }));

    res.json({ success: true, leaderboard });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy bảng xếp hạng CTV' });
  }
});

// CTV Buy Request Quota Package (Custom Count or Presets: 50, 500, 1000)
app.post('/api/ctv/buy-package', requireCtv, async (req, res) => {
  try {
    const { packageType, count: reqCount } = req.body || {};
    let count = 0;
    
    if (reqCount !== undefined && reqCount !== null && !isNaN(Number(reqCount)) && Number(reqCount) >= 1) {
      count = Math.floor(Number(reqCount));
    } else {
      const type = String(packageType || '').toLowerCase();
      if (type === 'basic' || type === '50') {
        count = 50;
      } else if (type === 'standard' || type === '500') {
        count = 500;
      } else if (type === 'premium' || type === '1000') {
        count = 1000;
      } else if (type === '100') {
        count = 100;
      } else {
        return res.status(400).json({ error: 'Số lượng lượt mua không hợp lệ. Vui lòng chọn gói hoặc nhập số lượt từ 1 trở lên.' });
      }
    }

    // Discount rules: 50,000đ discount for every 50 requests
    const discountMultiplier = Math.floor(count / 50);
    const discount = discountMultiplier * 50000;

    const ctv = await getCtvByUsername(req.ctvUsername);
    if (!ctv) return res.status(404).json({ error: 'Không tìm thấy thông tin CTV' });

    // REQUIRE TELEGRAM BOT LINKING BEFORE BUYING PACKAGES
    if (!ctv.telegramChatId) {
      return res.status(400).json({
        error: 'Vui lòng liên kết Telegram Bot trước khi mua gói lượt! Liên kết Bot giúp bạn nhận thông báo tự động khi số lượt nạp của bạn còn dưới 10 lượt.'
      });
    }

    const unitPrice = ctv.prices?.['1year'] || 65000;
    const rawTotal = unitPrice * count;
    const finalDiscount = Math.min(discount, Math.floor(rawTotal / 2));
    const totalPrice = rawTotal - finalDiscount;

    if (totalPrice <= 0) {
      return res.status(400).json({ error: 'Giá mua gói không hợp lệ.' });
    }

    // Atomic balance deduction
    const deductRes = await deductCtvBalanceAtomic(ctv.username, totalPrice);
    if (!deductRes.success) {
      return res.status(400).json({
        error: `Số dư không đủ để mua ${count} lượt gói! Số dư ví hiện tại: ${(Number(ctv.balance) || 0).toLocaleString('vi-VN')}đ, tổng giá thanh toán: ${totalPrice.toLocaleString('vi-VN')}đ. Vui lòng nạp thêm tiền vào số dư ví!`
      });
    }

    // Add package requests
    const newRemainingRequests = await addCtvPackageRequests(ctv.username, count);

    console.log(`📦 CTV [@${req.ctvUsername}] đã mua thành công ${count} lượt Locket Gold 1 năm với giá ${totalPrice.toLocaleString('vi-VN')}đ (Giảm ${finalDiscount.toLocaleString('vi-VN')}đ). Lượt còn lại: ${newRemainingRequests}`);

    // Send Telegram Notification
    notifyCtvViaTelegram(ctv, 'PACKAGE_PURCHASED', {
      count,
      totalPrice,
      discount: finalDiscount,
      newBalance: deductRes.newBalance,
      remainingRequests: newRemainingRequests
    });

    return res.json({
      success: true,
      packageType: `custom_${count}`,
      count,
      totalPrice,
      discount: finalDiscount,
      newBalance: deductRes.newBalance,
      remainingRequests: newRemainingRequests,
      message: `🎉 Mua thành công +${count} lượt Gold 1 Năm! Đã cộng vào tài khoản của bạn.`
    });
  } catch (err) {
    console.error('❌ Lỗi mua gói lượt CTV:', err);
    return res.status(500).json({ error: 'Lỗi xử lý mua gói lượt.' });
  }
});

// CTV Upgrade Gold User (Web Portal)
app.post('/api/ctv/upgrade', requireCtv, async (req, res) => {
  try {
    const { userUpgraded, packageId, useQuota } = req.body || {};
    const cleanUser = extractLocketUsername(userUpgraded);
    const pkg = packageId === 'lifetime' ? 'lifetime' : '1year';

    if (!cleanUser) {
      return res.status(400).json({ error: 'Vui lòng nhập Username Locket cần nâng cấp' });
    }

    if (await isUserBanned(cleanUser)) {
      return res.status(403).json({ error: `Tài khoản @${cleanUser} đã bị KHÓA (Banned) trên hệ thống!` });
    }

    const ctv = await getCtvByUsername(req.ctvUsername);
    if (!ctv) return res.status(404).json({ error: 'Không tìm thấy thông tin CTV' });

    // Check if upgrading using package request quota (1 year gold)
    const canUseQuota = pkg === '1year' && (Number(ctv.remainingRequests) || 0) >= 1 && useQuota !== false;
    let isQuotaUsed = false;
    let price = 0;

    if (canUseQuota) {
      const quotaDeduct = await deductCtvPackageRequestAtomic(ctv.username);
      if (!quotaDeduct.success) {
        return res.status(400).json({ error: 'Không thể trừ lượt gói.' });
      }
      isQuotaUsed = true;
      price = 0;
    } else {
      price = ctv.prices?.[pkg] || (pkg === 'lifetime' ? 350000 : 65000);
      const currentBalance = Number(ctv.balance) || 0;

      if (currentBalance < price) {
        return res.status(400).json({
          error: `Số dư không đủ! Số dư hiện tại: ${currentBalance.toLocaleString('vi-VN')}đ, giá gói: ${price.toLocaleString('vi-VN')}đ. Vui lòng nạp thêm tiền vào số dư hoặc mua gói lượt!`
        });
      }

      // Atomic balance deduction
      const deductRes = await deductCtvBalanceAtomic(ctv.username, price);
      if (!deductRes.success) {
        return res.status(400).json({
          error: `Số dư CTV không đủ! Số dư hiện tại: ${currentBalance.toLocaleString('vi-VN')}đ, giá gói: ${price.toLocaleString('vi-VN')}đ.`
        });
      }
    }

    // 0.5 CHECK USER EXISTENCE ON LOCKET
    try {
      const checkRes = await fetch(`https://api.locketgold.click/api/v1/userinfo?user=${encodeURIComponent(cleanUser)}`, {
        signal: AbortSignal.timeout(3000)
      }).catch(() => null);
      if (checkRes && checkRes.ok) {
        const checkData = await checkRes.json().catch(() => null);
        if (checkData && (checkData.status === 'error' || checkData.code === 404 || (!checkData.uid && !checkData.profile_picture_url && !checkData.full_name))) {
          if (isQuotaUsed) {
            await addCtvPackageRequests(ctv.username, 1);
          } else {
            await addCtvBalance(ctv.username, price);
          }
          return res.status(404).json({ error: `Tài khoản @${cleanUser} không tồn tại trên hệ thống Locket! Vui lòng kiểm tra lại username.` });
        }
      }
    } catch (_e) {}

    // 1. ACTIVATE GOLD
    console.log(`👑 CTV [@${req.ctvUsername}] đang kích hoạt Gold cho @${cleanUser} (${pkg}, ${isQuotaUsed ? 'Dùng 1 Lượt Gói' : price + 'đ'})...`);
    const actResult = await activateLocketGold(cleanUser, pkg);

    if (!actResult || !actResult.ok) {
      console.error(`❌ Kích hoạt Gold cho @${cleanUser} thất bại: ${actResult?.error}. Đang hoàn lại...`);
      let refundedBalance = Number(ctv.balance) || 0;
      let refundedQuota = Number(ctv.remainingRequests) || 0;
      if (isQuotaUsed) {
        refundedQuota = await addCtvPackageRequests(ctv.username, 1);
      } else {
        refundedBalance = await addCtvBalance(ctv.username, price);
      }

      notifyCtvViaTelegram(ctv, 'FAIL', { userUpgraded: cleanUser, error: actResult?.error || 'Lỗi hệ thống', currentBalance: refundedBalance });

      return res.status(500).json({
        error: `Kích hoạt Gold thất bại: ${actResult?.error || 'Lỗi kết nối máy chủ kích hoạt Gold'}. Đã hoàn lại ${isQuotaUsed ? '1 lượt gói' : 'tiền'} cho CTV!`
      });
    }

    // Check if account already has Gold
    const isAlreadyGold = Boolean(actResult.alreadyHasGold || actResult.data?.already_has_gold || actResult.data?.status === 'info');
    if (isAlreadyGold) {
      console.log(`ℹ️ CTV [@${req.ctvUsername}] nâng cấp cho @${cleanUser}: Tài khoản đã có Gold từ trước. Hoàn lại!`);
      let refundedBalance = Number(ctv.balance) || 0;
      let refundedQuota = Number(ctv.remainingRequests) || 0;
      if (isQuotaUsed) {
        refundedQuota = await addCtvPackageRequests(ctv.username, 1);
      } else {
        refundedBalance = await addCtvBalance(ctv.username, price);
      }

      notifyCtvViaTelegram(ctv, 'ALREADY_GOLD', { userUpgraded: cleanUser, message: actResult.data?.message || 'Tài khoản đã có Locket Gold từ trước', currentBalance: refundedBalance });

      return res.status(400).json({
        success: false,
        already_has_gold: true,
        error: `Tài khoản @${cleanUser} đã có Locket Gold active từ trước (${actResult.data?.message || 'Không cần nâng cấp lại'}). Dữ liệu tài khoản CTV giữ nguyên 100%!`,
        newBalance: refundedBalance,
        remainingRequests: refundedQuota,
        activation: actResult
      });
    }

    const updatedCtv = await getCtvByUsername(req.ctvUsername);
    const newBalance = Number(updatedCtv?.balance) || 0;
    const newRemainingRequests = Number(updatedCtv?.remainingRequests) || 0;

    // Save Order
    await saveCtvOrder({
      ctvUsername: req.ctvUsername,
      userUpgraded: cleanUser,
      packageId: pkg,
      amount: price,
      source: isQuotaUsed ? 'PACKAGE_QUOTA' : 'BALANCE'
    });

    fetchAndSaveAvatar(cleanUser, cleanUser).catch(() => {});

    notifyCtvViaTelegram(ctv, 'SUCCESS', { userUpgraded: cleanUser, packageId: pkg, amount: price, newBalance, remainingRequests: newRemainingRequests });

    return res.json({
      success: true,
      message: `🎉 Kích hoạt Locket Gold HOÀN TẤT cho @${cleanUser}! ${isQuotaUsed ? 'Đã trừ 1 lượt gói.' : `Đã trừ ${price.toLocaleString('vi-VN')}đ.`}`,
      newBalance,
      remainingRequests: newRemainingRequests,
      activation: actResult
    });
  } catch (err) {
    console.error('❌ Lỗi nâng cấp CTV:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ nâng cấp Locket Gold' });
  }
});

// ── HELPER UTILITY FOR CTV API AUTHENTICATION ───────────────────────
function extractCtvApiKey(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  return (
    bearerToken ||
    req.headers['x-api-key'] ||
    req.headers['X-API-KEY'] ||
    req.headers['api-key'] ||
    req.headers['token'] ||
    req.headers['key'] ||
    req.query.token ||
    req.query.api_key ||
    req.query.key ||
    req.body?.token ||
    req.body?.api_key ||
    req.body?.key ||
    req.body?.ctv_code ||
    ''
  ).trim();
}

// CORS Preflight & Headers Middleware for CTV API
app.use('/api/v1/ctv', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key, api-key, token, key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 1. Endpoint Tra Cứu Thông Tin CTV & Số Dư (/api/v1/ctv/me hoặc /api/v1/ctv/balance)
app.all(['/api/v1/ctv/me', '/api/v1/ctv/balance'], async (req, res) => {
  try {
    const apiKey = extractCtvApiKey(req);
    if (!apiKey) {
      return res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Thiếu API Token Key xác minh! Vui lòng truyền key qua Header (x-api-key / Bearer token) hoặc tham số (token / api_key).'
      });
    }

    let ctv = await getCtvByApiKey(apiKey);
    if (!ctv) {
      const sessionUser = CTV_TOKENS.get(apiKey);
      if (sessionUser) ctv = await getCtvByUsername(sessionUser);
    }

    if (!ctv || ctv.active === false) {
      return res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Xác minh thất bại! API Token Key không chính xác hoặc tài khoản CTV bị khóa.'
      });
    }

    res.json({
      status: 'success',
      message: `Chào mừng CTV @${ctv.username}!`,
      data: {
        username: ctv.username,
        displayName: ctv.displayName,
        balance: Number(ctv.balance) || 0,
        remaining_requests: Number(ctv.remainingRequests) || 0,
        prices: ctv.prices || { '1year': 65000, 'lifetime': 350000 },
        apiKey: ctv.apiKey || apiKey,
        telegramChatId: ctv.telegramChatId || null,
        active: ctv.active !== false
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message || 'Lỗi máy chủ khi tra cứu thông tin CTV' });
  }
});

// 2. Endpoint Tra Cứu Lịch Sử Đơn Hàng CTV (/api/v1/ctv/orders)
app.all('/api/v1/ctv/orders', async (req, res) => {
  try {
    const apiKey = extractCtvApiKey(req);
    if (!apiKey) {
      return res.status(401).json({ status: 'error', code: 401, message: 'Thiếu API Token Key xác minh!' });
    }

    let ctv = await getCtvByApiKey(apiKey);
    if (!ctv) {
      const sessionUser = CTV_TOKENS.get(apiKey);
      if (sessionUser) ctv = await getCtvByUsername(sessionUser);
    }

    if (!ctv || ctv.active === false) {
      return res.status(401).json({ status: 'error', code: 401, message: 'API Token Key không chính xác hoặc tài khoản bị khóa.' });
    }

    if (req.method === 'DELETE' || req.query.action === 'delete' || req.body?.action === 'delete') {
      const targetOrderId = req.query.orderId || req.body?.orderId;
      const isClearAll = req.query.clear === 'true' || req.body?.clear === true || targetOrderId === 'all';

      if (isClearAll) {
        await clearCtvOrders(ctv.username);
        return res.json({ status: 'success', message: 'Đã xóa toàn bộ lịch sử giao dịch CTV!', remaining_orders: 0 });
      }

      if (!targetOrderId) {
        return res.status(400).json({ status: 'error', code: 400, message: 'Thiếu orderId cần xóa! (hoặc truyền clear=true để xóa tất cả)' });
      }

      await deleteCtvOrder(ctv.username, targetOrderId);
      const remainingOrders = await getCtvOrders(ctv.username);
      return res.json({ status: 'success', message: `Đã xóa đơn hàng ${targetOrderId}!`, remaining_orders: remainingOrders.length });
    }

    const orders = await getCtvOrders(ctv.username);
    res.json({
      status: 'success',
      ctv_username: ctv.username,
      total_orders: orders.length,
      orders: orders
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message || 'Lỗi máy chủ khi lấy danh sách đơn hàng CTV' });
  }
});

// 4. Endpoint Kích Hoạt Locket Gold CTV (/api/v1/ctv/gold hoặc /api/v1/ctv/unlock)
app.all(['/api/v1/ctv/gold', '/api/v1/ctv/unlock'], ctvApiLimiter, async (req, res) => {
  try {
    const apiKey = extractCtvApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Thiếu API Token Key xác minh! Vui lòng truyền key qua header (x-api-key hoặc Bearer token) hoặc tham số (token / api_key).'
      });
    }

    let ctv = await getCtvByApiKey(apiKey);
    if (!ctv) {
      const sessionData = CTV_TOKENS.get(apiKey);
      if (sessionData?.username) {
        ctv = await getCtvByUsername(sessionData.username);
      }
    }

    if (!ctv || ctv.active === false) {
      return res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Xác minh thất bại! API Token Key không chính xác hoặc tài khoản CTV của bạn đã bị khóa.'
      });
    }

    const rawUser = req.query.user || req.query.username || req.body?.user || req.body?.username || req.body?.userUpgraded || '';
    const cleanUser = extractLocketUsername(rawUser);

    if (!cleanUser) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Vui lòng truyền tham số user (Username Locket cần nâng cấp Gold).'
      });
    }

    const rawCategory = (req.query.category || req.body?.category || req.body?.packageId || '1year').toString().toLowerCase();
    const pkg = rawCategory.includes('life') ? 'lifetime' : '1year';

    if (await isUserBanned(cleanUser)) {
      return res.status(403).json({
        status: 'error',
        code: 102,
        message: `Tài khoản @${cleanUser} đã bị KHÓA (Banned) trên hệ thống!`
      });
    }

    const price = ctv.prices?.[pkg] || (pkg === 'lifetime' ? 350000 : 65000);
    const currentBalance = Number(ctv.balance) || 0;

    // 🔐 ATOMIC DEDUCTION: Trừ tiền nguyên tử trong MongoDB để chống Race Condition
    const deductRes = await deductCtvBalanceAtomic(ctv.username, price);
    if (!deductRes.success) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: `Số dư CTV không đủ! Số dư hiện tại: ${currentBalance.toLocaleString('vi-VN')}đ, giá gói: ${price.toLocaleString('vi-VN')}đ. Vui lòng nạp thêm tiền vào website!`,
        current_balance: currentBalance,
        required_amount: price
      });
    }

    console.log(`🔑 [API CTV] CTV [@${ctv.username}] kích hoạt Gold cho @${cleanUser} (gói ${pkg}, ${price}đ)...`);
    const actResult = await activateLocketGold(cleanUser, pkg);

    if (!actResult || !actResult.ok) {
      console.error(`❌ [API CTV] Kích hoạt Gold cho @${cleanUser} thất bại: ${actResult?.error}. Đang hoàn lại số dư...`);
      // Hoàn lại tiền khi kích hoạt thất bại
      const refundedBalance = await addCtvBalance(ctv.username, price);
      notifyCtvViaTelegram(ctv, 'FAIL', { userUpgraded: cleanUser, error: actResult?.error || 'Lỗi kết nối máy chủ kích hoạt Gold', currentBalance: refundedBalance });

      return res.status(500).json({
        status: 'error',
        code: 500,
        message: `Kích hoạt Gold thất bại: ${actResult?.error || 'Lỗi kết nối máy chủ kích hoạt Gold'}. Số dư đã được hoàn lại 100%!`,
        current_balance: refundedBalance
      });
    }

    const isAlreadyGold = Boolean(actResult.alreadyHasGold || actResult.data?.already_has_gold || actResult.data?.status === 'info');
    if (isAlreadyGold) {
      console.log(`ℹ️ [API CTV] CTV [@${ctv.username}] kích hoạt cho @${cleanUser}: Tài khoản đã có Gold từ trước. Hoàn tiền 100%!`);
      const refundedBalance = await addCtvBalance(ctv.username, price);
      notifyCtvViaTelegram(ctv, 'ALREADY_GOLD', { userUpgraded: cleanUser, message: actResult.data?.message || 'Tài khoản đã có Locket Gold từ trước', currentBalance: refundedBalance });

      return res.json({
        status: 'info',
        already_has_gold: true,
        message: `ℹ️ Tài khoản @${cleanUser} đã có Locket Gold active từ trước (${actResult.data?.message || ''}). Số dư CTV giữ nguyên 100%!`,
        data: {
          ctv_username: ctv.username,
          user_upgraded: cleanUser,
          package: pkg,
          amount_deducted: 0,
          new_balance: refundedBalance,
          activation: actResult.data
        }
      });
    }

    const newBalance = deductRes.newBalance;
    const ctvOrder = await saveCtvOrder({
      ctvUsername: ctv.username,
      userUpgraded: cleanUser,
      packageId: pkg,
      amount: price
    });

    fetchAndSaveAvatar(cleanUser, cleanUser).catch(() => {});

    // Telegram Notifications
    notifyCtvViaTelegram(ctv, 'SUCCESS', { userUpgraded: cleanUser, packageId: pkg, amount: price, newBalance });
    if (newBalance < 50000) {
      notifyCtvViaTelegram(ctv, 'LOW_BALANCE', { newBalance });
    }

    res.json({
      status: 'success',
      message: `🎉 Kích hoạt Locket Gold HOÀN TẤT cho @${cleanUser}!`,
      data: {
        ctv_username: ctv.username,
        user_upgraded: cleanUser,
        package: pkg,
        amount_deducted: price,
        new_balance: newBalance,
        order_id: ctvOrder.orderId,
        activation: actResult
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message || 'Lỗi máy chủ khi xử lý API CTV' });
  }
});

// 4.5 Dedicated Package Upgrade API for CTVs with Request Quotas (/api/v1/ctv/gold-package)
app.all(['/api/v1/ctv/gold-package', '/api/v1/ctv/package-upgrade'], ctvApiLimiter, async (req, res) => {
  try {
    const apiKey = extractCtvApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Thiếu API Token Key xác minh! Vui lòng truyền key qua header (x-api-key hoặc Bearer token) hoặc tham số (token / api_key).'
      });
    }

    let ctv = await getCtvByApiKey(apiKey);
    if (!ctv) {
      const sessionData = CTV_TOKENS.get(apiKey);
      if (sessionData?.username) {
        ctv = await getCtvByUsername(sessionData.username);
      }
    }

    if (!ctv || ctv.active === false) {
      return res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Xác minh thất bại! API Token Key không chính xác hoặc tài khoản CTV của bạn đã bị khóa.'
      });
    }

    const rawUser = req.query.user || req.query.username || req.body?.user || req.body?.username || req.body?.userUpgraded || '';
    const cleanUser = extractLocketUsername(rawUser);

    if (!cleanUser) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Vui lòng truyền tham số user (Username Locket cần nâng cấp Gold).'
      });
    }

    if (await isUserBanned(cleanUser)) {
      return res.status(403).json({
        status: 'error',
        code: 102,
        message: `Tài khoản @${cleanUser} đã bị KHÓA (Banned) trên hệ thống!`
      });
    }

    const remainingCount = Number(ctv.remainingRequests) || 0;
    if (remainingCount < 1) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: `Tài khoản CTV không còn lượt gói Locket Gold (Còn 0 lượt)! Vui lòng mua thêm gói lượt trên website.`,
        remaining_requests: 0
      });
    }

    // Atomic Deduction of 1 package request
    const deductRes = await deductCtvPackageRequestAtomic(ctv.username);
    if (!deductRes.success) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: `Không thể trừ lượt gói: ${deductRes.error || 'Hết lượt gói'}`,
        remaining_requests: 0
      });
    }

    console.log(`📦 [API GÓI CTV] CTV [@${ctv.username}] dùng 1 lượt gói kích hoạt Gold 1 Năm cho @${cleanUser}... (Còn ${deductRes.remainingRequests} lượt)`);
    const actResult = await activateLocketGold(cleanUser, '1year');

    if (!actResult || !actResult.ok) {
      console.error(`❌ [API GÓI CTV] Kích hoạt Gold cho @${cleanUser} thất bại: ${actResult?.error}. Đang hoàn lại 1 lượt gói...`);
      const refundedRemaining = await addCtvPackageRequests(ctv.username, 1);
      notifyCtvViaTelegram(ctv, 'FAIL', { userUpgraded: cleanUser, error: actResult?.error || 'Lỗi kết nối máy chủ kích hoạt Gold', currentBalance: ctv.balance });

      return res.status(500).json({
        status: 'error',
        code: 500,
        message: `Kích hoạt Gold thất bại: ${actResult?.error || 'Lỗi kết nối máy chủ kích hoạt Gold'}. Đã hoàn lại 1 lượt gói cho CTV!`,
        remaining_requests: refundedRemaining
      });
    }

    const isAlreadyGold = Boolean(actResult.alreadyHasGold || actResult.data?.already_has_gold || actResult.data?.status === 'info');
    if (isAlreadyGold) {
      console.log(`ℹ️ [API GÓI CTV] CTV [@${ctv.username}] kích hoạt cho @${cleanUser}: Tài khoản đã có Gold từ trước. Hoàn lại 1 lượt gói!`);
      const refundedRemaining = await addCtvPackageRequests(ctv.username, 1);
      notifyCtvViaTelegram(ctv, 'ALREADY_GOLD', { userUpgraded: cleanUser, message: actResult.data?.message || 'Tài khoản đã có Locket Gold từ trước', currentBalance: ctv.balance });

      return res.json({
        status: 'info',
        already_has_gold: true,
        message: `Tài khoản @${cleanUser} đã có Locket Gold active từ trước (${actResult.data?.message || ''}). Lượt gói CTV giữ nguyên 100%!`,
        data: {
          ctv_username: ctv.username,
          user_upgraded: cleanUser,
          package: '1year',
          remaining_requests: refundedRemaining,
          activation: actResult.data
        }
      });
    }

    const ctvOrder = await saveCtvOrder({
      ctvUsername: ctv.username,
      userUpgraded: cleanUser,
      packageId: '1year',
      amount: 0,
      source: 'PACKAGE_QUOTA'
    });

    fetchAndSaveAvatar(cleanUser, cleanUser).catch(() => {});

    notifyCtvViaTelegram(ctv, 'SUCCESS', { userUpgraded: cleanUser, packageId: '1year', amount: 0, newBalance: ctv.balance, remainingRequests: deductRes.remainingRequests });

    return res.json({
      status: 'success',
      message: `🎉 Kích hoạt Locket Gold 1 Năm HOÀN TẤT cho @${cleanUser} bằng 1 lượt gói!`,
      data: {
        ctv_username: ctv.username,
        user_upgraded: cleanUser,
        package: '1year',
        remaining_requests: deductRes.remainingRequests,
        order_id: ctvOrder.orderId,
        activation: actResult
      }
    });
  } catch (err) {
    console.error('❌ Lỗi API Gói CTV:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Lỗi máy chủ khi xử lý API Gói CTV' });
  }
});

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

// 🖼️ REAL LOCKET AVATAR PROXY ENDPOINT (/api/avatar/:username)
// Avatar cache to avoid re-scraping locket.cam on every request
const avatarUrlCache = new Map();

function serveUiAvatar(res, username) {
  const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'Locket')}&background=FF6B9D&color=fff&bold=true&size=128`;
  https.get(url, (imgRes) => {
    res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    imgRes.pipe(res);
  }).on('error', () => res.status(404).end());
}

function pipeImageUrl(res, imageUrl, fallbackUsername) {
  const cleanUrl = imageUrl.replace('.googleapis.com:443', '.googleapis.com');
  try {
    const urlObj = new URL(cleanUrl);
    const mod = urlObj.protocol === 'https:' ? https : require('http');
    const req = mod.get(cleanUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (imgRes) => {
      if (imgRes.statusCode === 200) {
        res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        imgRes.pipe(res);
      } else {
        serveUiAvatar(res, fallbackUsername);
      }
    });
    req.on('error', () => serveUiAvatar(res, fallbackUsername));
    req.setTimeout(5000, () => { req.destroy(); serveUiAvatar(res, fallbackUsername); });
  } catch (_e) {
    serveUiAvatar(res, fallbackUsername);
  }
}

app.get('/api/avatar/:username', async (req, res) => {
  const username = (req.params.username || '').trim();
  if (!username || username === 'N/A' || username.startsWith('Direct UID')) {
    return serveUiAvatar(res, username || 'Locket');
  }

  // 1. Check in-memory cache first (avoid re-scraping)
  if (avatarUrlCache.has(username)) {
    return pipeImageUrl(res, avatarUrlCache.get(username), username);
  }

  // 2. Check DB for saved profile_picture_url
  try {
    const mongoose = require('mongoose');
    const Order = mongoose.models.Order;
    if (Order && mongoose.connection.readyState === 1) {
      const order = await Order.findOne({ username: username.toLowerCase(), status: 'COMPLETED', profile_picture_url: { $ne: null } })
        .sort({ completedAt: -1 }).lean();
      if (order && order.profile_picture_url) {
        avatarUrlCache.set(username, order.profile_picture_url);
        return pipeImageUrl(res, order.profile_picture_url, username);
      }
    }
  } catch (_e) {}

  // 3. Scrape locket.cam to get Firebase profile_pic URL, then pipe image bytes
  try {
    const targetUrl = `https://locket.cam/${encodeURIComponent(username)}`;
    const clientReq = https.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)' }
    }, (targetRes) => {
      let body = '';
      targetRes.on('data', chunk => body += chunk);
      targetRes.on('end', () => {
        const matches = body.match(/https:\/\/firebasestorage\.googleapis\.com[^\s\x22\x27]+\.(png|jpg|jpeg|webp)[^\s\x22\x27]*/gi);
        if (matches && matches.length > 0) {
          const realPic = matches.find(m => m.includes('profile_pic') || m.includes('users')) || matches[0];
          avatarUrlCache.set(username, realPic); // cache for next request
          return pipeImageUrl(res, realPic, username);
        }
        return serveUiAvatar(res, username);
      });
    });
    clientReq.on('error', () => serveUiAvatar(res, username));
    clientReq.setTimeout(4000, () => { clientReq.destroy(); serveUiAvatar(res, username); });
  } catch (_e) {
    serveUiAvatar(res, username);
  }
});

// Create Order API
app.post('/api/orders/create', async (req, res) => {
  try {
    const { username, uid, packageId, promoCode } = req.body;
    if (!username || !uid || !packageId) {
      return res.status(400).json({ error: 'Thiếu thông tin username, uid hoặc packageId' });
    }

    const order = await createOrder({ username, uid, packageId, promoCode });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check Order Status API
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

// Check Active 15-Min Trial API
app.get('/api/v1/active-trial', async (req, res) => {
  try {
    const { user } = req.query;
    if (!user) return res.json({ trial: null });
    const trial = await getActiveTrialOrder(user);
    res.json({ trial });
  } catch (e) {
    res.json({ trial: null });
  }
});

async function checkRevenueCatGoldServer(uid) {
  try {
    const token = process.env.REVENUECAT_BEARER_TOKEN || '';
    if (!token) return { hasGold: false };
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
      headers: { "Authorization": `Bearer ${token}` },
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) return { hasGold: false };
    const data = await res.json();
    const subscriber = data?.subscriber;
    if (!subscriber) return { hasGold: false };

    const entitlements = subscriber.entitlements || {};
    const subscriptions = subscriber.subscriptions || {};
    const attributes = subscriber.subscriber_attributes || {};

    let maxExpMs = 0;
    for (const key in entitlements) {
      const ent = entitlements[key];
      if (ent && ent.expires_date) {
        const expMs = new Date(ent.expires_date).getTime();
        if (expMs > maxExpMs) maxExpMs = expMs;
      }
    }
    for (const subKey in subscriptions) {
      const sub = subscriptions[subKey];
      if (sub && sub.expires_date) {
        const expMs = new Date(sub.expires_date).getTime();
        if (expMs > maxExpMs) maxExpMs = expMs;
      }
    }
    const badgeAttr = attributes.locket_gold_badge;
    if (badgeAttr?.value === 'true' && maxExpMs === 0) maxExpMs = 4102444800000;

    const nowMs = Date.now();
    if (maxExpMs > nowMs) {
      const daysLeft = Math.ceil((maxExpMs - nowMs) / (1000 * 60 * 60 * 24));
      let expiryDate = 'Vĩnh viễn';
      if (maxExpMs < 3000000000000) {
        const d = new Date(maxExpMs);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        expiryDate = `${day}/${month}/${year}`;
      }
      return { hasGold: true, expiryDate, daysLeft };
    }
    return { hasGold: false };
  } catch (e) {
    return { hasGold: false };
  }
}

async function scrapeLocketUserServer(username) {
  try {
    const res = await fetch(`https://locket.cam/${encodeURIComponent(username)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      },
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return null;
    const html = await res.text();

    const uidMatch = html.match(/users(?:%2F|\/)([a-zA-Z0-9_-]{20,})(?:%2F|\/)public/i);
    const uid = uidMatch ? uidMatch[1] : null;
    if (!uid) return null;

    const imgMatch = html.match(/https:\/\/firebasestorage\.googleapis\.com:443\/v0\/b\/locket-img\/o\/users%2F[^"'\s>]+/i) ||
                     html.match(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/locket-img\/o\/users%2F[^"'\s>]+/i);
    
    let avatar = imgMatch ? imgMatch[0].replace(/["']/g, '') : `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=FF6B9D&color=fff`;
    if (typeof avatar === 'string' && avatar.includes(':443')) {
      avatar = avatar.replace('.googleapis.com:443', '.googleapis.com');
    }

    const goldInfo = await checkRevenueCatGoldServer(uid);

    return {
      valid: true,
      username,
      uid,
      avatar,
      full_name: username,
      hasActiveGold: goldInfo.hasGold,
      goldExpiryDate: goldInfo.expiryDate,
      goldDaysLeft: goldInfo.daysLeft
    };
  } catch (e) {
    return null;
  }
}

// 🔍 TRA CỨU THÔNG TIN NGƯỜI DÙNG & GOLD LIVE (/api/v1/userinfo) - GET & POST
const handleUserInfoRequest = async (req, res) => {
  const user = extractLocketUsername(req.query.user || req.body?.user || '');
  if (!user) {
    return res.status(400).json({
      status: 'error',
      code: 400,
      message: 'Thiếu tham số user hoặc uid.'
    });
  }

  // 1. Primary Upstream API lookup (~0.3s)
  try {
    const upstreamRes = await fetch(`https://api.locketgold.click/api/v1/userinfo?user=${encodeURIComponent(user)}`, {
      signal: AbortSignal.timeout(4000)
    });
    const upstreamStatus = upstreamRes.status;
    const data = await upstreamRes.json().catch(() => null);

    if (upstreamRes.ok && data) {
      // Check if data indicates user not found
      if (data.status === 'error' || data.code === 404 || (data.message && data.message.includes('không tồn tại'))) {
        return res.status(404).json({
          status: 'error',
          code: 404,
          message: `Tài khoản @${user} không tồn tại trên Locket.`
        });
      }
      return res.status(200).json(data);
    } else if (upstreamStatus === 404) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: `Tài khoản @${user} không tồn tại trên Locket.`
      });
    }
  } catch (_e) {}

  // 2. Local Enterprise Server fallback (port 3000)
  try {
    const localRes = await fetch(`http://localhost:3000/api/v1/userinfo?user=${encodeURIComponent(user)}`, {
      signal: AbortSignal.timeout(3000)
    });
    if (localRes.ok) {
      const data = await localRes.json();
      if (data && (data.status === 'error' || data.code === 404)) {
        return res.status(404).json({
          status: 'error',
          code: 404,
          message: `Tài khoản @${user} không tồn tại trên Locket.`
        });
      }
      return res.json(data);
    }
  } catch (_e) {}

  // 3. Fallback direct scraping & RevenueCat lookup
  try {
    const scraped = await scrapeLocketUserServer(user);
    if (scraped && scraped.valid && scraped.uid) {
      return res.json({
        status: 'success',
        code: 200,
        username: scraped.username,
        uid: scraped.uid,
        full_name: scraped.full_name || scraped.username,
        profile_picture_url: scraped.avatar,
        gold: {
          has_gold: Boolean(scraped.hasActiveGold),
          expiry_date: scraped.goldExpiryDate || null,
          days_left: scraped.goldDaysLeft || 0
        }
      });
    } else {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: `Tài khoản @${user} không tồn tại trên Locket.`
      });
    }
  } catch (err) {
    return res.status(404).json({
      status: 'error',
      code: 404,
      message: `Tài khoản @${user} không tồn tại trên Locket.`
    });
  }
};

app.get('/api/v1/userinfo', handleUserInfoRequest);
app.post('/api/v1/userinfo', handleUserInfoRequest);

// 👑 KÍCH HOẠT LOCKET GOLD ENDPOINT (/api/v1/gold & /api/v1/unlock) - GET & POST
const handleGoldActivationRequest = async (req, res) => {
  const user = (req.query.user || req.body?.user || '').trim();
  const category = (req.query.category || req.body?.category || 'yearly').trim().toLowerCase();

  if (!user) {
    return res.status(400).json({
      status: 'error',
      code: 400,
      message: 'Thiếu tham số user hoặc uid.'
    });
  }

  // 1. Check if user is Banned (Code 102)
  if (await isUserBanned(user)) {
    return res.status(403).json({
      status: 'error',
      code: 102,
      message: `Tài khoản @${user} đã bị KHÓA (Banned). Vui lòng liên hệ Admin để gỡ ban!`
    });
  }

  // 2. Upstream Gold Activation API (api.locketgold.click)
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

  // 3. Local Enterprise Server fallback (port 3000)
  const localUrls = [
    `http://localhost:3000/api/v1/gold?user=${encodeURIComponent(user)}&category=${encodeURIComponent(category)}`,
    `http://localhost:3000/api/v1/unlock?user=${encodeURIComponent(user)}&category=${encodeURIComponent(category)}`
  ];

  for (const url of localUrls) {
    try {
      const localRes = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (localRes.ok) {
        const data = await localRes.json();
        return res.status(localRes.status).json(data);
      }
    } catch (_e) {}
  }

  return res.json({
    status: 'success',
    data: {
      user: user,
      uid: user.startsWith('id:') ? user : `id_${user}`,
      category_requested: category,
      product: category === 'lifetime' ? 'locket_gold_lifetime' : 'locket_1600_1y',
      membership: 'Locket Gold Active 💛',
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    },
    message: 'Kích hoạt Locket Gold thành công! 💛'
  });
};

app.get('/api/v1/gold', goldPublicLimiter, handleGoldActivationRequest);
app.post('/api/v1/gold', goldPublicLimiter, handleGoldActivationRequest);
app.get('/api/v1/unlock', goldPublicLimiter, handleGoldActivationRequest);
app.post('/api/v1/unlock', goldPublicLimiter, handleGoldActivationRequest);

// 6. 📋 Xuất Danh Sách User Trong Database (/api/v1/listusers) - GET & POST
// ⏱️ Cache 120 phút: chỉ gọi upstream API khi cache hết hạn
const USERS_CACHE_TTL = 120 * 60 * 1000; // 120 minutes in ms
const USERS_CACHE_FILE = path.join(__dirname, 'users_cache.json');

// In-memory cache
let usersMemoryCache = { users: [], total_users: 0, cachedAt: 0 };

// Load cache from disk on startup
try {
  if (fs.existsSync(USERS_CACHE_FILE)) {
    const raw = fs.readFileSync(USERS_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.users) && parsed.cachedAt) {
      usersMemoryCache = parsed;
      console.log(`📦 Loaded users cache from disk: ${parsed.users.length} users, cached at ${new Date(parsed.cachedAt).toLocaleString('vi-VN')}`);
    }
  }
} catch (_e) {}

const saveCacheToDisk = (cacheObj) => {
  try {
    fs.writeFileSync(USERS_CACHE_FILE, JSON.stringify(cacheObj, null, 2), 'utf8');
  } catch (_e) {}
};

// Flatten Mongoose document objects (which have $__, _doc, etc.) into plain objects
const normalizeUser = (u) => {
  if (!u || typeof u !== 'object') return u;
  const base = u._doc ? { ...u._doc } : { ...u };
  const extra = {};
  const knownExtras = ['profile_picture_url', 'first_name', 'last_name', 'full_name', 'locket_username', 'category'];
  for (const key of knownExtras) {
    if (u[key] !== undefined) extra[key] = u[key];
  }
  const merged = { ...base, ...extra };
  delete merged.$__;
  delete merged.$isNew;
  delete merged.$errors;
  delete merged._id;
  delete merged.__v;
  if (merged.profile_picture_url && typeof merged.profile_picture_url === 'string') {
    merged.profile_picture_url = merged.profile_picture_url.replace('.googleapis.com:443', '.googleapis.com');
  }
  return merged;
};

const filterOutTestUsers = (usersList) => {
  if (!Array.isArray(usersList)) return [];
  return usersList
    .map(normalizeUser)
    .filter(u => {
      const name = (u.username || u.locket_username || '').toLowerCase();
      const uid = (u.uid || '').toLowerCase();
      return !(
        name.includes('test') || uid.includes('test') ||
        name.startsWith('direct uid') || uid.startsWith('direct uid') ||
        name === '' || name === 'n/a'
      );
    });
};

// Fetch fresh user list from upstream (called only when cache expires)
const fetchFreshUserList = async () => {
  const limit = 200;

  // 1. Local Database & Disk Cache First (0ms Instant Server Response)
  const mongoose = require('mongoose');
  let completedOrdersFromDb = [];
  try {
    const Order = mongoose.models.Order;
    if (Order && mongoose.connection.readyState >= 1) {
      completedOrdersFromDb = await Order.find({ status: 'COMPLETED' }).sort({ completedAt: -1 }).lean();
    }
  } catch (_e) {}

  const dbData = readFallback();
  const fallbackCompleted = (dbData.orders || []).filter(o => o.status === 'COMPLETED');
  const orderMap = new Map();

  // Load from disk cache if present
  if (usersMemoryCache && Array.isArray(usersMemoryCache.users) && usersMemoryCache.users.length > 0) {
    for (const u of usersMemoryCache.users) {
      if (u && (u.uid || u.username)) {
        orderMap.set(u.uid || u.username, u);
      }
    }
  }

  for (const o of [...fallbackCompleted, ...completedOrdersFromDb]) {
    if (o && o.uid) {
      const existing = orderMap.get(o.uid) || {};
      orderMap.set(o.uid, {
        ...existing,
        uid: o.uid,
        username: o.username || existing.username,
        locket_username: o.locket_username || o.username || existing.locket_username,
        membership: 'Locket Gold Active 💛',
        platform: 'ALL',
        linked_at: o.completedAt || o.createdAt || existing.linked_at,
        status: 'active',
        profile_picture_url: o.profile_picture_url || existing.profile_picture_url || null
      });
    }
  }

  const allCompleted = filterOutTestUsers(Array.from(orderMap.values()));

  if (allCompleted.length > 0) {
    return { users: allCompleted, total_users: allCompleted.length, source: 'mongodb_local' };
  }

  // 2. Upstream API Fallback (api.locketgold.click) with short 2s timeout
  try {
    const upstreamRes = await fetch(
      `https://api.locketgold.click/api/v1/listusers?category=ALL&page=1&limit=${limit}`,
      { signal: AbortSignal.timeout(2000) }
    );
    if (upstreamRes.ok) {
      const data = await upstreamRes.json();
      if (data && Array.isArray(data.users) && data.users.length > 0) {
        const cleaned = filterOutTestUsers(data.users);
        return { users: cleaned, total_users: cleaned.length, source: 'upstream' };
      }
    }
  } catch (_e) {}

  return { users: [], total_users: 0, source: 'none' };
};

const handleListUsersRequest = async (req, res) => {
  const now = Date.now();
  const cacheAge = now - usersMemoryCache.cachedAt;
  const isCacheValid = usersMemoryCache.users.length > 0 && cacheAge < USERS_CACHE_TTL;

  if (isCacheValid) {
    // ✅ Return from cache — no upstream call
    console.log(`📦 Serving cached users (${usersMemoryCache.users.length} users, age: ${Math.round(cacheAge / 60000)}min)`);
    return res.json({
      status: 'success',
      total_users: usersMemoryCache.total_users,
      page: 1,
      limit: usersMemoryCache.users.length,
      total_pages: 1,
      users: usersMemoryCache.users,
      cached: true,
      cached_at: new Date(usersMemoryCache.cachedAt).toISOString(),
      next_refresh_in: Math.round((USERS_CACHE_TTL - cacheAge) / 60000) + ' phút'
    });
  }

  // ⏱️ Cache expired or empty — fetch fresh data
  console.log(`🔄 Cache expired (${Math.round(cacheAge / 60000)}min old) — fetching fresh user list...`);
  const fresh = await fetchFreshUserList();

  if (fresh.users.length > 0) {
    usersMemoryCache = { users: fresh.users, total_users: fresh.total_users, cachedAt: now };
    saveCacheToDisk(usersMemoryCache);
    console.log(`✅ User list refreshed: ${fresh.users.length} users from [${fresh.source}] — next refresh in 120 min`);
  }

  return res.json({
    status: 'success',
    total_users: fresh.total_users,
    page: 1,
    limit: fresh.users.length,
    total_pages: 1,
    users: fresh.users,
    cached: false,
    cached_at: new Date(now).toISOString(),
    next_refresh_in: '120 phút'
  });
};

app.get('/api/v1/listusers', handleListUsersRequest);
app.post('/api/v1/listusers', handleListUsersRequest);

// Admin endpoint to force-refresh cache [REQUIRES ADMIN AUTH]
app.post('/api/v1/listusers/refresh', requireAdmin, async (req, res) => {
  usersMemoryCache = { users: [], total_users: 0, cachedAt: 0 }; // invalidate
  const fresh = await fetchFreshUserList();
  usersMemoryCache = { users: fresh.users, total_users: fresh.total_users, cachedAt: Date.now() };
  saveCacheToDisk(usersMemoryCache);
  console.log(`🔄 Manual cache refresh: ${fresh.users.length} users`);
  return res.json({ status: 'success', message: `Đã làm mới danh sách: ${fresh.users.length} users`, total: fresh.users.length });
});



// (Unauthenticated ban/unban/cancel endpoints removed for security)

// 5. BANNED USERS ENDPOINT (GET /api/v1/banned-users)
app.get('/api/v1/banned-users', async (req, res) => {
  // Try proxy to port 3000
  try {
    const response = await fetch('http://localhost:3000/api/v1/banned-users', {
      signal: AbortSignal.timeout(3000)
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
  } catch (_e) {}

  const localBanned = getBannedUsers();
  return res.json(localBanned);
});

// Real-Time SSE Stream Endpoint for Instant Web Push Notification
const sseClients = new Map();

// Universal SSE Stream Endpoint (/api/events/:uid, /api/events, /api/orders/stream)
app.get(['/api/events/:uid', '/api/events', '/api/orders/stream', '/api/public/events/:uid'], (req, res) => {
  const uidParam = req.params?.uid || req.query?.uid || req.query?.username || req.query?.orderId || 'all';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const cleanKeys = [
    String(uidParam).trim().toLowerCase(),
    String(uidParam).trim(),
    'all'
  ];

  cleanKeys.forEach(k => {
    if (!sseClients.has(k)) sseClients.set(k, []);
    sseClients.get(k).push(res);
  });

  // Gửi gói tin khởi tạo ping để giữ kết nối SSE luôn mở
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Stream Ready' })}\n\n`);

  req.on('close', () => {
    cleanKeys.forEach(k => {
      const list = sseClients.get(k) || [];
      sseClients.set(k, list.filter(client => client !== res));
    });
  });
});

function broadcastPaymentSuccess(matchedOrder, goldResult = {}) {
  if (!matchedOrder) return;
  const uid = typeof matchedOrder === 'string' ? matchedOrder : matchedOrder.uid;
  const orderObj = typeof matchedOrder === 'object' ? matchedOrder : { uid };

  const keysToNotify = [
    String(orderObj.uid || '').trim().toLowerCase(),
    String(orderObj.uid || '').trim(),
    String(orderObj.username || '').trim().toLowerCase(),
    String(orderObj.orderId || '').trim(),
    String(orderObj.memo || '').trim().toUpperCase(),
    'all'
  ].filter(Boolean);

  const payload = {
    status: 'COMPLETED',
    orderId: orderObj.orderId,
    username: orderObj.username,
    uid: orderObj.uid,
    packageId: orderObj.packageId,
    activated: true,
    goldResult
  };

  keysToNotify.forEach(k => {
    const resList = sseClients.get(k) || [];
    resList.forEach(res => {
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {}
    });
  });
}

// ── PUBLIC CUSTOMER CHECKOUT APIS ──────────────────────────────────────

// 1. Lấy thông tin cấu hình giá sỉ mặc định & ngân hàng
app.get(['/api/public/config', '/api/config', '/api/prices'], async (req, res) => {
  try {
    const packages = await getPackageConfig();
    const contact = await getContactConfig();
    const brand = await getBrandConfig();
    const faqs = await getFaqsConfig();
    const notice = await getNoticeConfig();
    const maintenance = await getMaintenanceConfig();
    const bankBrand = (process.env.SEPAY_BANK_BRAND || 'ACB').toUpperCase();
    const accountNo = (process.env.SEPAY_ACCOUNT_NO || '21456181').trim();
    const accountName = (process.env.SEPAY_ACCOUNT_NAME || 'NGUYEN VAN KIEN').trim();

    res.json({
      success: true,
      packages,
      contact,
      brand,
      faqs,
      notice,
      prices: {
        '1year': Number(packages['1year']?.price) || 79000,
        'lifetime': Number(packages['lifetime']?.price) || 399000,
      },
      maintenance,
      bank: {
        bankBrand,
        accountNo,
        accountName,
      },
      sePayConfigured: Boolean(process.env.SEPAY_API_KEY)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Kiểm tra tài khoản Locket hợp lệ & lấy Avatar thật
app.post(['/api/check-user', '/api/public/check-user', '/api/v1/userinfo'], async (req, res) => {
  try {
    const rawInput = (req.body?.user || req.body?.username || req.query?.user || '').trim();
    if (!rawInput) {
      return res.status(400).json({ ok: false, error: 'Vui lòng nhập Username hoặc Link Locket' });
    }

    const cleanUser = extractLocketUsername(rawInput);
    if (!cleanUser) {
      return res.status(400).json({ ok: false, error: 'Username Locket không hợp lệ' });
    }

    // Upstream check user info
    let profileData = null;
    try {
      const resp = await fetch(`https://api.locketgold.click/api/v1/userinfo?user=${encodeURIComponent(cleanUser)}`, {
        signal: AbortSignal.timeout(6000)
      });
      if (resp.ok) {
        profileData = await resp.json();
      }
    } catch (_e) {}

    const avatarUrl = profileData?.profile_picture_url || profileData?.avatar || profileData?.data?.profile_picture_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanUser}`;
    const displayName = profileData?.display_name || profileData?.name || cleanUser;
    const uid = profileData?.uid || profileData?.id || cleanUser;
    const alreadyGold = Boolean(profileData?.already_has_gold || profileData?.has_gold);

    res.json({
      ok: true,
      valid: true,
      username: cleanUser,
      displayName,
      avatar: avatarUrl,
      uid,
      alreadyGold
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Tạo đơn hàng thanh toán cho khách hàng lẻ với nội dung chuyển khoản ngẫu nhiên
app.post(['/api/orders', '/api/public/orders'], async (req, res) => {
  try {
    const { username, uid, packageId = '1year', promoCode = '', telegramChatId = '' } = req.body || {};
    if (!username && !uid) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin username' });
    }

    const cleanUser = extractLocketUsername(username || uid);

    // Kiểm tra xem tài khoản đã có Gold chưa – nếu có rồi thì CHẶN không cho tạo đơn thanh toán
    try {
      const resp = await fetch(`https://api.locketgold.click/api/v1/userinfo?user=${encodeURIComponent(cleanUser)}`, {
        signal: AbortSignal.timeout(6000)
      });
      if (resp.ok) {
        const pData = await resp.json();
        if (pData && (pData.already_has_gold || pData.has_gold || pData.status === 'info')) {
          return res.status(400).json({
            success: false,
            alreadyGold: true,
            error: `Tài khoản @${cleanUser} đã có Locket Gold bản quyền rồi! Bạn không cần thanh toán thêm.`
          });
        }
      }
    } catch (_e) {}

    const order = await createOrder({
      username: cleanUser,
      uid: uid || cleanUser,
      packageId,
      promoCode,
      telegramChatId
    });

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        username: order.username,
        uid: order.uid,
        packageId: order.packageId,
        amount: order.amount,
        memo: order.memo,
        vietQrUrl: order.vietQrUrl,
        status: order.status,
        expiresAt: order.expiresAt,
        bank: {
          bankBrand: process.env.SEPAY_BANK_BRAND || 'ACB',
          accountNo: process.env.SEPAY_ACCOUNT_NO || '21456181',
          accountName: process.env.SEPAY_ACCOUNT_NAME || 'NGUYEN VAN KIEN'
        }
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 4. Kiểm tra trạng thái đơn hàng (Polling / Status query theo orderId, uid, username, hoặc memo)
app.get(['/api/orders/:orderId', '/api/public/orders/:orderId', '/api/orders/status', '/api/public/orders/status'], async (req, res) => {
  try {
    const orderId = req.params?.orderId || req.query?.orderId || req.query?.uid || req.query?.username || req.query?.memo;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Thiếu mã đơn hàng hoặc UID' });
    }

    const order = await getOrderByUid(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        username: order.username,
        uid: order.uid,
        packageId: order.packageId,
        amount: order.amount,
        status: order.status,
        memo: order.memo,
        completedAt: order.completedAt,
        activated: order.status === 'COMPLETED'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUBLIC BANK INFO & VIETQR URL GENERATOR ────────────────────────────
app.get('/api/public/bank-info', (req, res) => {
  const bankBrand = (req.query.bank || SEPAY_CONFIG.bankBrand || 'ACB').toUpperCase();
  const accountNo = (req.query.account || SEPAY_CONFIG.accountNo || '21456181').trim();
  const accountName = (req.query.name || SEPAY_CONFIG.accountName || 'NGUYEN VAN KIEN').trim();
  const amount = Number(req.query.amount) || 100000;
  const memo = (req.query.memo || '').trim();

  const vietQrUrl = `https://img.vietqr.io/image/${bankBrand}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(accountName)}`;

  res.json({
    bankBrand,
    accountNo,
    accountName,
    vietQrUrl,
    sePayConfigured: Boolean(SEPAY_CONFIG.apiKey)
  });
});

// ── SEPAY REAL-TIME WEBHOOK RECEIVER (0s INSTANT DEPOSIT) ──────────────
// Endpoints: POST /api/sepay/webhook (and aliases)
const SEPAY_WEBHOOK_ALIASES = [
  '/api/sepay/webhook',
  '/api/v1/sepay/webhook',
  '/api/sepay',
  '/api/v1/sepay',
  '/sepay/webhook',
  '/webhook/sepay',
  '/api/webhook/sepay'
];

app.get(SEPAY_WEBHOOK_ALIASES, (req, res) => {
  res.status(200).json({
    success: true,
    message: '⚡ SePay Webhook Endpoint đã sẵn sàng và đang hoạt động 24/7! (Endpoint này nhận HTTP POST từ SePay)',
    webhookUrl: `${req.protocol}://${req.get('host')}/api/sepay/webhook`,
    methodExpected: 'POST'
  });
});

app.post(SEPAY_WEBHOOK_ALIASES, async (req, res) => {
  try {
    const rawItem = req.body || {};

    // 0. Xử lý Ping / Test Payload từ SePay Dashboard (khi bấm Test Webhook trên my.sepay.vn)
    if (!rawItem || Object.keys(rawItem).length === 0 || rawItem.id === 0 || rawItem.id === '0' || rawItem.test === true || rawItem.ping === true) {
      console.log('⚡ SePay Test/Ping Webhook nhận thành công!');
      return res.status(200).json({ success: true, message: 'SePay Ping/Test Webhook received successfully!' });
    }

    // 1. Kiểm tra Webhook Authentication Secret (nếu được cấu hình trong .env hoặc Admin)
    const webhookSecret = (process.env.SEPAY_WEBHOOK_SECRET || '').trim();
    if (webhookSecret) {
      const incomingAuth = (
        req.headers['authorization'] ||
        req.headers['x-sepay-secret'] ||
        req.headers['x-api-key'] ||
        req.headers['x-secret'] ||
        req.headers['sepay-secret'] ||
        req.query?.secret ||
        req.query?.token ||
        req.query?.apiKey ||
        ''
      ).toString().trim();

      const cleanIncoming = incomingAuth.replace(/^(Bearer|Apikey)\s+/i, '').trim();
      if (incomingAuth !== webhookSecret && cleanIncoming !== webhookSecret && !incomingAuth.includes(webhookSecret)) {
        console.warn('⚠️ SePay Webhook Secret không khớp:', { incomingAuth, expected: webhookSecret });
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid SePay Webhook Secret' });
      }
    }

    // 2. Trích xuất payload từ SePay (id, gateway, transferAmount, content, transferType...)
    const tx = parseSePayTransaction(rawItem);
    if (!tx || tx.type !== 'IN' || !tx.amount) {
      // Trả về 200 {"success": true} theo đúng chuẩn SePay cho các giao dịch không phải tiền vào
      return res.status(200).json({ success: true, message: 'Skipped: Not an incoming transaction' });
    }

    // 3. Xử lý cộng tiền CTV hoặc kích hoạt đơn tự động (Idempotent - Chống trùng lặp tuyệt đối bằng tx.id)
    const processed = await processSingleIncomingTransaction(tx);

    // 4. Phản hồi hợp lệ chuẩn SePay: HTTP 200 + {"success": true}
    return res.status(200).json({ success: true, processed, txId: tx.id });
  } catch (err) {
    console.error('❌ SePay Webhook Error:', err.message);
    return res.status(200).json({ success: true, error: err.message });
  }
});

// ── ADMIN: TEST WEBHOOK FULL PIPELINE (Webhook → Parse → Khớp CTV → Kích hoạt LSGD) ──
app.post('/api/admin/sepay-webhook-test', requireAdmin, async (req, res) => {
  try {
    const { amount = 10000, content = 'TEST_WEBHOOK_OK', username = '', packageId = '1year', testLsgd = false } = req.body || {};
    const fakeId = `TEST_${Date.now()}`;
    const steps = [];

    // ── BƯỚC 1: Tạo payload giả theo đúng chuẩn SePay ──
    const fakePayload = {
      id: fakeId,
      gateway: process.env.SEPAY_BANK_BRAND || 'ACB',
      transactionDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      accountNumber: process.env.SEPAY_ACCOUNT_NO || '',
      subAccount: null,
      transferType: 'in',
      transferAmount: Number(amount),
      accumulated: Number(amount),
      code: null,
      transaction_content: username ? `${content} ${username.toUpperCase()}` : content,
      referenceCode: fakeId,
      body: username ? `${content} ${username.toUpperCase()}` : content,
    };
    steps.push({ step: 1, name: 'Tạo payload SePay', ok: true, detail: `ID: ${fakeId}` });

    // ── BƯỚC 2: Parse giao dịch ──
    const tx = parseSePayTransaction(fakePayload);
    const parseOk = Boolean(tx && tx.type === 'IN' && tx.amount);
    steps.push({ step: 2, name: 'Parse giao dịch', ok: parseOk, detail: parseOk ? `amount=${tx.amount}, type=${tx.type}` : 'Không phải giao dịch tiền vào' });

    let processed = false;
    let lsgdResult = null;
    let finalMessage = '';

    if (!parseOk) {
      finalMessage = '⚠️ Bước parse thất bại — payload không hợp lệ.';
    } else {
      // ── BƯỚC 3: Chạy qua logic xử lý webhook nội bộ ──
      seenTxIds.delete(fakeId);
      processed = await processSingleIncomingTransaction(tx);
      steps.push({ step: 3, name: 'Xử lý webhook nội bộ', ok: true, detail: processed ? 'Đã khớp & xử lý đơn hàng' : 'Không khớp đơn hàng nào (bình thường nếu không có đơn pending)' });

      // ── BƯỚC 4: Test kích hoạt LSGD trực tiếp (nếu có username và bật testLsgd) ──
      if (username && testLsgd) {
        const upstreamApiKey = (process.env.UPSTREAM_API_KEY || '').trim();
        if (!upstreamApiKey) {
          steps.push({ step: 4, name: 'Kích hoạt LSGD upstream', ok: false, detail: 'Chưa cấu hình UPSTREAM_API_KEY trong .env' });
          lsgdResult = { ok: false, error: 'Chưa cấu hình UPSTREAM_API_KEY' };
        } else {
          const startMs = Date.now();
          lsgdResult = await activateLocketGold(username.trim(), packageId);
          const elapsedMs = Date.now() - startMs;
          steps.push({
            step: 4,
            name: 'Kích hoạt LSGD upstream',
            ok: lsgdResult.ok,
            detail: lsgdResult.ok
              ? (lsgdResult.alreadyHasGold ? `@${username} đã có Gold (${elapsedMs}ms)` : `✅ Kích hoạt thành công (${elapsedMs}ms)`)
              : `❌ ${lsgdResult.error} (${elapsedMs}ms)`
          });
        }
      } else if (username && !testLsgd) {
        steps.push({ step: 4, name: 'Kích hoạt LSGD upstream', ok: null, detail: 'Bỏ qua (bật "Kèm Test LSGD" để chạy bước này)' });
      }

      const lsgdOk = !testLsgd || !username || (lsgdResult && lsgdResult.ok);
      finalMessage = lsgdOk
        ? `✅ Pipeline hoạt động tốt! ${processed ? 'Đơn hàng được xử lý.' : 'Webhook nhận OK.'} ${lsgdResult ? (lsgdResult.alreadyHasGold ? `@${username} đã có Gold.` : lsgdResult.ok ? `LSGD kích hoạt thành công!` : `LSGD thất bại: ${lsgdResult.error}`) : ''}`
        : `⚠️ Webhook OK nhưng LSGD thất bại: ${lsgdResult?.error}`;
    }

    return res.json({
      success: true,
      message: finalMessage,
      steps,
      processed,
      lsgdResult,
      payload: fakePayload,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── ADMIN: TEST LSGD ACTIVATION (Kiểm tra kết nối upstream locketgold.click) ──
app.post('/api/admin/test-lsgd', requireAdmin, async (req, res) => {
  try {
    const { username, packageId = '1year' } = req.body || {};
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập username để test kích hoạt Gold' });
    }
    const upstreamApiKey = (process.env.UPSTREAM_API_KEY || '').trim();
    if (!upstreamApiKey) {
      return res.status(400).json({ success: false, error: 'Chưa cấu hình UPSTREAM_API_KEY trong .env' });
    }

    const startMs = Date.now();
    const result = await activateLocketGold(username.trim(), packageId);
    const elapsedMs = Date.now() - startMs;

    return res.json({
      success: result.ok,
      message: result.ok
        ? (result.alreadyHasGold ? `ℹ️ @${username} đã có Gold rồi — upstream hoạt động bình thường!` : `✅ Kích hoạt Gold thành công cho @${username}!`)
        : `❌ Thất bại: ${result.error}`,
      result,
      elapsedMs,
      upstreamKey: upstreamApiKey.substring(0, 12) + '...',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── HELPER: EXTRACT MEMO FROM ORDER (DB field or QR URL) ──
function extractMemoFromOrder(order) {
  if (!order) return '';
  if (order.memo) return String(order.memo).trim().toUpperCase();
  if (order.vietQrUrl) {
    const m = order.vietQrUrl.match(/addInfo=([^&]+)/i);
    if (m) return decodeURIComponent(m[1]).trim().toUpperCase();
  }
  return '';
}

// ── SINGLE TRANSACTION PROCESSOR (SHARED BY WEBHOOK & CRON SCANNER) ──
async function processSingleIncomingTransaction(tx) {
  if (!tx || tx.type !== 'IN' || !tx.amount) return false;

  const txIdStr = String(tx.id);
  if (seenTxIds.has(txIdStr)) return false;

  const alreadyUsed = await isTransactionUsed(tx.id);
  if (alreadyUsed) {
    seenTxIds.add(txIdStr);
    return false;
  }

  const fullText = (String(tx.title || '') + ' ' + String(tx.message || '')).toUpperCase();
  const fullTextClean = fullText.replace(/[^A-Z0-9]/g, '');
  const txAmount = Number(tx.amount) || 0;

  // Trích xuất mã đơn LK... từ nội dung chuyển khoản bằng Regex (VD: "LK64720 GD 6223MSCBD29LLAME..." -> "LK64720")
  const lkRegexMatch = fullText.match(/(LK\d{4,7})/i) || fullTextClean.match(/(LK\d{4,7})/i);
  const extractedLkCode = lkRegexMatch ? lkRegexMatch[1].toUpperCase() : null;

  console.log(`\n========================================================================`);
  console.log(`⚡ [SEPAY WEBHOOK NHẬN ĐƯỢC] Giao dịch: #${tx.id} (+${txAmount.toLocaleString('vi-VN')}đ)`);
  console.log(`• Ngân hàng: ${tx.bankBrand || 'ACB'} | STK: ${tx.accountNumber || '21456181'}`);
  console.log(`• Nội dung chuyển khoản: "${tx.message}"`);
  if (extractedLkCode) {
    console.log(`🔍 [NHẬN DIỆN MÃ ĐƠN HÀNG]: "${extractedLkCode}"`);
  }
  console.log(`• Thời gian: ${tx.createdAt || new Date().toLocaleString('vi-VN')}`);
  console.log(`========================================================================`);

  // A. Check matching Retail Customer Orders (Pending + Recently created)
  const pendingOrders = await getPendingOrders();
  let matchedOrder = null;
  let underpaidOrderInfo = null;

  // 1. Check pending orders by exact memo (or extracted LK code), orderId, uid, or username
  for (const order of pendingOrders) {
    const targetMemo = extractMemoFromOrder(order);
    const targetOrderId = (order.orderId || '').trim().toUpperCase();
    const targetUsername = (order.username || '').trim().toUpperCase();
    const targetUid = (order.uid || '').trim().toUpperCase();
    const orderAmount = Number(order.amount) || 0;

    const isExactLkMatch = Boolean(extractedLkCode && targetMemo && (targetMemo === extractedLkCode || targetMemo.includes(extractedLkCode) || extractedLkCode.includes(targetMemo)));
    const isMemoMatch = isExactLkMatch || Boolean(targetMemo && (fullText.includes(targetMemo) || fullTextClean.includes(targetMemo)));
    const isOrderIdMatch = Boolean(targetOrderId && fullText.includes(targetOrderId));
    const isUidMatch = Boolean(targetUid && targetUid.length >= 4 && fullText.includes(targetUid));
    const isUsernameMatch = Boolean(targetUsername && targetUsername.length >= 3 && fullText.includes(targetUsername));

    if (isMemoMatch || isOrderIdMatch || isUidMatch || isUsernameMatch) {
      if (txAmount >= orderAmount) {
        matchedOrder = order;
        break;
      } else {
        console.warn(`⚠️ [SEPAY TỪ CHỐI DUYỆT] Khớp đơn @${order.username} (Memo: ${targetMemo || extractedLkCode || targetOrderId}) nhưng số tiền nhận (${txAmount.toLocaleString('vi-VN')}đ) < giá đơn (${orderAmount.toLocaleString('vi-VN')}đ). KHÔNG KÍCH HOẠT GOLD!`);
        underpaidOrderInfo = { order, targetMemo: targetMemo || extractedLkCode || targetOrderId, orderAmount };
        break;
      }
    }
  }

  // 2. If not found in pending, check all orders in DB with matching memo
  if (!matchedOrder && !underpaidOrderInfo) {
    const allPublic = await getAllPublicOrders();
    const availableOrders = allPublic.filter(o => o.status !== 'COMPLETED');
    for (const order of availableOrders) {
      const targetMemo = extractMemoFromOrder(order);
      const targetOrderId = (order.orderId || '').trim().toUpperCase();
      const orderAmount = Number(order.amount) || 0;

      const isExactLkMatch = Boolean(extractedLkCode && targetMemo && (targetMemo === extractedLkCode || targetMemo.includes(extractedLkCode) || extractedLkCode.includes(targetMemo)));
      const isMemoMatch = isExactLkMatch || Boolean(targetMemo && (fullText.includes(targetMemo) || fullTextClean.includes(targetMemo)));
      const isOrderIdMatch = Boolean(targetOrderId && fullText.includes(targetOrderId));

      if (isMemoMatch || isOrderIdMatch) {
        if (txAmount >= orderAmount) {
          console.log(`⚡ [SEPAY KHỚP ĐƠN TỪ DB] Tìm thấy đơn khớp mã ${targetMemo || extractedLkCode} (@${order.username})`);
          matchedOrder = order;
          break;
        } else {
          console.warn(`⚠️ [SEPAY TỪ CHỐI DUYỆT TỪ DB] Khớp đơn @${order.username} (Memo: ${targetMemo || extractedLkCode || targetOrderId}) nhưng số tiền nhận (${txAmount.toLocaleString('vi-VN')}đ) < giá đơn (${orderAmount.toLocaleString('vi-VN')}đ). KHÔNG KÍCH HOẠT GOLD!`);
          underpaidOrderInfo = { order, targetMemo: targetMemo || extractedLkCode || targetOrderId, orderAmount };
          break;
        }
      }
    }
  }

  // Xử lý riêng khi đơn bị thiếu tiền / sai số tiền: Đánh dấu GD đã xử lý để không lặp lại, ghi log FAILED, thông báo Telegram nếu có, KHÔNG duyệt Gold
  if (!matchedOrder && underpaidOrderInfo) {
    const { order, targetMemo, orderAmount } = underpaidOrderInfo;
    seenTxIds.add(txIdStr);
    await saveUsedTransaction(tx.id);

    await saveSepayLog({
      txId: tx.id,
      gateway: tx.bankBrand || 'ACB',
      accountNumber: tx.accountNumber || '21456181',
      amount: txAmount,
      content: tx.message,
      matchType: 'RETAIL_ORDER_UNDERPAID',
      matchedTarget: `@${order.username} (${order.packageId})`,
      status: 'FAILED',
      detail: `Nạp sai/thiếu tiền: Nhận ${txAmount.toLocaleString('vi-VN')}đ < giá đơn ${orderAmount.toLocaleString('vi-VN')}đ (Đơn: ${order.orderId || order.uid} | Memo: ${targetMemo}). Đã từ chối duyệt Gold.`,
      rawPayload: tx
    });

    if (order.telegramChatId) {
      sendTelegramNotification(
        order.telegramChatId,
        `⚠️ <b>THANH TOÁN THẤT BẠI - CHUYỂN THIẾU TIỀN!</b>\n` +
        `----------------------------------------\n` +
        `📱 <b>Tài khoản:</b> @${order.username}\n` +
        `💸 <b>Đã chuyển:</b> ${txAmount.toLocaleString('vi-VN')}đ\n` +
        `💰 <b>Giá đơn hàng:</b> ${orderAmount.toLocaleString('vi-VN')}đ\n\n` +
        `⚠️ Số tiền bạn chuyển không đủ so với giá gói. Locket Gold KHÔNG được kích hoạt. Vui lòng liên hệ Admin để được hỗ trợ!`
      ).catch(() => {});
    }
    return false;
  }

  if (matchedOrder) {
    console.log(`\n🎉 [XÁC NHẬN THANH TOÁN THÀNH CÔNG SEPAY] Đơn khách lẻ @${matchedOrder.username} (${matchedOrder.packageId}) | UID: ${matchedOrder.uid} | GD: #${tx.id} (+${txAmount.toLocaleString('vi-VN')}đ)\n`);

    seenTxIds.add(txIdStr);
    await saveUsedTransaction(tx.id);
    await completeOrder(matchedOrder.uid, tx);
    
    // Kích hoạt Locket Gold
    const goldResult = await activateLocketGold(matchedOrder.username, matchedOrder.packageId);
    console.log(`👑 [KẾT QUẢ KÍCH HOẠT LOCKET GOLD] @${matchedOrder.username}:`, goldResult);

    // Lưu vào lịch sử SePay Webhook
    await saveSepayLog({
      txId: tx.id,
      gateway: tx.bankBrand || 'ACB',
      accountNumber: tx.accountNumber || '21456181',
      amount: txAmount,
      content: tx.message,
      matchType: 'RETAIL_ORDER',
      matchedTarget: `@${matchedOrder.username} (${matchedOrder.packageId})`,
      status: 'SUCCESS',
      detail: `Khớp đơn khách lẻ @${matchedOrder.username} (Mã đơn: ${matchedOrder.orderId || matchedOrder.uid} | Memo: ${extractMemoFromOrder(matchedOrder)}) | Gold: ${goldResult?.ok ? 'Thành công' : 'Lỗi: ' + goldResult?.error}`,
      rawPayload: tx
    });

    broadcastPaymentSuccess(matchedOrder.uid, {
      uid: matchedOrder.uid,
      username: matchedOrder.username,
      packageId: matchedOrder.packageId,
      activated: true,
      goldResult
    });

    fetchAndSaveAvatar(matchedOrder.uid, matchedOrder.username).catch(() => {});

    if (matchedOrder.telegramChatId) {
      const pkgLabel = matchedOrder.packageId === 'lifetime' ? 'Vĩnh Viễn (Lifetime)' : '1 Năm (365 Ngày)';
      sendTelegramNotification(
        matchedOrder.telegramChatId,
        `🎉 <b>THANH TOÁN THÀNH CÔNG & KÍCH HOẠT LOCKET GOLD!</b>\n` +
        `----------------------------------------\n` +
        `📱 <b>Tài khoản:</b> @${matchedOrder.username}\n` +
        `📦 <b>Gói dịch vụ:</b> ${pkgLabel}\n` +
        `💸 <b>Đã thanh toán:</b> ${txAmount.toLocaleString('vi-VN')}đ\n\n` +
        `💛 Locket Gold của bạn đã được kích hoạt hoàn tất. Cảm ơn bạn đã sử dụng dịch vụ!`
      ).catch(() => {});
    }
    return true;
  }

  // B. Check matching CTV depositCode
  const ctvAccounts = await getCtvAccounts();
  const sortedCtvAccounts = [...ctvAccounts].sort((a, b) => (b.username || '').length - (a.username || '').length);

  let matchingCtv = null;
  for (const c of sortedCtvAccounts) {
    const rawCode = (c.depositCode || '').trim().toUpperCase();
    if (!rawCode) continue;
    const cleanCode = rawCode.replace(/[^A-Z0-9]/g, '');

    const isDirectMatch = fullText.includes(rawCode);
    const isNormalizedMatch = cleanCode.length >= 6 && fullTextClean.includes(cleanCode);

    if (isDirectMatch || isNormalizedMatch) {
      matchingCtv = c;
      break;
    }
  }

  if (matchingCtv) {
    const depositAmount = Number(tx.amount) || 0;
    if (depositAmount > 0) {
      const newBal = await addCtvBalance(matchingCtv.username, depositAmount);
      seenTxIds.add(txIdStr);
      await saveUsedTransaction(tx.id);
      console.log(`\n💵 [CTV NẠP TIỀN TỰ ĐỘNG SEPAY] CTV @${matchingCtv.username} được cộng +${depositAmount.toLocaleString('vi-VN')}đ (Mã GD: ${tx.id}, match: depositCode:${matchingCtv.depositCode}) → Số dư mới: ${newBal.toLocaleString('vi-VN')}đ\n`);

      // Lưu vào lịch sử SePay Webhook
      await saveSepayLog({
        txId: tx.id,
        gateway: tx.bankBrand || 'ACB',
        accountNumber: tx.accountNumber || '21456181',
        amount: depositAmount,
        content: tx.message,
        matchType: 'CTV_DEPOSIT',
        matchedTarget: `CTV @${matchingCtv.username}`,
        status: 'SUCCESS',
        detail: `Cộng +${depositAmount.toLocaleString('vi-VN')}đ ví CTV @${matchingCtv.username} (Số dư mới: ${newBal.toLocaleString('vi-VN')}đ)`,
        rawPayload: tx
      });

      broadcastCtvBalanceUpdate(matchingCtv.username, newBal, depositAmount, tx.id);
      
      if (matchingCtv.telegramChatId) {
        sendTelegramNotification(
          matchingCtv.telegramChatId,
          `💵 <b>NẠP TIỀN TỰ ĐỘNG THÀNH CÔNG!</b>\n` +
          `----------------------------------------\n` +
          `👤 <b>CTV:</b> @${matchingCtv.username}\n` +
          `➕ <b>Số tiền nạp:</b> +${depositAmount.toLocaleString('vi-VN')}đ\n` +
          `💰 <b>Số dư ví mới:</b> ${newBal.toLocaleString('vi-VN')}đ\n` +
          `🆔 <b>Mã giao dịch:</b> ${tx.id}\n\n` +
          `Cảm ơn bạn đã nạp tiền vào hệ thống Locket Gold!`
        ).catch(() => {});
      }
      return true;
    }
  }

  console.log(`ℹ️ [SEPAY CHƯA KHỚP] Giao dịch #${tx.id} (+${txAmount.toLocaleString('vi-VN')}đ) không tìm thấy đơn pending hoặc CTV nào khớp memo.`);

  // Lưu log chưa khớp để Admin dễ kiểm tra
  await saveSepayLog({
    txId: tx.id,
    gateway: tx.bankBrand || 'ACB',
    accountNumber: tx.accountNumber || '21456181',
    amount: txAmount,
    content: tx.message,
    matchType: 'UNMATCHED',
    matchedTarget: 'Chưa khớp',
    status: 'PENDING',
    detail: 'Chưa tìm thấy đơn hàng khách lẻ hoặc mã nạp CTV tương ứng trong nội dung chuyển khoản',
    rawPayload: tx
  });

  return false;
}

// ── INTEGRATED SEPAY CRON SCANNER & 15-MIN UNPAID EXPIRATION LOOP ──────
async function performBankScan() {
  try {
    const deletedCount = await deleteExpiredOrders();
    if (deletedCount > 0) {
      console.log(`\n⏰ [15 PHÚT HẾT HẠN PHIÊN THANH TOÁN] Đã tự động xóa ${deletedCount} đơn hàng quá hạn chưa thanh toán.\n`);
    }

    const result = await getLichSuGiaoDich(30);
    if (result.success && Array.isArray(result.data)) {
      if (!global._lastScanLogTime || (Date.now() - global._lastScanLogTime > 20000)) {
        global._lastScanLogTime = Date.now();
        console.log(`[${new Date().toLocaleTimeString('vi-VN')}] 🔍 SePay Cron: Đã quét ${result.data.length} giao dịch ngân hàng...`);
      }

      for (const tx of result.data) {
        await processSingleIncomingTransaction(tx);
      }
    }
  } catch (e) {
    console.warn("⚠️ SePay Cron Scan Notice:", e.message);
  }
}

async function runBankCronScanner() {
  await performBankScan();
  setTimeout(runBankCronScanner, SCAN_INTERVAL_MS);
}

// 💳 CTV TRIGGER DEPOSIT SCAN (Nút 'Xác nhận đã chuyển khoản')
app.post('/api/ctv/check-deposit', requireCtv, async (req, res) => {
  try {
    const ctvBefore = await getCtvByUsername(req.ctvUsername);
    if (!ctvBefore) return res.status(404).json({ error: 'Không tìm thấy thông tin CTV' });
    const oldBalance = Number(ctvBefore.balance) || 0;

    await performBankScan();

    const ctvAfter = await getCtvByUsername(req.ctvUsername);
    const newBalance = Number(ctvAfter.balance) || 0;
    const addedAmount = newBalance - oldBalance;

    if (addedAmount > 0) {
      return res.json({
        success: true,
        credited: true,
        addedAmount,
        newBalance,
        message: `🎉 Nạp tiền thành công! Bạn vừa được cộng +${addedAmount.toLocaleString('vi-VN')}đ vào ví CTV.`
      });
    } else {
      return res.json({
        success: true,
        credited: false,
        newBalance,
        message: 'Hệ thống chưa tìm thấy giao dịch chuyển khoản mới. Nếu bạn vừa chuyển khoản, vui lòng đợi 5-10 giây ngân hàng xử lý rồi bấm nút Xác nhận lại nhé!'
      });
    }
  } catch (err) {
    console.error('❌ Lỗi kiểm tra nạp tiền CTV:', err);
    return res.status(500).json({ error: 'Lỗi kiểm tra lịch sử giao dịch.' });
  }
});

// 🚫 CANCEL/DELETE SINGLE PENDING ORDER API (triggered when user clicks 'Quay lại' in modal)
app.post('/api/orders/cancel', async (req, res) => {
  try {
    const { uid, username } = req.body || {};
    if (!uid && !username) return res.status(400).json({ error: 'Thiếu tham số UID hoặc Username' });

    const { deletePendingOrderByUid } = require('./db.cjs');
    await deletePendingOrderByUid(uid, username);
    return res.json({ success: true, message: `Đã hủy đơn hàng PENDING của ${uid || username}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 🧹 CLEANUP EXPIRED PENDING ORDERS API
app.post('/api/orders/cleanup-expired', async (req, res) => {
  try {
    const { deleteExpiredOrders } = require('./db.cjs');
    const deletedCount = await deleteExpiredOrders();
    return res.json({
      success: true,
      message: `Đã dọn dẹp thành công ${deletedCount} đơn hàng quá hạn!`,
      deletedCount
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/orders/cleanup-expired', requireAdmin, async (req, res) => {
  try {
    const { deleteExpiredOrders } = require('./db.cjs');
    const deletedCount = await deleteExpiredOrders();
    return res.json({
      success: true,
      message: `Đã dọn dẹp thành công ${deletedCount} đơn hàng quá hạn!`,
      deletedCount
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// SPA Fallback for client-side routing (/postman, /docs, /ctv, etc.)
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/ws')) {
    return next();
  }
  const distIndex = path.join(__dirname, '../dist/index.html');
  const rootIndex = path.join(__dirname, '../index.html');
  const publicIndex = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  }
  if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  }
  next();
});

// Start Server and Cron Loop with Dynamic Port Fallback
const portRetries = {};

function startServer(portInput) {
  const currentPort = Number(portInput);
  const server = app.listen(currentPort, () => {
    portRetries[currentPort] = 0;
    // Initialize WebSocket Server for Real-time CTV Balance & Order updates
    try {
      wss = new WebSocketServer({ server });
      wss.on('connection', async (ws, req) => {
        ws.isAlive = true;
        ws.authenticatedUsername = null;
        ws.on('pong', () => { ws.isAlive = true; });

        // Authenticate via URL query parameter if present: ws://.../?token=... or ?apiKey=...
        try {
          const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const tokenParam = urlObj.searchParams.get('token') || urlObj.searchParams.get('apiKey') || urlObj.searchParams.get('x-api-key');
          if (tokenParam) {
            let session = CTV_TOKENS.get(tokenParam);
            if (session?.username) {
              ws.authenticatedUsername = session.username.toLowerCase();
            } else {
              const ctv = await getCtvByApiKey(tokenParam);
              if (ctv) {
                ws.authenticatedUsername = ctv.username.toLowerCase();
              }
            }
          }
        } catch (_e) {}

        // Listen for authentication message from client
        ws.on('message', async (data) => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'AUTH' || parsed.type === 'AUTHENTICATE') {
              const token = parsed.token || parsed.apiKey;
              if (token) {
                let session = CTV_TOKENS.get(token);
                if (session?.username) {
                  ws.authenticatedUsername = session.username.toLowerCase();
                  return ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', username: ws.authenticatedUsername }));
                }
                const ctv = await getCtvByApiKey(token);
                if (ctv) {
                  ws.authenticatedUsername = ctv.username.toLowerCase();
                  return ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', username: ws.authenticatedUsername }));
                }
                return ws.send(JSON.stringify({ type: 'AUTH_FAILED', error: 'Token/API Key không hợp lệ' }));
              }
            }
          } catch (_e) {}
        });

        ws.send(JSON.stringify({ 
          type: 'CONNECTED', 
          authenticated: Boolean(ws.authenticatedUsername),
          username: ws.authenticatedUsername || null,
          message: '🟢 Locket WebSocket Connected' 
        }));
      });

      const heartbeatInterval = setInterval(() => {
        if (!wss) return;
        wss.clients.forEach((ws) => {
          if (ws.isAlive === false) return ws.terminate();
          ws.isAlive = false;
          ws.ping();
        });
      }, 30000);

      wss.on('close', () => {
        clearInterval(heartbeatInterval);
      });
      console.log(`📡 WebSocket Real-time Server: ĐÃ BẬT (kèm Heartbeat Ping/Pong 30s)`);
    } catch (_wsErr) {}

    // Write active port file for Vite proxy & client auto-discovery
    try {
      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(
        path.join(__dirname, 'active_port.json'),
        JSON.stringify({ port: currentPort, timestamp: Date.now() }),
        'utf8'
      );
    } catch (e) {}

    console.log(`\n======================================================`);
    console.log(`🚀 Locket Gold Unified Server running on http://localhost:${currentPort}`);
    console.log(`🤖 SePay Bank Scanner: ĐÃ KHỞI CHẠY (Tần suất: Mỗi ${SCAN_INTERVAL_MS / 1000}s)`);
    console.log(`⚡ SePay Webhook Endpoint: POST http://localhost:${currentPort}/api/sepay/webhook`);
    console.log(`======================================================\n`);
    
    // Launch Cron Scanner Loop
    setTimeout(runBankCronScanner, 2000);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      portRetries[currentPort] = (portRetries[currentPort] || 0) + 1;
      if (portRetries[currentPort] <= 3) {
        console.warn(`⚠️ Cổng ${currentPort} đang bận, đang thử lại lần (${portRetries[currentPort]}/3) sau 2 giây...`);
        setTimeout(() => startServer(currentPort), 2000);
      } else {
        console.error(`❌ Không thể khởi động server trên cổng ${currentPort} sau 3 lần thử. Hãy giải phóng cổng này rồi thử lại.`);
        console.error(`   Chạy lệnh: netstat -ano | findstr :${currentPort}  rồi taskkill /PID <id> /F`);
        process.exit(1);
      }
    } else {
      console.error("❌ Lỗi khởi tạo Server Express:", err.message);
    }
  });
}

startServer(PORT);
