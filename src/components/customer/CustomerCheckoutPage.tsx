import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, CheckCircle2, ShieldCheck, Zap, Crown, ArrowRight,
  Copy, RefreshCw, AlertCircle, ExternalLink, HelpCircle, Check,
  QrCode, Clock, Heart, Share2, Smartphone, Gift, Users, Star, X,
  MessageCircle, Phone, Send, ChevronDown, Award, Lock, Eye, Video,
  Image as ImageIcon, Smile, Flame, Search, Megaphone, AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { extractLocketUsername, getLocketUserInfo, type LocketUserInfo } from '../../services/locketService';

interface PackageDetail {
  name: string;
  price: number;
  subtitle?: string;
  badge?: string;
  features?: string[];
}

interface ContactConfig {
  facebook?: string;
  telegram?: string;
  zalo?: string;
  hotline?: string;
  supportText?: string;
}

interface BrandConfig {
  logoUrl?: string;
  brandName?: string;
  brandTag?: string;
  siteTitle?: string;
  subtitle?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  brandNameColor?: string;
  heroTitleColor?: string;
  heroSubtitleColor?: string;
  accentColor?: string;
}

interface FaqItem {
  q: string;
  a: string;
}

interface NoticeConfig {
  enabled?: boolean;
  title?: string;
  content?: string;
  button1Text?: string;
  button1Url?: string;
  button2Text?: string;
  button2Url?: string;
  badge?: string;
}

// Helper: Chuyển đổi mã HTML nhiều dòng thành văn bản thuần 1 dòng mượt mà cho thanh chạy
function stripHtmlToPlainText(htmlOrText: string): string {
  if (!htmlOrText) return '';
  return htmlOrText
    .replace(/<br\s*[\/]?>/gi, ' • ')
    .replace(/<\/(p|h1|h2|h3|h4|li|div)>/gi, ' • ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .replace(/(•\s*){2,}/g, '• ')
    .replace(/^•\s*|\s*•$/g, '')
    .trim();
}

interface PublicConfig {
  brand?: BrandConfig;
  faqs?: FaqItem[];
  notice?: NoticeConfig;
  packages?: {
    '1year'?: PackageDetail;
    'lifetime'?: PackageDetail;
  };
  contact?: ContactConfig;
  prices: {
    '1year': number;
    'lifetime': number;
  };
  bank: {
    bankBrand: string;
    accountNo: string;
    accountName: string;
  };
  maintenance?: {
    enabled: boolean;
    message: string;
    contactUrl: string;
  };
}

interface ActiveOrder {
  orderId: string;
  username: string;
  uid: string;
  packageId: '1year' | 'lifetime';
  amount: number;
  memo: string;
  vietQrUrl: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  expiresAt: string;
  bank: {
    bankBrand: string;
    accountNo: string;
    accountName: string;
  };
}

export const CustomerCheckoutPage: React.FC = () => {

  const [config, setConfig] = useState<PublicConfig>({
    packages: {
      '1year': {
        name: 'Locket Gold Pro',
        price: 79000,
        subtitle: 'Up Locket Gold bằng Username Locket',
        features: [
          'Mở khóa Locket Gold độc quyền 👑',
          'Không quảng cáo phiền toái',
          'Upload ảnh không giới hạn từ thư viện',
          'Quay video Lockets 15s HD 1080p',
          'Xem ai đã xem Lockets của bạn',
          'Thay đổi icon Locket độc quyền',
          'Mở khóa giới hạn số lượng bạn bè',
          'Kích hoạt tự động ngay sau thanh toán'
        ]
      },
      'lifetime': {
        name: 'Locket Gold Premium',
        price: 399000,
        subtitle: 'Up Locket Gold bằng Username Locket trọn đời',
        badge: 'KHUYÊN DÙNG',
        features: [
          'Trọn đời tất cả tính năng Locket Gold 👑',
          'Không quảng cáo phiền toái mãi mãi',
          'Upload ảnh không giới hạn từ thư viện',
          'Quay video Lockets 15s HD 1080p',
          'Xem ai đã xem Lockets của bạn',
          'Thay đổi icon Locket độc quyền',
          'Mở khóa không giới hạn bạn bè',
          'Cập nhật tính năng mới miễn phí trọn đời',
          'Bảo hành vĩnh viễn 100% (1 đổi 1)'
        ]
      }
    },
    contact: {
      facebook: 'https://www.facebook.com/vnkin.06',
      telegram: 'https://t.me/vnkien26',
      zalo: '0987654321',
      hotline: '0987.654.321',
      supportText: 'Cần hỗ trợ thanh toán hoặc kích hoạt? Liên hệ Admin ngay 24/7!'
    },
    prices: { '1year': 79000, 'lifetime': 399000 },
    bank: { bankBrand: 'ACB', accountNo: '21456181', accountName: 'NGUYEN VAN KIEN' },
    notice: {
      enabled: true,
      title: '📢 Thông Báo Hệ Thống',
      content: 'Chào mừng bạn đến với hệ thống Nâng Cấp Locket Gold Tự Động 24/7!\n\n• Kích hoạt siêu tốc trong 0.5s chỉ bằng Username.\n• Bảo hành 1 đổi 1 suốt thời gian sử dụng.\n• Không cần tài khoản iCloud hay mật khẩu.',
      button1Text: 'Nhóm Thông Báo & Hỗ Trợ',
      button1Url: ''
    }
  });

  // Step 1: Input & Realtime Verification (Same mechanism as CTV Portal)
  const [userInput, setUserInput] = useState('');
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [liveUser, setLiveUser] = useState<LocketUserInfo | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  // Step 2: Package Selection
  const [selectedPackage, setSelectedPackage] = useState<'1year' | 'lifetime'>('1year');

  // Step 3: Payment
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<ActiveOrder | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 mins in seconds

  // Step 4: Success Celebration
  const [isSuccess, setIsSuccess] = useState(false);

  // FAQ open state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Contact Modal State
  const [showContactModal, setShowContactModal] = useState(false);

  // Logo Image Error Fallback State
  const [logoImgError, setLogoImgError] = useState(false);

  // Config loading state (true initially so we wait for server config before rendering)
  const [isConfigLoading, setIsConfigLoading] = useState(true);

  // Popup Announcement Notice Modal State (opened only if enabled in server config)
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [inlineNoticeClosed, setInlineNoticeClosed] = useState(false);

  // 5s Clock Ticker Channel Carousel Index
  const [activeChannelIdx, setActiveChannelIdx] = useState(0);

  const contactInfo = config.contact || {};
  const supportChannels = React.useMemo(() => {
    const list = [];
    if (contactInfo.facebook) {
      list.push({
        id: 'facebook',
        name: 'Facebook Messenger',
        tagline: 'Nhắn tin Admin 24/7',
        icon: 'f',
        isTextIcon: true,
        color: 'bg-blue-600',
        textColor: 'text-blue-400',
        link: contactInfo.facebook
      });
    }
    if (contactInfo.telegram) {
      list.push({
        id: 'telegram',
        name: 'Telegram Support',
        tagline: 'Phản hồi siêu tốc qua Telegram',
        icon: Send,
        isTextIcon: false,
        color: 'bg-sky-500',
        textColor: 'text-sky-400',
        link: contactInfo.telegram
      });
    }
    if (contactInfo.zalo || contactInfo.hotline) {
      const num = contactInfo.zalo || contactInfo.hotline;
      list.push({
        id: 'zalo',
        name: `Zalo / Hotline: ${num}`,
        tagline: 'Tư vấn & Hỗ trợ kỹ thuật',
        icon: Phone,
        isTextIcon: false,
        color: 'bg-emerald-600',
        textColor: 'text-emerald-400',
        link: `https://zalo.me/${num}`
      });
    }
    if (list.length === 0) {
      list.push({
        id: 'default',
        name: 'Hỗ Trợ Admin 24/7',
        tagline: 'Sẵn sàng trợ giúp',
        icon: MessageCircle,
        isTextIcon: false,
        color: 'bg-indigo-600',
        textColor: 'text-indigo-400',
        link: '#'
      });
    }
    return list;
  }, [contactInfo]);

  // 5-second vertical clock ticker interval
  useEffect(() => {
    if (supportChannels.length <= 1) return;
    const interval = setInterval(() => {
      setActiveChannelIdx(prev => (prev + 1) % supportChannels.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [supportChannels]);

  // 1. Fetch Config from Admin
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    fetch('/api/public/config', { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!isMounted) return;
        if (data) {
          setConfig(prev => ({
            ...prev,
            ...data,
            brand: data.brand || prev.brand,
            packages: data.packages || prev.packages,
            contact: data.contact || prev.contact,
            prices: data.prices || prev.prices,
            bank: data.bank || prev.bank,
            notice: data.notice || prev.notice,
            maintenance: data.maintenance || prev.maintenance
          }));

          // Only open modal if enabled and contains notice text
          if (data.notice?.enabled !== false && (data.notice?.title || data.notice?.content)) {
            setShowNoticeModal(true);
          }
        }
      })
      .catch((err) => {
        console.warn('Config fetch fallback:', err);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (isMounted) {
          setIsConfigLoading(false);
          const dismiss = (window as any).dismissAppPreloader;
          if (typeof dismiss === 'function') dismiss();
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  // Update browser tab title & favicon icon from admin brand config & reset logo error state
  useEffect(() => {
    if (config.brand?.siteTitle) {
      document.title = config.brand.siteTitle;
    }
    const targetFavicon = config.brand?.logoUrl && config.brand.logoUrl.trim() ? config.brand.logoUrl.trim() : '/favicon.svg';
    const links = document.querySelectorAll("link[rel*='icon']");
    if (links.length > 0) {
      const firstLink = links[0] as HTMLLinkElement;
      firstLink.removeAttribute('type');
      firstLink.rel = 'icon';
      firstLink.href = targetFavicon;
      for (let i = 1; i < links.length; i++) {
        links[i].remove();
      }
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = targetFavicon;
      document.head.appendChild(link);
    }
    setLogoImgError(false);
  }, [config.brand]);

  // 2. Real-time automatic username identification (debounced like CTV portal)
  useEffect(() => {
    const clean = extractLocketUsername(userInput);
    if (!clean || clean.length < 2) {
      setLiveUser(null);
      setIsSearchingUser(false);
      setUserError(null);
      return;
    }

    setIsSearchingUser(true);
    setUserError(null);

    const timer = setTimeout(async () => {
      try {
        const info = await getLocketUserInfo(clean);
        setLiveUser(info);
        if (info.valid === false) {
          setUserError(info.error || 'Tài khoản không tồn tại trên Locket.');
        } else {
          setUserError(null);
        }
      } catch (err: any) {
        setUserError(err.message || 'Lỗi khi kiểm tra tài khoản');
      } finally {
        setIsSearchingUser(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [userInput]);

  // Explicit check handler for button submit
  const handleCheckUserManual = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = extractLocketUsername(userInput);
    if (!clean) {
      setUserError('Vui lòng nhập Username hoặc Link Locket hợp lệ (VD: vanle)');
      return;
    }

    setIsSearchingUser(true);
    setUserError(null);

    try {
      const info = await getLocketUserInfo(clean);
      setLiveUser(info);
      if (info.valid === false) {
        setUserError(info.error || 'Tài khoản không tồn tại trên Locket.');
      }
    } catch (err: any) {
      setUserError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsSearchingUser(false);
    }
  };

  // 3. Countdown Timer for Active Order
  useEffect(() => {
    if (!currentOrder || isSuccess) return;
    const timer = setInterval(() => {
      const expiresMs = new Date(currentOrder.expiresAt).getTime();
      const remainingSec = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setTimeLeft(remainingSec);
      if (remainingSec <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentOrder, isSuccess]);

  // 4. Real-time Order Polling & SSE Real-time Listener (0.5s reaction)
  useEffect(() => {
    if (!currentOrder || isSuccess) return;

    let isDone = false;

    // A. Fast polling every 1200ms with cache-busting
    const interval = setInterval(async () => {
      if (isDone) return;
      try {
        const orderKey = currentOrder.orderId || currentOrder.uid || currentOrder.memo;
        const res = await fetch(`/api/orders/${encodeURIComponent(orderKey)}?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.order && (data.order.status === 'COMPLETED' || data.order.activated)) {
            isDone = true;
            triggerSuccess();
          }
        }
      } catch (_e) {}
    }, 1200);

    // B. Real-Time Server-Sent Events (SSE) stream
    let sse: EventSource | null = null;
    try {
      const streamKey = currentOrder.uid || currentOrder.username || currentOrder.orderId;
      sse = new EventSource(`/api/events/${encodeURIComponent(streamKey)}`);
      sse.onmessage = (e) => {
        if (isDone) return;
        try {
          const payload = JSON.parse(e.data);
          if (payload.status === 'COMPLETED' || payload.activated === true) {
            isDone = true;
            triggerSuccess();
          }
        } catch (_err) {}
      };
    } catch (_e) {}

    return () => {
      clearInterval(interval);
      if (sse) sse.close();
    };
  }, [currentOrder, isSuccess]);

  const triggerSuccess = () => {
    setIsSuccess(true);
    try {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 100,
          angle: 60,
          spread: 70,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 100,
          angle: 120,
          spread: 70,
          origin: { x: 1 }
        });
      }, 400);
    } catch (_e) {}
  };

  // Handler: Proceed to Payment & Create Order
  const handleCreateOrder = async () => {
    if (!liveUser || !liveUser.valid) {
      alert('Vui lòng nhập tài khoản Locket hợp lệ trước!');
      return;
    }

    const isUserGold = Boolean(liveUser.hasGold || liveUser.hasActiveGold || liveUser.alreadyGold);
    if (isUserGold) {
      alert(`Tài khoản @${liveUser.username} đã có Locket Gold rồi! Không cần nâng cấp thêm.`);
      return;
    }

    setIsCreatingOrder(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: liveUser.username,
          uid: liveUser.uid || liveUser.username,
          packageId: selectedPackage
        })
      });
      const data = await res.json();

      if (res.ok && data.success && data.order) {
        setCurrentOrder(data.order);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert(data.error || 'Không thể tạo đơn hàng. Vui lòng thử lại!');
      }
    } catch (err: any) {
      alert('Lỗi tạo đơn hàng: ' + err.message);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (_e) {}
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const pkg1y = config.packages?.['1year'] || {
    name: 'Locket Gold Pro',
    price: config.prices['1year'] || 79000,
    subtitle: 'Up Locket Gold bằng Username Locket',
    features: [
      'Mở khóa Locket Gold độc quyền 👑',
      'Không quảng cáo phiền toái',
      'Upload ảnh không giới hạn từ thư viện',
      'Quay video Lockets 15s HD 1080p',
      'Xem ai đã xem Lockets của bạn',
      'Thay đổi icon Locket độc quyền',
      'Mở khóa giới hạn số lượng bạn bè',
      'Kích hoạt tự động ngay sau thanh toán'
    ]
  };

  const pkgLt = config.packages?.['lifetime'] || {
    name: 'Locket Gold Premium',
    price: config.prices['lifetime'] || 399000,
    subtitle: 'Up Locket Gold bằng Username Locket trọn đời',
    badge: 'KHUYÊN DÙNG',
    features: [
      'Trọn đời tất cả tính năng Locket Gold 👑',
      'Không quảng cáo phiền toái mãi mãi',
      'Upload ảnh không giới hạn từ thư viện',
      'Quay video Lockets 15s HD 1080p',
      'Xem ai đã xem Lockets của bạn',
      'Thay đổi icon Locket độc quyền',
      'Mở khóa không giới hạn bạn bè',
      'Cập nhật tính năng mới miễn phí trọn đời',
      'Bảo hành vĩnh viễn 100% (1 đổi 1)'
    ]
  };

  const contact = config.contact || {
    facebook: 'https://www.facebook.com/vnkin.06',
    telegram: 'https://t.me/vnkien26',
    zalo: '0987654321',
    hotline: '0987.654.321',
    supportText: 'Cần hỗ trợ thanh toán hoặc kích hoạt? Liên hệ Admin ngay 24/7!'
  };

  const price1Year = Number(pkg1y.price) || 79000;
  const priceLifetime = Number(pkgLt.price) || 399000;
  const isUserGold = Boolean(liveUser && (liveUser.hasGold || liveUser.hasActiveGold || liveUser.alreadyGold));

  // ── LOADING STATE: Show polished gold loader while fetching remote config ──
  if (isConfigLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex flex-col items-center justify-center p-4 text-white">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 mb-4 relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
            <Crown className="w-12 h-12 text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-pulse" />
          </div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-2 font-baloo">
            {config.brand?.brandName || 'Locket Gold'}
          </h2>
          <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-400">
            <div className="w-4 h-4 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
            <span>Đang tải cấu hình hệ thống...</span>
          </div>
        </div>
      </div>
    );
  }

  // ── MAINTENANCE STATE: Dedicated maintenance screen if enabled by admin ──
  if (config.maintenance?.enabled) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#161B28] rounded-3xl border border-amber-500/30 p-6 sm:p-8 text-center text-white shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-amber-400 mb-2 font-baloo">
            Hệ Thống Đang Bảo Trì
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-6 font-medium whitespace-pre-line">
            {config.maintenance.message || 'Hệ thống đang tiến hành nâng cấp & bảo trì định kỳ. Quý khách vui lòng quay lại sau ít phút!'}
          </p>
          {config.maintenance.contactUrl ? (
            <a
              href={config.maintenance.contactUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 font-black text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <span>Liên Hệ Hỗ Trợ</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3.5 px-6 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-500/30 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tải Lại Trang</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] text-gray-100 transition-colors duration-300 font-sans antialiased">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[850px] h-[550px] bg-gradient-to-tr from-amber-500/15 via-yellow-400/10 to-purple-600/15 blur-[140px] rounded-full animate-pulse-glow" />
      </div>

      {/* ── HEADER NAVBAR ── */}
      <header className="relative z-20 border-b border-slate-200/80 dark:border-white/[0.08] backdrop-blur-xl bg-white/75 dark:bg-[#0B0F17]/75 sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-3 group">
            {config.brand?.logoUrl && !logoImgError ? (
              <img
                src={config.brand.logoUrl}
                alt="Brand Logo"
                className="w-10 h-10 object-contain rounded-2xl shadow-md group-hover:scale-105 transition-transform"
                onError={() => setLogoImgError(true)}
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/25 group-hover:scale-105 transition-transform">
                <Crown className="w-5 h-5 fill-current" />
              </div>
            )}
            <div>
              <div className="font-extrabold text-base flex items-center gap-1.5 font-baloo">
                <span style={config.brand?.brandNameColor ? { color: config.brand.brandNameColor } : undefined} className="text-slate-900 dark:text-white">
                  {config.brand?.brandName || 'Locket Gold'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase">
                  {config.brand?.brandTag || 'PREMIUM'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {config.brand?.subtitle || 'Kích hoạt tự động 24/7'}
              </p>
            </div>
          </a>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowContactModal(true)}
              className="px-3.5 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <MessageCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>Hỗ Trợ 24/7</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">

        {/* ── CASE 1: CELEBRATION MODAL (PAYMENT SUCCESS) ── */}
        <AnimatePresence>
          {isSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-6 sm:p-10 rounded-3xl border-2 border-emerald-500/50 shadow-2xl text-center space-y-6 bg-white dark:bg-[#121622]"
            >
              <div className="relative inline-block">
                <img
                  src={liveUser?.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=vanle'}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full mx-auto border-4 border-amber-400 shadow-xl object-cover"
                />
                <div className="absolute -bottom-2 right-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
                  ✓
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-sans">
                  🎉 KÍCH HOẠT LOCKET GOLD THÀNH CÔNG!
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Tài khoản <strong className="text-indigo-600 dark:text-indigo-400 font-bold">@{liveUser?.username}</strong> của bạn đã được nâng cấp lên gói{' '}
                  <strong className="text-amber-500 font-bold">
                    {currentOrder?.packageId === 'lifetime' ? pkgLt.name : pkg1y.name}
                  </strong>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 font-medium space-y-1 text-left">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Hướng Dẫn Bật Tính Năng Trên Điện Thoại:
                </div>
                <p>1. Mở app <strong>Locket</strong> trên điện thoại ➔ Vào phần Cài Đặt (Profile).</p>
                <p>2. Kéo xuống chọn <strong>Khôi phục giao dịch mua (Restore Purchases)</strong>.</p>
                <p>3. Tận hưởng trọn bộ tính năng Gold độc quyền ngay lập tức!</p>
              </div>

              <button
                onClick={() => {
                  setCurrentOrder(null);
                  setLiveUser(null);
                  setUserInput('');
                  setIsSuccess(false);
                }}
                className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer active:scale-[0.98]"
              >
                🔄 Nâng Cấp Thêm Tài Khoản Khác
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CASE 2: PAYMENT VIETQR SCREEN ── */}
        {!isSuccess && currentOrder && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentOrder(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                ← Quay lại chọn gói
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-xs font-extrabold">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                <span>Hết hạn sau: {formatTimer(timeLeft)}</span>
              </div>
            </div>

            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl bg-white dark:bg-[#121622] space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-2 font-baloo">
                  <span>📱 Quét Mã QR Thanh Toán Tự Động</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hệ thống tự động phát hiện và kích hoạt Gold trong <strong>0.5 giây</strong> sau khi chuyển khoản
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="text-center space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10">
                  <img
                    src={currentOrder.vietQrUrl}
                    alt="VietQR Code"
                    className="w-full max-w-[260px] mx-auto rounded-xl shadow-md border border-slate-200 dark:border-white/10"
                  />
                  <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Đang chờ chuyển khoản...</span>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase">Ngân Hàng</div>
                      <div className="font-black text-sm text-indigo-600 dark:text-indigo-400">{currentOrder.bank.bankBrand}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase">Số Tài Khoản</div>
                      <div className="font-mono font-black text-base text-slate-900 dark:text-white">{currentOrder.bank.accountNo}</div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(currentOrder.bank.accountNo, 'acc')}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'acc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'acc' ? 'Đã copy' : 'Sao chép'}</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase">Chủ Tài Khoản</div>
                      <div className="font-bold text-slate-900 dark:text-white uppercase">{currentOrder.bank.accountName}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase">Số Tiền Cần Chuyển</div>
                      <div className="font-mono font-black text-lg text-emerald-600 dark:text-emerald-400">
                        {currentOrder.amount.toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(String(currentOrder.amount), 'amt')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'amt' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'amt' ? 'Đã copy' : 'Sao chép'}</span>
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Nội Dung Chuyển Khoản (Bắt buộc)
                      </div>
                      <div className="font-mono font-black text-base text-amber-600 dark:text-amber-400 select-all">
                        {currentOrder.memo}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(currentOrder.memo, 'memo')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-black text-xs transition-all flex items-center gap-1 shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      {copiedField === 'memo' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'memo' ? 'Đã copy' : 'Copy Mã'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>Đang lắng nghe SePay Webhook tự động...</span>
                </div>
                <span className="font-mono font-bold">Mã đơn: #{currentOrder.orderId.slice(-6)}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── CASE 3: HERO & STEP 1 & STEP 2 (CHECKOUT FORM) ── */}
        {!isSuccess && !currentOrder && (
          <div className="space-y-10">
            {/* Hero Header */}
            <div className="text-center space-y-3 pt-2">
              <h1 style={config.brand?.heroTitleColor ? { color: config.brand.heroTitleColor } : undefined} className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-[-0.025em] max-w-2xl mx-auto font-sans leading-tight">
                {config.brand?.heroTitle ? (
                  config.brand.heroTitle
                ) : (
                  <>Nâng cấp <span style={config.brand?.accentColor ? { color: config.brand.accentColor } : undefined} className="gold-metallic-text">Locket Gold</span> tự động 24/7</>
                )}
              </h1>
              <p style={config.brand?.heroSubtitleColor ? { color: config.brand.heroSubtitleColor } : undefined} className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto leading-relaxed font-medium">
                {config.brand?.heroSubtitle || 'Kích hoạt siêu tốc trong 0.5 giây chỉ bằng Username, bảo hành 1 đổi 1 suốt thời gian sử dụng.'}
              </p>
            </div>

            {/* Step 1: Input Locket Username */}
            <div className="glass-card p-6 sm:p-7 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm bg-white dark:bg-[#121622] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center text-xs font-bold">1</span>
                  <span>Nhập Tài Khoản Locket Cần Nâng Cấp</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">Tự động nhận diện live 0.3s</span>
              </div>

              <form onSubmit={handleCheckUserManual} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                    <input
                      type="text"
                      value={userInput}
                      onChange={e => setUserInput(extractLocketUsername(e.target.value))}
                      placeholder="Username hoặc link Locket (VD: vanle)"
                      required
                      className="w-full pl-8 pr-4 py-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm font-bold focus:border-amber-500 focus:outline-none transition-all font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingUser || !userInput.trim()}
                    className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-amber-950 font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-[0.98]"
                  >
                    {isSearchingUser ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> <span>Đang tìm...</span></>
                    ) : (
                      <><Search className="w-4 h-4" /> <span>Kiểm Tra Tài Khoản</span></>
                    )}
                  </button>
                </div>

                {userError && (
                  <p className="text-xs text-rose-500 font-bold flex items-center gap-1 pt-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {userError}
                  </p>
                )}
              </form>

              {/* Profile Preview Card with Live Indicator */}
              <AnimatePresence>
                {liveUser && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`p-4 rounded-2xl border transition-all ${
                      liveUser.valid === false
                        ? 'bg-rose-500/10 border-rose-500/20'
                        : isUserGold
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-slate-50 dark:bg-black/30 border-slate-200/80 dark:border-white/5'
                    } flex items-center justify-between gap-4 mt-3`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        {liveUser.avatar ? (
                          <img
                            src={liveUser.avatar}
                            alt="Avatar"
                            className="w-12 h-12 rounded-full object-cover border-2 border-amber-500/40 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-amber-950 font-bold flex items-center justify-center text-base shadow-sm">
                            {liveUser.username.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {isUserGold && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] shadow-sm">
                            👑
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                          <span>{liveUser.displayName || liveUser.username}</span>
                          {liveUser.valid === false ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Không Tồn Tại
                            </span>
                          ) : isUserGold ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-500 fill-amber-500" /> Đã Có Gold {liveUser.daysLeft ? `(${liveUser.daysLeft} ngày)` : liveUser.isLifetime ? '(Vĩnh viễn)' : ''}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Hợp Lệ (Chưa có Gold)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">@{liveUser.username}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      {isUserGold ? (
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 justify-end">
                          <Crown className="w-4 h-4 fill-current" /> Đã Kích Hoạt
                        </span>
                      ) : liveUser.valid !== false ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                          <CheckCircle2 className="w-4 h-4" /> Sẵn sàng kích hoạt
                        </span>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Inline Announcement Notice Bar with Continuous Running Marquee */}
            {config.notice?.enabled !== false && !inlineNoticeClosed && (config.notice?.content || config.notice?.title) && (() => {
              const plainNoticeText = stripHtmlToPlainText(config.notice?.content || config.notice?.title || '');
              return (
                <div className="relative overflow-hidden p-3 px-4 rounded-2xl bg-[#161B28]/95 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between gap-3 shadow-lg shadow-amber-500/5 backdrop-blur-md">
                  <div className="flex items-center gap-2.5 overflow-hidden flex-1 relative min-w-0">
                    <span className="text-base flex-shrink-0 z-10 bg-[#161B28] pr-1.5 drop-shadow-sm select-none">📢</span>
                    
                    {/* Marquee Running Ticker Container */}
                    <div 
                      className="overflow-hidden whitespace-nowrap flex-1 flex select-none cursor-pointer group" 
                      onClick={() => setShowNoticeModal(true)} 
                      title="Bấm để xem đầy đủ nội dung thông báo"
                    >
                      <div className="animate-marquee flex items-center gap-10 text-slate-200 font-semibold text-xs tracking-wide group-hover:text-amber-300 transition-colors">
                        <span>{plainNoticeText}</span>
                        <span className="text-amber-400 font-black">✨</span>
                        <span>{plainNoticeText}</span>
                        <span className="text-amber-400 font-black">✨</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 z-10 bg-[#161B28] pl-2">
                    <button
                      type="button"
                      onClick={() => setShowNoticeModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[11px] whitespace-nowrap transition-all cursor-pointer"
                    >
                      Xem chi tiết
                    </button>
                    {config.notice?.button1Text && (
                      <a
                        href={config.notice.button1Url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-extrabold text-[11px] whitespace-nowrap shadow-sm transition-all"
                      >
                        {config.notice.button1Text}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setInlineNoticeClosed(true)}
                      className="p-1 rounded-lg bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Tắt thông báo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Step 2: Choose Gold Package */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center text-xs font-bold">2</span>
                  <span>Chọn Gói Locket Gold</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Card 1: 1 Year (Pro) */}
                <div
                  onClick={() => !isUserGold && setSelectedPackage('1year')}
                  className={`relative p-6 rounded-2xl border transition-all space-y-4 bg-white dark:bg-[#121622] ${
                    isUserGold
                      ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-white/5'
                      : selectedPackage === '1year'
                      ? 'border-amber-500 shadow-md shadow-amber-500/10 cursor-pointer'
                      : 'border-slate-200/80 dark:border-white/10 hover:border-amber-500/40 cursor-pointer'
                  }`}
                >
                  <div className="text-center pb-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mb-2">
                      <Star className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500" />
                      <span>GÓI TIẾT KIỆM</span>
                    </div>
                    <h4 className="text-xl font-bold uppercase gold-metallic-text font-sans">{pkg1y.name}</h4>
                    {pkg1y.subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{pkg1y.subtitle}</p>}
                    <div className="mt-3">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                        {price1Year.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-rose-500 tracking-wider uppercase mt-1">Hạn 1 năm (365 Ngày)</p>
                  </div>

                  <div className="border-t border-slate-200/60 dark:border-white/5 pt-3">
                    <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-2.5">
                      {(pkg1y.features || []).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat.replace(/👑/g, '')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={isUserGold}
                    className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                      isUserGold
                        ? 'bg-slate-200 dark:bg-white/10 text-slate-400 cursor-not-allowed'
                        : selectedPackage === '1year'
                        ? 'bg-amber-400 text-amber-950 font-bold shadow-amber-500/20'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>{selectedPackage === '1year' && !isUserGold ? 'Đang chọn gói này' : 'Chọn gói 1 Năm'}</span>
                  </button>
                </div>

                {/* Card 2: Lifetime (Premium) */}
                <div
                  onClick={() => !isUserGold && setSelectedPackage('lifetime')}
                  className={`relative p-6 rounded-2xl border transition-all space-y-4 bg-white dark:bg-[#121622] ${
                    isUserGold
                      ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-white/5'
                      : selectedPackage === 'lifetime'
                      ? 'border-amber-500 ring-2 ring-amber-500/50 shadow-md shadow-amber-500/10 cursor-pointer'
                      : 'border-slate-200/80 dark:border-white/10 hover:border-amber-500/40 cursor-pointer'
                  }`}
                >
                  <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 shadow-sm">
                    {pkgLt.badge || 'KHUYÊN DÙNG'}
                  </div>

                  <div className="text-center pb-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
                      <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>GÓI TRỌN ĐỜI</span>
                    </div>
                    <h4 className="text-xl font-bold uppercase gold-metallic-text font-baloo">{pkgLt.name}</h4>
                    {pkgLt.subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{pkgLt.subtitle}</p>}
                    <div className="mt-3">
                      <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                        {priceLifetime.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <p className="text-[10px] font-extrabold text-amber-500 tracking-wider uppercase mt-1">Vĩnh viễn (Trọn đời)</p>
                  </div>

                  <div className="border-t border-slate-200/60 dark:border-white/5 pt-3">
                    <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-2.5">
                      {(pkgLt.features || []).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={isUserGold}
                    className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                      isUserGold
                        ? 'bg-slate-200 dark:bg-white/10 text-slate-400 cursor-not-allowed'
                        : selectedPackage === 'lifetime'
                        ? 'bg-amber-400 text-amber-950 font-bold shadow-amber-500/20'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5 fill-current" />
                    <span>{selectedPackage === 'lifetime' && !isUserGold ? 'Đang chọn gói này' : 'Chọn gói Vĩnh Viễn'}</span>
                  </button>
                </div>
              </div>

              {/* Main Checkout Trigger Button or Already Gold Notice */}
              <div className="pt-3">
                {isUserGold ? (
                  <div className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-2.5 text-center">
                    <div className="font-black text-base flex items-center justify-center gap-2">
                      <Crown className="w-5 h-5 fill-current text-amber-500" />
                      <span>Tài Khoản @{liveUser?.username} Đã Có Locket Gold Rồi!</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Tài khoản này đã được kích hoạt Gold bản quyền trước đó ({liveUser?.daysLeft ? `còn ${liveUser.daysLeft} ngày` : liveUser?.goldExpiryDate || 'Vĩnh viễn'}). Bạn không cần phải thanh toán thêm! Hãy mở ứng dụng Locket trên điện thoại ➔ Cài đặt ➔ chọn <strong>Khôi phục giao dịch mua (Restore Purchases)</strong> để sử dụng ngay.
                    </p>
                    <button
                      type="button"
                      disabled
                      className="w-full py-4 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs cursor-not-allowed border border-amber-500/30 select-none flex items-center justify-center gap-2"
                    >
                      <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span>TÀI KHOẢN ĐÃ CÓ GOLD (KHÔNG CẦN THANH TOÁN THÊM)</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateOrder}
                    disabled={isCreatingOrder || !liveUser || !liveUser.valid}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:scale-[1.005] active:scale-[0.995] disabled:opacity-50 text-slate-900 font-extrabold text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
                  >
                    {isCreatingOrder ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Đang tạo mã VietQR...</>
                    ) : (
                      <>
                        <span>Tiến Hành Thanh Toán ({selectedPackage === 'lifetime' ? priceLifetime.toLocaleString('vi-VN') : price1Year.toLocaleString('vi-VN')} đ)</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#121622] border border-slate-200/80 dark:border-white/5 space-y-2 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-base">
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">Kích Hoạt Siêu Tốc 0.5s</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">Hệ thống SePay quét tiền và kích hoạt tức thì sau khi chuyển khoản</p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#121622] border border-slate-200/80 dark:border-white/5 space-y-2 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-base">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">Bảo Hành 100% Trọn Đời</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">Bảo hành 1 đổi 1 và hỗ trợ kỹ thuật suốt thời gian sử dụng</p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#121622] border border-slate-200/80 dark:border-white/5 space-y-2 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-base">
                  <Lock className="w-4 h-4 text-emerald-500" />
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">Không Cần Mật Khẩu / iCloud</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">Chỉ cần username Locket, an toàn tuyệt đối 100% cho tài khoản</p>
              </div>
            </div>

            {/* ── FAQ Section (Inspired by mẫu) ── */}
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121622] space-y-5 shadow-sm">
              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white font-baloo">Câu hỏi thường gặp (FAQ)</h3>
                <p className="text-xs text-slate-400">Giải đáp mọi thắc mắc của bạn về việc nâng cấp Locket Gold</p>
              </div>

              <div className="space-y-3 text-xs">
                {(config.faqs && config.faqs.length > 0 ? config.faqs : [
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
                ]).map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200/80 dark:border-white/5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between font-extrabold text-slate-800 dark:text-slate-200">
                      <span>{item.q}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${openFaq === idx ? 'rotate-180 text-amber-500' : 'text-slate-400'}`} />
                    </div>
                    {openFaq === idx && (
                      <p className="mt-2.5 text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200/60 dark:border-white/5 pt-2">
                        {item.a}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>



      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-slate-200/80 dark:border-white/[0.08] mt-16 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>© 2026 LOCKET GOLD ENTERPRISE — All rights reserved.</p>
      </footer>

      {/* ── POPUP ANNOUNCEMENT NOTICE MODAL ── */}
      <AnimatePresence>
        {showNoticeModal && config.notice?.enabled !== false && (config.notice?.content || config.notice?.title) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setShowNoticeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#161B28] text-white rounded-3xl border border-amber-500/30 shadow-2xl shadow-amber-500/10 overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Megaphone className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="font-extrabold text-base text-white font-baloo tracking-wide">
                    {config.notice?.title || '📢 Thông Báo Hệ Thống'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowNoticeModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                <div 
                  className="notice-modal-html leading-relaxed font-medium break-words space-y-2"
                  dangerouslySetInnerHTML={{
                    __html: (() => {
                      const raw = config.notice?.content || 'Chào mừng bạn đến với hệ thống Nâng Cấp Locket Gold Tự Động 24/7!\n\n• Kích hoạt siêu tốc trong 0.5s chỉ bằng Username.\n• Bảo hành 1 đổi 1 suốt thời gian sử dụng.\n• Không cần tài khoản iCloud hay mật khẩu.';
                      const hasHtml = /<[a-z][\s\S]*>/i.test(raw);
                      return hasHtml ? raw : raw.replace(/\n/g, '<br />');
                    })()
                  }}
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="p-4 sm:p-5 border-t border-white/10 bg-black/30 space-y-2.5">
                {/* CTA Action Buttons if present */}
                {(config.notice?.button1Text || config.notice?.button2Text) && (
                  <div className="flex items-center gap-2.5">
                    {config.notice?.button1Text && (
                      <a
                        href={config.notice.button1Url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black text-xs text-center shadow-lg shadow-rose-500/25 transition-all"
                      >
                        {config.notice.button1Text}
                      </a>
                    )}
                    {config.notice?.button2Text && (
                      <a
                        href={config.notice.button2Url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-3 px-3 rounded-xl bg-white/10 border border-white/15 hover:bg-white/20 text-white font-bold text-xs text-center transition-all"
                      >
                        {config.notice.button2Text}
                      </a>
                    )}
                  </div>
                )}

                {/* Close Button */}
                <button
                  onClick={() => setShowNoticeModal(false)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-black text-xs text-center shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  Đã Hiểu / Đóng Thông Báo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── FLOATING SUPPORT BUTTON ── */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowContactModal(true)}
        className="fixed bottom-5 right-5 z-[9999] px-4 py-3 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-black text-xs shadow-xl shadow-amber-500/30 flex items-center gap-2 border border-amber-300/40 cursor-pointer"
      >
        <MessageCircle className="w-4 h-4 text-amber-950 fill-current" />
        <span>Hỗ Trợ 24/7</span>
      </motion.button>

      {/* ── CONTACT SUPPORT MODAL ── */}
      <AnimatePresence>
        {showContactModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setShowContactModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-[#161B28] text-white rounded-3xl border border-amber-500/30 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <MessageCircle className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="font-extrabold text-base text-white font-baloo">💬 Liên Hệ Hỗ Trợ 24/7</h3>
                </div>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <p className="text-slate-300 leading-relaxed font-medium">
                  {contact.supportText || 'Cần hỗ trợ thanh toán hoặc thắc mắc về Locket Gold? Liên hệ Admin ngay 24/7!'}
                </p>

                <div className="grid grid-cols-1 gap-2.5 pt-1">
                  {contact.facebook && (
                    <a
                      href={contact.facebook}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3.5 rounded-2xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Share2 className="w-4 h-4 text-blue-400" />
                        <span>Facebook Admin Support</span>
                      </div>
                      <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                  )}

                  {contact.telegram && (
                    <a
                      href={contact.telegram.startsWith('http') ? contact.telegram : `https://t.me/${contact.telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3.5 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-400 font-bold flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Send className="w-4 h-4 text-sky-400" />
                        <span>Telegram Live Chat 24/7</span>
                      </div>
                      <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                  )}

                  {contact.zalo && (
                    <a
                      href={contact.zalo.startsWith('http') ? contact.zalo : `https://zalo.me/${contact.zalo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3.5 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-400 font-bold flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-cyan-400" />
                        <span>Zalo Hỗ Trợ Gấp ({contact.zalo})</span>
                      </div>
                      <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                  )}

                  {contact.hotline && (
                    <a
                      href={`tel:${contact.hotline.replace(/[^0-9]/g, '')}`}
                      className="p-3.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 font-bold flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-amber-400" />
                        <span>Hotline: {contact.hotline}</span>
                      </div>
                      <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-white/10 bg-black/30 text-center">
                <button
                  onClick={() => setShowContactModal(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
                >
                  Đóng Hỗ Trợ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
