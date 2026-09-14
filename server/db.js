const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/locket';

// MongoDB Schema for Orders
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  username: { type: String, required: true, lowercase: true, trim: true },
  uid: { type: String, required: true, trim: true, index: true },
  packageId: { type: String, required: true, enum: ['1year', 'lifetime'] },
  amount: { type: Number, required: true },
  status: { type: String, required: true, enum: ['PENDING', 'COMPLETED', 'EXPIRED'], default: 'PENDING' },
  vietQrUrl: { type: String },
  transaction: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
});

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

/**
 * Connect to MongoDB
 */
async function connectDb() {
  if (mongoose.connection.readyState >= 1) return;
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🍃 Kết nối MongoDB thành công:', MONGODB_URI);
  } catch (err) {
    console.error('❌ Lỗi kết nối MongoDB:', err.message);
  }
}

/**
 * Create or Update Order in MongoDB
 */
async function createOrder({ username, uid, packageId }) {
  await connectDb();
  const cleanUsername = username.trim().toLowerCase();
  const cleanUid = uid.trim();
  const amount = packageId === 'lifetime' ? 399000 : 99000;
  const accountName = encodeURIComponent('NGUYEN VAN KIEN');
  const vietQrUrl = `https://img.vietqr.io/image/ACB-21456181-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(cleanUid)}&accountName=${accountName}`;

  const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  // Find if there is a pending order for this UID
  let order = await Order.findOne({ uid: cleanUid, status: 'PENDING' });

  if (order) {
    order.packageId = packageId;
    order.amount = amount;
    order.vietQrUrl = vietQrUrl;
    order.updatedAt = new Date();
    await order.save();
  } else {
    order = await Order.create({
      orderId,
      username: cleanUsername,
      uid: cleanUid,
      packageId,
      amount,
      status: 'PENDING',
      vietQrUrl,
    });
  }

  return order;
}

/**
 * Get order status by UID
 */
async function getOrderByUid(uid) {
  await connectDb();
  return await Order.findOne({ uid: uid.trim() }).sort({ createdAt: -1 });
}

/**
 * Get all pending orders
 */
async function getPendingOrders() {
  await connectDb();
  return await Order.find({ status: 'PENDING' });
}

/**
 * Mark order as COMPLETED upon payment match
 */
async function completeOrder(uid, transactionData = {}) {
  await connectDb();
  const order = await Order.findOne({ uid: uid.trim(), status: 'PENDING' });
  if (order) {
    order.status = 'COMPLETED';
    order.completedAt = new Date();
    order.transaction = transactionData;
    await order.save();
    return order;
  }
  return null;
}

module.exports = {
  connectDb,
  createOrder,
  getOrderByUid,
  getPendingOrders,
  completeOrder,
  Order,
};
