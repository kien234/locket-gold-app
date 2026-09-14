const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashPassword(password) {
  if (!password) return '';
  const cleanPass = String(password).trim();
  if (!cleanPass) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(cleanPass, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (!password || !storedPassword) return false;
  const cleanPass = String(password).trim();
  const storedStr = String(storedPassword).trim();
  if (!storedStr.startsWith('scrypt:')) {
    return cleanPass === storedStr;
  }
  const parts = storedStr.split(':');
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const storedHash = parts[2];
  try {
    const hash = crypto.scryptSync(cleanPass, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (_e) {
    return false;
  }
}

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

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/locket_ctv';
const FALLBACK_DB_FILE = path.join(__dirname, 'ctv_orders_fallback.json');

let isMongoConnected = false;

// ── MONGOOSE SCHEMAS & MODELS ──────────────────────────────────────────

// 1. Retail Order Schema
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  username: { type: String, required: true, lowercase: true, trim: true },
  uid: { type: String, required: true, trim: true, index: true },
  packageId: { type: String, required: true, enum: ['1year', 'lifetime'] },
  amount: { type: Number, required: true },
  memo: { type: String, index: true },
  status: { type: String, required: true, enum: ['PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED'], default: 'PENDING' },
  vietQrUrl: { type: String },
  transaction: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  completedAt: { type: Date, default: null },
  profile_picture_url: { type: String, default: null },
  telegramChatId: { type: String, default: '' }
});
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

// 2. ChildUser Schema
const childUserSchema = new mongoose.Schema({
  username: String,
  uid: String,
  profile_picture_url: String,
  first_name: String,
  last_name: String,
  linked_at: Date
});
const ChildUser = mongoose.models.ChildUser || mongoose.model('ChildUser', childUserSchema, 'childusers');

// 3. CTV Account Schema
const ctvAccountSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  displayName: { type: String },
  prices: {
    '1year': { type: Number, default: 65000 },
    'lifetime': { type: Number, default: 350000 }
  },
  balance: { type: Number, default: 0 },
  remainingRequests: { type: Number, default: 0 },
  apiKey: { type: String, required: true, unique: true },
  // depositCode: mã nạp tiền cố định, duy nhất cho từng CTV (dùng trong nội dung chuyển khoản)
  depositCode: { type: String, unique: true, sparse: true },
  telegramChatId: { type: String, default: '' },
  avatar: { type: String, default: '/assets/vip1.gif' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const CtvAccount = mongoose.models.CtvAccount || mongoose.model('CtvAccount', ctvAccountSchema);

// Helper: tạo depositCode ngẫu nhiên duy nhất dạng "LGNAPXXXXXX" (không dấu gạch ngang)
function generateDepositCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `LGNAP${code}`;
}

// 4. CTV Order Schema
const ctvOrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  ctvUsername: { type: String, required: true, lowercase: true, trim: true },
  userUpgraded: { type: String, required: true, lowercase: true, trim: true },
  packageId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'COMPLETED' },
  createdAt: { type: Date, default: Date.now }
});
const CtvOrder = mongoose.models.CtvOrder || mongoose.model('CtvOrder', ctvOrderSchema);

// 5. SePay Webhook Transaction Log Schema
const sepayLogSchema = new mongoose.Schema({
  txId: { type: String, index: true },
  gateway: { type: String, default: 'ACB' },
  accountNumber: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  content: { type: String, default: '' },
  matchType: { type: String, default: 'UNMATCHED' }, // 'RETAIL_ORDER', 'CTV_DEPOSIT', 'UNMATCHED', 'TEST_PING'
  matchedTarget: { type: String, default: '' },
  status: { type: String, default: 'SUCCESS' }, // 'SUCCESS', 'FAILED', 'PENDING'
  detail: { type: String, default: '' },
  rawPayload: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});
const SepayLog = mongoose.models.SepayLog || mongoose.model('SepayLog', sepayLogSchema);

// 6. System Configuration Schema (Prices, Maintenance, PromoCodes, BannedUsers, UsedTransactions, TelegramBotToken)
const systemConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
});
const SystemConfig = mongoose.models.SystemConfig || mongoose.model('SystemConfig', systemConfigSchema);

async function getSystemConfigValue(key, defaultValue = null) {
  if (await connectDb()) {
    try {
      const doc = await SystemConfig.findOne({ key }).lean();
      if (doc && doc.value !== undefined) return doc.value;
    } catch(e) {}
  }
  const db = readFallback();
  if (db && db[key] !== undefined) return db[key];
  return defaultValue;
}

async function setSystemConfigValue(key, value) {
  if (await connectDb()) {
    try {
      await SystemConfig.updateOne(
        { key },
        { $set: { value } },
        { upsert: true }
      );
    } catch(e) {}
  }
  const db = readFallback();
  db[key] = value;
  writeFallback(db);
  return value;
}


// ── JSON FALLBACK HELPERS ──────────────────────────────────────────────

function readFallback() {
  try {
    if (!fs.existsSync(FALLBACK_DB_FILE)) {
      const initialDb = { 
        orders: [], 
        bannedUsers: [], 
        userViolations: {},
        prices: { '1year': 79000, 'lifetime': 399000 },
        promoCodes: [
          { code: 'KAWAII10', discountType: 'percent', discountValue: 10, maxUses: 100, usedCount: 0, active: true }
        ],
        maintenance: {
          enabled: false,
          endDate: '03/08/2026',
          contactUrl: 'https://www.facebook.com/vnkin.06',
          message: 'Hệ thống nâng cấp Locket Gold đang hoạt động bình thường.'
        },
        ctvAccounts: [],
        ctvOrders: [],
        usedTransactions: []
      };
      fs.writeFileSync(FALLBACK_DB_FILE, JSON.stringify(initialDb, null, 2), 'utf8');
    }
    const data = JSON.parse(fs.readFileSync(FALLBACK_DB_FILE, 'utf8') || '{}');
    if (!data.orders) data.orders = [];
    if (!data.bannedUsers) data.bannedUsers = [];
    if (!data.userViolations) data.userViolations = {};
    if (!data.prices) data.prices = { '1year': 79000, 'lifetime': 399000 };
    if (!data.promoCodes) data.promoCodes = [];
    if (!data.maintenance) {
      data.maintenance = {
        enabled: false,
        endDate: '03/08/2026',
        contactUrl: 'https://www.facebook.com/vnkin.06',
        message: 'Hệ thống nâng cấp Locket Gold đang hoạt động bình thường.'
      };
    }
    if (!data.ctvAccounts) data.ctvAccounts = [];
    if (!data.ctvOrders) data.ctvOrders = [];
    if (!data.usedTransactions) data.usedTransactions = [];
    if (!data.brandConfig) {
      data.brandConfig = {
        logoUrl: '',
        brandName: 'Locket Gold',
        brandTag: 'PREMIUM',
        siteTitle: 'Locket Gold | Nâng Cấp Locket Gold Premium Tự Động Uy Tín Số 1',
        subtitle: 'Kích hoạt tự động 24/7'
      };
    }
    if (!data.contactConfig) {
      data.contactConfig = {
        facebook: 'https://www.facebook.com/vnkin.06',
        telegram: 'https://t.me/vnkien26',
        zalo: '0987654321',
        hotline: '0987.654.321',
        supportText: 'Cần hỗ trợ thanh toán hoặc thắc mắc về Locket Gold? Liên hệ Admin ngay 24/7!'
      };
    }
    if (!data.packagesConfig) {
      data.packagesConfig = {
        '1year': {
          name: 'Gói 1 Năm (365 Ngày)',
          price: 79000,
          subtitle: 'Tiết kiệm 80% so với mua trực tiếp trên App Store',
          features: [
            'Huy hiệu vương miện Gold 👑',
            'Đăng video dài & HD 1080p',
            'Kích hoạt tự động sau thanh toán'
          ]
        },
        'lifetime': {
          name: 'Gói Vĩnh Viễn (Trọn Đời)',
          price: 399000,
          subtitle: 'Dùng mãi mãi không lo hết hạn hay gia hạn lại',
          badge: 'TIẾT KIỆM NHẤT',
          features: [
            'Trọn đời tất cả tính năng Gold',
            'Cập nhật tính năng mới miễn phí',
            'Bảo hành trọn đời 100%'
          ]
        }
      };
    }
    return data;
  } catch (e) {
    return { 
      orders: [], 
      bannedUsers: [], 
      userViolations: {}, 
      prices: { '1year': 79000, 'lifetime': 399000 }, 
      promoCodes: [],
      maintenance: { enabled: false },
      ctvAccounts: [],
      ctvOrders: [],
      usedTransactions: [],
      brandConfig: {
        logoUrl: '',
        brandName: 'Locket Gold',
        brandTag: 'PREMIUM',
        siteTitle: 'Locket Gold | Nâng Cấp Locket Gold Premium Tự Động Uy Tín Số 1',
        subtitle: 'Kích hoạt tự động 24/7'
      },
      contactConfig: {
        facebook: 'https://www.facebook.com/vnkin.06',
        telegram: 'https://t.me/vnkien26',
        zalo: '0987654321',
        hotline: '0987.654.321',
        supportText: 'Cần hỗ trợ thanh toán hoặc thắc mắc về Locket Gold? Liên hệ Admin ngay 24/7!'
      },
      packagesConfig: {
        '1year': { name: 'Gói 1 Năm (365 Ngày)', price: 79000, subtitle: 'Tiết kiệm 80% so với mua trực tiếp trên App Store' },
        'lifetime': { name: 'Gói Vĩnh Viễn (Trọn Đời)', price: 399000, subtitle: 'Dùng mãi mãi không lo hết hạn hay gia hạn lại' }
      }
    };
  }
}

function writeFallback(data) {
  try {
    fs.writeFileSync(FALLBACK_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}


// ── MONGO DB CONNECTION & SYNC ─────────────────────────────────────────

let lastConnectAttempt = 0;

async function connectDb() {
  if (isMongoConnected) return true;
  const now = Date.now();
  if (now - lastConnectAttempt < 30000) {
    return false;
  }
  lastConnectAttempt = now;
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 1500
    });
    isMongoConnected = true;
    console.log('🍃 Kết nối MongoDB Database thành công:', MONGODB_URI);
    
    // Auto sync fallback JSON data into MongoDB if MongoDB collections are empty
    syncDataToMongo().catch(err => console.warn('⚠️ Seed MongoDB sync warning:', err.message));
    return true;
  } catch (err) {
    isMongoConnected = false;
    return false;
  }
}

async function syncDataToMongo() {
  if (!isMongoConnected) return;
  const fallback = readFallback();

  // 1. Sync CTV Accounts
  const countCtv = await CtvAccount.countDocuments();
  if (countCtv === 0 && fallback.ctvAccounts.length > 0) {
    for (const acc of fallback.ctvAccounts) {
      await CtvAccount.updateOne(
        { username: acc.username.toLowerCase() },
        { $set: acc },
        { upsert: true }
      );
    }
    console.log(`🍃 MongoDB: Đã đồng bộ ${fallback.ctvAccounts.length} tài khoản CTV vào Database!`);
  }

  // 2. Sync CTV Orders
  const countCtvOrders = await CtvOrder.countDocuments();
  if (countCtvOrders === 0 && fallback.ctvOrders.length > 0) {
    for (const o of fallback.ctvOrders) {
      await CtvOrder.updateOne(
        { orderId: o.orderId },
        { $set: o },
        { upsert: true }
      );
    }
  }

  // 3. Sync System Configurations (prices, maintenance, promoCodes, bannedUsers, usedTransactions, telegramBotToken)
  const systemKeys = ['prices', 'maintenance', 'promoCodes', 'bannedUsers', 'usedTransactions', 'telegramBotToken'];
  for (const k of systemKeys) {
    if (fallback[k] !== undefined) {
      const existing = await SystemConfig.findOne({ key: k });
      if (!existing) {
        await SystemConfig.create({ key: k, value: fallback[k] });
      }
    }
  }
}


// ── MONGO DB / FALLBACK SYSTEM CONFIG GETTERS & SETTERS ────────────────

async function getSystemConfigValue(key, defaultValue) {
  if (await connectDb()) {
    try {
      const doc = await SystemConfig.findOne({ key });
      if (doc && doc.value !== undefined) return doc.value;
    } catch (e) {}
  }
  const fallback = readFallback();
  return fallback[key] !== undefined ? fallback[key] : defaultValue;
}

async function setSystemConfigValue(key, value) {
  const fallback = readFallback();
  fallback[key] = value;
  writeFallback(fallback);

  if (await connectDb()) {
    try {
      await SystemConfig.updateOne({ key }, { $set: { value } }, { upsert: true });
    } catch (e) {}
  }
  return value;
}


// ── BANNED USERS FUNCTIONS ─────────────────────────────────────────────

async function getBannedUsers() {
  return await getSystemConfigValue('bannedUsers', []);
}

async function isUserBanned(usernameOrUid) {
  if (!usernameOrUid) return false;
  const clean = usernameOrUid.trim().toLowerCase();
  const list = await getBannedUsers();
  return list.some(u => 
    (u.user && u.user.toLowerCase() === clean) || 
    (u.uid && u.uid.toLowerCase() === clean) ||
    (u.username && u.username.toLowerCase() === clean)
  );
}

async function banUser(user, uid = '', reason = 'Vi phạm chính sách Locket Gold') {
  const cleanUser = user ? user.trim().toLowerCase() : 'unknown';
  const cleanUid = uid ? uid.trim() : `id:${cleanUser}`;
  const list = await getBannedUsers();

  const existingIndex = list.findIndex(u => 
    (u.user && u.user.toLowerCase() === cleanUser) || 
    (u.uid && u.uid.toLowerCase() === cleanUid)
  );

  const bannedObj = {
    user: cleanUser,
    username: cleanUser,
    uid: cleanUid,
    status: 'banned',
    code: 102,
    reason: reason,
    bannedAt: new Date().toISOString(),
    message: 'Tài khoản của bạn đã bị khóa (Banned). Vui lòng liên hệ Admin để được hỗ trợ!'
  };

  if (existingIndex >= 0) {
    list[existingIndex] = bannedObj;
  } else {
    list.push(bannedObj);
  }

  await setSystemConfigValue('bannedUsers', list);
  return bannedObj;
}

async function unbanUser(user) {
  const cleanUser = user ? user.trim().toLowerCase() : '';
  let list = await getBannedUsers();
  const initialLen = list.length;
  list = list.filter(u => 
    (u.user && u.user.toLowerCase() !== cleanUser) && 
    (u.username && u.username.toLowerCase() !== cleanUser) &&
    (u.uid && u.uid.toLowerCase() !== cleanUser)
  );
  if (list.length !== initialLen) {
    await setSystemConfigValue('bannedUsers', list);
    return true;
  }
  return false;
}

function incrementUserViolation(user) {
  const clean = user ? user.trim().toLowerCase() : '';
  if (!clean) return 0;
  const db = readFallback();
  if (!db.userViolations) db.userViolations = {};
  db.userViolations[clean] = (db.userViolations[clean] || 0) + 1;
  writeFallback(db);
  return db.userViolations[clean];
}

function getUserViolationCount(user) {
  const clean = user ? user.trim().toLowerCase() : '';
  if (!clean) return 0;
  const db = readFallback();
  return (db.userViolations && db.userViolations[clean]) || 0;
}


// ── ADMIN AUTHENTICATION & PRICES ──────────────────────────────────────

async function getAdminCredentials() {
  const custom = await getSystemConfigValue('adminCredentials', null);
  if (custom && custom.username && custom.password) {
    return custom;
  }
  const db = readFallback();
  if (db.adminCredentials && db.adminCredentials.username && db.adminCredentials.password) {
    return db.adminCredentials;
  }
  return {
    username: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASS || 'ChangeThisToASecurePassword123!'
  };
}

async function verifyAdminLogin(username, password) {
  if (!username || !password) return false;
  const inputUser = String(username).trim().toLowerCase();
  const inputPass = String(password).trim();

  // 1. Check from Database / System Config
  const creds = await getAdminCredentials();
  const storedUser = String(creds.username || '').trim().toLowerCase();
  const storedPass = String(creds.password || '').trim();
  const storedHash = String(creds.hashedPassword || '').trim();

  if (inputUser === storedUser) {
    if (inputPass === storedPass || (storedHash && verifyPassword(inputPass, storedHash)) || verifyPassword(inputPass, storedPass)) {
      return true;
    }
  }

  // 2. Check from .env directly as secondary check
  const envUser = String(process.env.ADMIN_USER || 'admin').trim().toLowerCase();
  const envPass = String(process.env.ADMIN_PASS || 'ChangeThisToASecurePassword123!').trim();
  if (inputUser === envUser) {
    if (inputPass === envPass || verifyPassword(inputPass, envPass)) {
      return true;
    }
  }

  return false;
}

async function updateAdminCredentials(newUsername, newPassword) {
  const cleanUser = String(newUsername || '').trim();
  const cleanPass = String(newPassword || '').trim();
  if (!cleanUser || cleanUser.length < 3) {
    throw new Error('Username Admin phải từ 3 ký tự trở lên');
  }
  if (!cleanPass || cleanPass.length < 4) {
    throw new Error('Mật khẩu Admin phải từ 4 ký tự trở lên');
  }

  const hashedPassword = hashPassword(cleanPass);
  const credObj = { username: cleanUser, password: cleanPass, hashedPassword };

  await setSystemConfigValue('adminCredentials', credObj);

  const db = readFallback();
  db.adminCredentials = credObj;
  writeFallback(db);

  process.env.ADMIN_USER = cleanUser;
  process.env.ADMIN_PASS = cleanPass;

  return { username: cleanUser };
}

async function getPrices() {
  const pkgConfig = await getPackageConfig();
  return {
    '1year': Number(pkgConfig['1year']?.price) || 79000,
    'lifetime': Number(pkgConfig['lifetime']?.price) || 399000
  };
}

async function updatePrices(newPrices) {
  const current = await getPackageConfig();
  current['1year'].price = Number(newPrices['1year']) || current['1year'].price || 79000;
  current['lifetime'].price = Number(newPrices['lifetime']) || current['lifetime'].price || 399000;
  await setSystemConfigValue('packagesConfig', current);
  return { '1year': current['1year'].price, 'lifetime': current['lifetime'].price };
}

async function getPackageConfig() {
  return await getSystemConfigValue('packagesConfig', {
    '1year': {
      name: 'Gói 1 Năm (365 Ngày)',
      price: 79000,
      subtitle: 'Tiết kiệm 80% so với mua trực tiếp trên App Store',
      features: [
        'Huy hiệu vương miện Gold 👑',
        'Đăng video dài & HD 1080p',
        'Kích hoạt tự động sau thanh toán'
      ]
    },
    'lifetime': {
      name: 'Gói Vĩnh Viễn (Trọn Đời)',
      price: 399000,
      subtitle: 'Dùng mãi mãi không lo hết hạn hay gia hạn lại',
      badge: 'TIẾT KIỆM NHẤT',
      features: [
        'Trọn đời tất cả tính năng Gold',
        'Cập nhật tính năng mới miễn phí',
        'Bảo hành trọn đời 100%'
      ]
    }
  });
}

async function updatePackageConfig(data) {
  const current = await getPackageConfig();
  if (data['1year']) {
    current['1year'] = {
      name: data['1year'].name || current['1year'].name,
      price: Number(data['1year'].price) || current['1year'].price,
      subtitle: data['1year'].subtitle !== undefined ? data['1year'].subtitle : current['1year'].subtitle,
      features: Array.isArray(data['1year'].features) ? data['1year'].features : current['1year'].features
    };
  }
  if (data['lifetime']) {
    current['lifetime'] = {
      name: data['lifetime'].name || current['lifetime'].name,
      price: Number(data['lifetime'].price) || current['lifetime'].price,
      subtitle: data['lifetime'].subtitle !== undefined ? data['lifetime'].subtitle : current['lifetime'].subtitle,
      badge: data['lifetime'].badge !== undefined ? data['lifetime'].badge : current['lifetime'].badge,
      features: Array.isArray(data['lifetime'].features) ? data['lifetime'].features : current['lifetime'].features
    };
  }
  await setSystemConfigValue('packagesConfig', current);
  return current;
}

async function getBrandConfig() {
  return await getSystemConfigValue('brandConfig', {
    logoUrl: '',
    brandName: 'Locket Gold',
    brandTag: 'PREMIUM',
    siteTitle: 'Locket Gold | Nâng Cấp Locket Gold Premium Tự Động Uy Tín Số 1',
    subtitle: 'Kích hoạt tự động 24/7',
    heroTitle: 'Nâng cấp Locket Gold tự động 24/7',
    heroSubtitle: 'Kích hoạt siêu tốc trong 0.5 giây chỉ bằng Username, bảo hành 1 đổi 1 suốt thời gian sử dụng.',
    brandNameColor: '#FFFFFF',
    heroTitleColor: '#FFFFFF',
    heroSubtitleColor: '#9CA3AF',
    accentColor: '#F59E0B'
  });
}

async function updateBrandConfig(data) {
  const current = await getBrandConfig();
  const updated = {
    logoUrl: (data.logoUrl !== undefined ? data.logoUrl : current.logoUrl || '').trim(),
    brandName: (data.brandName !== undefined ? data.brandName : current.brandName || 'Locket Gold').trim(),
    brandTag: (data.brandTag !== undefined ? data.brandTag : current.brandTag || 'PREMIUM').trim(),
    siteTitle: (data.siteTitle !== undefined ? data.siteTitle : current.siteTitle || '').trim(),
    subtitle: (data.subtitle !== undefined ? data.subtitle : current.subtitle || '').trim(),
    heroTitle: (data.heroTitle !== undefined ? data.heroTitle : current.heroTitle || 'Nâng cấp Locket Gold tự động 24/7').trim(),
    heroSubtitle: (data.heroSubtitle !== undefined ? data.heroSubtitle : current.heroSubtitle || 'Kích hoạt siêu tốc trong 0.5 giây chỉ bằng Username, bảo hành 1 đổi 1 suốt thời gian sử dụng.').trim(),
    brandNameColor: (data.brandNameColor !== undefined ? data.brandNameColor : current.brandNameColor || '#FFFFFF').trim(),
    heroTitleColor: (data.heroTitleColor !== undefined ? data.heroTitleColor : current.heroTitleColor || '#FFFFFF').trim(),
    heroSubtitleColor: (data.heroSubtitleColor !== undefined ? data.heroSubtitleColor : current.heroSubtitleColor || '#9CA3AF').trim(),
    accentColor: (data.accentColor !== undefined ? data.accentColor : current.accentColor || '#F59E0B').trim()
  };
  await setSystemConfigValue('brandConfig', updated);
  return updated;
}

async function getFaqsConfig() {
  return await getSystemConfigValue('faqsConfig', [
    {
      q: 'Tôi có cần cung cấp mật khẩu hoặc tài khoản iCloud không?',
      a: 'Hoàn toàn KHÔNG! Hệ thống chỉ cần Username Locket công khai của bạn để gửi gói Gold. Không bao giờ hỏi mật khẩu hay iCloud.'
    },
    {
      q: 'Sau khi thanh toán bao lâu thì tài khoản có Gold?',
      a: 'Hệ thống tự động phát hiện giao dịch qua SePay Webhook và nâng cấp trong vòng 0.5s đến 3s ngay sau khi tiền vào tài khoản.'
    },
    {
      q: 'Làm thế nào để kích hoạt tính năng Gold trên điện thoại sau khi mua?',
      a: 'Mở app Locket trên điện thoại ➔ Vào phần Cài Đặt (Profile) ➔ Kéo xuống chọn "Khôi phục giao dịch mua (Restore Purchases)" là xong ngay.'
    },
    {
      q: 'Chính sách bảo hành như thế nào?',
      a: 'Hệ thống cam kết bảo hành 100% lỗi 1 đổi 1. Nếu có bất kỳ vấn đề gì, Admin hỗ trợ kích hoạt lại ngay lập tức 24/7.'
    }
  ]);
}

async function updateFaqsConfig(faqs) {
  if (Array.isArray(faqs)) {
    await setSystemConfigValue('faqsConfig', faqs);
    return faqs;
  }
  return await getFaqsConfig();
}

async function getContactConfig() {
  return await getSystemConfigValue('contactConfig', {
    facebook: 'https://www.facebook.com/vnkin.06',
    telegram: 'https://t.me/vnkien26',
    zalo: '0987654321',
    hotline: '0987.654.321',
    supportText: 'Cần hỗ trợ thanh toán hoặc thắc mắc về Locket Gold? Liên hệ Admin ngay 24/7!'
  });
}

async function updateContactConfig(data) {
  const current = await getContactConfig();
  const updated = {
    facebook: (data.facebook !== undefined ? data.facebook : current.facebook || '').trim(),
    telegram: (data.telegram !== undefined ? data.telegram : current.telegram || '').trim(),
    zalo: (data.zalo !== undefined ? data.zalo : current.zalo || '').trim(),
    hotline: (data.hotline !== undefined ? data.hotline : current.hotline || '').trim(),
    supportText: (data.supportText !== undefined ? data.supportText : current.supportText || '').trim()
  };
  await setSystemConfigValue('contactConfig', updated);
  return updated;
}

async function getNoticeConfig() {
  const config = await getSystemConfigValue('noticeConfig', {
    enabled: true,
    title: '📢 Thông Báo Hệ Thống',
    content: 'Chào mừng bạn đến với hệ thống Nâng Cấp Locket Gold Tự Động 24/7!\n\n• Kích hoạt siêu tốc trong 0.5s chỉ bằng Username.\n• Bảo hành 1 đổi 1 suốt thời gian sử dụng.\n• Không cần tài khoản iCloud hay mật khẩu.',
    button1Text: 'Nhóm Thông Báo & Hỗ Trợ',
    button1Url: '',
    button2Text: '',
    button2Url: ''
  });
  if (config && config.enabled === undefined) {
    config.enabled = true;
  }
  return config;
}

async function updateNoticeConfig(data) {
  const current = await getNoticeConfig();
  const updated = {
    enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
    title: (data.title !== undefined ? data.title : current.title || '📢 Thông Báo Hệ Thống').trim(),
    content: (data.content !== undefined ? data.content : current.content || '').trim(),
    button1Text: (data.button1Text !== undefined ? data.button1Text : current.button1Text || '').trim(),
    button1Url: (data.button1Url !== undefined ? data.button1Url : current.button1Url || '').trim(),
    button2Text: (data.button2Text !== undefined ? data.button2Text : current.button2Text || '').trim(),
    button2Url: (data.button2Url !== undefined ? data.button2Url : current.button2Url || '').trim()
  };
  await setSystemConfigValue('noticeConfig', updated);
  return updated;
}

async function getMaintenanceConfig() {
  return await getSystemConfigValue('maintenance', {
    enabled: false,
    endDate: '03/08/2026',
    contactUrl: 'https://www.facebook.com/vnkin.06',
    message: 'Hệ thống đang tiến hành nâng cấp & bảo trì định kỳ. Vui lòng liên hệ Facebook để hỗ trợ!'
  });
}

async function updateMaintenanceConfig(configData) {
  const mObj = {
    enabled: configData.enabled !== false,
    endDate: configData.endDate || '03/08/2026',
    contactUrl: configData.contactUrl || 'https://www.facebook.com/vnkin.06',
    message: configData.message || 'Hệ thống đang tiến hành nâng cấp & bảo trì định kỳ. Vui lòng liên hệ Facebook để hỗ trợ!'
  };
  await setSystemConfigValue('maintenance', mObj);
  return mObj;
}


// ── PROMO CODES ────────────────────────────────────────────────────────

async function getPromoCodes() {
  return await getSystemConfigValue('promoCodes', []);
}

async function savePromoCode(promo) {
  const list = await getPromoCodes();
  const cleanCode = (promo.code || '').trim().toUpperCase();
  if (!cleanCode) throw new Error("Mã giảm giá không hợp lệ");
  
  const existingIdx = list.findIndex(p => p.code.toUpperCase() === cleanCode);
  const promoObj = {
    code: cleanCode,
    discountType: promo.discountType || 'percent',
    discountValue: Number(promo.discountValue) || 0,
    maxUses: Number(promo.maxUses) || 999,
    usedCount: existingIdx >= 0 ? (list[existingIdx].usedCount || 0) : 0,
    active: promo.active !== false,
    createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : new Date().toISOString()
  };

  if (existingIdx >= 0) {
    list[existingIdx] = promoObj;
  } else {
    list.push(promoObj);
  }
  await setSystemConfigValue('promoCodes', list);
  return promoObj;
}

async function deletePromoCode(code) {
  let list = await getPromoCodes();
  const cleanCode = (code || '').trim().toUpperCase();
  list = list.filter(p => p.code.toUpperCase() !== cleanCode);
  await setSystemConfigValue('promoCodes', list);
  return true;
}

async function validatePromoCode(code, packageId) {
  if (!code) return { valid: false, error: "Vui lòng nhập mã giảm giá" };
  const cleanCode = code.trim().toUpperCase();
  const list = await getPromoCodes();
  const promo = list.find(p => p.code.toUpperCase() === cleanCode && p.active);
  if (!promo) return { valid: false, error: "Mã giảm giá không tồn tại hoặc đã bị tắt" };

  if (promo.usedCount >= promo.maxUses) {
    return { valid: false, error: "Mã giảm giá đã hết lượt sử dụng" };
  }

  const prices = await getPrices();
  const basePrice = packageId === 'lifetime' ? prices['lifetime'] : prices['1year'];
  let discountAmount = 0;

  if (promo.discountType === 'percent') {
    discountAmount = Math.round((basePrice * promo.discountValue) / 100);
  } else {
    discountAmount = promo.discountValue;
  }

  const finalAmount = Math.max(0, basePrice - discountAmount);

  return {
    valid: true,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    discountAmount,
    basePrice,
    finalAmount,
    message: `Áp dụng mã ${promo.code} thành công! Giảm ${discountAmount.toLocaleString('vi-VN')}đ`
  };
}


// ── RETAIL ORDERS MANAGEMENT ───────────────────────────────────────────

async function createOrder({ username, uid, packageId, promoCode, telegramChatId }) {
  const maintenance = await getMaintenanceConfig();
  if (maintenance && maintenance.enabled) {
    throw new Error(maintenance.message || `Hệ thống đang bảo trì. Vui lòng liên hệ Facebook: ${maintenance.contactUrl}`);
  }

  const cleanUsername = (username || '').trim().toLowerCase();
  let cleanUid = (uid || '').trim();
  if (!cleanUid) {
    cleanUid = `TG_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  if (await isUserBanned(cleanUsername) || await isUserBanned(cleanUid)) {
    throw new Error('Tài khoản của bạn đã bị KHÓA (Banned) do vi phạm quy định!');
  }

  const prices = await getPrices();
  let amount = packageId === 'lifetime' ? prices['lifetime'] : prices['1year'];

  if (promoCode) {
    const pResult = await validatePromoCode(promoCode, packageId);
    if (pResult.valid) {
      amount = pResult.finalAmount;
    }
  }

  const bankBrand = (process.env.SEPAY_BANK_BRAND || 'ACB').toUpperCase();
  const accountNo = (process.env.SEPAY_ACCOUNT_NO || '21456181').trim();
  const accountName = (process.env.SEPAY_ACCOUNT_NAME || 'NGUYEN VAN KIEN').trim();

  // Tạo mã memo nội dung chuyển khoản ngẫu nhiên (VD: LK82631)
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const transferMemo = (cleanUsername ? `LK${randomSuffix}` : `LK${randomSuffix}`).toUpperCase();

  const vietQrUrl = `https://img.vietqr.io/image/${bankBrand}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferMemo)}&accountName=${encodeURIComponent(accountName)}`;
  const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

  const orderObj = {
    orderId,
    username: cleanUsername,
    uid: cleanUid,
    packageId,
    amount,
    memo: transferMemo,
    status: 'PENDING',
    vietQrUrl,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    telegramChatId: telegramChatId || ''
  };

  // 1. Save to MongoDB
  if (await connectDb()) {
    try {
      await Order.create({
        orderId,
        username: cleanUsername,
        uid: cleanUid,
        packageId,
        amount,
        memo: transferMemo,
        status: 'PENDING',
        vietQrUrl,
        createdAt: now,
        expiresAt
      });
    } catch(e) {}
  }

  // 2. Sync to Fallback
  const db = readFallback();
  db.orders.unshift(orderObj);
  writeFallback(db);

  return orderObj;
}

async function completeOrder(identifier, transactionData = {}) {
  const raw = String(identifier || '').trim();
  const clean = raw.toLowerCase();
  const now = new Date();

  // 1. Update MongoDB
  if (await connectDb()) {
    try {
      await Order.findOneAndUpdate(
        {
          $or: [
            { orderId: raw },
            { orderId: clean },
            { uid: raw },
            { uid: clean },
            { username: clean },
            { memo: raw.toUpperCase() }
          ]
        },
        { status: 'COMPLETED', completedAt: now, transaction: transactionData }
      );
    } catch(e) {}
  }

  // 2. Update Fallback
  const db = readFallback();
  const order = db.orders.find(o => 
    o.orderId === raw ||
    o.orderId === clean ||
    (o.uid && o.uid.toLowerCase() === clean) ||
    (o.username && o.username.toLowerCase() === clean) ||
    (o.memo && o.memo.toUpperCase() === raw.toUpperCase())
  );

  if (order) {
    order.status = 'COMPLETED';
    order.completedAt = now.toISOString();
    order.transaction = transactionData;
    writeFallback(db);

    if (transactionData && transactionData.id) {
      await saveUsedTransaction(transactionData.id);
    }
    return order;
  }
  return null;
}

async function cancelExpiredOrders() {
  const now = new Date();
  const nowMs = now.getTime();
  const fifteenMinsAgoMs = nowMs - 15 * 60 * 1000;
  const cancelledList = [];

  if (await connectDb()) {
    try {
      await Order.updateMany(
        { status: 'PENDING', expiresAt: { $lte: now } },
        { status: 'EXPIRED' }
      );
    } catch(e) {}
  }

  const db = readFallback();
  let updatedFallback = false;
  for (const order of db.orders) {
    if (order.status === 'PENDING') {
      const createdMs = order.createdAt ? new Date(order.createdAt).getTime() : 0;
      const expireTime = order.expiresAt ? new Date(order.expiresAt).getTime() : (createdMs > 0 ? createdMs + 15 * 60 * 1000 : 0);
      if (!expireTime || nowMs >= expireTime || (createdMs > 0 && createdMs <= fifteenMinsAgoMs)) {
        order.status = 'EXPIRED';
        order.cancelledAt = now.toISOString();
        if (!cancelledList.some(o => o.uid === order.uid)) {
          cancelledList.push(order);
        }
        updatedFallback = true;
      }
    }
  }

  if (updatedFallback) writeFallback(db);
  return cancelledList;
}

async function deleteExpiredOrders() {
  const now = new Date();
  let deletedCount = 0;

  if (await connectDb()) {
    try {
      const res1 = await Order.deleteMany({ status: 'EXPIRED' });
      const res2 = await Order.deleteMany({ status: 'PENDING', expiresAt: { $lte: now } });
      deletedCount += (res1.deletedCount || 0) + (res2.deletedCount || 0);
    } catch(e) {}
  }

  const db = readFallback();
  const initialCount = db.orders.length;
  db.orders = db.orders.filter(o => o.status !== 'EXPIRED' && o.status !== 'PENDING');
  const removedFallback = initialCount - db.orders.length;
  if (removedFallback > 0) writeFallback(db);

  return Math.max(deletedCount, removedFallback);
}

async function deletePendingOrderByUid(uidOrUsername, optionalUsername) {
  if (!uidOrUsername && !optionalUsername) return false;
  const cleanUid = (uidOrUsername || '').trim();
  const cleanUser = (optionalUsername || '').trim().toLowerCase();

  if (await connectDb()) {
    try {
      const queryOr = [];
      if (cleanUid) queryOr.push({ uid: cleanUid }, { uid: cleanUid.toLowerCase() }, { username: cleanUid.toLowerCase() });
      if (cleanUser) queryOr.push({ username: cleanUser }, { uid: cleanUser });

      await Order.deleteMany({ $or: queryOr, status: 'PENDING' });
    } catch(e) {}
  }

  const db = readFallback();
  const initialCount = db.orders.length;
  db.orders = db.orders.filter(o => {
    if (o.status !== 'PENDING') return true;
    const isUidMatch = cleanUid && (o.uid.toLowerCase() === cleanUid.toLowerCase() || o.username.toLowerCase() === cleanUid.toLowerCase());
    const isUserMatch = cleanUser && (o.username.toLowerCase() === cleanUser || o.uid.toLowerCase() === cleanUser);
    return !(isUidMatch || isUserMatch);
  });

  if (db.orders.length !== initialCount) writeFallback(db);
  return true;
}

async function deletePublicOrder(orderIdOrUid) {
  if (!orderIdOrUid) return false;
  const clean = String(orderIdOrUid).trim();
  if (await connectDb()) {
    try {
      await Order.deleteMany({ $or: [{ orderId: clean }, { uid: clean }] });
    } catch(e) {}
  }
  const db = readFallback();
  const len = db.orders.length;
  db.orders = db.orders.filter(o => o.orderId !== clean && o.uid !== clean);
  if (db.orders.length !== len) writeFallback(db);
  return true;
}

async function clearPublicOrders() {
  if (await connectDb()) {
    try {
      await Order.deleteMany({});
    } catch(e) {}
  }
  const db = readFallback();
  db.orders = [];
  writeFallback(db);
  return true;
}

async function getAllPublicOrders() {
  await cancelExpiredOrders();
  if (await connectDb()) {
    try {
      const docs = await Order.find({}).sort({ createdAt: -1 }).lean();
      if (docs && docs.length > 0) {
        return docs.map(d => ({
          orderId: d.orderId || (d._id ? d._id.toString() : ''),
          username: d.username || '',
          uid: d.uid || '',
          packageId: d.packageId || '1year',
          amount: Number(d.amount || 0),
          memo: d.memo || '',
          status: d.status || 'PENDING',
          vietQrUrl: d.vietQrUrl || '',
          createdAt: d.createdAt ? (typeof d.createdAt === 'string' ? d.createdAt : d.createdAt.toISOString()) : '',
          completedAt: d.completedAt ? (typeof d.completedAt === 'string' ? d.completedAt : d.completedAt.toISOString()) : null,
          expiresAt: d.expiresAt ? (typeof d.expiresAt === 'string' ? d.expiresAt : d.expiresAt.toISOString()) : '',
          telegramChatId: d.telegramChatId || ''
        }));
      }
    } catch(e) {}
  }
  const db = readFallback();
  return db.orders || [];
}

async function updateOrderStatus(uid, status, transactionData = {}) {
  if (status === 'COMPLETED') {
    return await completeOrder(uid, transactionData);
  }
  return null;
}

async function getOrderByUid(uidOrOrderIdOrUser) {
  if (!uidOrOrderIdOrUser) return null;
  const raw = String(uidOrOrderIdOrUser).trim();
  const clean = raw.toLowerCase();
  if (await connectDb()) {
    try {
      const order = await Order.findOne({
        $or: [
          { orderId: raw },
          { orderId: clean },
          { uid: raw },
          { uid: clean },
          { username: clean },
          { memo: raw.toUpperCase() }
        ]
      }).sort({ createdAt: -1 }).lean();
      if (order) return order;
    } catch(e) {}
  }
  const db = readFallback();
  return db.orders.find(o => 
    o.orderId === raw ||
    o.orderId === clean ||
    (o.uid && o.uid.toLowerCase() === clean) ||
    (o.username && o.username.toLowerCase() === clean) ||
    (o.memo && o.memo.toUpperCase() === raw.toUpperCase())
  ) || null;
}

async function getActiveTrialOrder(usernameOrUid) {
  if (!usernameOrUid) return null;
  const clean = usernameOrUid.trim().toLowerCase();
  const now = new Date().getTime();

  let order = null;
  if (await connectDb()) {
    try {
      order = await Order.findOne({
        $or: [{ username: clean }, { uid: clean }],
        status: 'PENDING'
      }).lean();
    } catch(e) {}
  }

  if (!order) {
    const db = readFallback();
    order = db.orders.find(o => (o.username.toLowerCase() === clean || o.uid.toLowerCase() === clean) && o.status === 'PENDING');
  }

  if (!order) return null;

  const expireTime = order.expiresAt ? new Date(order.expiresAt).getTime() : (new Date(order.createdAt).getTime() + 15 * 60 * 1000);
  if (now < expireTime) {
    return {
      ...order,
      remainingSeconds: Math.max(0, Math.floor((expireTime - now) / 1000))
    };
  }
  return null;
}

async function getPendingOrders() {
  await cancelExpiredOrders();
  if (await connectDb()) {
    try {
      const docs = await Order.find({ status: 'PENDING' }).sort({ createdAt: -1 }).lean();
      if (docs.length > 0) return docs;
    } catch(e) {}
  }
  const db = readFallback();
  return db.orders.filter(o => o.status === 'PENDING');
}


// ── TRANSACTION DEDUPLICATION (ACB) ───────────────────────────────────

async function isTransactionUsed(txId) {
  if (!txId) return false;
  const idStr = String(txId);
  const usedList = await getSystemConfigValue('usedTransactions', []);
  if (usedList.includes(idStr)) return true;

  if (await connectDb()) {
    try {
      const existing = await Order.findOne({ 'transaction.id': idStr, status: 'COMPLETED' });
      if (existing) return true;
      const ctvOrder = await CtvOrder.findOne({ orderId: idStr });
      if (ctvOrder) return true;
    } catch(e) {}
  }

  const db = readFallback();
  if (db.ctvOrders && db.ctvOrders.some(o => String(o.txId || o.transactionId) === idStr)) return true;
  return db.orders.some(o => o.status === 'COMPLETED' && o.transaction && String(o.transaction.id) === idStr);
}

async function saveUsedTransaction(txId) {
  if (!txId) return;
  const idStr = String(txId);
  const usedList = await getSystemConfigValue('usedTransactions', []);
  if (!usedList.includes(idStr)) {
    usedList.push(idStr);
    await setSystemConfigValue('usedTransactions', usedList);
  }
}

// ── SEPAY WEBHOOK LOGS REPOSITORY ──────────────────────────────────────
async function saveSepayLog(logData = {}) {
  const logItem = {
    txId: String(logData.txId || logData.id || `TX_${Date.now()}`),
    gateway: logData.gateway || logData.bankBrand || 'ACB',
    accountNumber: logData.accountNumber || '',
    amount: Number(logData.amount || logData.transferAmount || 0),
    content: logData.content || logData.message || '',
    matchType: logData.matchType || 'UNMATCHED',
    matchedTarget: logData.matchedTarget || '',
    status: logData.status || 'SUCCESS',
    detail: logData.detail || '',
    rawPayload: logData.rawPayload || {},
    createdAt: logData.createdAt ? new Date(logData.createdAt) : new Date()
  };

  if (await connectDb()) {
    try {
      await SepayLog.create(logItem);
    } catch(e) {}
  }

  const db = readFallback();
  if (!db.sepayLogs) db.sepayLogs = [];
  db.sepayLogs.unshift(logItem);
  if (db.sepayLogs.length > 200) db.sepayLogs = db.sepayLogs.slice(0, 200);
  writeFallback(db);

  return logItem;
}

async function getSepayLogs(limit = 50) {
  if (await connectDb()) {
    try {
      const docs = await SepayLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
      if (docs && docs.length > 0) return docs;
    } catch(e) {}
  }
  const db = readFallback();
  return (db.sepayLogs || []).slice(0, limit);
}

async function clearSepayLogs() {
  if (await connectDb()) {
    try {
      await SepayLog.deleteMany({});
    } catch(e) {}
  }
  const db = readFallback();
  db.sepayLogs = [];
  writeFallback(db);
  return true;
}


// ── CTV (CỘNG TÁC VIÊN) DATABASE FUNCTIONS (MONGODB PRIMARY) ───────────

async function getCtvAccounts() {
  if (await connectDb()) {
    try {
      const docs = await CtvAccount.find({}).sort({ createdAt: -1 }).lean();
      if (docs && docs.length > 0) {
        return docs.map(acc => ({
          username: acc.username,
          password: acc.password !== undefined && acc.password !== null ? String(acc.password) : '',
          displayName: acc.displayName || acc.username,
          prices: acc.prices || { '1year': 65000, 'lifetime': 350000 },
          balance: Number(acc.balance) || 0,
          remainingRequests: Number(acc.remainingRequests) || 0,
          apiKey: acc.apiKey,
          depositCode: acc.depositCode || null,
          telegramChatId: acc.telegramChatId || '',
          avatar: acc.avatar || '/assets/vip1.gif',
          active: acc.active !== false,
          createdAt: acc.createdAt ? new Date(acc.createdAt).toISOString() : new Date().toISOString()
        }));
      }
    } catch (e) {}
  }

  const db = readFallback();
  return (db.ctvAccounts || []).map(acc => ({
    username: acc.username,
    password: acc.password !== undefined && acc.password !== null ? String(acc.password) : '',
    displayName: acc.displayName || acc.username,
    prices: acc.prices || { '1year': 65000, 'lifetime': 350000 },
    balance: Number(acc.balance) || 0,
    remainingRequests: Number(acc.remainingRequests) || 0,
    apiKey: acc.apiKey || acc.tokenKey,
    depositCode: acc.depositCode || null,
    telegramChatId: acc.telegramChatId || '',
    avatar: acc.avatar || '/assets/vip1.gif',
    active: acc.active !== false,
    createdAt: acc.createdAt || new Date().toISOString()
  }));
}

async function getCtvByUsername(username) {
  if (!username) return null;
  const clean = username.trim().toLowerCase();
  
  if (await connectDb()) {
    try {
      let acc = await CtvAccount.findOne({ username: clean });
      if (acc) {
        if (!acc.depositCode) {
          let newCode = generateDepositCode();
          while (await CtvAccount.findOne({ depositCode: newCode })) {
            newCode = generateDepositCode();
          }
          acc.depositCode = newCode;
          await acc.save();
        }
        const safeAcc = acc.toObject ? acc.toObject() : acc;
        return {
          ...safeAcc,
          password: safeAcc.password !== undefined ? String(safeAcc.password) : '',
          remainingRequests: Number(safeAcc.remainingRequests) || 0,
          telegramChatId: safeAcc.telegramChatId || '',
          depositCode: safeAcc.depositCode
        };
      }
    } catch (e) {}
  }

  const db = readFallback();
  let acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === clean);
  if (!acc) return null;
  if (!acc.depositCode) {
    let newCode = generateDepositCode();
    while ((db.ctvAccounts || []).some(a => a.depositCode === newCode)) {
      newCode = generateDepositCode();
    }
    acc.depositCode = newCode;
    writeFallback(db);
  }
  return {
    ...acc,
    password: acc.password !== undefined ? String(acc.password) : '',
    remainingRequests: Number(acc.remainingRequests) || 0,
    telegramChatId: acc.telegramChatId || '',
    depositCode: acc.depositCode
  };
}

// Tra cứu CTV theo depositCode (mã nạp tiền cố định)
async function getCtvByDepositCode(code) {
  if (!code) return null;
  const cleanCode = code.trim().toUpperCase();
  const normalized = cleanCode.replace(/[^A-Z0-9]/g, '');

  if (await connectDb()) {
    try {
      let acc = await CtvAccount.findOne({ depositCode: cleanCode, active: { $ne: false } }).lean();
      if (acc) return acc;
      if (normalized.length >= 6) {
        const all = await CtvAccount.find({ active: { $ne: false } }).lean();
        acc = all.find(a => (a.depositCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === normalized);
        if (acc) return acc;
      }
    } catch(e) {}
  }

  const db = readFallback();
  return (db.ctvAccounts || []).find(a => {
    if (a.active === false) return false;
    const c = (a.depositCode || '').toUpperCase();
    return c === cleanCode || (normalized.length >= 6 && c.replace(/[^A-Z0-9]/g, '') === normalized);
  }) || null;
}

async function getCtvByApiKey(key) {
  if (!key) return null;
  const clean = key.trim();

  if (await connectDb()) {
    try {
      const acc = await CtvAccount.findOne({ apiKey: clean, active: { $ne: false } }).lean();
      if (acc) return acc;
    } catch(e) {}
  }

  const db = readFallback();
  const acc = (db.ctvAccounts || []).find(a => a.active !== false && (a.apiKey === clean || a.tokenKey === clean));
  return acc || null;
}

async function saveCtvAccount({ username, password, displayName, prices, balance = 0, apiKey = null, telegramChatId = null, depositCode = null }) {
  const cleanUser = (username || '').trim().toLowerCase();
  if (!cleanUser) throw new Error('Username CTV không được để trống');
  
  const existing = await getCtvByUsername(cleanUser);
  const finalApiKey = apiKey ? apiKey.trim() : (existing?.apiKey || `ctv_key_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  const finalTelegramChatId = telegramChatId !== null ? String(telegramChatId).trim() : (existing?.telegramChatId || '');
  // Giữ nguyên depositCode cũ nếu đã có, chỉ tạo mới nếu chưa có
  const finalDepositCode = depositCode ? depositCode.trim().toUpperCase() : (existing?.depositCode || generateDepositCode());

  const ctvObj = {
    username: cleanUser,
    password: password ? String(password).trim() : (existing ? String(existing.password) : '123456'),
    displayName: displayName ? String(displayName).trim() : (existing ? existing.displayName : cleanUser),
    prices: {
      '1year': Number(prices?.['1year']) || (existing ? existing.prices['1year'] : 65000),
      'lifetime': Number(prices?.['lifetime']) || (existing ? existing.prices['lifetime'] : 350000)
    },
    balance: balance !== undefined ? Number(balance) : (existing ? Number(existing.balance || 0) : 0),
    apiKey: finalApiKey,
    depositCode: finalDepositCode,
    telegramChatId: finalTelegramChatId,
    active: true,
    createdAt: existing ? existing.createdAt : new Date().toISOString()
  };

  // 1. Save to MongoDB
  if (await connectDb()) {
    try {
      await CtvAccount.updateOne(
        { username: cleanUser },
        { $set: ctvObj },
        { upsert: true }
      );
    } catch(e) {}
  }

  // 2. Sync to Fallback JSON
  const db = readFallback();
  if (!db.ctvAccounts) db.ctvAccounts = [];
  const idx = db.ctvAccounts.findIndex(a => a.username.toLowerCase() === cleanUser);
  if (idx >= 0) db.ctvAccounts[idx] = ctvObj;
  else db.ctvAccounts.push(ctvObj);
  writeFallback(db);

  return ctvObj;
}

async function updateCtvPrices(username, newPrices) {
  const cleanUser = (username || '').trim().toLowerCase();
  const p1y = Number(newPrices['1year']) || 65000;
  const plt = Number(newPrices['lifetime']) || 350000;

  if (await connectDb()) {
    try {
      await CtvAccount.updateOne(
        { username: cleanUser },
        { $set: { 'prices.1year': p1y, 'prices.lifetime': plt } }
      );
    } catch(e) {}
  }

  const db = readFallback();
  const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
  if (acc) {
    acc.prices = { '1year': p1y, 'lifetime': plt };
    writeFallback(db);
    return acc;
  }
  return null;
}

async function updateCtvTelegramChatId(username, chatId) {
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanChatId = (chatId || '').trim();

  if (await connectDb()) {
    try {
      await CtvAccount.updateOne(
        { username: cleanUser },
        { $set: { telegramChatId: cleanChatId } }
      );
    } catch(e) {}
  }

  const db = readFallback();
  const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
  if (acc) {
    acc.telegramChatId = cleanChatId;
    writeFallback(db);
    return acc;
  }
  return null;
}

async function updateCtvAvatar(username, avatarUrl) {
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanAvatar = (avatarUrl || '').trim();

  if (await connectDb()) {
    try {
      await CtvAccount.updateOne(
        { username: cleanUser },
        { $set: { avatar: cleanAvatar } }
      );
    } catch(e) {}
  }

  const db = readFallback();
  const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
  if (acc) {
    acc.avatar = cleanAvatar;
    writeFallback(db);
    return acc;
  }
  return null;
}

async function updateCtvApiKey(username) {
  const cleanUser = (username || '').trim().toLowerCase();
  const newApiKey = `ctv_key_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  let updated = false;
  if (await connectDb()) {
    try {
      const res = await CtvAccount.updateOne(
        { username: cleanUser },
        { $set: { apiKey: newApiKey } }
      );
      if (res.matchedCount > 0) updated = true;
    } catch(e) {}
  }

  const db = readFallback();
  const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
  if (acc) {
    acc.apiKey = newApiKey;
    writeFallback(db);
    updated = true;
  }

  return updated ? newApiKey : false;
}

async function setCustomCtvApiKey(username, customApiKey) {
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanKey = (customApiKey || '').trim();
  if (!cleanKey || cleanKey.length < 3) {
    throw new Error('API Key phải có ít nhất 3 ký tự');
  }

  if (await connectDb()) {
    try {
      const existing = await CtvAccount.findOne({ apiKey: cleanKey, username: { $ne: cleanUser } });
      if (existing) {
        throw new Error('API Key này đã được sử dụng bởi tài khoản khác');
      }
      const res = await CtvAccount.updateOne(
        { username: cleanUser },
        { $set: { apiKey: cleanKey } }
      );
      if (res.matchedCount === 0) return false;
    } catch(e) {
      if (e.message && e.message.includes('API Key')) throw e;
    }
  }

  const db = readFallback();
  const duplicate = (db.ctvAccounts || []).find(a => a.apiKey === cleanKey && a.username.toLowerCase() !== cleanUser);
  if (duplicate) {
    throw new Error('API Key này đã được sử dụng bởi tài khoản khác');
  }
  const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
  if (acc) {
    acc.apiKey = cleanKey;
    writeFallback(db);
    return cleanKey;
  }

  return cleanKey;
}

async function getCtvByTelegramChatId(chatId) {
  if (!chatId) return null;
  const cleanId = String(chatId).trim();

  if (await connectDb()) {
    try {
      const acc = await CtvAccount.findOne({ telegramChatId: cleanId, active: { $ne: false } }).lean();
      if (acc) return acc;
    } catch(e) {}
  }

  const db = readFallback();
  return (db.ctvAccounts || []).find(a => a.active !== false && String(a.telegramChatId).trim() === cleanId) || null;
}

async function addCtvBalance(username, amount) {
  const cleanUser = (username || '').trim().toLowerCase();
  const addAmt = Number(amount) || 0;

  let newBal = 0;
  if (await connectDb()) {
    try {
      const doc = await CtvAccount.findOneAndUpdate(
        { username: cleanUser },
        { $inc: { balance: addAmt } },
        { returnDocument: 'after' }
      );
      if (doc) newBal = doc.balance;
    } catch(e) {}
  }

  const db = readFallback();
  const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
  if (acc) {
    acc.balance = (Number(acc.balance) || 0) + addAmt;
    newBal = acc.balance;
    writeFallback(db);
  }
  return newBal;
}

// Atomic Balance Deduction with Race-Condition Protection ($gte check)
async function deductCtvBalanceAtomic(username, amount) {
  const cleanUser = (username || '').trim().toLowerCase();
  const deductAmt = Math.abs(Number(amount) || 0);

  if (await connectDb()) {
    try {
      const doc = await CtvAccount.findOneAndUpdate(
        { username: cleanUser, balance: { $gte: deductAmt } },
        { $inc: { balance: -deductAmt } },
        { returnDocument: 'after' }
      );
      if (doc) {
        const db = readFallback();
        const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
        if (acc) {
          acc.balance = doc.balance;
          writeFallback(db);
        }
        return { success: true, newBalance: doc.balance };
      }
    } catch(e) {}
  }

  // Fallback JSON mode with balance check
  const db = readFallback();
  const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
  if (acc) {
    const curBal = Number(acc.balance) || 0;
    if (curBal < deductAmt) {
      return { success: false, currentBalance: curBal, required: deductAmt, error: 'Số dư CTV không đủ!' };
    }
    acc.balance = curBal - deductAmt;
    writeFallback(db);
    return { success: true, newBalance: acc.balance };
  }

  return { success: false, error: 'Tài khoản CTV không tồn tại' };
}

async function addCtvPackageRequests(username, count) {
  const cleanUser = (username || '').trim().toLowerCase();
  const addCount = Math.max(0, Number(count) || 0);

  let newRemaining = 0;
  if (await connectDb()) {
    try {
      const doc = await CtvAccount.findOneAndUpdate(
        { username: cleanUser },
        { $inc: { remainingRequests: addCount } },
        { returnDocument: 'after' }
      );
      if (doc) newRemaining = Number(doc.remainingRequests) || 0;
    } catch(e) {}
  }

  const db = readFallback();
  const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
  if (acc) {
    acc.remainingRequests = (Number(acc.remainingRequests) || 0) + addCount;
    newRemaining = acc.remainingRequests;
    writeFallback(db);
  }
  return newRemaining;
}

async function deductCtvPackageRequestAtomic(username) {
  const cleanUser = (username || '').trim().toLowerCase();

  if (await connectDb()) {
    try {
      const doc = await CtvAccount.findOneAndUpdate(
        { username: cleanUser, remainingRequests: { $gte: 1 } },
        { $inc: { remainingRequests: -1 } },
        { returnDocument: 'after' }
      );
      if (doc) {
        const db = readFallback();
        const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
        if (acc) {
          acc.remainingRequests = Number(doc.remainingRequests) || 0;
          writeFallback(db);
        }
        return { success: true, remainingRequests: Number(doc.remainingRequests) || 0 };
      }
    } catch(e) {}
  }

  const db = readFallback();
  const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
  if (acc && (Number(acc.remainingRequests) || 0) >= 1) {
    acc.remainingRequests = (Number(acc.remainingRequests) || 0) - 1;
    writeFallback(db);
    return { success: true, remainingRequests: acc.remainingRequests };
  }
  return { success: false, error: 'Tài khoản CTV không còn lượt gói Locket Gold.' };
}

async function deleteCtvAccount(username) {
  const cleanUser = (username || '').trim().toLowerCase();

  if (await connectDb()) {
    try {
      await CtvAccount.deleteOne({ username: cleanUser });
    } catch(e) {}
  }

  const db = readFallback();
  if (db.ctvAccounts) {
    db.ctvAccounts = db.ctvAccounts.filter(a => a.username.toLowerCase() !== cleanUser);
    writeFallback(db);
  }
  return true;
}

async function updateCtvPassword(username, newPassword) {
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = String(newPassword || '').trim();
  if (cleanPass.length < 4) throw new Error('Mật khẩu mới phải từ 4 ký tự trở lên');

  const hashedPass = cleanPass.startsWith('scrypt:') ? cleanPass : hashPassword(cleanPass);

  if (await connectDb()) {
    try {
      await CtvAccount.updateOne(
        { username: cleanUser },
        { $set: { password: hashedPass } }
      );
    } catch(e) {}
  }

  const db = readFallback();
  const acc = (db.ctvAccounts || []).find(a => a.username.toLowerCase() === cleanUser);
  if (acc) {
    acc.password = hashedPass;
    writeFallback(db);
    return true;
  }
  return false;
}

async function verifyCtvLogin(username, password) {
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();
  const ctv = await getCtvByUsername(cleanUser);
  if (!ctv || ctv.active === false) return null;

  if (verifyPassword(cleanPass, ctv.password)) {
    // Auto-upgrade legacy plaintext password to hashed format
    if (ctv.password && !ctv.password.startsWith('scrypt:')) {
      updateCtvPassword(cleanUser, cleanPass).catch(() => {});
    }
    const { password: _p, ...safe } = ctv;
    return safe;
  }
  return null;
}

async function saveCtvOrder({ ctvUsername, userUpgraded, packageId, amount }) {
  const orderObj = {
    orderId: `CTV_ORD_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    ctvUsername: ctvUsername.trim().toLowerCase(),
    userUpgraded: userUpgraded.trim().toLowerCase(),
    packageId,
    amount: Number(amount) || 0,
    status: 'COMPLETED',
    createdAt: new Date().toISOString()
  };

  if (await connectDb()) {
    try {
      await CtvOrder.create(orderObj);
    } catch(e) {}
  }

  const db = readFallback();
  if (!db.ctvOrders) db.ctvOrders = [];
  db.ctvOrders.unshift(orderObj);
  writeFallback(db);
  return orderObj;
}

async function getCtvOrders(ctvUsername = null) {
  if (await connectDb()) {
    try {
      const query = ctvUsername ? { ctvUsername: ctvUsername.trim().toLowerCase() } : {};
      const docs = await CtvOrder.find(query).sort({ createdAt: -1 }).lean();
      if (docs && docs.length > 0) return docs;
    } catch(e) {}
  }

  const db = readFallback();
  const orders = db.ctvOrders || [];
  if (!ctvUsername) return orders;
  const cleanUser = ctvUsername.trim().toLowerCase();
  return orders.filter(o => o.ctvUsername.toLowerCase() === cleanUser);
}

async function deleteCtvOrder(ctvUsername, orderId) {
  if (!orderId) return false;
  const cleanOrderId = String(orderId).trim();
  const cleanUser = ctvUsername ? String(ctvUsername).trim().toLowerCase() : null;

  if (await connectDb()) {
    try {
      const filter = cleanUser ? { orderId: cleanOrderId, ctvUsername: cleanUser } : { orderId: cleanOrderId };
      await CtvOrder.deleteOne(filter);
    } catch(e) {}
  }

  const db = readFallback();
  if (db.ctvOrders && Array.isArray(db.ctvOrders)) {
    db.ctvOrders = db.ctvOrders.filter(
      o => !(String(o.orderId) === cleanOrderId && (!cleanUser || o.ctvUsername.toLowerCase() === cleanUser))
    );
    writeFallback(db);
  }
  return true;
}

async function clearCtvOrders(ctvUsername = null) {
  const cleanUser = ctvUsername ? String(ctvUsername).trim().toLowerCase() : null;

  if (await connectDb()) {
    try {
      const filter = (cleanUser && cleanUser !== 'all') ? { ctvUsername: cleanUser } : {};
      await CtvOrder.deleteMany(filter);
    } catch(e) {}
  }

  const db = readFallback();
  if (db.ctvOrders && Array.isArray(db.ctvOrders)) {
    if (cleanUser && cleanUser !== 'all') {
      db.ctvOrders = db.ctvOrders.filter(o => o.ctvUsername.toLowerCase() !== cleanUser);
    } else {
      db.ctvOrders = [];
    }
    writeFallback(db);
  }
  return true;
}

function getTelegramBotToken() {
  const db = readFallback();
  return (db.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

async function updateTelegramBotToken(token) {
  const cleanToken = (token || '').trim();
  await setSystemConfigValue('telegramBotToken', cleanToken);
  return cleanToken;
}

// Save avatar into Order & ChildUser MongoDB Models
async function saveAvatarToOrder(uid, avatarUrl) {
  if (!uid || !avatarUrl) return;
  const cleanUid = uid.trim();

  if (await connectDb()) {
    try {
      await Order.updateMany(
        { $or: [{ uid: cleanUid }, { username: cleanUid.toLowerCase() }] },
        { $set: { profile_picture_url: avatarUrl } }
      );
      await ChildUser.updateOne(
        { $or: [{ uid: cleanUid }, { username: cleanUid.toLowerCase() }] },
        { $set: { profile_picture_url: avatarUrl } },
        { upsert: true }
      );
    } catch(e) {}
  }

  const db = readFallback();
  let updated = false;
  for (const o of db.orders) {
    if (o.uid === cleanUid || o.username.toLowerCase() === cleanUid.toLowerCase()) {
      o.profile_picture_url = avatarUrl;
      updated = true;
    }
  }
  if (updated) writeFallback(db);
}

async function getLocketAvatarFromDb(uidOrUsername) {
  if (!uidOrUsername) return null;
  const clean = uidOrUsername.trim().toLowerCase();

  if (await connectDb()) {
    try {
      const order = await Order.findOne({
        $or: [{ uid: clean }, { username: clean }],
        profile_picture_url: { $ne: null }
      }).sort({ completedAt: -1, createdAt: -1 }).lean();

      if (order && order.profile_picture_url) return order.profile_picture_url;

      const child = await ChildUser.findOne({
        $or: [{ uid: clean }, { username: clean }],
        profile_picture_url: { $ne: null }
      }).lean();

      if (child && child.profile_picture_url) return child.profile_picture_url;
    } catch(e) {}
  }

  const db = readFallback();
  const order = db.orders.find(o => 
    (o.uid.toLowerCase() === clean || o.username.toLowerCase() === clean) && 
    o.profile_picture_url
  );
  return order ? order.profile_picture_url : null;
}

module.exports = {
  connectDb,
  createOrder,
  getOrderByUid,
  getActiveTrialOrder,
  getPendingOrders,
  completeOrder,
  cancelExpiredOrders,
  deleteExpiredOrders,
  deletePendingOrderByUid,
  updateOrderStatus,
  isTransactionUsed,
  saveUsedTransaction,
  getBannedUsers,
  isUserBanned,
  banUser,
  unbanUser,
  incrementUserViolation,
  getUserViolationCount,
  readFallback,
  verifyAdminLogin,
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
  getAdminCredentials,
  updateAdminCredentials,
  getMaintenanceConfig,
  updateMaintenanceConfig,
  getPromoCodes,
  savePromoCode,
  deletePromoCode,
  validatePromoCode,
  saveAvatarToOrder,
  getLocketAvatarFromDb,
  // CTV MongoDB Exports
  getCtvAccounts,
  getCtvByUsername,
  getCtvByApiKey,
  getCtvByDepositCode,
  saveCtvAccount,
  updateCtvPrices,
  updateCtvTelegramChatId,
  updateCtvAvatar,
  updateCtvApiKey,
  setCustomCtvApiKey,
  getCtvByTelegramChatId,
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
  updateTelegramBotToken,
  getNoticeConfig,
  updateNoticeConfig,
  hashPassword,
  verifyPassword
};
