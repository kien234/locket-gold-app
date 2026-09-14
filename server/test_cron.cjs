const { getLichSuGiaoDich } = require('../lsgd/lsgd_module.cjs');
const { getCtvAccounts, readFallback } = require('./db.cjs');

(async () => {
  console.log("=== INSPECTING ACB RECENT TRANSACTIONS ===");
  const result = await getLichSuGiaoDich(30);
  if (!result.success || !Array.isArray(result.data)) {
    console.error("Failed to fetch ACB transactions:", result);
    return;
  }

  console.log(`\nFetched ${result.data.length} transactions from ACB:`);
  result.data.forEach((tx, idx) => {
    if (tx.type === 'IN') {
      console.log(`[${idx+1}] ID: ${tx.id} | Amount: ${tx.amount}đ | Date: ${tx.transactionDate || tx.postDate || tx.time}`);
      console.log(`     Message: "${tx.message || tx.description || tx.title}"`);
    }
  });
})();
