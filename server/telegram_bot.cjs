const fs = require('fs');
const path = require('path');
const {
  getTelegramBotToken,
  getCtvByApiKey,
  getCtvByUsername,
  getCtvByTelegramChatId,
  updateCtvTelegramChatId,
  createOrder,
  getPrices,
  isUserBanned,
  getCtvOrders,
  deductCtvBalance
} = require('./db.cjs');

let lastTelegramUpdateId = 0;
let cachedBotUsername = '';
let ctvTokensMap = null;
let activateGoldFn = null;

// User state machine for conversation steps (e.g. waiting for username input)
const userStatesMap = new Map();

function setTelegramDependencies(ctvTokens, activateFn) {
  ctvTokensMap = ctvTokens;
  activateGoldFn = activateFn;
}

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

// ── FETCH LOCKET USER INFO & CHECK GOLD STATUS ─────────────────────────
async function fetchLocketUserInfo(username) {
  const cleanUser = extractLocketUsername(username);
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanUser || 'Locket')}&background=FF6B9D&color=fff&bold=true&size=512`;
  if (!cleanUser) {
    return {
      username: '',
      displayName: 'Không xác định',
      avatar: fallbackAvatar,
      uid: '',
      alreadyHasGold: false,
      goldMessage: '',
      goldExpiry: ''
    };
  }

  const apiUrls = [
    `https://api.locketgold.click/api/v1/userinfo?user=${encodeURIComponent(cleanUser)}`,
    `http://localhost:3000/api/v1/userinfo?user=${encodeURIComponent(cleanUser)}`
  ];

  for (const url of apiUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.status === 'success' || data.username || data.uid)) {
          const picUrl = data.profile_picture_url || data.avatar || data.data?.profile_picture_url || '';
          const cleanPic = picUrl ? picUrl.replace('.googleapis.com:443', '.googleapis.com') : fallbackAvatar;

          const fullName = data.full_name || (data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : '');
          const displayName = fullName || data.name || data.display_name || cleanUser;

          const hasGold = data.gold?.has_gold === true || data.already_has_gold === true || (data.gold?.membership && String(data.gold.membership).includes('Active'));
          const goldMsg = data.gold?.membership || data.message || 'Locket Gold Active 💛';
          const goldExpiry = data.gold?.expiry_date || data.data?.expiry_date || '';

          return {
            username: cleanUser,
            displayName: displayName,
            avatar: cleanPic,
            uid: data.uid || data.data?.uid || '',
            alreadyHasGold: hasGold,
            goldMessage: goldMsg,
            goldExpiry: goldExpiry
          };
        }
      }
    } catch (_e) {}
  }

  return {
    username: cleanUser,
    displayName: cleanUser,
    avatar: fallbackAvatar,
    uid: '',
    alreadyHasGold: false,
    goldMessage: '',
    goldExpiry: ''
  };
}

// ── TELEGRAM BOT INFO & COMMAND REGISTRATION ───────────────────────────
async function fetchTelegramBotInfo(forceRefresh = false) {
  const botToken = getTelegramBotToken();
  if (!botToken) return { configured: false, botUsername: '' };
  if (cachedBotUsername && !forceRefresh) return { configured: true, botUsername: cachedBotUsername };

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    if (data.ok && data.result?.username) {
      cachedBotUsername = data.result.username;
      console.log(`🤖 [Telegram Bot Connected] @${cachedBotUsername}`);
      
      // Auto register bot commands menu in Telegram
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commands: [
              { command: 'start', description: '🚀 Bảng điều khiển & Trình đơn chính CTV' },
              { command: 'menu', description: '📱 Bảng menu nút bấm CTV' },
              { command: 'balance', description: '💰 Kiểm tra số dư ví CTV' },
              { command: 'gold', description: '👑 Kích hoạt Locket Gold tức thì' },
              { command: 'check', description: '🔍 Tra cứu Profile & Trạng thái Gold' },
              { command: 'history', description: '📜 Xem 5 lịch sử kích hoạt gần nhất' },
              { command: 'api', description: '🔑 Lấy API Key & Hướng dẫn kết nối' }
            ]
          })
        });
      } catch (_err) {}

      return { configured: true, botUsername: cachedBotUsername };
    }
  } catch (err) {
    console.error('❌ [Telegram Bot Error]:', err.message);
  }
  return { configured: true, botUsername: cachedBotUsername };
}

// ── ANSWER CALLBACK QUERY ──────────────────────────────────────────────
async function answerCallbackQuery(callbackQueryId, text = '') {
  const botToken = getTelegramBotToken();
  if (!botToken || !callbackQueryId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text
      })
    });
  } catch (_e) {}
}

// ── EDIT TELEGRAM MESSAGE INLINE HELPER ────────────────────────────────
async function editTelegramMessage(chatId, messageId, text, replyMarkup = null) {
  if (!chatId || !messageId) return false;
  const botToken = getTelegramBotToken();
  if (!botToken) return false;

  try {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML'
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.ok) {
      // Fallback if original message was a photo or cannot be edited
      return await sendTelegramNotification(chatId, text, replyMarkup);
    }
    return true;
  } catch (err) {
    return await sendTelegramNotification(chatId, text, replyMarkup);
  }
}

// ── TELEGRAM SEND MESSAGE HELPER ───────────────────────────────────────
async function sendTelegramNotification(chatId, text, replyMarkup = null) {
  if (!chatId) return false;
  const botToken = getTelegramBotToken();
  if (!botToken) return false;

  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    let data = await res.json();
    if (!data.ok && data.description && data.description.includes("can't parse entities")) {
      const plainText = text.replace(/<[^>]*>/g, '');
      const fallbackPayload = { chat_id: chatId, text: plainText };
      if (replyMarkup) fallbackPayload.reply_markup = replyMarkup;

      const fallbackRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fallbackPayload)
      });
      data = await fallbackRes.json();
    }
    return data.ok;
  } catch (err) {
    console.error(`❌ [Telegram Error] ChatID ${chatId}:`, err.message);
    return false;
  }
}

// ── TELEGRAM SEND PHOTO HELPER ─────────────────────────────────────────
async function sendTelegramPhoto(chatId, photoUrl, caption = '', replyMarkup = null) {
  if (!chatId || !photoUrl) return false;
  const botToken = getTelegramBotToken();
  if (!botToken) return false;

  // 1. Support local file path upload via FormData
  if (photoUrl.startsWith('/') || photoUrl.startsWith('c:') || photoUrl.startsWith('C:') || photoUrl.includes(':\\')) {
    if (fs.existsSync(photoUrl)) {
      try {
        const fileBuffer = fs.readFileSync(photoUrl);
        const blob = new Blob([fileBuffer], { type: 'image/png' });
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('photo', blob, path.basename(photoUrl));
        if (caption) formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
        if (replyMarkup) formData.append('reply_markup', JSON.stringify(replyMarkup));

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          body: formData
        });
        let data = await res.json();
        if (data.ok) return true;
      } catch (err) {}
    }
  }

  // 2. Remote HTTP/HTTPS photo URL
  try {
    const payload = {
      chat_id: chatId,
      photo: photoUrl,
      caption: caption,
      parse_mode: 'HTML'
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    let data = await res.json();
    if (!data.ok) {
      return await sendTelegramNotification(chatId, `${caption}\n\n🖼️ Xem ảnh: ${photoUrl}`, replyMarkup);
    }
    return true;
  } catch (err) {
    return await sendTelegramNotification(chatId, `${caption}\n\n🖼️ Xem ảnh: ${photoUrl}`, replyMarkup);
  }
}

// ── NOTIFY CTV VIA TELEGRAM ───────────────────────────────────────────
async function notifyCtvViaTelegram(ctv, type, details = {}) {
  if (!ctv || !ctv.telegramChatId) return;
  const chatId = String(ctv.telegramChatId).trim();
  if (!chatId) return;

  const ctvName = ctv.displayName || ctv.username;

  if (type === 'SUCCESS') {
    const pkgLabel = details.packageId === 'lifetime' ? '👑 Vĩnh Viễn (Lifetime)' : '⭐ 1 Năm (365 Ngày)';
    const text = `🎉 <b>NÂNG CẤP LOCKET GOLD THÀNH CÔNG!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>CTV Thực Hiện:</b> ${ctvName} (@${ctv.username})\n` +
      `📱 <b>Khách Hàng:</b> <code>@${details.userUpgraded}</code>\n` +
      `📦 <b>Gói Dịch Vụ:</b> ${pkgLabel}\n` +
      (details.amount === 0 ? `📦 <b>Thanh Toán:</b> Trừ 1 lượt gói (Còn ${Number(details.remainingRequests || 0).toLocaleString('vi-VN')} lượt)\n` : `💸 <b>Trừ Ví CTV:</b> <code>-${Number(details.amount).toLocaleString('vi-VN')}đ</code>\n`) +
      `💰 <b>Số Dư Ví CTV:</b> <b>${Number(details.newBalance).toLocaleString('vi-VN')}đ</b>\n` +
      `⏰ <b>Thời Gian:</b> ${new Date().toLocaleString('vi-VN')}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ <i>Cảm ơn bạn đã tin dùng hệ thống Kawaii Locket!</i>`;
    await sendTelegramNotification(chatId, text);

    // Auto send low quota warning if remaining requests < 10
    if (details.remainingRequests !== undefined && Number(details.remainingRequests) < 10 && Number(details.remainingRequests) >= 0) {
      const remaining = Number(details.remainingRequests);
      const alertText = `⚠️ <b>CẢNH BÁO SẮP HẾT LƯỢT NẠP GOLD (&lt; 10 LƯỢT)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Kính gửi CTV:</b> ${ctvName} (@${ctv.username})\n` +
        `📦 <b>Lượt gói Gold 1 Năm còn lại:</b> <b>${remaining.toLocaleString('vi-VN')} lượt</b>\n\n` +
        `‼️ Kho lượt nạp của bạn chỉ còn <b>${remaining} lượt</b>. Vui lòng mua thêm gói lượt trên Website CTV để không bị gián đoạn đơn kích hoạt của khách!`;
      await sendTelegramNotification(chatId, alertText);
    }
  } else if (type === 'FAIL') {
    const text = `❌ <b>NÂNG CẤP LOCKET GOLD THẤT BẠI!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>CTV:</b> ${ctvName} (@${ctv.username})\n` +
      `📱 <b>Khách Hàng:</b> <code>@${details.userUpgraded}</code>\n` +
      `⚠️ <b>Lý Do Lỗi:</b> ${details.error || 'Lỗi hệ thống'}\n` +
      `💰 <b>Số Dư Giữ Nguyên:</b> ${Number(details.currentBalance || 0).toLocaleString('vi-VN')}đ\n` +
      `⏰ <b>Thời Gian:</b> ${new Date().toLocaleString('vi-VN')}`;
    await sendTelegramNotification(chatId, text);
  } else if (type === 'LOW_BALANCE') {
    const text = `⚠️ <b>CẢNH BÁO SỐ DƯ TÀI KHOẢN THẤP (&lt; 50.000đ)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Kính gửi CTV:</b> ${ctvName} (@${ctv.username})\n` +
      `💰 <b>Số dư hiện tại:</b> <b>${Number(details.newBalance).toLocaleString('vi-VN')}đ</b>\n\n` +
      `‼️ Số dư ví CTV của bạn vừa giảm xuống dưới <b>50.000đ</b>. Vui lòng truy cập Website CTV hoặc nạp VietQR để tránh gián đoạn dịch vụ!`;
    await sendTelegramNotification(chatId, text);
  } else if (type === 'LOW_QUOTA') {
    const remaining = Number(details.remainingRequests) || 0;
    const text = `⚠️ <b>CẢNH BÁO SẮP HẾT LƯỢT NẠP GOLD (&lt; 10 LƯỢT)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Kính gửi CTV:</b> ${ctvName} (@${ctv.username})\n` +
      `📦 <b>Lượt gói Gold 1 Năm còn lại:</b> <b>${remaining.toLocaleString('vi-VN')} lượt</b>\n\n` +
      `‼️ Kho lượt nạp của bạn chỉ còn <b>${remaining} lượt</b>. Vui lòng mua thêm gói lượt trên Website CTV để không bị gián đoạn đơn kích hoạt của khách!`;
    await sendTelegramNotification(chatId, text);
  } else if (type === 'PACKAGE_PURCHASED') {
    const text = `🎉 <b>MUA GÓI LƯỢT NẠP THÀNH CÔNG!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>CTV:</b> ${ctvName} (@${ctv.username})\n` +
      `📦 <b>Cộng lượt:</b> <b>+${Number(details.count).toLocaleString('vi-VN')} lượt</b> (Gold 1 Năm)\n` +
      `💸 <b>Thanh toán:</b> <code>-${Number(details.totalPrice).toLocaleString('vi-VN')}đ</code> (Ưu đãi chiết khấu -${Number(details.discount || 0).toLocaleString('vi-VN')}đ)\n` +
      `📦 <b>Tổng kho lượt hiện có:</b> <b>${Number(details.remainingRequests).toLocaleString('vi-VN')} lượt</b>\n` +
      `💰 <b>Ví CTV còn lại:</b> ${Number(details.newBalance).toLocaleString('vi-VN')}đ\n` +
      `⏰ <b>Thời Gian:</b> ${new Date().toLocaleString('vi-VN')}`;
    await sendTelegramNotification(chatId, text);
  } else if (type === 'ALREADY_GOLD') {
    const text = `ℹ️ <b>TÀI KHOẢN ĐÃ CÓ LOCKET GOLD TỪ TRƯỚC!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>CTV:</b> ${ctvName} (@${ctv.username})\n` +
      `📱 <b>Khách Hàng:</b> <code>@${details.userUpgraded}</code>\n` +
      `💛 <b>Trạng Thái:</b> ${details.message || 'Đã có Gold active'}\n` +
      `💰 <b>Ví CTV Hoàn Tiền 100%:</b> ${Number(details.currentBalance || 0).toLocaleString('vi-VN')}đ\n` +
      `⏰ <b>Thời Gian:</b> ${new Date().toLocaleString('vi-VN')}`;
    await sendTelegramNotification(chatId, text);
  }
}

// ── NON-CTV / OUTSIDER DENIAL MESSAGE ────────────────────────────────
async function sendNonCtvDenial(chatId, messageId = null) {
  const text = `⛔ <b>BOT CHỈ DÀNH RIÊNG CHO CỘNG TÁC VIÊN (CTV)!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Hệ thống Bot Telegram này là công cụ nội bộ <b>chỉ dành riêng cho các Cộng Tác Viên Locket Gold chính thức</b> đã kích hoạt tài khoản.\n\n` +
    `💬 <b>Nếu bạn muốn đăng ký tài khoản CTV hoặc liên hệ hỗ trợ, vui lòng liên hệ Admin:</b>\n` +
    `👉 Telegram Admin: <b>@yeummo</b>`;

  const inlineButtons = {
    inline_keyboard: [
      [
        { text: '💬 Liên Hệ Telegram Admin @yeummo', url: 'https://t.me/yeummo' }
      ],
      [
        { text: '🌐 Truy Cập Website Locket Gold', url: 'https://locketgold.click' }
      ]
    ]
  };

  if (messageId) {
    await editTelegramMessage(chatId, messageId, text, inlineButtons);
  } else {
    await sendTelegramNotification(chatId, text, inlineButtons);
  }
}

// ── TELEGRAM INLINE MENU BUILDER ──────────────────────────────────────
function buildCtvMenu(ctv) {
  return {
    inline_keyboard: [
      [
        { text: '👑 Kích Hoạt Gold Cho Khách', callback_data: 'ctv_prompt_gold' },
        { text: '💰 Số Dư & Key API', callback_data: 'ctv_check_balance' }
      ],
      [
        { text: '🔍 Tra Cứu Profile Locket', callback_data: 'prompt_check_user' },
        { text: '📜 Lịch Sử 5 Đơn Gần Nhất', callback_data: 'ctv_history' }
      ],
      [
        { text: '📚 Hướng Dẫn Đấu NỐi API', callback_data: 'ctv_api_docs' },
        { text: '💬 Chat Admin @yeummo', url: 'https://t.me/yeummo' }
      ]
    ]
  };
}

// ── TELEGRAM CALLBACK QUERY PROCESSOR (EDIT MESSAGE INLINE) ───────────
async function handleTelegramCallbackQuery(cb) {
  if (!cb) return;
  const chatId = String(cb.message?.chat?.id);
  const messageId = cb.message?.message_id;
  const data = cb.data || '';

  try {
    await answerCallbackQuery(cb.id);

    // FIX: Await async getCtvByTelegramChatId call!
    const linkedCtv = await getCtvByTelegramChatId(chatId);

    // STRICT GUARD: If not a linked CTV, block all button interactions & notify admin @yeummo
    if (!linkedCtv) {
      await sendNonCtvDenial(chatId, messageId);
      return;
    }

    // 1. Prompt CTV for target username
    if (data === 'ctv_prompt_gold') {
      userStatesMap.set(chatId, { action: 'await_gold_username' });
      await editTelegramMessage(
        chatId,
        messageId,
        `👑 <b>KÍCH HOẠT LOCKET GOLD SỈ CTV</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Vui lòng nhập <b>Username Locket</b> của khách hàng (ví dụ: <code>vnkien</code>):`
      );
      return;
    }

    // 2. CTV Check Balance
    if (data === 'ctv_check_balance') {
      const msg = `💰 <b>THÔNG TIN VÍ & TÀI KHOẢN CTV</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Tài khoản:</b> @${linkedCtv.username} (${linkedCtv.displayName || 'CTV'})\n` +
        `💵 <b>Số dư ví CTV:</b> <b>${Number(linkedCtv.balance || 0).toLocaleString('vi-VN')}đ</b>\n` +
        `🔑 <b>Key API:</b> <code>${linkedCtv.apiKey}</code>\n` +
        `📲 <b>Telegram ChatID:</b> <code>${chatId}</code>\n\n` +
        `📊 <b>Bảng Giá CTV Của Bạn:</b>\n` +
        `  • ⭐ Gói 1 Năm: <b>${Number(linkedCtv.prices?.['1year'] || 65000).toLocaleString('vi-VN')}đ</b>\n` +
        `  • 👑 Gói Vĩnh Viễn: <b>${Number(linkedCtv.prices?.['lifetime'] || 350000).toLocaleString('vi-VN')}đ</b>`;
      await editTelegramMessage(chatId, messageId, msg, buildCtvMenu(linkedCtv));
      return;
    }

    // 3. CTV View History
    if (data === 'ctv_history') {
      const orders = (await getCtvOrders(linkedCtv.username) || []).slice(0, 5);
      if (orders.length === 0) {
        await editTelegramMessage(chatId, messageId, `📜 Bạn chưa có lịch sử nâng cấp Locket Gold nào.`, buildCtvMenu(linkedCtv));
        return;
      }

      let historyText = `📜 <b>5 ĐƠN NÂNG CẤP GẦN NHẤT CỦA CTV @${linkedCtv.username}</b>\n━━━━━━━━━━━━━━━━━━━━━━\n`;
      orders.forEach((ord, idx) => {
        const pkgName = ord.packageId === 'lifetime' ? '👑 Vĩnh Viễn' : '⭐ 1 Năm';
        const timeStr = new Date(ord.createdAt || Date.now()).toLocaleDateString('vi-VN');
        historyText += `${idx + 1}. <b>@${ord.targetUser}</b> | ${pkgName} | <code>${Number(ord.price).toLocaleString('vi-VN')}đ</code> | <i>${timeStr}</i>\n`;
      });

      await editTelegramMessage(chatId, messageId, historyText, buildCtvMenu(linkedCtv));
      return;
    }

    // 4. CTV API Docs
    if (data === 'ctv_api_docs') {
      const textGuide = `📋 <b>HƯỚNG DẪN ĐẤU NỐI API CTV TỰ ĐỘNG</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔑 <b>Key API:</b> <code>${linkedCtv.apiKey}</code>\n` +
        `🌐 <b>Base URL:</b> <code>https://locketgold.click</code>\n\n` +
        `📌 <b>Endpoint POST:</b>\n` +
        `<code>POST /api/v1/ctv/gold</code>\n` +
        `Header: <code>x-api-key: ${linkedCtv.apiKey}</code>\n` +
        `Body (JSON): <code>{"user": "vanle", "category": "yearly"}</code>\n\n` +
        `👉 <b>Mở tài liệu Postman 1-click tại:</b>\n` +
        `https://locketgold.click/postman`;
      await editTelegramMessage(chatId, messageId, textGuide, buildCtvMenu(linkedCtv));
      return;
    }

    // 5. Prompt for Check Locket Profile
    if (data === 'prompt_check_user') {
      userStatesMap.set(chatId, { action: 'await_check_username' });
      await editTelegramMessage(chatId, messageId, `🔍 Vui lòng nhập <b>Username Locket</b> bạn muốn tra cứu:`);
      return;
    }

    // 6. Direct CTV Instant Gold Confirmation
    if (data.startsWith('ctv_confirm_gold:')) {
      const parts = data.split(':');
      const pkg = parts[1] || '1year';
      const targetUser = parts[2] || '';

      if (!targetUser) return;

      await editTelegramMessage(chatId, messageId, `⏳ Đang kích hoạt Locket Gold cho <b>@${targetUser}</b>...`);

      if (activateGoldFn) {
        const result = await activateGoldFn(linkedCtv.username, targetUser, pkg);
        if (result.success) {
          const pkgLabel = pkg === 'lifetime' ? '👑 Vĩnh Viễn' : '⭐ 1 Năm';
          const msg = `🎉 <b>KÍCH HOẠT LOCKET GOLD THÀNH CÔNG!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📱 <b>Khách Hàng:</b> <code>@${targetUser}</code>\n` +
            `📦 <b>Gói:</b> ${pkgLabel}\n` +
            `💸 <b>Đã trừ ví:</b> <code>-${Number(result.deducted).toLocaleString('vi-VN')}đ</code>\n` +
            `💰 <b>Số dư còn lại:</b> <b>${Number(result.newBalance).toLocaleString('vi-VN')}đ</b>`;
          await sendTelegramNotification(chatId, msg, buildCtvMenu(linkedCtv));
        } else {
          await editTelegramMessage(chatId, messageId, `❌ <b>KÍCH HOẠT THẤT BẠI:</b> ${result.message || 'Lỗi không xác định'}`, buildCtvMenu(linkedCtv));
        }
      }
      return;
    }

    if (data === 'cancel_gold') {
      await editTelegramMessage(chatId, messageId, `❌ <b>ĐÃ HỦY YÊU CẦU</b>`, buildCtvMenu(linkedCtv));
    }
  } catch (err) {
    console.error(`❌ [Telegram Callback Error] ChatID ${chatId}:`, err.message);
  }
}

// ── TELEGRAM MESSAGE PROCESSOR ────────────────────────────────────────
async function handleTelegramMessage(message) {
  if (!message || !message.text) return;
  const text = message.text.trim();
  const chatId = String(message.chat.id);
  const fromUser = message.from?.username ? `@${message.from.username}` : (message.from?.first_name || 'Bạn');

  const lowerText = text.toLowerCase();

  try {
    // 1. Handling CTV Deep-linking (/start <token>)
    if (text.startsWith('/start')) {
      const param = text.replace(/^\/start\s*/, '').trim();

      if (param) {
        let ctv = await getCtvByApiKey(param);
        if (!ctv) ctv = await getCtvByUsername(param);
        if (!ctv && ctvTokensMap) {
          const sessionUser = ctvTokensMap.get(param);
          if (sessionUser) ctv = await getCtvByUsername(sessionUser);
        }

        if (ctv) {
          await updateCtvTelegramChatId(ctv.username, chatId);
          console.log(`🤖 [Telegram Auto-Link] CTV @${ctv.username} <-> ChatID: ${chatId}`);

          const reply = `🎉 <b>LIÊN KẾT TÀI KHOẢN CTV THÀNH CÔNG!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `👤 <b>Tài khoản CTV:</b> @${ctv.username} (${ctv.displayName || 'CTV'})\n` +
            `💰 <b>Số dư ví CTV:</b> <b>${Number(ctv.balance || 0).toLocaleString('vi-VN')}đ</b>\n` +
            `🔑 <b>Key API:</b> <code>${ctv.apiKey}</code>\n` +
            `📲 <b>Telegram Chat ID:</b> <code>${chatId}</code>\n\n` +
            `✅ Bạn có thể thực hiện mọi thao tác Kích hoạt Gold, Tra cứu, Kiểm tra ví ngay trên Telegram Bot này!`;
          
          await sendTelegramNotification(chatId, reply, buildCtvMenu(ctv));
          return;
        }
      }
    }

    // FIX: Await async getCtvByTelegramChatId call!
    const linkedCtv = await getCtvByTelegramChatId(chatId);

    // STRICT GUARD: If NOT a linked CTV, deny access & direct to admin @yeummo
    if (!linkedCtv) {
      await sendNonCtvDenial(chatId);
      return;
    }

    // Check state machine for CTV
    const userState = userStatesMap.get(chatId);
    if (userState) {
      userStatesMap.delete(chatId);

      if (userState.action === 'await_gold_username') {
        const targetUser = extractLocketUsername(text);
        const userInfo = await fetchLocketUserInfo(targetUser);

        const prices = linkedCtv.prices || getPrices();
        const price1Year = prices['1year'] || 65000;
        const priceLifetime = prices['lifetime'] || 350000;

        const caption = `👤 <b>XÁC NHẬN KÍCH HOẠT GOLD CHO KHÁCH</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📱 <b>Username:</b> @${userInfo.username}\n` +
          `📛 <b>Tên hiển thị:</b> ${userInfo.displayName}\n` +
          (userInfo.alreadyHasGold ? `⚠️ <b>Trạng thái:</b> <code>Đã có Gold từ trước!</code>\n` : `✅ <b>Trạng thái:</b> <code>Sẵn sàng nâng cấp</code>\n`) +
          `💰 <b>Ví CTV hiện tại:</b> <b>${Number(linkedCtv.balance || 0).toLocaleString('vi-VN')}đ</b>\n\n` +
          `❓ <b>Vui lòng chọn gói dịch vụ cần nâng cấp:</b>`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: `⭐ Gói 1 Năm (${Number(price1Year).toLocaleString('vi-VN')}đ)`, callback_data: `ctv_confirm_gold:1year:${userInfo.username}` }
            ],
            [
              { text: `👑 Gói Vĩnh Viễn (${Number(priceLifetime).toLocaleString('vi-VN')}đ)`, callback_data: `ctv_confirm_gold:lifetime:${userInfo.username}` }
            ],
            [
              { text: '❌ Hủy Bỏ', callback_data: 'cancel_gold' }
            ]
          ]
        };

        if (userInfo.avatar) {
          await sendTelegramPhoto(chatId, userInfo.avatar, caption, keyboard);
        } else {
          await sendTelegramNotification(chatId, caption, keyboard);
        }
        return;
      } else if (userState.action === 'await_check_username') {
        const targetUser = extractLocketUsername(text);
        await sendTelegramNotification(chatId, `🔍 Đang tra cứu Profile Locket <b>@${targetUser}</b>...`);
        const userInfo = await fetchLocketUserInfo(targetUser);

        const infoMsg = `📱 <b>THÔNG TIN PROFILE LOCKET GOLD</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📱 <b>Username:</b> @${userInfo.username}\n` +
          `📛 <b>Tên hiển thị:</b> ${userInfo.displayName}\n` +
          `🆔 <b>UID Locket:</b> <code>${userInfo.uid || 'N/A'}</code>\n` +
          `💛 <b>Locket Gold:</b> ${userInfo.alreadyHasGold ? '<b>ĐÃ CÓ GOLD ACTIVE 💛</b>' : '<i>Chưa có Gold (Tài khoản thường)</i>'}\n` +
          (userInfo.goldExpiry ? `📅 <b>Hạn dùng:</b> <code>${userInfo.goldExpiry}</code>\n` : '');

        if (userInfo.avatar) {
          await sendTelegramPhoto(chatId, userInfo.avatar, infoMsg, buildCtvMenu(linkedCtv));
        } else {
          await sendTelegramNotification(chatId, infoMsg, buildCtvMenu(linkedCtv));
        }
        return;
      }
    }

    // CTV Commands (/menu, /balance, /gold, /check, /history, /api)
    if (lowerText === '/menu' || lowerText === 'menu' || lowerText === '/start') {
      await sendTelegramNotification(
        chatId,
        `👋 <b>Xin chào CTV @${linkedCtv.username}!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 <b>Số dư ví CTV:</b> <b>${Number(linkedCtv.balance || 0).toLocaleString('vi-VN')}đ</b>\n\n` +
        `Bấm các nút chức năng bên dưới để điều khiển Bot:`,
        buildCtvMenu(linkedCtv)
      );
      return;
    }

    if (lowerText === '/balance' || lowerText === 'balance') {
      const msg = `💰 <b>SỐ DƯ VÍ CTV @${linkedCtv.username}</b>\n━━━━━━━━━━━━━━━━━━━━━━\nSố dư khả dụng: <b>${Number(linkedCtv.balance || 0).toLocaleString('vi-VN')}đ</b>\nKey API: <code>${linkedCtv.apiKey}</code>`;
      await sendTelegramNotification(chatId, msg, buildCtvMenu(linkedCtv));
      return;
    }

    if (lowerText.startsWith('/check')) {
      const parts = text.split(/\s+/).slice(1);
      if (parts.length === 0) {
        await sendTelegramNotification(chatId, `⚠️ Vui lòng nhập username: <code>/check &lt;username&gt;</code>`);
        return;
      }
      const targetUser = extractLocketUsername(parts[0]);
      await sendTelegramNotification(chatId, `🔍 Đang tra cứu Profile <b>@${targetUser}</b>...`);
      const userInfo = await fetchLocketUserInfo(targetUser);

      const infoMsg = `📱 <b>THÔNG TIN PROFILE LOCKET GOLD</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 <b>Username:</b> @${userInfo.username}\n` +
        `📛 <b>Tên hiển thị:</b> ${userInfo.displayName}\n` +
        `🆔 <b>UID Locket:</b> <code>${userInfo.uid || 'N/A'}</code>\n` +
        `💛 <b>Locket Gold:</b> ${userInfo.alreadyHasGold ? '<b>ĐÃ CÓ GOLD ACTIVE 💛</b>' : '<i>Chưa có Gold</i>'}\n` +
        (userInfo.goldExpiry ? `📅 <b>Hạn dùng:</b> <code>${userInfo.goldExpiry}</code>\n` : '');

      if (userInfo.avatar) {
        await sendTelegramPhoto(chatId, userInfo.avatar, infoMsg, buildCtvMenu(linkedCtv));
      } else {
        await sendTelegramNotification(chatId, infoMsg, buildCtvMenu(linkedCtv));
      }
      return;
    }

    if (lowerText.startsWith('/gold')) {
      userStatesMap.set(chatId, { action: 'await_gold_username' });
      await sendTelegramNotification(
        chatId,
        `👑 <b>KÍCH HOẠT LOCKET GOLD SỈ CTV</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Vui lòng nhập <b>Username Locket</b> của khách hàng (ví dụ: <code>vnkien</code>):`
      );
      return;
    }

    // Default CTV Welcome Menu
    await sendTelegramNotification(
      chatId,
      `👋 Chào mừng CTV <b>@${linkedCtv.username}</b>! Vui lòng chọn thao tác bên dưới:`,
      buildCtvMenu(linkedCtv)
    );
  } catch (err) {
    console.error(`❌ [Telegram Message Error] ChatID ${chatId}:`, err.message);
  }
}

// ── TELEGRAM POLLING & WEBHOOK SETUP ──────────────────────────────────
function initTelegramBot(app) {
  // Webhook Endpoint
  app.post(['/api/telegram/webhook', '/api/v1/telegram/webhook'], async (req, res) => {
    try {
      const update = req.body;
      if (update && update.update_id) {
        lastTelegramUpdateId = Math.max(lastTelegramUpdateId, update.update_id);
      }
      if (update?.callback_query) {
        await handleTelegramCallbackQuery(update.callback_query);
      } else if (update?.message || update?.edited_message) {
        await handleTelegramMessage(update.message || update.edited_message);
      }
    } catch (err) {
      console.error('❌ [Telegram Webhook Error]:', err.message);
    }
    res.sendStatus(200);
  });

  // Verify and log Telegram Bot status on startup
  fetchTelegramBotInfo(true).then(info => {
    if (info && info.configured) {
      console.log(`🤖 Telegram Bot Active: @${info.botUsername} (Polling 24/7 cho CTV)`);
    } else {
      console.log(`⚠️ Telegram Bot: Chưa cấu hình TELEGRAM_BOT_TOKEN`);
    }
  }).catch(() => {});

  // Clear old pending updates on initial startup
  (async () => {
    const botToken = getTelegramBotToken();
    if (botToken) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=-1&limit=1`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
            lastTelegramUpdateId = data.result[0].update_id;
          }
        }
      } catch (_e) {}
    }
  })();

  // Sequential Fast Polling Loop
  let isPollingActive = false;
  setInterval(async () => {
    if (isPollingActive) return;
    const botToken = getTelegramBotToken();
    if (!botToken) return;

    isPollingActive = true;
    try {
      const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastTelegramUpdateId + 1}&timeout=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastTelegramUpdateId = Math.max(lastTelegramUpdateId, update.update_id);
            if (update.callback_query) {
              await handleTelegramCallbackQuery(update.callback_query);
            } else {
              const msg = update.message || update.edited_message;
              if (msg) {
                await handleTelegramMessage(msg);
              }
            }
          }
        }
      }
    } catch (_e) {
    } finally {
      isPollingActive = false;
    }
  }, 1000);
}

module.exports = {
  setTelegramDependencies,
  fetchTelegramBotInfo,
  sendTelegramNotification,
  sendTelegramPhoto,
  notifyCtvViaTelegram,
  handleTelegramMessage,
  initTelegramBot
};
