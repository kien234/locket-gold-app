export interface LocketUserInfo {
  username: string;
  uid: string | null;
  avatar: string | null;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  displayName?: string;
  valid: boolean;
  hasActiveGold?: boolean;
  hasGold?: boolean;
  alreadyGold?: boolean;
  goldExpiryDate?: string;
  expiryDate?: string;
  goldDaysLeft?: number;
  daysLeft?: number;
  isLifetime?: boolean;
  productId?: string;
  membership?: string;
  error?: string;
}

// RevenueCat API check fallback for active Gold membership
async function checkRevenueCatGold(uid: string): Promise<{ hasGold: boolean; expiryDate?: string; daysLeft?: number }> {
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
      headers: { "Authorization": "Bearer appl_JngFETzdodyLmCREOlwTUtXdQik" },
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
    const badgeVal = badgeAttr?.value;
    if (badgeVal === 'true' && maxExpMs === 0) {
      maxExpMs = 4102444800000;
    }

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
      return {
        hasGold: true,
        expiryDate,
        daysLeft
      };
    }
    return { hasGold: false };
  } catch (e) {
    return { hasGold: false };
  }
}

async function fetchLocketCamAvatar(username: string): Promise<string | null> {
  try {
    const urls = [
      `/api/locket/${encodeURIComponent(username)}`,
      `https://locket.cam/${encodeURIComponent(username)}`
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
          },
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const html = await res.text();
          const imgMatch = html.match(/https:\/\/firebasestorage\.googleapis\.com:443\/v0\/b\/locket-img\/o\/users%2F[^"'\s>]+/i) ||
                           html.match(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/locket-img\/o\/users%2F[^"'\s>]+/i);
          if (imgMatch) {
            let avatar = imgMatch[0].replace(/["']/g, '');
            if (avatar.includes(':443')) {
              avatar = avatar.replace('.googleapis.com:443', '.googleapis.com');
            }
            return avatar;
          }
        }
      } catch (_e) {}
    }
  } catch (_e) {}
  return null;
}

export async function getLocketUserInfo(user: string): Promise<LocketUserInfo> {
  if (!user || !user.trim()) {
    throw new Error("Vui lòng cung cấp username hoặc UID");
  }

  const cleanUser = extractLocketUsername(user);

  // Try fast primary UserInfo APIs (~0.3s)
  const primaryUrls = [
    `/api/v1/userinfo?user=${encodeURIComponent(cleanUser)}`,
    `https://api.locketgold.click/api/v1/userinfo?user=${encodeURIComponent(cleanUser)}`,
  ];

  for (const url of primaryUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (data.status === 'error' || data.code === 404 || (data.message && data.message.includes('không tồn tại'))) {
            return {
              username: cleanUser,
              uid: null,
              avatar: null,
              valid: false,
              error: "Tài khoản không tồn tại trên Locket"
            };
          }

          if (data.status === 'success') {
            // Check if account does NOT exist on Locket
            const isNonExistent = (!data.uid || data.uid === cleanUser) && !data.profile_picture_url && !data.full_name && !data.first_name;

            if (isNonExistent) {
              return {
                username: cleanUser,
                uid: null,
                avatar: null,
                valid: false,
                error: "Tài khoản không tồn tại trên Locket"
              };
            }

          const gold = data.gold || {};
          const hasGold = Boolean(gold.has_gold);
          let expiryDateStr: string | undefined = undefined;
          let daysLeft: number | undefined = undefined;

          if (hasGold) {
            if (gold.expiry_date) {
              const expMs = new Date(gold.expiry_date).getTime();
              if (!isNaN(expMs) && expMs > Date.now()) {
                daysLeft = Math.ceil((expMs - Date.now()) / (1000 * 60 * 60 * 24));
                const d = new Date(expMs);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                expiryDateStr = `${day}/${month}/${year}`;
              } else {
                expiryDateStr = 'Vĩnh viễn';
                daysLeft = 9999;
              }
            } else {
              expiryDateStr = 'Vĩnh viễn';
              daysLeft = 9999;
            }
          }

          let rawAvatar = data.profile_picture_url;
          if (!rawAvatar) {
            rawAvatar = await fetchLocketCamAvatar(cleanUser);
          }
          if (!rawAvatar) {
            rawAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanUser)}&background=FF6B9D&color=fff`;
          } else if (typeof rawAvatar === 'string' && rawAvatar.includes(':443')) {
            rawAvatar = rawAvatar.replace('.googleapis.com:443', '.googleapis.com');
          }

          return {
            username: data.username || cleanUser,
            uid: data.uid || null,
            avatar: rawAvatar,
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            full_name: data.full_name || '',
            displayName: data.full_name || data.display_name || data.name || cleanUser,
            valid: true,
            hasActiveGold: hasGold,
            hasGold: hasGold,
            alreadyGold: hasGold,
            goldExpiryDate: expiryDateStr,
            expiryDate: expiryDateStr,
            goldDaysLeft: daysLeft,
            daysLeft: daysLeft,
            isLifetime: expiryDateStr === 'Vĩnh viễn' || daysLeft === 9999,
            productId: gold.product_id || undefined,
            membership: gold.membership || undefined
          };
        }
      }
    }
  } catch (_e) {
      // Try next fallback endpoint
    }
  }

  // Fallback 2: Direct html scraping & RevenueCat check if primary API endpoints fail
  try {
    const res = await fetch(`/api/locket/${encodeURIComponent(cleanUser)}`, { signal: AbortSignal.timeout(3000) });
    
    if (!res.ok) {
      return {
        username: cleanUser,
        uid: null,
        avatar: null,
        valid: false,
        error: "Tài khoản không tồn tại"
      };
    }

    const html = await res.text();

    const uidMatch = html.match(/users(?:%2F|\/)([a-zA-Z0-9_-]{20,})(?:%2F|\/)public/i);
    const uid = uidMatch ? uidMatch[1] : null;

    if (!uid) {
      return {
        username: cleanUser,
        uid: null,
        avatar: null,
        valid: false,
        error: "Tài khoản không tồn tại trên Locket"
      };
    }

    const imgMatch = html.match(/https:\/\/firebasestorage\.googleapis\.com:443\/v0\/b\/locket-img\/o\/users%2F[^"'\s>]+/i) ||
                     html.match(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/locket-img\/o\/users%2F[^"'\s>]+/i);
    
    const avatar = imgMatch 
      ? imgMatch[0].replace(/["']/g, '') 
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanUser)}&background=FF6B9D&color=fff`;

    const goldInfo = await checkRevenueCatGold(uid);

    return {
      username: cleanUser,
      uid,
      avatar,
      valid: true,
      displayName: cleanUser,
      hasActiveGold: goldInfo.hasGold,
      hasGold: goldInfo.hasGold,
      alreadyGold: goldInfo.hasGold,
      goldExpiryDate: goldInfo.expiryDate,
      expiryDate: goldInfo.expiryDate,
      goldDaysLeft: goldInfo.daysLeft,
      daysLeft: goldInfo.daysLeft,
      isLifetime: goldInfo.expiryDate === 'Vĩnh viễn'
    };
  } catch (err) {
    return {
      username: cleanUser,
      uid: null,
      avatar: null,
      valid: false,
      error: "Tài khoản không tồn tại"
    };
  }
}

/**
 * Parses input string or URL (e.g. http://locket.cam/vnkien26 or https://locket.cam/%7Buid%7D)
 * and extracts the clean username / UID.
 */
export function extractLocketUsername(input: string): string {
  if (!input) return '';
  let str = String(input).trim();
  try {
    str = decodeURIComponent(str);
  } catch (_) {}

  // Remove leading @ or repeated @
  str = str.replace(/^@+/, '').trim();

  // If input is a URL or contains locket domains or protocol / slashes
  if (str.includes('://') || str.toLowerCase().includes('locket') || str.includes('/')) {
    try {
      const urlStr = str.startsWith('http://') || str.startsWith('https://') ? str : `https://${str}`;
      const urlObj = new URL(urlStr);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        let lastPart = parts[parts.length - 1];
        lastPart = lastPart.split('?')[0].split('#')[0].replace(/^@+/, '').trim();
        lastPart = lastPart.replace(/\.(html|php|aspx|jsx|tsx|png|jpg|jpeg|gif|svg|webp)$/i, '');
        if (lastPart) {
          return lastPart.toLowerCase();
        }
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
