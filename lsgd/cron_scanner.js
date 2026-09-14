/**
 * ====================================================================
 * 🔄 CRON SCANNER QUÉT LỊCH SỬ GIAO DỊCH ACB & KÍCH HOẠT TỰ ĐỘNG
 * ====================================================================
 * Chạy bằng lệnh: node lsgd/cron_scanner.js
 */

const { getLichSuGiaoDich } = require('./lsgd_module');
const { connectDb, getPendingOrders, completeOrder } = require('../server/db');

const SCAN_INTERVAL_MS = 10000; // Quét mỗi 10 giây

console.log('🤖 CRON SCANNER LOCKET GOLD (ACB BANK + MONGODB) ĐÃ KHỞI CHẠY...');
console.log(`⏱  Tần suất quét: Mỗi ${SCAN_INTERVAL_MS / 1000} giây\n`);

async function scanTransactions() {
  await connectDb();
  const pendingOrders = await getPendingOrders();
  if (pendingOrders.length === 0) {
    return;
  }

  console.log(`[${new Date().toLocaleTimeString('vi-VN')}] 🔍 Đang quét ACB cho ${pendingOrders.length} đơn hàng PENDING trong MongoDB...`);

  const result = await getLichSuGiaoDich(20);
  if (!result.success || !Array.isArray(result.data)) {
    console.warn(`[${new Date().toLocaleTimeString('vi-VN')}] ⚠️ Lỗi lấy LSGD ACB:`, result.error);
    return;
  }

  const transactions = result.data;

  for (const order of pendingOrders) {
    // Look for matching income transaction
    const matchedTx = transactions.find(tx => {
      if (tx.type !== 'IN') return false;

      const fullText = (tx.title + ' ' + tx.message).toUpperCase();
      const targetUid = order.uid.toUpperCase();
      const targetUsername = order.username.toUpperCase();

      // Check if transaction content contains UID or username
      const hasContentMatch = fullText.includes(targetUid) || fullText.includes(targetUsername);
      const hasAmountMatch = tx.amount >= order.amount;

      return hasContentMatch && hasAmountMatch;
    });

    if (matchedTx) {
      console.log(`\n🎉 [KÍCH HOẠT MONGODB THÀNH CÔNG] Đơn hàng cho @${order.username}`);
      console.log(`   - UID: ${order.uid}`);
      console.log(`   - Gói: ${order.packageId} (${order.amount.toLocaleString('vi-VN')}đ)`);
      console.log(`   - Giao dịch ACB: +${matchedTx.amount.toLocaleString('vi-VN')}đ [ID: ${matchedTx.id}]`);
      console.log(`   - Nội dung ACB: "${matchedTx.message}"\n`);

      await completeOrder(order.uid, matchedTx);
    }
  }
}

// Loop scanner
async function runLoop() {
  try {
    await scanTransactions();
  } catch (e) {
    console.error("Lỗi Cron Scanner:", e.message);
  } finally {
    setTimeout(runLoop, SCAN_INTERVAL_MS);
  }
}

runLoop();
