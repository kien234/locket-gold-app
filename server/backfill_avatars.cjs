/**
 * backfill_avatars.cjs
 * Run ONCE to fetch & save real Locket profile pictures for all existing COMPLETED orders.
 * Usage: node server/backfill_avatars.cjs
 */

const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/locket';

const orderSchema = new mongoose.Schema({
  orderId: String,
  username: String,
  uid: String,
  packageId: String,
  amount: Number,
  status: String,
  completedAt: Date,
  profile_picture_url: { type: String, default: null }
}, { strict: false });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

async function fetchAvatarForUser(username) {
  if (!username || username === 'n/a' || username.includes('test')) return null;

  const apiUrls = [
    `https://api.locketgold.click/api/v1/userinfo?user=${encodeURIComponent(username)}`,
    `http://localhost:3001/api/v1/userinfo?user=${encodeURIComponent(username)}`,
    `http://localhost:3000/api/v1/userinfo?user=${encodeURIComponent(username)}`
  ];

  for (const url of apiUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        const pic = data?.profile_picture_url || data?.avatar || data?.data?.profile_picture_url;
        if (pic && typeof pic === 'string' && pic.startsWith('http')) {
          return pic.replace('.googleapis.com:443', '.googleapis.com');
        }
      }
    } catch (_e) {}
  }

  return null;
}

async function run() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
  console.log('✅ MongoDB connected');

  const orders = await Order.find({
    status: 'COMPLETED',
    $or: [{ profile_picture_url: null }, { profile_picture_url: { $exists: false } }]
  }).lean();

  console.log(`📋 Found ${orders.length} completed orders without avatar`);

  let saved = 0;
  let failed = 0;

  for (const order of orders) {
    const uname = (order.username || '').trim().toLowerCase();
    if (!uname || uname.includes('test')) {
      console.log(`  ⏭️  Skip test user: ${uname}`);
      continue;
    }

    process.stdout.write(`  🔍 Fetching avatar for @${uname}... `);
    const avatarUrl = await fetchAvatarForUser(uname);

    if (avatarUrl) {
      await Order.updateOne(
        { _id: order._id },
        { $set: { profile_picture_url: avatarUrl } }
      );
      console.log(`✅ SAVED (${avatarUrl.substring(0, 50)}...)`);
      saved++;
    } else {
      console.log(`❌ NOT FOUND`);
      failed++;
    }

    // Small delay between requests to not spam the API
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n🎉 Done! Saved: ${saved} avatars | Failed: ${failed}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
