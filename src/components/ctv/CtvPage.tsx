import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Lock, LogOut, QrCode, CheckCircle2, AlertCircle,
  Crown, History, Key, PlusCircle, Copy, Clipboard, Bell,
  ArrowRight, RefreshCw, AlertTriangle, ShieldCheck, X,
  Search, User, Wallet, Sparkles, ExternalLink, Check, Zap,
  Trophy, Package, Trash2, ChevronRight
} from 'lucide-react';
import { getLocketUserInfo, extractLocketUsername, type LocketUserInfo } from '../../services/locketService';
import { ThemeToggle } from '../ui/ThemeToggle';
import { CtvMobileView } from './CtvMobileView';

interface LeaderboardItem {
  rank: number;
  username: string;
  displayName: string;
  totalAmount: number;
  totalOrders: number;
  avatar?: string;
  orders?: CtvOrder[];
}

interface CtvInfo {
  username: string;
  displayName: string;
  prices: { '1year': number; 'lifetime': number };
  balance: number;
  remainingRequests?: number;
  apiKey?: string;
  depositCode?: string;
  telegramChatId?: string;
  avatar?: string;
}

interface CtvOrder {
  orderId: string;
  userUpgraded: string;
  packageId: string;
  amount: number;
  createdAt: string;
}

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full px-4 py-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] text-sm text-[#111827] dark:text-[#F9FAFB] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 transition-all duration-150 ${props.className || ''}`}
  />
);

// ─── Main Page Component ───────────────────────────────────────────────────
export const CtvPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ctv_token'));
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [ctv, setCtv] = useState<CtvInfo | null>(null);
  const [orders, setOrders] = useState<CtvOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => Boolean(localStorage.getItem('ctv_token')));
  const [error, setError] = useState<string | null>(null);
  type TabType = 'upgrade' | 'deposit' | 'packages' | 'history' | 'leaderboard' | 'api';
  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const saved = localStorage.getItem('ctv_active_tab');
    return (saved === 'upgrade' || saved === 'deposit' || saved === 'packages' || saved === 'history' || saved === 'leaderboard' || saved === 'api') ? saved as TabType : 'upgrade';
  });

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    try { localStorage.setItem('ctv_active_tab', tab); } catch (_) {}
  };

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      try {
        confetti({
          particleCount: 90,
          spread: 100,
          origin: { y: 0.4 },
          colors: ['#F59E0B', '#6D28D9', '#22C55E', '#FF6FAE']
        });
      } catch (_) {}
    }
  }, [activeTab]);

  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  const fetchLeaderboard = async () => {
    setIsLeaderboardLoading(true);
    try {
      const res = await fetch('/api/ctv/leaderboard');
      if (res.ok) {
        const d = await res.json();
        if (d.success) setLeaderboard(d.leaderboard || []);
      }
    } catch (_) {}
    finally { setIsLeaderboardLoading(false); }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const myRankItem = ctv ? leaderboard.find(item => item.username.toLowerCase() === ctv.username.toLowerCase()) : null;
  const myVipLevel = myRankItem ? myRankItem.rank : null;

  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [presetAvatars, setPresetAvatars] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  const fetchAvatars = async () => {
    try {
      const res = await fetch('/api/ctv/avatars');
      const data = await res.json();
      if (data.success && Array.isArray(data.avatars)) {
        setPresetAvatars(data.avatars);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchAvatars();
  }, []);

  const handleSaveAvatar = async (url: string) => {
    if (!token || !url) return;
    setIsSavingAvatar(true);
    try {
      const res = await fetch('/api/ctv/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ avatar: url })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCtv(prev => prev ? { ...prev, avatar: data.avatar } : prev);
        setAvatarModalOpen(false);
      }
    } catch (_) {}
    finally { setIsSavingAvatar(false); }
  };

  const [telegramInput, setTelegramInput] = useState('');
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isRegenKeyLoading, setIsRegenKeyLoading] = useState(false);
  const [botUsername, setBotUsername] = useState('');

  const [popup, setPopup] = useState<{
    isOpen: boolean; type: 'success' | 'error'; title: string; message: string;
    details?: { username?: string; packageLabel?: string; amount?: number; newBalance?: number; remainingRequests?: number };
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [selectedPkg, setSelectedPkg] = useState<'quota' | '1year' | 'lifetime'>('quota');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [liveUser, setLiveUser] = useState<LocketUserInfo | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(100000);
  const [historySearch, setHistorySearch] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const [bankInfo, setBankInfo] = useState<{
    bankBrand: string;
    accountNo: string;
    accountName: string;
    vietQrUrl: string;
    sePayConfigured: boolean;
  }>({
    bankBrand: 'ACB',
    accountNo: '21456181',
    accountName: 'NGUYEN VAN KIEN',
    vietQrUrl: 'https://img.vietqr.io/image/ACB-21456181-compact2.png',
    sePayConfigured: false
  });

  useEffect(() => {
    fetch('/api/public/telegram-bot-info').then(r => r.json()).then(d => { if (d?.botUsername) setBotUsername(d.botUsername); }).catch(() => {});
    fetch('/api/public/bank-info').then(r => r.json()).then(d => { if (d && d.bankBrand) setBankInfo(d); }).catch(() => {});
  }, []);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTargetUser(extractLocketUsername(text));
      }
    } catch (_) {
      const manualPrompt = prompt('Dán link hoặc username Locket vào đây (VD: http://locket.cam/vnkien26):');
      if (manualPrompt) {
        setTargetUser(extractLocketUsername(manualPrompt));
      }
    }
  };

  useEffect(() => {
    const clean = extractLocketUsername(targetUser);
    if (!clean || clean.length < 3) { setLiveUser(null); setIsSearchingUser(false); return; }
    setLiveUser(null);
    const t = setTimeout(async () => {
      setIsSearchingUser(true);
      try { setLiveUser(await getLocketUserInfo(clean)); } catch (_) {}
      finally { setIsSearchingUser(false); }
    }, 800);
    return () => clearTimeout(t);
  }, [targetUser]);

  const fetchCtvData = async (t: string) => {
    try {
      const [meRes, ordersRes] = await Promise.all([
        fetch('/api/ctv/me', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/ctv/orders', { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (meRes.ok) {
        const d = await meRes.json();
        setCtv(d.ctv);
        if (d.ctv?.telegramChatId !== undefined) setTelegramInput(d.ctv.telegramChatId || '');
        if ((d.ctv?.remainingRequests || 0) > 0) {
          setSelectedPkg('quota');
        } else {
          setSelectedPkg('1year');
        }
      } else { localStorage.removeItem('ctv_token'); setToken(null); setCtv(null); }
      if (ordersRes.ok) { const d = await ordersRes.json(); setOrders(d.orders || []); }
    } catch (_) { setError('Không thể kết nối máy chủ.'); }
    finally { setIsAuthChecking(false); }
  };

  useEffect(() => {
    if (!token) return;
    fetchCtvData(token);
    const id = setInterval(() => { if (tokenRef.current) fetchCtvData(tokenRef.current); }, 30000);
    return () => clearInterval(id);
  }, [token]);

  // WebSocket Realtime Listener (with Quiet Fallback)
  useEffect(() => {
    if (!ctv?.username) return;
    let sock: WebSocket | null = null, timer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const maxRetries = 3;

    const connect = () => {
      if (retryCount >= maxRetries) return;
      try {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsToken = tokenRef.current || '';
        const wsUrl = location.port === '5173'
          ? `${proto}//${location.hostname}:3001?token=${encodeURIComponent(wsToken)}`
          : `${proto}//${location.host}?token=${encodeURIComponent(wsToken)}`;

        sock = new WebSocket(wsUrl);

        sock.onopen = () => {
          retryCount = 0;
          if (wsToken && sock && sock.readyState === WebSocket.OPEN) {
            sock.send(JSON.stringify({ type: 'AUTH', token: wsToken }));
          }
        };

        sock.onerror = () => {
          // Quietly ignore WS connection failures and fallback to HTTP polling
        };

        sock.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d.type === 'CTV_BALANCE_UPDATE' && d.username?.toLowerCase() === ctv.username.toLowerCase()) {
              setCtv(p => p ? { ...p, balance: d.newBalance } : null);
              try { confetti({ particleCount: 100, spread: 80, origin: { y: 0.4 } }); } catch (_) {}
              setPopup({
                isOpen: true,
                type: 'success',
                title: '🎉 Nạp Tiền Tự Động Thành Công!',
                message: d.message || `Bạn vừa được cộng +${Number(d.amount).toLocaleString('vi-VN')}đ vào ví CTV!`,
                details: { amount: d.amount, newBalance: d.newBalance }
              });
              if (tokenRef.current) fetchCtvData(tokenRef.current);
            }
          } catch (_) {}
        };

        sock.onclose = () => {
          retryCount++;
          if (retryCount < maxRetries) {
            timer = setTimeout(connect, 5000);
          }
        };
      } catch (_) {}
    };

    connect();
    return () => {
      retryCount = maxRetries;
      if (timer) clearTimeout(timer);
      if (sock) {
        sock.onopen = null;
        sock.onmessage = null;
        sock.onerror = null;
        sock.onclose = null;
        sock.close();
      }
    };
  }, [ctv?.username]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUser.trim() || !loginPass.trim()) return;
    setIsLoading(true); setError(null);
    try {
      const res = await fetch('/api/ctv/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUser.trim(), password: loginPass.trim() }) });
      const d = await res.json();
      if (res.ok && d.success) { localStorage.setItem('ctv_token', d.token); setToken(d.token); setCtv(d.ctv); setLoginPass(''); }
      else setPopup({ isOpen: true, type: 'error', title: 'Đăng nhập thất bại', message: d.error || 'Sai tài khoản hoặc mật khẩu!' });
    } catch (_) { setPopup({ isOpen: true, type: 'error', title: 'Lỗi kết nối', message: 'Không kết nối được máy chủ.' }); }
    finally { setIsLoading(false); }
  };

  const handleLogout = () => { localStorage.removeItem('ctv_token'); setToken(null); setCtv(null); setOrders([]); };

  const handleDeleteOrder = async (orderId: string) => {
    if (!token || !orderId) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đơn hàng này khỏi lịch sử không?`)) return;
    try {
      const res = await fetch(`/api/ctv/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(data.orders || orders.filter(o => o.orderId !== orderId));
      } else {
        alert(data.error || 'Không thể xóa đơn hàng');
      }
    } catch (_) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  const handleClearHistory = async () => {
    if (!token || orders.length === 0) return;
    if (!window.confirm('⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TOÀN BỘ LỊCH SỬ GIAO DỊCH?\nHành động này không thể hoàn tác!')) return;
    try {
      const res = await fetch('/api/ctv/orders', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders([]);
      } else {
        alert(data.error || 'Không thể xóa lịch sử');
      }
    } catch (_) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !targetUser.trim()) return;
    const u = targetUser.trim().toLowerCase();
    if (liveUser && (liveUser.valid === false || !liveUser.uid)) { setPopup({ isOpen: true, type: 'error', title: '❌ Không tồn tại', message: `@${u} không tồn tại trên Locket.` }); return; }
    if (liveUser?.hasActiveGold) { setPopup({ isOpen: true, type: 'error', title: '⚠️ Đã có Gold', message: `@${u} đã có Locket Gold.` }); return; }

    const isQuotaMode = selectedPkg === 'quota';
    const pkgId = isQuotaMode ? '1year' : selectedPkg;
    const price = isQuotaMode ? 0 : (ctv?.prices?.[pkgId] || (pkgId === 'lifetime' ? 350000 : 65000));

    if (isQuotaMode) {
      if ((ctv?.remainingRequests || 0) < 1) {
        setPopup({ isOpen: true, type: 'error', title: '⚠️ Hết lượt gói', message: 'Tài khoản của bạn đã hết lượt gói nạp! Vui lòng nạp bằng số dư ví hoặc mua thêm gói lượt.' });
        return;
      }
    } else {
      if ((ctv?.balance || 0) < price) {
        setPopup({ isOpen: true, type: 'error', title: '⚠️ Không đủ số dư', message: `Cần ${price.toLocaleString('vi-VN')}đ, bạn có ${(ctv?.balance || 0).toLocaleString('vi-VN')}đ.` });
        return;
      }
    }

    setIsUpgrading(true);
    try {
      const res = await fetch('/api/ctv/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userUpgraded: u, packageId: pkgId, useQuota: isQuotaMode })
      });
      const d = await res.json();
      if (res.ok && d.success && !d.already_has_gold) {
        setTargetUser(''); setLiveUser(null);
        if (d.newBalance !== undefined && ctv) {
          setCtv({ ...ctv, balance: d.newBalance, remainingRequests: d.remainingRequests ?? ctv.remainingRequests });
        }
        fetchCtvData(token);
        try { confetti({ particleCount: 90, spread: 75, origin: { y: 0.5 } }); } catch (_) {}
        const newRemaining = d.remainingRequests ?? (isQuotaMode ? Math.max(0, (ctv?.remainingRequests || 1) - 1) : ctv?.remainingRequests);
        setPopup({
          isOpen: true,
          type: 'success',
          title: '🎉 Kích hoạt thành công!',
          message: `Locket Gold đã kích hoạt cho @${u}!`,
          details: {
            username: u,
            packageLabel: isQuotaMode ? '📦 Gói 1 Năm (1 Lượt Gói)' : pkgId === 'lifetime' ? '👑 Vĩnh Viễn' : '⭐ 1 Năm',
            amount: price,
            ...(isQuotaMode ? { remainingRequests: newRemaining } : { newBalance: d.newBalance })
          }
        });
      } else setPopup({ isOpen: true, type: 'error', title: 'Thất bại', message: d.error || d.message || 'Kích hoạt thất bại.' });
    } catch (_) { setPopup({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Không kết nối được máy chủ.' }); }
    finally { setIsUpgrading(false); }
  };

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault(); if (!token) return;
    setIsSavingTelegram(true);
    try {
      const res = await fetch('/api/ctv/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ telegramChatId: telegramInput.trim() }) });
      const d = await res.json();
      if (res.ok && d.success) { if (ctv) setCtv({ ...ctv, telegramChatId: d.telegramChatId }); setPopup({ isOpen: true, type: 'success', title: '🤖 Liên kết thành công', message: `Chat ID: ${d.telegramChatId || 'Trống'}` }); }
      else setPopup({ isOpen: true, type: 'error', title: 'Lỗi', message: d.error || 'Không thể lưu.' });
    } catch (_) { setPopup({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Lỗi máy chủ.' }); }
    finally { setIsSavingTelegram(false); }
  };

  const handleRegenKey = async () => {
    if (!token || !window.confirm('Tạo lại API Key? Key cũ sẽ mất!')) return;
    setIsRegenKeyLoading(true);
    try {
      const res = await fetch('/api/ctv/regen-key', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok && d.success && ctv) { setCtv({ ...ctv, apiKey: d.apiKey }); setPopup({ isOpen: true, type: 'success', title: '🔑 Key mới đã tạo', message: d.apiKey }); }
    } catch (_) {}
    finally { setIsRegenKeyLoading(false); }
  };

  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [customApiKeyInput, setCustomApiKeyInput] = useState('');
  const [isSavingCustomKey, setIsSavingCustomKey] = useState(false);

  const handleSaveCustomApiKey = async (newKey: string) => {
    if (!token) return;
    if (!newKey || newKey.trim().length < 3) {
      setPopup({ isOpen: true, type: 'error', title: 'Lỗi API Key', message: 'API Key phải từ 3 ký tự trở lên' });
      return;
    }
    setIsSavingCustomKey(true);
    try {
      const res = await fetch('/api/ctv/update-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ apiKey: newKey.trim() })
      });
      const d = await res.json();
      if (res.ok && d.success && ctv) {
        setCtv({ ...ctv, apiKey: d.apiKey });
        setIsEditingApiKey(false);
        setPopup({ isOpen: true, type: 'success', title: '🔑 Đã cập nhật API Key', message: `API Key mới: ${d.apiKey}` });
      } else {
        setPopup({ isOpen: true, type: 'error', title: 'Thất bại', message: d.error || 'Không thể cập nhật API Key' });
      }
    } catch (e: any) {
      setPopup({ isOpen: true, type: 'error', title: 'Lỗi', message: e?.message || 'Lỗi hệ thống' });
    } finally {
      setIsSavingCustomKey(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault(); if (!token) return;
    if (newPassword !== confirmPassword) { setPopup({ isOpen: true, type: 'error', title: 'Không khớp', message: 'Mật khẩu xác nhận không trùng!' }); return; }
    if (newPassword.length < 4) { setPopup({ isOpen: true, type: 'error', title: 'Quá ngắn', message: 'Mật khẩu tối thiểu 4 ký tự.' }); return; }
    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/ctv/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ oldPassword, newPassword }) });
      const d = await res.json();
      if (res.ok && d.success) { setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setPopup({ isOpen: true, type: 'success', title: '🔒 Đổi mật khẩu thành công', message: 'Mật khẩu đã được cập nhật.' }); }
      else setPopup({ isOpen: true, type: 'error', title: 'Thất bại', message: d.error || 'Mật khẩu cũ không đúng.' });
    } catch (_) { setPopup({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Không kết nối được.' }); }
    finally { setIsChangingPassword(false); }
  };

  const [isCheckingDeposit, setIsCheckingDeposit] = useState(false);

  const handleCheckDeposit = async () => {
    if (!token) return;
    setIsCheckingDeposit(true);
    try {
      const res = await fetch('/api/ctv/check-deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.credited) {
          setPopup({
            isOpen: true,
            type: 'success',
            title: '🎉 Nạp Tiền Thành Công!',
            message: data.message || `Đã cộng +${Number(data.addedAmount).toLocaleString('vi-VN')}đ vào ví CTV!`,
            details: { amount: data.addedAmount, newBalance: data.newBalance }
          });
          if (token) fetchCtvData(token);
        } else {
          setPopup({
            isOpen: true,
            type: 'error',
            title: '⏳ Chưa Tìm Thấy Giao Dịch',
            message: data.message || 'Hệ thống chưa ghi nhận tiền vào. Nếu bạn vừa chuyển khoản, vui lòng đợi 5-10 giây ngân hàng xử lý rồi bấm nút Xác nhận lại nhé!'
          });
        }
      } else {
        setPopup({
          isOpen: true,
          type: 'error',
          title: '❌ Không thể kiểm tra',
          message: data.error || 'Lỗi kiểm tra lịch sử giao dịch.'
        });
      }
    } catch (_) {
      setPopup({
        isOpen: true,
        type: 'error',
        title: '❌ Lỗi kết nối',
        message: 'Không thể kết nối đến máy chủ.'
      });
    } finally {
      setIsCheckingDeposit(false);
    }
  };

  const [buyingPackageType, setBuyingPackageType] = useState<string | null>(null);
  const [customBuyCount, setCustomBuyCount] = useState<number>(50);
  const [confirmPackage, setConfirmPackage] = useState<{
    type: string;
    name: string;
    count: number;
    price: number;
  } | null>(null);

  const handleBuyPackage = async (packageType: string, countVal?: number) => {
    if (!token) return;
    if (!ctv?.telegramChatId) {
      setPopup({
        isOpen: true,
        type: 'error',
        title: '📲 Yêu Cầu Liên Kết Telegram Bot',
        message: 'Bạn chưa kết nối Telegram Bot! Vui lòng chuyển sang Tab "API" để liên kết Telegram Bot trước khi mua gói lượt (giúp hệ thống gửi cảnh báo tự động khi số lượt nạp của bạn còn dưới 10 lượt).'
      });
      return;
    }
    setBuyingPackageType(packageType);
    try {
      const res = await fetch('/api/ctv/buy-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageType, count: countVal })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCtv(p => p ? { ...p, balance: data.newBalance, remainingRequests: data.remainingRequests } : null);
        try { confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 } }); } catch (_) {}
        setPopup({
          isOpen: true,
          type: 'success',
          title: '🎉 Mua Gói Thành Công!',
          message: data.message || `Đã cộng +${data.count} lượt nâng cấp Gold 1 Năm vào tài khoản của bạn!`
        });
      } else {
        setPopup({
          isOpen: true,
          type: 'error',
          title: '❌ Mua gói thất bại',
          message: data.error || 'Lỗi xử lý mua gói lượt.'
        });
      }
    } catch (_) {
      setPopup({
        isOpen: true,
        type: 'error',
        title: '❌ Lỗi kết nối',
        message: 'Không thể kết nối máy chủ mua gói.'
      });
    } finally {
      setBuyingPackageType(null);
    }
  };

  const depositMemo = ctv ? (ctv.depositCode || `ctv${ctv.username}`).replace(/-/g, '') : '';
  const vietQrUrl = `https://img.vietqr.io/image/${bankInfo.bankBrand}-${bankInfo.accountNo}-compact2.png?amount=${depositAmount}&addInfo=${encodeURIComponent(depositMemo)}&accountName=${encodeURIComponent(bankInfo.accountName)}`;

  const TABS = [
    { id: 'upgrade', icon: <Crown className="w-5 h-5" />, label: 'Gold', title: 'Kích Hoạt Locket Gold', desc: 'Nhập username Locket của khách để nâng cấp tự động 3s' },
    { id: 'deposit', icon: <QrCode className="w-5 h-5" />, label: 'Nạp tiền', title: 'Nạp Tiền Vào Ví CTV', desc: `Nạp tiền tự động 24/7 qua VietQR ${bankInfo.bankBrand} SePay (Cộng tiền tức thì)` },
    { id: 'packages', icon: <Package className="w-5 h-5" />, label: 'Mua Gói', title: 'Mua Gói Lượt Gold 1 Năm', desc: 'Mua gói số lượt nạp (100 / 500 / 1.000 lượt) chiết khấu cực ưu đãi' },
    { id: 'history', icon: <History className="w-5 h-5" />, label: 'Lịch sử', title: 'Lịch Sử Kích Hoạt', desc: 'Danh sách các tài khoản Locket Gold bạn đã nâng cấp' },
    { id: 'leaderboard', icon: <Trophy className="w-5 h-5" />, label: 'Top CTV', title: 'Bảng Xếp Hạng Top CTV', desc: 'Vinh danh Top Cộng Tác Viên có tổng nạp & doanh số cao nhất' },
    { id: 'api',     icon: <Key className="w-5 h-5" />,     label: 'API', title: 'API & Tích Hợp', desc: 'Quản lý API Key, liên kết Telegram Bot thông báo và cài đặt tài khoản' },
  ] as const;

  const filteredOrders = orders.filter(o =>
    !historySearch.trim() || o.userUpgraded.toLowerCase().includes(historySearch.trim().toLowerCase())
  );

  const currentTabInfo = TABS.find(t => t.id === activeTab) || TABS[0];

  if (isAuthChecking && token && !ctv) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0f] flex flex-col items-center justify-center p-6 text-slate-900 dark:text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 animate-pulse">
            <Crown className="w-8 h-8 text-amber-300" />
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
            <span>Đang tải dữ liệu Portal CTV...</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── HIGH-PERFORMANCE MOBILE VIEW (DEDICATED SEPARATE RENDER) ──────────────
  if (isMobile) {
    return (
      <>
        <CtvMobileView
          token={token}
          ctv={ctv}
          orders={orders}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          loginUser={loginUser}
          setLoginUser={setLoginUser}
          loginPass={loginPass}
          setLoginPass={setLoginPass}
          isLoading={isLoading}
          error={error}
          handleLogin={handleLogin}
          handleLogout={handleLogout}
          targetUser={targetUser}
          setTargetUser={setTargetUser}
          selectedPkg={selectedPkg}
          setSelectedPkg={setSelectedPkg}
          isUpgrading={isUpgrading}
          handleUpgrade={handleUpgrade}
          handlePasteClipboard={handlePasteClipboard}
          liveUser={liveUser}
          isSearchingUser={isSearchingUser}
          customBuyCount={customBuyCount}
          setCustomBuyCount={setCustomBuyCount}
          buyingPackageType={buyingPackageType}
          setConfirmPackage={setConfirmPackage}
          depositAmount={depositAmount}
          setDepositAmount={setDepositAmount}
          depositMemo={depositMemo}
          vietQrUrl={vietQrUrl}
          copiedMemo={copiedMemo}
          setCopiedMemo={setCopiedMemo}
          handleCheckDeposit={handleCheckDeposit}
          isCheckingDeposit={isCheckingDeposit}
          historySearch={historySearch}
          setHistorySearch={setHistorySearch}
          onDeleteOrder={handleDeleteOrder}
          onClearHistory={handleClearHistory}
          leaderboard={leaderboard}
          isLeaderboardLoading={isLeaderboardLoading}
          myRankItem={myRankItem}
          myVipLevel={myVipLevel}
          telegramInput={telegramInput}
          setTelegramInput={setTelegramInput}
          handleSaveTelegram={handleSaveTelegram}
          isSavingTelegram={isSavingTelegram}
          handleRegenApiKey={handleRegenKey}
          isRegenKeyLoading={isRegenKeyLoading}
          copiedApiKey={copiedApiKey}
          setCopiedApiKey={setCopiedApiKey}
          oldPassword={oldPassword}
          setOldPassword={setOldPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          isChangingPassword={isChangingPassword}
          handleChangePassword={handleChangePassword}
        />

        {/* PACKAGE CONFIRM MODAL FOR MOBILE */}
        <AnimatePresence>
          {confirmPackage && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setConfirmPackage(null)}
                className="absolute inset-0 bg-black/60"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="relative z-10 w-full max-w-sm rounded-3xl bg-white dark:bg-[#13111c] p-5 space-y-4 shadow-2xl border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              >
                <button
                  onClick={() => setConfirmPackage(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">Xác Nhận Mua Gói Lượt</h3>
                    <p className="text-[11px] text-slate-400">Vui lòng kiểm tra kỹ trước khi xác nhận</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 space-y-2 text-xs border border-slate-200 dark:border-white/10">
                  <div className="flex justify-between"><span className="text-slate-500">Gói mua:</span><span className="font-bold">{confirmPackage.name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Cộng:</span><span className="font-mono font-bold text-amber-500">+{confirmPackage.count.toLocaleString('vi-VN')} lượt</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Giá:</span><span className="font-mono font-black text-purple-500">{confirmPackage.price.toLocaleString('vi-VN')}đ</span></div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmPackage(null)}
                    className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/10 font-bold text-xs"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      if (confirmPackage) {
                        const pkgType = confirmPackage.type;
                        const countVal = confirmPackage.count;
                        setConfirmPackage(null);
                        handleBuyPackage(pkgType, countVal);
                      }
                    }}
                    disabled={Boolean(buyingPackageType)}
                    className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold text-xs disabled:opacity-50"
                  >
                    {buyingPackageType ? 'Đang xử lý...' : 'Xác Nhận Mua'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* SHARED POPUP MODAL FOR MOBILE */}
        {popup.isOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0">
            <div className="absolute inset-0 bg-black/60" onClick={() => setPopup(p => ({ ...p, isOpen: false }))} />
            <div className="relative z-10 w-full rounded-t-3xl bg-white dark:bg-[#13111c] p-5 space-y-3.5 shadow-2xl border-t border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
              <button onClick={() => setPopup(p => ({ ...p, isOpen: false }))} className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-white/[0.08]">
                <X className="w-4 h-4 text-slate-500" />
              </button>

              <div className="flex flex-col items-center text-center gap-2 pt-1">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${popup.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-600'}`}>
                  {popup.type === 'success' ? <CheckCircle2 className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
                </div>
                <div>
                  <h3 className="text-base font-black">{popup.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{popup.message}</p>
                </div>
              </div>

              {popup.details && (
                <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-black/40 text-xs border border-slate-100 dark:border-white/10">
                  {popup.details.username && <div className="flex justify-between"><span className="text-slate-500">Khách</span><span className="font-bold text-purple-500">@{popup.details.username}</span></div>}
                  {popup.details.packageLabel && <div className="flex justify-between"><span className="text-slate-500">Gói</span><span className="font-bold text-emerald-500">{popup.details.packageLabel}</span></div>}
                  {popup.details.remainingRequests !== undefined ? (
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-white/10"><span className="text-slate-500">Lượt gói còn lại</span><span className="font-mono font-bold text-purple-500">{popup.details.remainingRequests.toLocaleString('vi-VN')} lượt</span></div>
                  ) : popup.details.newBalance !== undefined && (
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-white/10"><span className="text-slate-500">Số dư mới</span><span className="font-mono font-bold text-amber-500">{(Number(popup.details.newBalance) || 0).toLocaleString('vi-VN')}đ</span></div>
                  )}
                </div>
              )}

              <button
                onClick={() => setPopup(p => ({ ...p, isOpen: false }))}
                className="w-full py-3.5 rounded-xl font-bold text-xs bg-purple-600 text-white"
              >
                {popup.type === 'success' ? '🎉 Đã hiểu' : 'Đóng'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0f] text-slate-900 dark:text-white font-sans selection:bg-purple-500 selection:text-white">

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 1. NOT LOGGED IN STATE */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {!token || !ctv ? (
        <>
          {/* MOBILE LOGIN (< md) */}
          <div className="flex md:hidden min-h-screen flex-col items-center justify-center px-5 py-10">
            <div className="w-full max-w-sm space-y-5">
              <div className="text-center mb-2">
                <div className="w-16 h-16 rounded-3xl bg-linear-to-br from-purple-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-500/30">
                  <Lock className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">Portal CTV</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Đăng nhập tài khoản cộng tác viên</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-3">
                <Input
                  type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)}
                  required placeholder="Tên tài khoản CTV"
                />
                <Input
                  type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
                  required placeholder="Mật khẩu"
                />
                <button
                  type="submit" disabled={isLoading}
                  className="w-full py-4 rounded-2xl bg-linear-to-r from-purple-600 to-indigo-600 text-white font-bold text-base disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-500/25 active:scale-[0.98] transition-transform"
                >
                  {isLoading ? <RefreshCw className="w-5 h-5 animate-spin inline" /> : 'Đăng nhập'}
                </button>
              </form>

              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                Chưa có tài khoản?{' '}
                <a href="https://www.facebook.com/vnkin.06" target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 font-bold">Liên hệ Admin</a>
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { icon: '⚡', title: 'Kích hoạt 3s', sub: 'Tự động 24/7' },
                  { icon: '💳', title: 'Nạp VietQR', sub: 'Tự động trong 10s' },
                ].map(f => (
                  <div key={f.title} className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-center">
                    <div className="text-xl mb-1">{f.icon}</div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{f.title}</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">{f.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PC / DESKTOP LOGIN (≥ md) */}
          <div className="hidden md:flex min-h-screen items-center justify-center p-6 relative overflow-hidden bg-slate-100 dark:bg-[#090d16]">
            {/* Ambient Lighting Spheres */}
            <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-4xl bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl shadow-purple-500/5 overflow-hidden grid grid-cols-12 relative z-10">
              
              {/* Left Side: Branding & Value Props */}
              <div className="col-span-6 bg-gradient-to-br from-purple-700 via-indigo-700 to-purple-800 text-white p-10 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold mb-6">
                    <Crown className="w-4 h-4 text-amber-300" /> System CTV Portal v2.0
                  </div>
                  <h1 className="text-3xl font-black leading-tight tracking-tight">
                    Cổng Quản Lý CTV <br />
                    <span className="text-amber-300">Locket Gold</span> Tự Động
                  </h1>
                  <p className="text-purple-100 text-sm mt-3 leading-relaxed">
                    Hệ thống nâng cấp Locket Gold 24/7 tự động 100%. Tích hợp API, Telegram Bot và thanh toán tự động VietQR.
                  </p>
                </div>

                <div className="space-y-4 my-8 relative z-10">
                  {[
                    { icon: Zap, title: 'Kích hoạt 3 giây', desc: 'Hệ thống tự động kích hoạt Locket Gold theo Username' },
                    { icon: QrCode, title: 'Nạp VietQR Auto 10s', desc: 'Cộng tiền tự động không chờ duyệt, quét QR là có tiền' },
                    { icon: Key, title: 'API & Telegram Bot', desc: 'Tích hợp API cho website riêng, nhận thông báo biến động số dư qua Tele' },
                  ].map((feat, i) => (
                    <div key={i} className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
                      <div className="p-2 rounded-xl bg-white/15 shrink-0">
                        <feat.icon className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{feat.title}</div>
                        <div className="text-xs text-purple-100/80 mt-0.5">{feat.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-purple-200 flex items-center justify-between pt-4 border-t border-white/15 relative z-10">
                  <span>© 2026 Locket Gold CTV Portal</span>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                  </div>
                </div>
              </div>

              {/* Right Side: Login Form */}
              <div className="col-span-6 p-10 flex flex-col justify-center bg-white dark:bg-[#111827]">
                <div className="mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">Đăng Nhập CTV</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Nhập tài khoản cộng tác viên để truy cập bảng điều khiển</p>
                </div>

                {error && (
                  <div className="mb-4 flex items-center gap-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Tên tài khoản</label>
                    <Input
                      type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)}
                      required placeholder="Tên tài khoản CTV" className="py-3.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Mật khẩu</label>
                    <Input
                      type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
                      required placeholder="••••••••" className="py-3.5"
                    />
                  </div>
                  <button
                    type="submit" disabled={isLoading}
                    className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Đăng nhập ngay <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/[0.06] text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chưa đăng ký làm Cộng tác viên?{' '}
                    <a href="https://www.facebook.com/vnkin.06" target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 font-bold hover:underline">
                      Liên hệ Admin Facebook ↗
                    </a>
                  </p>
                </div>
              </div>

            </div>
          </div>
        </>
      ) : (

      /* ═══════════════════════════════════════════════════════════ */
      /* 2. LOGGED IN STATE */
      /* ═══════════════════════════════════════════════════════════ */
        <div>

          {/* ─────────────────────────────────────────────────────────── */}
          {/* MOBILE VIEW (< md) - KEPT 100% EXACT AS ORIGINAL           */}
          {/* ─────────────────────────────────────────────────────────── */}
          <div className="flex md:hidden flex-col h-screen overflow-hidden">
            {/* Top Header */}
            <div className="flex-shrink-0 px-4 pt-4 pb-2 bg-slate-50 dark:bg-[#0a0a0f]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setSelectedAvatar(ctv.avatar || ''); setAvatarModalOpen(true); }}
                    className="w-10 h-10 rounded-2xl bg-[#6D28D9] text-white font-black text-sm flex items-center justify-center cursor-pointer overflow-hidden active:scale-95 transition-transform shrink-0"
                    title="Bấm để đổi avatar"
                  >
                    {ctv.avatar ? (
                      <img src={ctv.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      ctv.username.charAt(0).toUpperCase()
                    )}
                  </button>
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white leading-tight">@{ctv.username}</div>
                    <div className="text-base font-black text-amber-500 dark:text-amber-400 font-mono leading-tight">
                      {ctv.balance.toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('deposit')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-black text-xs font-black cursor-pointer active:scale-95 transition-transform"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Nạp tiền
                  </button>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-xl bg-slate-200 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400 cursor-pointer active:scale-95 transition-transform"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Content Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-24">
              {activeTab === 'upgrade' && (
                <div className="py-4 space-y-4">
                  <div className="p-5 rounded-3xl bg-white dark:bg-[#13111c] border border-slate-200 dark:border-white/[0.06] space-y-4">
                    <div>
                      <h2 className="text-base font-black flex items-center gap-2">
                        <span className="text-xl">👑</span> Kích Hoạt Locket Gold
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Nhập username khách → kích hoạt tức thì</p>
                    </div>

                    <form onSubmit={handleUpgrade} className="space-y-3">
                      <div className="relative flex items-center">
                        <Input
                          type="text"
                          value={targetUser}
                          onChange={e => setTargetUser(extractLocketUsername(e.target.value))}
                          onPaste={e => {
                            const text = e.clipboardData.getData('text');
                            if (text) {
                              e.preventDefault();
                              setTargetUser(extractLocketUsername(text));
                            }
                          }}
                          required
                          placeholder="Nhập username hoặc dán link Locket..."
                          className="pr-24"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                          {isSearchingUser ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-purple-500 mr-1" />
                          ) : (
                            <button
                              type="button"
                              onClick={handlePasteClipboard}
                              className="px-2.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 active:scale-95 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer border border-purple-500/20 shadow-sm"
                              title="Dán link hoặc username từ bộ nhớ tạm"
                            >
                              <Clipboard className="w-3.5 h-3.5" />
                              <span>Dán</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {liveUser && (
                        <div className={`flex items-center justify-between p-3 rounded-2xl border ${
                          liveUser.valid === false || !liveUser.uid
                            ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'
                            : liveUser.hasActiveGold
                            ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
                            : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            {liveUser.avatar
                              ? <img src={liveUser.avatar} alt="" className="w-9 h-9 rounded-xl object-cover" />
                              : <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center font-black text-purple-600 text-sm">{(liveUser.username || targetUser).charAt(0).toUpperCase()}</div>
                            }
                            <div>
                              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                {liveUser.full_name || liveUser.username}
                                {liveUser.uid && liveUser.valid !== false && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                              </div>
                              <div className="text-[11px] text-slate-500">@{liveUser.username || targetUser}</div>
                            </div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            liveUser.valid === false || !liveUser.uid
                              ? 'text-rose-600 dark:text-rose-400'
                              : liveUser.hasActiveGold
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {liveUser.valid === false || !liveUser.uid ? '❌ Không tồn tại' : liveUser.hasActiveGold ? '👑 Đã có Gold' : '✓ Sẵn sàng'}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-2">
                        {[
                          {
                            id: 'quota' as const,
                            label: '📦 1 Năm (Dùng 1 Lượt Gói)',
                            sub: `Trừ 1 lượt (Còn ${(ctv.remainingRequests || 0).toLocaleString('vi-VN')} lượt)`,
                            color: 'text-purple-600 dark:text-purple-400',
                            isQuota: true
                          },
                          {
                            id: '1year' as const,
                            label: '⭐ 1 Năm (Ví CTV)',
                            sub: `${(ctv.prices?.['1year'] || 65000).toLocaleString('vi-VN')}đ / lượt`,
                            color: 'text-emerald-600 dark:text-emerald-400',
                            isQuota: false
                          },
                          {
                            id: 'lifetime' as const,
                            label: '👑 Vĩnh Viễn (Ví CTV)',
                            sub: `${(ctv.prices?.['lifetime'] || 350000).toLocaleString('vi-VN')}đ / lượt`,
                            color: 'text-amber-600 dark:text-amber-400',
                            isQuota: false
                          },
                        ].map(pkg => (
                          <button
                            key={pkg.id} type="button" onClick={() => setSelectedPkg(pkg.id)}
                            className={`p-3.5 rounded-2xl border-2 text-left transition-colors cursor-pointer flex items-center justify-between ${
                              selectedPkg === pkg.id
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/15'
                                : 'border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.03]'
                            }`}
                          >
                            <div>
                              <div className="font-black text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                                {pkg.label}
                                {pkg.isQuota && (ctv.remainingRequests || 0) > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-300 text-[10px] font-bold">Khả dụng</span>
                                )}
                              </div>
                              <div className={`text-[11px] font-medium mt-0.5 ${pkg.color}`}>
                                {pkg.sub}
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedPkg === pkg.id ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300'}`}>
                              {selectedPkg === pkg.id && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </button>
                        ))}
                      </div>

                      <button
                        type="submit"
                        disabled={isUpgrading || !targetUser.trim() || !!liveUser?.hasActiveGold || (!!liveUser && (liveUser.valid === false || !liveUser.uid))}
                        className="w-full py-4 rounded-2xl bg-linear-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm disabled:opacity-40 cursor-pointer shadow-lg shadow-purple-500/20 active:scale-[0.98] transition-transform"
                      >
                        {isUpgrading
                          ? <><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Đang kích hoạt...</>
                          : liveUser && (liveUser.valid === false || !liveUser.uid) ? '❌ Username không tồn tại'
                          : liveUser?.hasActiveGold ? '⚠️ Đã có Gold'
                          : '👑 Xác Nhận Kích Hoạt Gold'
                        }
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === 'deposit' && (
                <div className="py-4 space-y-4">
                  <div className="p-5 rounded-3xl bg-white dark:bg-[#13111c] border border-slate-200 dark:border-white/[0.06] space-y-4">
                    <div>
                      <h2 className="text-base font-black flex items-center gap-2">
                        <span className="text-xl">💳</span> Nạp Tiền VietQR ACB
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tự động cộng số dư sau ~10 giây</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25">
                      <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mb-1.5">🔑 Mã nạp tiền cố định của bạn (dùng cho mọi lần nạp)</div>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-black/30 border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono font-black text-base tracking-widest">
                          {depositMemo}
                        </span>
                        <button
                          type="button"
                          onClick={() => { try { navigator.clipboard.writeText(depositMemo); setCopiedMemo(true); setTimeout(() => setCopiedMemo(false), 2000); } catch (_) {} }}
                          className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-500/20 shrink-0 cursor-pointer"
                        >
                          {copiedMemo ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-1.5">
                        ⚠️ Nhập <strong>chính xác</strong> mã này vào nội dung chuyển khoản. Mã là duy nhất của bạn.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF]">
                        Chọn nhanh hoặc nhập số tiền nạp tùy chọn:
                      </label>

                      <div className="grid grid-cols-3 gap-2">
                        {[100000, 200000, 500000].map(amt => (
                          <button
                            key={amt} type="button" onClick={() => setDepositAmount(amt)}
                            className={`py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                              depositAmount === amt
                                ? 'border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]'
                                : 'border-[#E5E7EB] dark:border-[#374151] bg-[#F5F5F5] dark:bg-[#1F2937] text-[#111827] dark:text-[#F9FAFB]'
                            }`}
                          >{amt.toLocaleString('vi-VN')}đ</button>
                        ))}
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={depositAmount ? depositAmount.toLocaleString('vi-VN') : ''}
                          onChange={e => {
                            const raw = parseInt(e.target.value.replace(/\D/g, ''), 10);
                            setDepositAmount(isNaN(raw) ? 0 : raw);
                          }}
                          placeholder="Nhập số tiền nạp tùy ý (VD: 100.000)..."
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#0B0F17] border border-[#E5E7EB] dark:border-[#374151] font-bold text-sm text-[#F59E0B] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 pr-12 transition-all duration-150"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] pointer-events-none">đ</span>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start">
                      <img src={vietQrUrl} alt="VietQR" className="w-28 h-28 rounded-2xl bg-white p-1.5 shrink-0 border border-slate-200 dark:border-white/[0.08]" loading="lazy" />
                      <div className="flex-1 space-y-1.5 text-xs min-w-0">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Ngân hàng</span>
                          <span className="font-bold text-slate-900 dark:text-white">{bankInfo.bankBrand}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Số TK</span>
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400">{bankInfo.accountNo}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Chủ TK</span>
                          <span className="font-bold text-slate-900 dark:text-white">{bankInfo.accountName}</span>
                        </div>
                        <div className="pt-1 border-t border-slate-200 dark:border-white/[0.06]">
                          <div className="text-slate-500 mb-1">Nội dung <span className="text-rose-500 font-bold">(bắt buộc)</span></div>
                          <div className="flex items-center gap-2">
                            <span className="flex-1 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 font-mono font-black text-sm truncate">
                              {depositMemo}
                            </span>
                            <button
                              type="button"
                              onClick={() => { try { navigator.clipboard.writeText(depositMemo); setCopiedMemo(true); setTimeout(() => setCopiedMemo(false), 2000); } catch (_) {} }}
                              className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] shrink-0 cursor-pointer"
                            >
                              {copiedMemo ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">⚡ Hệ thống quét tự động liên tục 24/7, tiền cộng ngay sau khi ngân hàng xử lý.</p>
                  </div>
                </div>
              )}

              {/* MOBILE VIEW: PACKAGES TAB */}
              {activeTab === 'packages' && (
                <div className="py-4 space-y-5">
                  {/* Clean Surface Hero Header */}
                  <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] space-y-3 relative overflow-hidden border border-[#E5E7EB] dark:border-[#374151] shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6D28D9]/10 text-[#6D28D9] dark:text-[#8D71FF] text-[11px] font-bold">
                        <Package className="w-3.5 h-3.5" /> Gói Lượt Nạp Gold 1 Năm
                      </div>
                      <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-xl bg-[#F5F5F5] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF] border border-[#E5E7EB] dark:border-[#374151]">
                        Cứ 50 lượt -50k
                      </span>
                    </div>

                    <div>
                      <h2 className="text-xl font-black tracking-tight text-[#111827] dark:text-[#F9FAFB]">Mua Lượt Nạp Chiết Khấu</h2>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed mt-1">
                        Kích hoạt Locket Gold 1 Năm bằng lượt gói thay vì trừ ví trực tiếp!
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs border-t border-[#E5E7EB] dark:border-[#374151]">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF] font-medium">Kho lượt gói hiện có:</span>
                      <span className="font-mono font-black text-[#F59E0B] text-base bg-[#F59E0B]/10 px-3 py-1 rounded-xl border border-[#F59E0B]/20">
                        {(ctv.remainingRequests || 0).toLocaleString('vi-VN')} lượt
                      </span>
                    </div>
                  </div>

                  {/* CUSTOM QUANTITY CALCULATOR CARD */}
                  {(() => {
                    const unitPrice = ctv.prices?.['1year'] || 65000;
                    const count = Math.max(1, customBuyCount || 1);
                    const rawTotal = unitPrice * count;
                    const discount = Math.floor(count / 50) * 50000;
                    const totalPrice = Math.max(0, rawTotal - discount);
                    const isLoading = buyingPackageType === `custom_${count}`;

                    return (
                      <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] space-y-4 border border-[#E5E7EB] dark:border-[#374151] shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 rounded-full bg-[#6D28D9]/10 text-[#6D28D9] dark:text-[#8D71FF] text-[11px] font-bold uppercase tracking-wider">
                            ✨ Tùy Chọn Số Lượt
                          </span>
                          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono font-bold">Đơn giá: {unitPrice.toLocaleString('vi-VN')}đ</span>
                        </div>

                        <div>
                          <label className="block text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2 font-bold flex items-center justify-between">
                            <span>Nhập số lượng lượt cần mua:</span>
                            <span className="text-[11px] text-[#6D28D9] dark:text-[#8D71FF] font-mono">Bấm nấc nhanh bên dưới</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number" min={1} step={1}
                              value={customBuyCount || ''}
                              onChange={e => setCustomBuyCount(Math.max(1, parseInt(e.target.value) || 0))}
                              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#0B0F17] border border-[#E5E7EB] dark:border-[#374151] text-[#F59E0B] font-mono font-black text-xl focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 pr-16"
                              placeholder="Nhập số lượt..."
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] pointer-events-none">lượt</span>
                          </div>

                          {/* Quick Increment Pills */}
                          <div className="grid grid-cols-4 gap-2 mt-2.5">
                            {[50, 100, 500, 1000].map(addVal => (
                              <button
                                key={addVal} type="button"
                                onClick={() => setCustomBuyCount(addVal)}
                                className={`py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                  customBuyCount === addVal
                                    ? 'bg-[#6D28D9] border-[#6D28D9] text-white shadow-xs'
                                    : 'bg-[#F5F5F5] dark:bg-[#1F2937] border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#E5E7EB]'
                                }`}
                              >
                                {addVal} lượt
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Real-time Calculation Breakdown */}
                        <div className="p-4 rounded-xl bg-[#F5F5F5] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] space-y-2 text-xs">
                          <div className="flex justify-between text-[#6B7280] dark:text-[#9CA3AF]">
                            <span>Số lượt mua:</span>
                            <span className="font-mono text-[#111827] dark:text-[#F9FAFB] font-black">{count.toLocaleString('vi-VN')} lượt</span>
                          </div>
                          <div className="flex justify-between text-[#6B7280] dark:text-[#9CA3AF]">
                            <span>Tổng thành tiền gốc:</span>
                            <span className="font-mono">{rawTotal.toLocaleString('vi-VN')}đ</span>
                          </div>

                          {discount > 0 ? (
                            <div className="flex justify-between text-[#22C55E] font-bold pt-1.5 border-t border-[#E5E7EB] dark:border-[#374151]">
                              <span>🎁 Chiết khấu (cứ 50 lượt -50k):</span>
                              <span className="font-mono">-{discount.toLocaleString('vi-VN')}đ</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-[#F59E0B] italic pt-1 border-t border-[#E5E7EB] dark:border-[#374151]">
                              💡 Mẹo: Mua từ 50 lượt trở lên để được tự động giảm 50.000đ!
                            </div>
                          )}

                          <div className="flex justify-between text-sm font-black pt-2 border-t border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F9FAFB]">
                            <span>Tổng giá thanh toán:</span>
                            <span className="text-[#F59E0B] font-mono text-base">{totalPrice.toLocaleString('vi-VN')}đ</span>
                          </div>
                        </div>

                        <button
                          onClick={() => setConfirmPackage({ type: `custom_${count}`, name: `Gói Tùy Chọn (${count} Lượt)`, count, price: totalPrice })}
                          disabled={isLoading || count < 1 || ctv.balance < totalPrice}
                          className="w-full py-3.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98] transition-all duration-150"
                        >
                          {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                          {ctv.balance < totalPrice ? 'Số dư ví không đủ' : `Mua Ngay ${count} Lượt (${totalPrice.toLocaleString('vi-VN')}đ)`}
                        </button>
                      </div>
                    );
                  })()}

                  {/* PRESET QUICK CARDS HEADER */}
                  <div className="pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#F59E0B]" /> Các gói chọn nhanh có sẵn
                    </h3>

                    <div className="space-y-3">
                      {/* Preset 50 Lượt */}
                      {(() => {
                        const unitPrice = ctv.prices?.['1year'] || 65000;
                        const rawTotal = unitPrice * 50;
                        const discount = Math.floor(50 / 50) * 50000;
                        const price = rawTotal - discount;
                        const isLoading = buyingPackageType === '50';
                        return (
                          <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#111827] dark:text-[#F9FAFB] text-base">50 Lượt</span>
                                <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[10px] font-bold uppercase">Giảm 50k</span>
                              </div>
                              <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2 font-mono">
                                <span className="line-through">{rawTotal.toLocaleString('vi-VN')}đ</span>
                                <span className="font-bold text-[#22C55E] text-sm">{price.toLocaleString('vi-VN')}đ</span>
                              </div>
                            </div>
                            <button
                              onClick={() => setConfirmPackage({ type: '50', name: 'Gói 50 Lượt', count: 50, price })}
                              disabled={isLoading || ctv.balance < price}
                              className="px-4 py-2 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold text-xs disabled:opacity-50 shrink-0 cursor-pointer transition-all duration-150"
                            >
                              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Mua 50 Lượt'}
                            </button>
                          </div>
                        );
                      })()}

                      {/* Preset 500 Lượt */}
                      {(() => {
                        const unitPrice = ctv.prices?.['1year'] || 65000;
                        const rawTotal = unitPrice * 500;
                        const discount = Math.floor(500 / 50) * 50000;
                        const price = rawTotal - discount;
                        const isLoading = buyingPackageType === '500';
                        return (
                          <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#111827] dark:text-[#F9FAFB] text-base">500 Lượt</span>
                                <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] font-bold uppercase">Giảm 500k</span>
                              </div>
                              <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2 font-mono">
                                <span className="line-through">{rawTotal.toLocaleString('vi-VN')}đ</span>
                                <span className="font-bold text-[#F59E0B] text-sm">{price.toLocaleString('vi-VN')}đ</span>
                              </div>
                            </div>
                            <button
                              onClick={() => setConfirmPackage({ type: '500', name: 'Gói 500 Lượt', count: 500, price })}
                              disabled={isLoading || ctv.balance < price}
                              className="px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-bold text-xs disabled:opacity-50 shrink-0 cursor-pointer transition-all duration-150"
                            >
                              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Mua 500 Lượt'}
                            </button>
                          </div>
                        );
                      })()}

                      {/* Preset 1000 Lượt */}
                      {(() => {
                        const unitPrice = ctv.prices?.['1year'] || 65000;
                        const rawTotal = unitPrice * 1000;
                        const discount = Math.floor(1000 / 50) * 50000;
                        const price = rawTotal - discount;
                        const isLoading = buyingPackageType === '1000';
                        return (
                          <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#111827] dark:text-[#F9FAFB] text-base">1.000 Lượt</span>
                                <span className="px-2 py-0.5 rounded-full bg-[#6D28D9]/10 text-[#6D28D9] dark:text-[#8D71FF] text-[10px] font-bold uppercase">Giảm 1 Triệu</span>
                              </div>
                              <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2 font-mono">
                                <span className="line-through">{rawTotal.toLocaleString('vi-VN')}đ</span>
                                <span className="font-bold text-[#6D28D9] dark:text-[#8D71FF] text-sm">{price.toLocaleString('vi-VN')}đ</span>
                              </div>
                            </div>
                            <button
                              onClick={() => setConfirmPackage({ type: '1000', name: 'Gói 1.000 Lượt', count: 1000, price })}
                              disabled={isLoading || ctv.balance < price}
                              className="px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-xs disabled:opacity-50 shrink-0 cursor-pointer transition-all duration-150"
                            >
                              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Mua 1000 Lượt'}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-black flex items-center gap-2"><span className="text-xl">📜</span> Lịch Sử Đơn</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{orders.length} tài khoản đã kích hoạt</p>
                    </div>
                    <button onClick={() => token && fetchCtvData(token)} className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 cursor-pointer">
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {orders.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                      <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Chưa có đơn nào</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orders.map((o, i) => (
                        <div key={o.orderId || i} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#13111c] border border-slate-200 dark:border-white/[0.06]">
                          <div>
                            <div className="font-bold text-sm text-slate-900 dark:text-white">@{o.userUpgraded}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : ''}</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${o.packageId === 'lifetime' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'}`}>
                              {o.packageId === 'lifetime' ? '👑 Vĩnh Viễn' : '⭐ 1 Năm'}
                            </div>
                            <div className="font-mono font-black text-xs text-amber-600 dark:text-amber-400 mt-1">{(o.amount || 0).toLocaleString('vi-VN')}đ</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'leaderboard' && (
                <div className="py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-black flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" /> Bảng Xếp Hạng CTV
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Top Cộng Tác Viên có doanh số nạp & kích hoạt cao nhất</p>
                    </div>
                    <button onClick={fetchLeaderboard} className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 cursor-pointer">
                      <RefreshCw className={`w-4 h-4 ${isLeaderboardLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {leaderboard.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                      <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30 text-amber-500" />
                      <p className="text-sm font-bold">Đang cập nhật bảng xếp hạng...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Top 3 Podium (Mobile) */}
                      <div className="grid grid-cols-3 gap-2">
                        {leaderboard.slice(0, 3).map((item) => {
                          const isTop1 = item.rank === 1;
                          const isTop2 = item.rank === 2;
                          const isTop3 = item.rank === 3;
                          return (
                            <div
                              key={item.username}
                              className={`p-3 rounded-2xl border text-center relative overflow-hidden flex flex-col justify-between ${
                                isTop1
                                  ? 'bg-linear-to-b from-amber-500/20 to-amber-500/5 border-amber-400/50 dark:border-amber-500/30'
                                  : isTop2
                                  ? 'bg-linear-to-b from-slate-400/20 to-slate-400/5 border-slate-300 dark:border-slate-500/30'
                                  : 'bg-linear-to-b from-amber-700/20 to-amber-700/5 border-amber-600/30'
                              }`}
                            >
                              <div>
                                <div className="w-10 h-10 mx-auto mb-1 flex items-center justify-center">
                                  {isTop1 ? (
                                    <img src="/assets/vip1.gif" alt="VIP 1" className="w-9 h-9 object-contain drop-shadow-sm" />
                                  ) : isTop2 ? (
                                    <img src="/assets/vip2.png" alt="VIP 2" className="w-9 h-9 object-contain drop-shadow-sm" />
                                  ) : isTop3 ? (
                                    <img src="/assets/vip3.png" alt="VIP 3" className="w-9 h-9 object-contain drop-shadow-sm" />
                                  ) : (
                                    <span className="text-xl">🏅</span>
                                  )}
                                </div>
                                <div className="font-black text-xs text-slate-900 dark:text-white truncate">
                                  @{item.username}
                                </div>
                              </div>
                              <div className="mt-2">
                                <div className="font-mono font-black text-xs text-amber-600 dark:text-amber-400">
                                  {item.totalAmount.toLocaleString('vi-VN')}đ
                                </div>
                                <div className="text-[10px] text-slate-400 font-bold">{item.totalOrders} đơn</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Ranks 4+ List */}
                      <div className="space-y-2 pt-2">
                        {leaderboard.slice(3).map((item) => {
                          const isMe = ctv?.username && item.username.toLowerCase() === ctv.username.toLowerCase();
                          return (
                            <div
                              key={item.username}
                              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                                isMe
                                  ? 'bg-purple-50 dark:bg-purple-500/15 border-purple-500/40'
                                  : 'bg-white dark:bg-[#13111c] border-slate-200 dark:border-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 font-black text-xs flex items-center justify-center">
                                  #{item.rank}
                                </span>
                                <div>
                                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                                    @{item.username}
                                    {isMe && <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[9px] font-black">Bạn</span>}
                                  </div>
                                  <div className="text-[11px] text-slate-400">{item.totalOrders} đơn nâng cấp</div>
                                </div>
                              </div>
                              <div className="font-mono font-black text-xs text-amber-600 dark:text-amber-400">
                                {item.totalAmount.toLocaleString('vi-VN')}đ
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'api' && (
                <div className="py-4 space-y-4">
                  <div className="p-5 rounded-3xl bg-white dark:bg-[#13111c] border border-slate-200 dark:border-white/[0.06] space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black flex items-center gap-2"><Key className="w-4 h-4 text-indigo-500" /> Quản Lý API Key</h3>
                      <button
                        onClick={() => {
                          if (!isEditingApiKey) setCustomApiKeyInput(ctv.apiKey || '');
                          setIsEditingApiKey(!isEditingApiKey);
                        }}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        {isEditingApiKey ? 'Hủy chỉnh sửa' : '✏️ Chỉnh sửa Key'}
                      </button>
                    </div>

                    {isEditingApiKey ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customApiKeyInput}
                          onChange={e => setCustomApiKeyInput(e.target.value)}
                          placeholder="Nhập API Key tùy chỉnh của bạn..."
                          className="flex-1 px-3 py-2 rounded-2xl bg-slate-100 dark:bg-black/40 font-mono text-xs text-slate-900 dark:text-white border border-slate-300 dark:border-white/10 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => handleSaveCustomApiKey(customApiKeyInput)}
                          disabled={isSavingCustomKey || !customApiKeyInput}
                          className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                        >
                          {isSavingCustomKey ? 'Đang lưu...' : 'Lưu'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-black/40 font-mono text-xs text-amber-600 dark:text-amber-400 truncate">
                          {ctv.apiKey || 'Chưa khởi tạo'}
                        </div>
                        <button onClick={() => { if (ctv.apiKey) { navigator.clipboard.writeText(ctv.apiKey); setCopiedApiKey(true); setTimeout(() => setCopiedApiKey(false), 2000); } }} className="p-2.5 rounded-2xl bg-slate-100 dark:bg-white/[0.06] cursor-pointer" title="Copy Key">
                          {copiedApiKey ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
                        </button>
                        <button onClick={handleRegenKey} disabled={isRegenKeyLoading} className="p-2.5 rounded-2xl bg-slate-100 dark:bg-white/[0.06] cursor-pointer" title="Tạo ngẫu nhiên">
                          <RefreshCw className={`w-4 h-4 text-slate-500 ${isRegenKeyLoading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    )}
                    <a href="/postman" className="flex items-center justify-between py-3 px-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-xs font-bold">
                      <span>📖 Xem hướng dẫn Postman API đầy đủ</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="p-5 rounded-3xl bg-white dark:bg-[#13111c] border border-slate-200 dark:border-white/[0.06] space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black flex items-center gap-2"><Bell className="w-4 h-4 text-sky-500" /> Telegram Bot</h3>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ctv.telegramChatId ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500'}`}>
                        {ctv.telegramChatId ? '🟢 Đã liên kết' : '⚪ Chưa kết nối'}
                      </span>
                    </div>
                    {botUsername ? (
                      <a href={`https://t.me/${botUsername}?start=${ctv.apiKey || ctv.username}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm">
                        🚀 Kết nối Telegram (1-click)
                      </a>
                    ) : (
                      <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center w-full py-3.5 rounded-2xl bg-sky-500 text-white font-bold text-sm">
                        📲 Mở Telegram Bot
                      </a>
                    )}
                    <details className="text-xs text-slate-500">
                      <summary className="cursor-pointer font-bold text-slate-600 dark:text-slate-300">⚙️ Nhập Chat ID thủ công</summary>
                      <form onSubmit={handleSaveTelegram} className="mt-2.5 flex gap-2">
                        <Input type="text" value={telegramInput} onChange={e => setTelegramInput(e.target.value)} placeholder="Chat ID..." className="text-xs" />
                        <button type="submit" disabled={isSavingTelegram} className="px-4 rounded-2xl bg-purple-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50">Lưu</button>
                      </form>
                    </details>
                  </div>

                  <div className="p-5 rounded-3xl bg-white dark:bg-[#13111c] border border-slate-200 dark:border-white/[0.06] space-y-3">
                    <h3 className="text-sm font-black flex items-center gap-2"><Lock className="w-4 h-4 text-purple-500" /> Đổi Mật Khẩu</h3>
                    <form onSubmit={handleChangePassword} className="space-y-2.5">
                      <Input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required placeholder="Mật khẩu hiện tại" className="text-sm" />
                      <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Mật khẩu mới (≥4 ký tự)" className="text-sm" />
                      <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Xác nhận mật khẩu mới" className="text-sm" />
                      <button type="submit" disabled={isChangingPassword} className="w-full py-3.5 rounded-2xl bg-purple-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                        {isChangingPassword ? <RefreshCw className="w-4 h-4 animate-spin inline" /> : '🔒 Cập Nhật Mật Khẩu'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Navigation Tab Bar (Mobile) */}
            <div className="flex-shrink-0 border-t border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0d0d14] px-2 pb-safe">
              <div className="flex">
                {TABS.map(tab => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 cursor-pointer transition-colors ${
                        active ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl ${active ? 'bg-purple-100 dark:bg-purple-500/20' : ''}`}>
                        {tab.icon}
                      </div>
                      <span className={`text-[10px] font-bold ${active ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-600'}`}>
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>


          {/* ─────────────────────────────────────────────────────────── */}
          {/* PC / DESKTOP VIEW (≥ md) - BRAND NEW PREMIUM DESKTOP LAYOUT  */}
          {/* ─────────────────────────────────────────────────────────── */}
          <div className="hidden md:flex min-h-screen bg-[#f8fafc] dark:bg-[#090d16]">
            
            {/* ── 1. Desktop Left Sidebar ── */}
            <aside className="w-64 lg:w-72 bg-white dark:bg-[#111827] border-r border-slate-200/80 dark:border-white/10 flex flex-col justify-between shrink-0 sticky top-0 h-screen z-20">
              <div className="p-6 space-y-6">
                
                {/* Brand Logo */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
                    <Crown className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                    <h1 className="font-black text-lg text-slate-900 dark:text-white leading-tight">Portal CTV</h1>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">Locket Gold v2.0</span>
                    </div>
                  </div>
                </div>

                {/* CTV User Info Card */}
                <div className="p-4 rounded-2xl bg-slate-900 dark:bg-black/40 border border-slate-800 dark:border-purple-500/30 text-white shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={() => { setSelectedAvatar(ctv.avatar || ''); setAvatarModalOpen(true); }}
                        className="w-10 h-10 rounded-xl bg-[#6D28D9]/20 border border-[#6D28D9]/40 flex items-center justify-center text-[#6D28D9] dark:text-[#8D71FF] font-black text-sm shrink-0 relative group cursor-pointer overflow-hidden transition-transform hover:scale-105"
                        title="Bấm để chọn ảnh đại diện"
                      >
                        {ctv.avatar ? (
                          <img src={ctv.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          ctv.username.charAt(0).toUpperCase()
                        )}
                        {myVipLevel === 1 && (
                          <img src="/assets/vip1.gif" alt="Huy hiệu VIP 1" className="w-5 h-5 absolute -top-1.5 -right-1.5 drop-shadow-md z-10" title="Huy hiệu VIP 1 (Top 1)" />
                        )}
                        {myVipLevel === 2 && (
                          <img src="/assets/vip2.png" alt="Huy hiệu VIP 2" className="w-5 h-5 absolute -top-1.5 -right-1.5 drop-shadow-md z-10" title="Huy hiệu VIP 2 (Top 2)" />
                        )}
                        {myVipLevel === 3 && (
                          <img src="/assets/vip3.png" alt="Huy hiệu VIP 3" className="w-5 h-5 absolute -top-1.5 -right-1.5 drop-shadow-md z-10" title="Huy hiệu VIP 3 (Top 3)" />
                        )}
                      </button>
                      <div className="truncate">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400 font-medium">Cộng Tác Viên</span>
                          {myVipLevel === 1 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-[9px] font-black text-amber-300 flex items-center gap-0.5">
                              <img src="/assets/vip1.gif" alt="VIP 1" className="w-3.5 h-3.5 object-contain" /> VIP 1
                            </span>
                          )}
                          {myVipLevel === 2 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-400/20 border border-slate-300/30 text-[9px] font-black text-slate-200 flex items-center gap-0.5">
                              <img src="/assets/vip2.png" alt="VIP 2" className="w-3.5 h-3.5 object-contain" /> VIP 2
                            </span>
                          )}
                          {myVipLevel === 3 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-800/20 border border-amber-700/30 text-[9px] font-black text-amber-400 flex items-center gap-0.5">
                              <img src="/assets/vip3.png" alt="VIP 3" className="w-3.5 h-3.5 object-contain" /> VIP 3
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-black truncate">@{ctv.username}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Số dư ví</div>
                      <div className="text-lg font-black text-amber-400 font-mono">
                        {ctv.balance.toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('deposit')}
                      className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-sm"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Nạp
                    </button>
                  </div>
                </div>

                {/* Sidebar Navigation Links */}
                <nav className="space-y-1.5 pt-2">
                  <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Menu Quản Lý
                  </div>
                  {TABS.map(t => {
                    const active = activeTab === t.id;
                    return (
                      <motion.button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.97 }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all duration-150 ${
                          active
                            ? 'bg-[#6D28D9] text-white shadow-xs'
                            : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F5F5F5] dark:hover:bg-[#1F2937] hover:text-[#111827] dark:hover:text-[#F9FAFB]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base">{t.icon}</span>
                          <span>{t.label}</span>
                        </div>
                        {active && <ChevronRight className="w-4 h-4 text-white/70" />}
                      </motion.button>
                    );
                  })}
                </nav>
              </div>

              {/* Sidebar Footer Controls */}
              <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.07] space-y-3">
                {botUsername && (
                  <a
                    href={`https://t.me/${botUsername}?start=${ctv.apiKey || ctv.username}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-bold hover:bg-sky-100 transition-colors"
                  >
                    <span className="flex items-center gap-2"><Bell className="w-4 h-4" /> Tele Bot Alert</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <span className="text-xs font-semibold text-slate-500">Giao diện</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Đăng xuất"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-bold cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Thoát
                  </button>
                </div>
              </div>
            </aside>

            {/* ── 2. Desktop Main Content Area ── */}
            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
              
              {/* Desktop Sticky Header */}
              <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#08070d]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.07] px-8 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{currentTabInfo.icon}</span>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">{currentTabInfo.title}</h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{currentTabInfo.desc}</p>
                </div>

                <div className="flex items-center gap-4">
                  {/* Status Indicator */}
                  <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    System Online 24/7
                  </div>

                  {/* Header Balance Pill */}
                  <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                    <Wallet className="w-4 h-4 text-amber-500" />
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Số Dư</div>
                      <div className="text-sm font-black font-mono text-amber-600 dark:text-amber-400 leading-none">
                        {ctv.balance.toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('deposit')}
                      className="ml-2 p-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </header>

              {/* Desktop Body Content */}
              <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 12, scale: 0.995 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.995 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  >

                {/* ────────────────────────────────────────────────── */}
                {/* TAB: UPGRADE (PC GRID) */}
                {/* ────────────────────────────────────────────────── */}
                {activeTab === 'upgrade' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left: Form Controls (7 cols) */}
                    <div className="lg:col-span-7 space-y-6">
                      <div className="p-7 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] shadow-xl shadow-purple-500/5 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-4">
                          <div>
                            <h3 className="text-lg font-black flex items-center gap-2">
                              <Crown className="w-5 h-5 text-amber-500" /> Nâng Cấp Tài Khoản Locket Gold
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Kích hoạt trực tiếp theo Username Locket của khách hàng</p>
                          </div>
                          <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-bold">
                            Tự động 100%
                          </span>
                        </div>

                        <form onSubmit={handleUpgrade} className="space-y-6">
                          
                          {/* Username Input */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                              <span>Username Locket của khách</span>
                              <span className="text-slate-400 font-normal">Ví dụ: vanle</span>
                            </label>
                            <div className="relative flex items-center">
                              <Input
                                type="text"
                                value={targetUser}
                                onChange={e => setTargetUser(extractLocketUsername(e.target.value))}
                                onPaste={e => {
                                  const text = e.clipboardData.getData('text');
                                  if (text) {
                                    e.preventDefault();
                                    setTargetUser(extractLocketUsername(text));
                                  }
                                }}
                                required
                                placeholder="Nhập username hoặc dán link Locket (locket.cam/...)"
                                className="py-4 pr-28 text-base font-semibold"
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {isSearchingUser ? (
                                  <div className="flex items-center gap-1.5 text-xs text-purple-500 font-bold bg-white dark:bg-[#12101d] px-2 py-1 rounded-lg">
                                    <RefreshCw className="w-4 h-4 animate-spin text-purple-500" /> Đang kiểm tra...
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={handlePasteClipboard}
                                    className="px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 active:scale-95 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-purple-500/20 shadow-sm"
                                    title="Dán link hoặc username từ bộ nhớ tạm"
                                  >
                                    <Clipboard className="w-4 h-4" />
                                    <span>Dán</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Package Selection Cards */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">
                              Chọn phương thức & gói kích hoạt Locket Gold
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                {
                                  id: 'quota' as const,
                                  title: '📦 1 Năm (Lượt Gói)',
                                  badge: 'Gói Lượt',
                                  desc: `Trừ 1 lượt (Còn ${(ctv.remainingRequests || 0).toLocaleString('vi-VN')} lượt)`,
                                  priceText: '1 Lượt Gói',
                                  isQuota: true
                                },
                                {
                                  id: '1year' as const,
                                  title: '⭐ 1 Năm (Ví CTV)',
                                  badge: 'Trừ Ví',
                                  desc: 'Bảo hành 12 tháng đầy đủ',
                                  priceText: `${(ctv.prices?.['1year'] || 65000).toLocaleString('vi-VN')}đ`,
                                  isQuota: false
                                },
                                {
                                  id: 'lifetime' as const,
                                  title: '👑 Vĩnh Viễn (Ví CTV)',
                                  badge: 'Dùng Mãi Mãi',
                                  desc: 'Kích hoạt vĩnh viễn',
                                  priceText: `${(ctv.prices?.['lifetime'] || 350000).toLocaleString('vi-VN')}đ`,
                                  isQuota: false
                                },
                              ].map(pkg => {
                                const selected = selectedPkg === pkg.id;
                                return (
                                  <div
                                    key={pkg.id}
                                    onClick={() => setSelectedPkg(pkg.id)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 relative overflow-hidden flex flex-col justify-between ${
                                      selected
                                        ? 'border-[#6D28D9] bg-[#6D28D9]/10 shadow-xs'
                                        : 'border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] hover:border-[#D1D5DB] dark:hover:border-[#4B5563]'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${selected ? 'bg-[#6D28D9] text-white' : 'bg-[#F5F5F5] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]'}`}>
                                          {pkg.badge}
                                        </span>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selected ? 'border-[#6D28D9] bg-[#6D28D9] text-white' : 'border-[#D1D5DB] dark:border-[#4B5563]'}`}>
                                          {selected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                        </div>
                                      </div>
                                      <div className="text-base font-black font-mono text-purple-600 dark:text-purple-400 mt-1">
                                        {pkg.priceText}
                                      </div>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 border-t border-slate-200/60 dark:border-white/5 pt-1.5">
                                      {pkg.desc}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Total & Summary Box */}
                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between">
                            <div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">Hình thức thanh toán</div>
                              <div className="text-base font-black text-slate-900 dark:text-white">
                                {selectedPkg === 'quota' ? '📦 Trừ 1 Lượt Gói 1 Năm' : selectedPkg === 'lifetime' ? '👑 Gói Vĩnh Viễn (Số Dư Ví)' : '⭐ Gói 1 Năm (Số Dư Ví)'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-500 dark:text-slate-400">Chi phí</div>
                              <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                                {selectedPkg === 'quota' ? '1 Lượt Gói' : `${((ctv.prices?.[selectedPkg]) || (selectedPkg === 'lifetime' ? 350000 : 65000)).toLocaleString('vi-VN')}đ`}
                              </div>
                            </div>
                          </div>

                          {/* Submit Button */}
                          <button
                            type="submit"
                            disabled={isUpgrading || !targetUser.trim() || !!liveUser?.hasActiveGold || (!!liveUser && (liveUser.valid === false || !liveUser.uid))}
                            className="w-full py-4 rounded-2xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-base disabled:opacity-40 cursor-pointer shadow-xl shadow-purple-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                          >
                            {isUpgrading ? (
                              <><RefreshCw className="w-5 h-5 animate-spin" /> Đang kích hoạt Locket Gold...</>
                            ) : liveUser && (liveUser.valid === false || !liveUser.uid) ? (
                              '❌ Username không tồn tại'
                            ) : liveUser?.hasActiveGold ? (
                              '⚠️ Tài khoản đã có Locket Gold'
                            ) : (
                              <><Crown className="w-5 h-5 text-amber-300" /> Xác Nhận Kích Hoạt Ngay</>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Right: Live Preview & System Guarantee (5 cols) */}
                    <div className="lg:col-span-5 space-y-6">
                      
                      {/* Live User Card Preview */}
                      <div className="p-6 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] shadow-xl shadow-purple-500/5 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Kiểm tra thông tin tài khoản
                        </h4>

                        {liveUser ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200/60 dark:border-white/[0.06]">
                              <div className="relative">
                                {liveUser.avatar ? (
                                  <img src={liveUser.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover border border-purple-500/30 shadow-md" />
                                ) : (
                                  <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
                                    {(liveUser.username || targetUser).charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-base font-black text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                  {liveUser.full_name || liveUser.username}
                                  {liveUser.uid && liveUser.valid !== false && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                                  {liveUser.hasActiveGold && (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-[10px] font-black text-amber-500">
                                      <Crown className="w-3 h-3 text-amber-500" /> Gold Active
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">@{liveUser.username || targetUser}</div>
                                {liveUser.uid && <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">UID: {liveUser.uid}</div>}
                              </div>
                            </div>

                            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
                              liveUser.valid === false || !liveUser.uid
                                ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400'
                                : liveUser.hasActiveGold
                                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400'
                                : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                            }`}>
                              {liveUser.valid === false || !liveUser.uid ? (
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                              ) : liveUser.hasActiveGold ? (
                                <Crown className="w-5 h-5 shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-5 h-5 shrink-0" />
                              )}
                              <div className="text-xs font-bold">
                                {liveUser.valid === false || !liveUser.uid ? (
                                  'Tài khoản này không tồn tại trên Locket. Vui lòng kiểm tra lại chính xác username.'
                                ) : liveUser.hasActiveGold ? (
                                  'Tài khoản này đã sở hữu Locket Gold từ trước!'
                                ) : (
                                  'Tài khoản hợp lệ! Đủ điều kiện để kích hoạt Locket Gold tức thì.'
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-white/[0.08] rounded-2xl">
                            <User className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-xs text-slate-400">Nhập username ở bên trái để xem trước ảnh đại diện và thông tin tài khoản Locket</p>
                          </div>
                        )}
                      </div>

                      {/* System Guarantees */}
                      <div className="p-6 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Cam kết hệ thống CTV
                        </h4>
                        <div className="space-y-3">
                          {[
                            { title: 'Kích hoạt tức thì (3s)', desc: 'Xử lý tự động qua API kết nối máy chủ Locket' },
                            { title: 'An toàn 100%', desc: 'Không bao giờ cần mật khẩu Locket của khách hàng' },
                            { title: 'Bảo hành đầy đủ', desc: 'Bảo hành theo thời hạn gói đăng ký cho khách hàng' },
                          ].map((item, idx) => (
                            <div key={idx} className="flex items-start gap-3 text-xs">
                              <div className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{item.title}</div>
                                <div className="text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                )}


                {/* ────────────────────────────────────────────────── */}
                {/* TAB: DEPOSIT (PC GRID) */}
                {/* ────────────────────────────────────────────────── */}
                {activeTab === 'deposit' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left: VietQR & Preset Amounts (5 cols) */}
                    <div className="lg:col-span-5 space-y-6">
                      <div className="p-7 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] shadow-xl shadow-amber-500/5 text-center space-y-6">
                        <div>
                          <span className="px-3.5 py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-black">
                            ⚡ Nạp Tiền VietQR Auto 10s
                          </span>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white mt-3">Quét Mã QR Chuyển Khoản</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Mở app Ngân hàng → Quét mã QR → Tiền vào ví tự động</p>
                        </div>

                        {/* VietQR Box */}
                        <div className="relative inline-block p-4 rounded-3xl bg-white border border-slate-200 dark:border-white/10 shadow-lg">
                          <img src={vietQrUrl} alt="VietQR" className="w-56 h-56 mx-auto rounded-xl object-contain" />
                          <div className="mt-2 text-xs font-bold text-slate-600">Ngân hàng {bankInfo.bankBrand} • {bankInfo.accountNo}</div>
                        </div>

                        {/* Quick Preset Amounts */}
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 text-left">Chọn nhanh số tiền nạp</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[100000, 200000, 500000, 1000000, 2000000, 5000000].map(amt => (
                              <button
                                key={amt} type="button" onClick={() => setDepositAmount(amt)}
                                className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                                  depositAmount === amt
                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-sm'
                                    : 'border-slate-200 dark:border-white/[0.07] bg-slate-50/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-amber-300'
                                }`}
                              >
                                {amt.toLocaleString('vi-VN')}đ
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Input Amount */}
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 text-left mb-1.5">Số tiền khác (VNĐ)</label>
                          <Input
                            type="number" value={depositAmount}
                            onChange={e => setDepositAmount(Number(e.target.value))}
                            step={10000} min={10000}
                            className="font-mono font-black text-amber-600 dark:text-amber-400 text-center text-lg py-3.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right: Fixed Memo & Account Info (7 cols) */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {/* Fixed Deposit Code Box */}
                      <div className="p-7 rounded-3xl bg-amber-50/80 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/30 shadow-xl space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black text-sm">🔑</span>
                          <div>
                            <h4 className="text-base font-black text-amber-900 dark:text-amber-300">Mã Nạp Tiền Cố Định Của Bạn</h4>
                            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">Dùng mã này làm Nội Dung Chuyển Khoản cho mọi lần nạp</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="flex-1 px-5 py-4 rounded-2xl bg-white dark:bg-black/50 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-mono font-black text-xl tracking-wider shadow-inner">
                            {depositMemo}
                          </span>
                          <button
                            type="button"
                            onClick={() => { try { navigator.clipboard.writeText(depositMemo); setCopiedMemo(true); setTimeout(() => setCopiedMemo(false), 2000); } catch (_) {} }}
                            className="px-5 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shrink-0 cursor-pointer flex items-center gap-2 shadow-md active:scale-95 transition-all"
                          >
                            {copiedMemo ? <CheckCircle2 className="w-5 h-5 text-emerald-950" /> : <Copy className="w-5 h-5" />}
                            {copiedMemo ? 'Đã copy!' : 'Sao chép'}
                          </button>
                        </div>

                        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                          ⚠️ <strong>QUAN TRỌNG:</strong> Hãy nhập đúng mã <code className="font-bold font-mono bg-amber-200/50 dark:bg-amber-500/20 px-1 rounded">{depositMemo}</code> vào lời nhắn/nội dung chuyển khoản. Hệ thống tự động nhận diện và cộng số dư trong 10 giây.
                        </p>
                      </div>

                      {/* Bank Details Breakdown */}
                      <div className="p-7 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] shadow-xl space-y-4">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Thông tin chuyển khoản ngân hàng
                        </h4>

                        <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-sm">
                          <div className="py-3 flex justify-between items-center">
                            <span className="text-slate-500">Ngân hàng thụ hưởng</span>
                            <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.06] px-3 py-1 rounded-xl">{bankInfo.bankBrand} (SePay Auto)</span>
                          </div>

                          <div className="py-3 flex justify-between items-center">
                            <span className="text-slate-500">Số tài khoản</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-base text-amber-600 dark:text-amber-400">{bankInfo.accountNo}</span>
                              <button onClick={() => { try { navigator.clipboard.writeText(bankInfo.accountNo); setCopiedMemo(true); setTimeout(() => setCopiedMemo(false), 2000); } catch (_) {} }} className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] cursor-pointer">
                                <Copy className="w-4 h-4 text-slate-500" />
                              </button>
                            </div>
                          </div>

                          <div className="py-3 flex justify-between items-center">
                            <span className="text-slate-500">Chủ tài khoản</span>
                            <span className="font-black text-slate-900 dark:text-white">{bankInfo.accountName}</span>
                          </div>

                          <div className="py-3 flex justify-between items-center">
                            <span className="text-slate-500">Nội dung chuyển khoản</span>
                            <span className="font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-200 dark:border-amber-500/20">{depositMemo}</span>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200/60 dark:border-white/[0.06] flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <Zap className="w-5 h-5 text-amber-500 shrink-0" />
                          <span>Hệ thống quét ngân hàng tự động liên tục 24/7. Tiền sẽ vào ví của bạn ngay lập tức khi ngân hàng ghi nhận chuyển khoản thành công.</span>
                        </div>
                      </div>

                    </div>
                  </div>
                )}


                {/* ────────────────────────────────────────────────── */}
                {/* TAB: PACKAGES (PC GLASS CARDS) */}
                {/* ────────────────────────────────────────────────── */}
                {activeTab === 'packages' && (
                  <div className="space-y-8">
                    {/* Header Banner */}
                    <div className="p-8 rounded-2xl bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] shadow-xs relative overflow-hidden border border-[#E5E7EB] dark:border-[#374151]">
                      <div className="relative z-10 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#6D28D9]/10 text-[#6D28D9] dark:text-[#8D71FF] text-xs font-bold">
                            <Package className="w-4 h-4" /> Mua Gói Lượt Nạp Locket Gold (1 Năm)
                          </div>
                          <span className="px-3 py-1 rounded-full bg-[#F5F5F5] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF] text-xs font-mono font-bold border border-[#E5E7EB] dark:border-[#374151]">
                            ⚡ Đơn giá chuẩn: {((ctv.prices?.[ '1year' ] || 65000)).toLocaleString('vi-VN')}đ / lượt
                          </span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight text-[#111827] dark:text-[#F9FAFB]">Mua Gói Lượt Nâng Cấp Chiết Khấu Cao</h2>
                        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed max-w-3xl">
                          Mua gói lượt để chủ động nạp nhanh cho khách! Mỗi lượt tương đương 1 lần kích hoạt Locket Gold 1 Năm. Hệ thống tự động trừ 1 lượt khi nạp đơn mà không cần trừ thêm tiền ví.
                        </p>

                        <div className="pt-3 flex items-center gap-4">
                          <div className="px-5 py-2.5 rounded-xl bg-[#F5F5F5] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] flex items-center gap-3">
                            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium">Kho lượt gói hiện có của bạn:</span>
                            <span className="text-xl font-black text-[#F59E0B] font-mono">{(ctv.remainingRequests || 0).toLocaleString('vi-VN')} lượt</span>
                          </div>
                          <div className="px-4 py-2.5 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] text-xs font-bold flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-[#F59E0B]" /> Cứ mỗi 50 lượt mua sẽ được TỰ ĐỘNG GIẢM 50.000đ
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Main Layout: Calculator Spotlight + Preset Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      
                      {/* LEFT: INTERACTIVE CALCULATOR (7 COLS) */}
                      <div className="lg:col-span-7 p-8 rounded-2xl bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] space-y-6 border border-[#E5E7EB] dark:border-[#374151] shadow-xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="px-3.5 py-1 rounded-full bg-[#6D28D9]/10 text-[#6D28D9] dark:text-[#8D71FF] text-xs font-bold uppercase tracking-wider">
                              ✨ Tính Toán & Mua Số Lượt Tùy Chọn
                            </span>
                            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">Nhập số lượng lượt bất kỳ để hệ thống tự áp mã giảm giá chiết khấu</p>
                          </div>
                          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono font-bold bg-[#F5F5F5] dark:bg-[#1F2937] px-3 py-1 rounded-xl border border-[#E5E7EB] dark:border-[#374151]">
                            Đơn giá: {((ctv.prices?.[ '1year' ] || 65000)).toLocaleString('vi-VN')}đ
                          </span>
                        </div>

                        {/* Input Box & Quick Increment Pills */}
                        <div className="space-y-3">
                          <label className="block text-xs text-[#6B7280] dark:text-[#9CA3AF] font-bold flex items-center justify-between">
                            <span>Nhập số lượng lượt muốn mua:</span>
                            <span className="text-xs text-[#6D28D9] dark:text-[#8D71FF] font-bold">Bấm nấc chọn nhanh bên dưới</span>
                          </label>

                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={customBuyCount ? customBuyCount.toLocaleString('vi-VN') : ''}
                              onChange={e => {
                                const raw = parseInt(e.target.value.replace(/\D/g, ''), 10);
                                setCustomBuyCount(isNaN(raw) ? 0 : Math.max(1, raw));
                              }}
                              className="w-full px-5 py-4 rounded-xl bg-white dark:bg-[#0B0F17] border border-[#E5E7EB] dark:border-[#374151] text-[#F59E0B] font-bold text-2xl focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 pr-20 transition-all duration-150"
                              placeholder="Nhập số lượt..."
                            />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7280] dark:text-[#9CA3AF] pointer-events-none">lượt</span>
                          </div>

                          <div className="grid grid-cols-4 gap-2.5">
                            {[50, 100, 500, 1000].map(addVal => (
                              <button
                                key={addVal} type="button"
                                onClick={() => setCustomBuyCount(addVal)}
                                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                  customBuyCount === addVal
                                    ? 'bg-[#6D28D9] border-[#6D28D9] text-white shadow-xs'
                                    : 'bg-[#F5F5F5] dark:bg-[#1F2937] border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#E5E7EB] dark:hover:bg-[#374151]'
                                }`}
                              >
                                {addVal} lượt
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Real-time Calculation Breakdown Table */}
                        {(() => {
                          const unitPrice = ctv.prices?.['1year'] || 65000;
                          const count = Math.max(1, customBuyCount || 1);
                          const rawTotal = unitPrice * count;
                          const discount = Math.floor(count / 50) * 50000;
                          const totalPrice = Math.max(0, rawTotal - discount);
                          const isLoading = buyingPackageType === `custom_${count}`;

                          return (
                            <div className="space-y-4 pt-2">
                              <div className="p-5 rounded-xl bg-[#F5F5F5] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] space-y-2.5 text-xs">
                                <div className="flex justify-between text-[#6B7280] dark:text-[#9CA3AF]">
                                  <span>Số lượng lượt mua:</span>
                                  <span className="text-[#111827] dark:text-[#F9FAFB] font-bold text-sm">{count.toLocaleString('vi-VN')} lượt</span>
                                </div>
                                <div className="flex justify-between text-[#6B7280] dark:text-[#9CA3AF]">
                                  <span>Tổng thành tiền gốc:</span>
                                  <span className="font-bold text-[#111827] dark:text-[#F9FAFB]">{rawTotal.toLocaleString('vi-VN')}đ</span>
                                </div>

                                {discount > 0 ? (
                                  <div className="flex justify-between text-[#22C55E] font-bold pt-2 border-t border-[#E5E7EB] dark:border-[#374151]">
                                    <span>🎁 Chiết khấu ưu đãi (cứ 50 lượt -50k):</span>
                                    <span className="font-bold text-sm">-{discount.toLocaleString('vi-VN')}đ</span>
                                  </div>
                                ) : (
                                  <div className="text-xs text-[#F59E0B] italic pt-2 border-t border-[#E5E7EB] dark:border-[#374151] flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 shrink-0" />
                                    <span>Mẹo: Mua từ 50 lượt trở lên để được tự động giảm 50.000đ!</span>
                                  </div>
                                )}

                                <div className="flex justify-between items-center text-sm font-black pt-3 border-t border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F9FAFB]">
                                  <span className="text-base">Tổng tiền ví thanh toán:</span>
                                  <span className="text-[#F59E0B] font-bold text-2xl">{totalPrice.toLocaleString('vi-VN')}đ</span>
                                </div>
                              </div>

                              <button
                                onClick={() => setConfirmPackage({ type: `custom_${count}`, name: `Gói Tùy Chọn (${count} Lượt)`, count, price: totalPrice })}
                                disabled={isLoading || count < 1 || ctv.balance < totalPrice}
                                className="w-full py-4 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-base disabled:bg-slate-200 dark:disabled:bg-[#1F2937] disabled:text-[#9CA3AF] dark:disabled:text-[#6B7280] disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99] transition-all duration-150"
                              >
                                {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Package className="w-5 h-5" />}
                                {ctv.balance < totalPrice ? 'Số dư ví không đủ' : `Xác Nhận Mua ${count} Lượt (${totalPrice.toLocaleString('vi-VN')}đ)`}
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                      {/* RIGHT: QUICK PRESET CARDS (5 COLS) */}
                      <div className="lg:col-span-5 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2">
                          <Zap className="w-4 h-4 text-[#F59E0B]" /> Chọn nhanh gói nạp có sẵn
                        </h3>

                        {/* Preset 50 Lượt */}
                        {(() => {
                          const unitPrice = ctv.prices?.['1year'] || 65000;
                          const rawTotal = unitPrice * 50;
                          const discount = Math.floor(50 / 50) * 50000;
                          const price = rawTotal - discount;
                          const isLoading = buyingPackageType === '50';
                          return (
                            <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs flex items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[#111827] dark:text-[#F9FAFB] text-lg">50 Lượt</span>
                                  <span className="px-2.5 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[10px] font-bold uppercase">Giảm 50k</span>
                                </div>
                                <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2 font-bold">
                                  <span className="line-through text-[#9CA3AF]">{rawTotal.toLocaleString('vi-VN')}đ</span>
                                  <span className="font-bold text-[#22C55E] text-base">{price.toLocaleString('vi-VN')}đ</span>
                                </div>
                              </div>
                              <button
                                onClick={() => setConfirmPackage({ type: '50', name: 'Gói 50 Lượt', count: 50, price })}
                                disabled={isLoading || ctv.balance < price}
                                className="px-5 py-3 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold text-xs disabled:bg-slate-200 dark:disabled:bg-[#1F2937] disabled:text-[#9CA3AF] dark:disabled:text-[#6B7280] disabled:cursor-not-allowed shrink-0 cursor-pointer transition-all duration-150 active:scale-95"
                              >
                                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Mua 50 Lượt'}
                              </button>
                            </div>
                          );
                        })()}

                        {/* Preset 500 Lượt */}
                        {(() => {
                          const unitPrice = ctv.prices?.['1year'] || 65000;
                          const rawTotal = unitPrice * 500;
                          const discount = Math.floor(500 / 50) * 50000;
                          const price = rawTotal - discount;
                          const isLoading = buyingPackageType === '500';
                          return (
                            <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs flex items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[#111827] dark:text-[#F9FAFB] text-lg">500 Lượt</span>
                                  <span className="px-2.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] font-bold uppercase">Giảm 500k</span>
                                </div>
                                <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2 font-bold">
                                  <span className="line-through text-[#9CA3AF]">{rawTotal.toLocaleString('vi-VN')}đ</span>
                                  <span className="font-bold text-[#F59E0B] text-base">{price.toLocaleString('vi-VN')}đ</span>
                                </div>
                              </div>
                              <button
                                onClick={() => setConfirmPackage({ type: '500', name: 'Gói 500 Lượt', count: 500, price })}
                                disabled={isLoading || ctv.balance < price}
                                className="px-5 py-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-bold text-xs disabled:bg-slate-200 dark:disabled:bg-[#1F2937] disabled:text-[#9CA3AF] dark:disabled:text-[#6B7280] disabled:cursor-not-allowed shrink-0 cursor-pointer transition-all duration-150 active:scale-95"
                              >
                                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Mua 500 Lượt'}
                              </button>
                            </div>
                          );
                        })()}

                        {/* Preset 1000 Lượt */}
                        {(() => {
                          const unitPrice = ctv.prices?.['1year'] || 65000;
                          const rawTotal = unitPrice * 1000;
                          const discount = Math.floor(1000 / 50) * 50000;
                          const price = rawTotal - discount;
                          const isLoading = buyingPackageType === '1000';
                          return (
                            <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs flex items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[#111827] dark:text-[#F9FAFB] text-lg">1.000 Lượt</span>
                                  <span className="px-2.5 py-0.5 rounded-full bg-[#6D28D9]/10 text-[#6D28D9] dark:text-[#8D71FF] text-[10px] font-bold uppercase">Giảm 1 Triệu</span>
                                </div>
                                <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2 font-bold">
                                  <span className="line-through text-[#9CA3AF]">{rawTotal.toLocaleString('vi-VN')}đ</span>
                                  <span className="font-bold text-[#6D28D9] dark:text-[#8D71FF] text-base">{price.toLocaleString('vi-VN')}đ</span>
                                </div>
                              </div>
                              <button
                                onClick={() => setConfirmPackage({ type: '1000', name: 'Gói 1.000 Lượt', count: 1000, price })}
                                disabled={isLoading || ctv.balance < price}
                                className="px-5 py-3 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-xs disabled:bg-slate-200 dark:disabled:bg-[#1F2937] disabled:text-[#9CA3AF] dark:disabled:text-[#6B7280] disabled:cursor-not-allowed shrink-0 cursor-pointer transition-all duration-150 active:scale-95"
                              >
                                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Mua 1000 Lượt'}
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                    </div>
                  </div>
                )}


                {/* ────────────────────────────────────────────────── */}
                {/* TAB: HISTORY (PC DATA TABLE) */}
                {/* ────────────────────────────────────────────────── */}
                {activeTab === 'history' && (
                  <div className="space-y-6">
                    
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-3 gap-6">
                      <div className="p-6 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] shadow-lg">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng số đơn đã kích hoạt</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">{orders.length} đơn</div>
                      </div>

                      <div className="p-6 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] shadow-lg">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng chi tiêu kích hoạt</div>
                        <div className="text-2xl font-black text-amber-500 font-mono mt-1">
                          {orders.reduce((acc, o) => acc + (o.amount || 0), 0).toLocaleString('vi-VN')}đ
                        </div>
                      </div>

                      <div className="p-6 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] shadow-lg">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Số dư khả dụng trong ví</div>
                        <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono mt-1">
                          {ctv.balance.toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                    </div>

                    {/* Table Container */}
                    <div className="p-7 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] shadow-xl space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-black text-slate-900 dark:text-white">Lịch Sử Nâng Cấp Locket Gold</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Danh sách các tài khoản Locket bạn đã kích hoạt gói Gold thành công</p>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Search bar */}
                          <div className="relative w-64">
                            <Input
                              type="text"
                              value={historySearch}
                              onChange={e => setHistorySearch(e.target.value)}
                              placeholder="Tìm username..."
                              className="py-2.5 pl-9 text-xs"
                            />
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          </div>

                          <button onClick={() => token && fetchCtvData(token)} className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-200 transition-colors" title="Làm mới">
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                          </button>

                          {orders.length > 0 && (
                            <button
                              onClick={handleClearHistory}
                              className="px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Xóa toàn bộ lịch sử giao dịch"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa tất cả</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {filteredOrders.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-100 dark:border-white/[0.06] rounded-2xl">
                          <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="text-sm font-bold">Chưa tìm thấy đơn hàng nào</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-white/[0.06] text-slate-400 text-xs font-bold uppercase tracking-wider">
                                <th className="pb-3 px-4">Tài khoản Locket</th>
                                <th className="pb-3 px-4">Gói Kích Hoạt</th>
                                <th className="pb-3 px-4">Số Tiền</th>
                                <th className="pb-3 px-4">Thời Gian</th>
                                <th className="pb-3 px-4 text-right">Trạng Thái</th>
                                <th className="pb-3 px-4 text-center">Xóa</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                              {filteredOrders.map((o, i) => (
                                <tr key={o.orderId || i} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">
                                  <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 font-black flex items-center justify-center text-xs">
                                        {o.userUpgraded.charAt(0).toUpperCase()}
                                      </div>
                                      <span>@{o.userUpgraded}</span>
                                    </div>
                                  </td>
                                  <td className="py-4 px-4">
                                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${
                                      o.packageId === 'lifetime'
                                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300/30'
                                        : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-300/30'
                                    }`}>
                                      {o.packageId === 'lifetime' ? '👑 Gói Vĩnh Viễn' : '⭐ Gói 1 Năm'}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 font-mono font-black text-amber-600 dark:text-amber-400">
                                    {(o.amount || 0).toLocaleString('vi-VN')}đ
                                  </td>
                                  <td className="py-4 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                                    {o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : ''}
                                  </td>
                                  <td className="py-4 px-4 text-right">
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Thành công
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 text-center">
                                    <button
                                      onClick={() => handleDeleteOrder(o.orderId)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                      title="Xóa đơn hàng này"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* ────────────────────────────────────────────────── */}
                {/* TAB: LEADERBOARD (PC DASHBOARD) */}
                {/* ────────────────────────────────────────────────── */}
                {activeTab === 'leaderboard' && (
                  <div className="space-y-8">
                    
                    {/* Top 3 Podium Cards (PC) */}
                    <div className="grid grid-cols-3 gap-6 items-end pt-4">
                      {/* Top 2 */}
                      {leaderboard[1] && (
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -6, scale: 1.02 }}
                          transition={{ duration: 0.3 }}
                          className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs hover:shadow-md text-center space-y-3 relative overflow-hidden"
                        >
                          <motion.div
                            animate={{ y: [0, -3, 0] }}
                            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                            className="w-16 h-16 rounded-2xl bg-[#F5F5F5] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] font-black flex items-center justify-center mx-auto shadow-xs relative group"
                          >
                            <img src="/assets/vip2.png" alt="Huy hiệu VIP 2" className="w-14 h-14 object-contain drop-shadow-md transition-transform group-hover:scale-110" />
                          </motion.div>
                          <div>
                            <div className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider flex items-center justify-center gap-1">
                              <img src="/assets/vip2.png" alt="VIP 2" className="w-4 h-4 object-contain" />
                              <span>Á Quân Top 2 (VIP 2)</span>
                            </div>
                            <div className="text-base font-bold text-[#111827] dark:text-[#F9FAFB] mt-0.5">@{leaderboard[1].username}</div>
                          </div>
                          <div className="p-3 rounded-xl bg-[#F5F5F5] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151]">
                            <div className="text-lg font-bold font-mono text-[#111827] dark:text-[#F9FAFB]">
                              {leaderboard[1].totalAmount.toLocaleString('vi-VN')}đ
                            </div>
                            <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-semibold">{leaderboard[1].totalOrders} đơn đã kích hoạt</div>
                          </div>
                        </motion.div>
                      )}

                      {/* Top 1 (Center Spotlight & Explosive Glow) */}
                      {leaderboard[0] && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: -10 }}
                          whileHover={{ y: -16, scale: 1.03 }}
                          transition={{ type: 'spring', stiffness: 350, damping: 20 }}
                          className="p-8 rounded-2xl bg-white dark:bg-[#111827] border-2 border-[#F59E0B] shadow-md text-center space-y-4 relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 px-4 py-1.5 rounded-bl-xl bg-[#F59E0B] text-slate-950 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1 shadow-xs">
                            <img src="/assets/vip1.gif" alt="VIP 1" className="w-4 h-4 object-contain" />
                            👑 Champion VIP 1
                          </div>

                          <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                            className="w-20 h-20 rounded-2xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-slate-950 font-black flex items-center justify-center mx-auto shadow-md relative group"
                          >
                            <img src="/assets/vip1.gif" alt="Huy hiệu VIP 1" className="w-16 h-16 object-contain drop-shadow-md transition-transform group-hover:scale-115" />
                          </motion.div>

                          <div>
                            <div className="text-xs font-bold text-[#F59E0B] uppercase tracking-widest flex items-center justify-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                              <span>Quán Quân Top 1 (VIP 1)</span>
                            </div>
                            <div className="text-xl font-black text-[#111827] dark:text-[#F9FAFB] mt-1">@{leaderboard[0].username}</div>
                          </div>

                          <div className="p-4 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                            <div className="text-2xl font-black font-mono text-[#F59E0B]">
                              {leaderboard[0].totalAmount.toLocaleString('vi-VN')}đ
                            </div>
                            <div className="text-xs text-[#F59E0B] font-bold mt-0.5">{leaderboard[0].totalOrders} đơn đã kích hoạt</div>
                          </div>
                        </motion.div>
                      )}

                      {/* Top 3 */}
                      {leaderboard[2] && (
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -6, scale: 1.02 }}
                          transition={{ duration: 0.35 }}
                          className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs hover:shadow-md text-center space-y-3 relative overflow-hidden"
                        >
                          <motion.div
                            animate={{ y: [0, -3, 0] }}
                            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                            className="w-16 h-16 rounded-2xl bg-[#F5F5F5] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] font-black flex items-center justify-center mx-auto shadow-xs relative group"
                          >
                            <img src="/assets/vip3.png" alt="Huy hiệu VIP 3" className="w-14 h-14 object-contain drop-shadow-md transition-transform group-hover:scale-110" />
                          </motion.div>
                          <div>
                            <div className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider flex items-center justify-center gap-1">
                              <img src="/assets/vip3.png" alt="VIP 3" className="w-4 h-4 object-contain" />
                              <span>Quý Quân Top 3 (VIP 3)</span>
                            </div>
                            <div className="text-base font-bold text-[#111827] dark:text-[#F9FAFB] mt-0.5">@{leaderboard[2].username}</div>
                          </div>
                          <div className="p-3 rounded-xl bg-[#F5F5F5] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151]">
                            <div className="text-lg font-bold font-mono text-[#111827] dark:text-[#F9FAFB]">
                              {leaderboard[2].totalAmount.toLocaleString('vi-VN')}đ
                            </div>
                            <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-semibold">{leaderboard[2].totalOrders} đơn đã kích hoạt</div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Table Ranking (PC) */}
                    <div className="p-7 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-[#F59E0B]" /> Bảng Xếp Hạng Tổng Doanh Số CTV
                          </h3>
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">Cập nhật tự động dựa trên tổng số tiền nạp & số đơn kích hoạt thành công</p>
                        </div>
                        <button onClick={fetchLeaderboard} className="p-2.5 rounded-xl bg-[#F5F5F5] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF] cursor-pointer hover:bg-[#E5E7EB] transition-colors">
                          <RefreshCw className={`w-4 h-4 ${isLeaderboardLoading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-[#E5E7EB] dark:border-[#374151] text-[#6B7280] dark:text-[#9CA3AF] text-xs font-bold uppercase tracking-wider">
                              <th className="pb-3 px-4">Thứ Hạng</th>
                              <th className="pb-3 px-4">Cộng Tác Viên</th>
                              <th className="pb-3 px-4">Tổng Doanh Số Kích Hoạt</th>
                              <th className="pb-3 px-4">Đơn Đã Kích Hoạt</th>
                              <th className="pb-3 px-4 text-right">Danh Hiệu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#374151]">
                            {leaderboard.map((item, idx) => {
                              const isMe = ctv?.username && item.username.toLowerCase() === ctv.username.toLowerCase();
                              return (
                                <motion.tr
                                  key={item.username}
                                  initial={{ opacity: 0, x: -12 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.04, duration: 0.2 }}
                                  className={`transition-colors ${isMe ? 'bg-[#6D28D9]/10' : 'hover:bg-[#F5F5F5] dark:hover:bg-[#1F2937]'}`}
                                >
                                  <td className="py-4 px-4 font-black">
                                    <span className={`w-8 h-8 rounded-xl font-mono text-xs flex items-center justify-center ${
                                      item.rank === 1 ? 'bg-[#F59E0B] text-slate-950 font-black' : item.rank === 2 ? 'bg-[#E5E7EB] dark:bg-[#374151] text-[#111827] dark:text-[#F9FAFB]' : item.rank === 3 ? 'bg-[#F59E0B]/30 text-[#F59E0B]' : 'bg-[#F5F5F5] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]'
                                    }`}>
                                      #{item.rank}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 font-bold text-[#111827] dark:text-[#F9FAFB]">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-[#6D28D9] text-white font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                                        {item.avatar ? (
                                          <img src={item.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                          item.username.charAt(0).toUpperCase()
                                        )}
                                      </div>
                                      <span>@{item.username}</span>
                                      {isMe && <span className="px-2.5 py-0.5 rounded-full bg-[#6D28D9] text-white text-[10px] font-bold">Bạn</span>}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4 font-mono font-bold text-[#F59E0B] text-base">
                                    {item.totalAmount.toLocaleString('vi-VN')}đ
                                  </td>
                                  <td className="py-4 px-4 font-bold text-[#6B7280] dark:text-[#9CA3AF]">
                                    {item.totalOrders} đơn
                                  </td>
                                  <td className="py-4 px-4 text-right">
                                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${
                                      item.rank === 1 ? 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20' : item.rank <= 3 ? 'bg-[#6D28D9]/10 text-[#6D28D9] dark:text-[#8D71FF]' : 'bg-[#F5F5F5] dark:bg-[#1F2937] text-[#6B7280]'
                                    }`}>
                                      {item.rank === 1 ? '👑 Quán Quân' : item.rank === 2 ? '🥈 Á Quân' : item.rank === 3 ? '🥉 Quý Quân' : '⭐ Top CTV'}
                                    </span>
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ────────────────────────────────────────────────── */}
                {/* TAB: API & SETTINGS (PC GRID) */}
                {/* ────────────────────────────────────────────────── */}
                {activeTab === 'api' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* API Key Card */}
                    <div className="p-7 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] shadow-xl space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                            <Key className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white">API Key Tích Hợp</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Dùng để kết nối API từ website hoặc tool riêng của bạn</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-500">Mã API Key cá nhân</label>
                          <button
                            onClick={() => {
                              const promptKey = prompt('Nhập API Key tùy chỉnh mới của bạn:', ctv.apiKey || '');
                              if (promptKey && promptKey.trim()) {
                                handleSaveCustomApiKey(promptKey.trim());
                              }
                            }}
                            className="text-xs font-bold text-indigo-500 hover:underline cursor-pointer"
                          >
                            ✏️ Đổi API Key
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-black/50 font-mono text-sm text-amber-600 dark:text-amber-400 truncate border border-slate-200 dark:border-white/[0.06]">
                            {ctv.apiKey || 'Chưa khởi tạo'}
                          </div>
                          <button
                            onClick={() => { if (ctv.apiKey) { navigator.clipboard.writeText(ctv.apiKey); setCopiedApiKey(true); setTimeout(() => setCopiedApiKey(false), 2000); } }}
                            className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 cursor-pointer flex items-center gap-2 text-xs font-bold"
                          >
                            {copiedApiKey ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
                            {copiedApiKey ? 'Đã copy' : 'Copy'}
                          </button>
                          <button
                            onClick={handleRegenKey} disabled={isRegenKeyLoading}
                            className="p-3 rounded-2xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 cursor-pointer"
                            title="Tạo ngẫu nhiên lại Key"
                          >
                            <RefreshCw className={`w-4 h-4 text-slate-500 ${isRegenKeyLoading ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </div>

                      <a
                        href="/postman"
                        className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 transition-colors text-indigo-700 dark:text-indigo-300 text-xs font-bold"
                      >
                        <span>📖 Xem Tài Liệu API & Postman Collection Đầy Đủ</span>
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>

                    {/* Telegram Bot Card */}
                    <div className="p-7 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] shadow-xl space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-2xl bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400">
                            <Bell className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white">Thông Báo Telegram</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Nhận tin nhắn tự động khi số dư tăng hoặc kích hoạt thành công</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${ctv.telegramChatId ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500'}`}>
                          {ctv.telegramChatId ? '🟢 Đã kết nối' : '⚪ Chưa kết nối'}
                        </span>
                      </div>

                      {botUsername ? (
                        <a
                          href={`https://t.me/${botUsername}?start=${ctv.apiKey || ctv.username}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm shadow-lg shadow-sky-500/20 transition-all"
                        >
                          🚀 Kết Nối Telegram Bot (1-Click Autoconnect)
                        </a>
                      ) : (
                        <a
                          href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center w-full py-4 rounded-2xl bg-sky-500 text-white font-bold text-sm"
                        >
                          📲 Mở Telegram Bot
                        </a>
                      )}

                      <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                        <form onSubmit={handleSaveTelegram} className="flex gap-3">
                          <Input
                            type="text" value={telegramInput}
                            onChange={e => setTelegramInput(e.target.value)}
                            placeholder="Nhập Chat ID thủ công..." className="text-xs py-3"
                          />
                          <button type="submit" disabled={isSavingTelegram} className="px-5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0">
                            Lưu Chat ID
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Password Change Form */}
                    <div className="lg:col-span-2 p-7 rounded-3xl bg-white dark:bg-[#12101d] border border-slate-200/80 dark:border-white/[0.08] shadow-xl space-y-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                          <Lock className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white">Bảo Mật & Đổi Mật Khẩu</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Cập nhật mật khẩu định kỳ để đảm bảo an toàn cho tài khoản CTV</p>
                        </div>
                      </div>

                      <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <Input
                          type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                          required placeholder="Mật khẩu hiện tại" className="text-sm py-3.5"
                        />
                        <Input
                          type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                          required placeholder="Mật khẩu mới (≥4 ký tự)" className="text-sm py-3.5"
                        />
                        <Input
                          type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                          required placeholder="Xác nhận mật khẩu mới" className="text-sm py-3.5"
                        />
                        <div className="md:col-span-3">
                          <button
                            type="submit" disabled={isChangingPassword}
                            className="w-full md:w-auto px-8 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-2"
                          >
                            {isChangingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : '🔒 Cập Nhật Mật Khẩu Khỏi Máy'}
                          </button>
                        </div>
                      </form>
                    </div>

                  </div>
                )}

                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 2.5 PACKAGE PURCHASE CONFIRMATION MODAL                   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {confirmPackage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#13111c] border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-2xl relative"
            >
              <button
                onClick={() => setConfirmPackage(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/15 text-slate-500 cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Xác Nhận Mua Gói Lượt</h3>
                  <p className="text-xs text-slate-500">Vui lòng kiểm tra kỹ thông tin trước khi xác nhận</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Gói chọn mua:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{confirmPackage.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Số lượt cộng:</span>
                  <span className="font-mono font-bold text-amber-500">+{confirmPackage.count.toLocaleString('vi-VN')} lượt (Locket Gold 1 Năm)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Giá thanh toán:</span>
                  <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-sm">{confirmPackage.price.toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex justify-between items-center">
                  <span className="text-slate-500">Số dư ví còn lại sau mua:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {((ctv?.balance || 0) - confirmPackage.price).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmPackage(null)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer transition-all"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pkgType = confirmPackage.type;
                    const countVal = confirmPackage.count;
                    setConfirmPackage(null);
                    handleBuyPackage(pkgType, countVal);
                  }}
                  disabled={buyingPackageType !== null}
                  className="flex-1 py-3 rounded-2xl bg-linear-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs shadow-lg shadow-purple-500/20 cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  {buyingPackageType ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Xác Nhận Mua Gói</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2.6 AVATAR SELECTION MODAL */}
      <AnimatePresence>
        {avatarModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] p-6 space-y-5 shadow-xs relative text-[#111827] dark:text-[#F9FAFB]"
            >
              <button
                onClick={() => setAvatarModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-[#F5F5F5] dark:bg-[#1F2937] text-[#6B7280] hover:text-[#111827] cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#6D28D9]/10 text-[#6D28D9] flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">Chọn Ảnh Đại Diện CTV</h3>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Chọn một mẫu ảnh avatar có sẵn từ hệ thống</p>
                </div>
              </div>

              {/* Avatar Grid */}
              <div className="grid grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                {presetAvatars.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedAvatar(url)}
                    className={`relative rounded-xl overflow-hidden aspect-square border-2 cursor-pointer transition-all ${
                      selectedAvatar === url
                        ? 'border-[#6D28D9] ring-2 ring-[#6D28D9]/30 scale-105'
                        : 'border-[#E5E7EB] dark:border-[#374151] hover:border-[#D1D5DB] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                    {selectedAvatar === url && (
                      <div className="absolute inset-0 bg-[#6D28D9]/30 flex items-center justify-center text-white font-bold">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-[#F5F5F5] dark:bg-[#1F2937] text-[#111827] dark:text-[#F9FAFB] font-bold text-xs cursor-pointer hover:bg-[#E5E7EB] transition-all"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveAvatar(selectedAvatar)}
                  disabled={isSavingAvatar || !selectedAvatar}
                  className="flex-1 py-3 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-xs shadow-xs cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingAvatar ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Lưu Ảnh Đại Diện</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 3. SHARED POPUP MODAL                                       */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {popup.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setPopup(p => ({ ...p, isOpen: false }))} />
          <div className="relative z-10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#13111c] p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-white/[0.1]">
            <button onClick={() => setPopup(p => ({ ...p, isOpen: false }))} className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-white/[0.08] cursor-pointer">
              <X className="w-4 h-4 text-slate-500" />
            </button>

            <div className="flex flex-col items-center text-center gap-3 pt-2">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${popup.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-600'}`}>
                {popup.type === 'success' ? <CheckCircle2 className="w-9 h-9" /> : <AlertTriangle className="w-9 h-9" />}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{popup.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{popup.message}</p>
              </div>
            </div>

            {popup.details && (
              <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-black/40 text-sm border border-slate-100 dark:border-white/[0.06]">
                {popup.details.username    && <div className="flex justify-between"><span className="text-slate-500">Khách</span><span className="font-bold text-purple-600 dark:text-purple-400">@{popup.details.username}</span></div>}
                {popup.details.packageLabel && <div className="flex justify-between"><span className="text-slate-500">Gói</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{popup.details.packageLabel}</span></div>}
                {popup.details.remainingRequests !== undefined ? (
                  <div className="flex justify-between"><span className="text-slate-500">Chi phí</span><span className="font-bold text-purple-600 dark:text-purple-400">Trừ 1 lượt gói</span></div>
                ) : popup.details.amount !== undefined && (
                  <div className="flex justify-between"><span className="text-slate-500">Tiền</span><span className="font-mono font-black text-amber-600 dark:text-amber-400">{popup.details.amount.toLocaleString('vi-VN')}đ</span></div>
                )}
                {popup.details.remainingRequests !== undefined ? (
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-white/[0.06]">
                    <span className="text-slate-500">Lượt gói còn lại</span>
                    <span className="font-mono font-black text-purple-600 dark:text-purple-400">{popup.details.remainingRequests.toLocaleString('vi-VN')} lượt</span>
                  </div>
                ) : popup.details.newBalance !== undefined && (
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-white/[0.06]">
                    <span className="text-slate-500">Số dư mới</span>
                    <span className="font-mono font-black text-amber-600 dark:text-amber-400">{(Number(popup.details.newBalance) || 0).toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setPopup(p => ({ ...p, isOpen: false }))}
              className={`w-full py-4 rounded-2xl font-bold text-base cursor-pointer shadow-lg transition-transform active:scale-[0.98] ${
                popup.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-100 dark:bg-white/[0.08] text-slate-800 dark:text-slate-200'
              }`}
            >
              {popup.type === 'success' ? '🎉 Tuyệt vời!' : 'Đã hiểu'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default CtvPage;


