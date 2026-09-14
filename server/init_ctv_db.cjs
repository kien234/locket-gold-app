const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const {
  hashPassword,
  saveCtvAccount,
  getCtvByUsername,
  updatePrices,
  readFallback,
  writeFallback
} = require('./db.cjs');

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

async function seedDatabase() {
  console.log('🚀 Đang khởi tạo Database Locket CTV mới...');
  console.log(`📌 URI Database: ${MONGODB_URI}`);

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Đã kết nối thành công tới MongoDB locket_ctv!');
  } catch (err) {
    console.log('⚠️ Không thể kết nối MongoDB (sẽ khởi tạo JSON Fallback file):', err.message);
  }

  // 1. Khởi tạo tài khoản CTV Mẫu (ctv_demo / 123456)
  try {
    const existing = await getCtvByUsername('ctv_demo');
    if (!existing) {
      const defaultCtv = {
        username: 'ctv_demo',
        password: hashPassword('123456'),
        displayName: 'Cộng Tác Viên Mẫu',
        balance: 500000,
        prices: {
          '1year': 65000,
          'lifetime': 350000
        },
        apiKey: `ctv_key_demo_${Date.now()}`,
        depositCode: 'LGNAPDEMO1',
        active: true
      };
      await saveCtvAccount(defaultCtv);
      console.log('✅ Đã tạo tài khoản CTV mẫu: Username: ctv_demo | Mật khẩu: 123456 | Số dư: 500.000đ');
    } else {
      console.log('ℹ️ Tài khoản ctv_demo đã tồn tại trong DB.');
    }
  } catch (e) {
    console.error('❌ Lỗi khi khởi tạo CTV mẫu:', e.message);
  }

  // 2. Cài đặt bảng giá mặc định
  try {
    await updatePrices({ '1year': 79000, 'lifetime': 399000 });
    console.log('✅ Đã lưu giá niêm yết bán lẻ mặc định: Gói 1 Năm (79.000đ) | Gói Vĩnh Viễn (399.000đ)');
  } catch (e) {}

  // 3. Khởi tạo file Fallback JSON
  const dbData = readFallback();
  if (!dbData.ctvAccounts || dbData.ctvAccounts.length === 0) {
    dbData.ctvAccounts = [
      {
        username: 'ctv_demo',
        password: hashPassword('123456'),
        displayName: 'Cộng Tác Viên Mẫu',
        balance: 500000,
        prices: { '1year': 65000, 'lifetime': 350000 },
        apiKey: `ctv_key_demo_${Date.now()}`,
        depositCode: 'LGNAPDEMO1',
        active: true,
        createdAt: new Date().toISOString()
      }
    ];
    writeFallback(dbData);
    console.log('✅ Đã ghi dữ liệu ban đầu vào ctv_orders_fallback.json!');
  }

  console.log('\n🎉 KHỞI TẠO DATABASE CTV HOÀN TẤT SUÔN SẺ!');
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
}

seedDatabase();
