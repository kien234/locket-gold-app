import React from 'react';
import {
  Lock, LogOut, QrCode, CheckCircle2, AlertCircle,
  Crown, History, Key, Copy, Clipboard, Bell,
  RefreshCw, Check, Trash2,
  Trophy, Package, Search, ExternalLink
} from 'lucide-react';
import { extractLocketUsername, type LocketUserInfo } from '../../services/locketService';
import { ThemeToggle } from '../ui/ThemeToggle';

export interface LeaderboardItem {
  rank: number;
  username: string;
  displayName: string;
  totalAmount: number;
  totalOrders: number;
  orders?: CtvOrder[];
}

export interface CtvInfo {
  username: string;
  displayName: string;
  prices: { '1year': number; 'lifetime': number };
  balance: number;
  totalSpent?: number;
  totalOrders?: number;
  apiKey?: string;
  depositCode?: string;
  remainingRequests?: number;
  telegramChatId?: string;
  avatar?: string;
}

export interface CtvOrder {
  id?: string;
  orderId?: string;
  userUpgraded: string;
  packageId: string;
  amount: number;
  status?: string;
  createdAt: string;
}

export type TabType = 'upgrade' | 'deposit' | 'packages' | 'history' | 'leaderboard' | 'api';

interface CtvMobileViewProps {
  token: string | null;
  ctv: CtvInfo | null;
  orders: CtvOrder[];
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  // Login
  loginUser: string;
  setLoginUser: (val: string) => void;
  loginPass: string;
  setLoginPass: (val: string) => void;
  isLoading: boolean;
  error: string | null;
  handleLogin: (e: React.FormEvent) => void;
  handleLogout: () => void;
  // Gold Upgrade Form
  targetUser: string;
  setTargetUser: (val: string) => void;
  selectedPkg: 'quota' | '1year' | 'lifetime';
  setSelectedPkg: (pkg: 'quota' | '1year' | 'lifetime') => void;
  isUpgrading: boolean;
  handleUpgrade: (e: React.FormEvent) => void;
  handlePasteClipboard: () => void;
  liveUser: LocketUserInfo | null;
  isSearchingUser: boolean;
  // Packages
  customBuyCount: number;
  setCustomBuyCount: (val: number) => void;
  buyingPackageType: string | null;
  setConfirmPackage: (pkg: any) => void;
  // Deposit
  depositAmount: number;
  setDepositAmount: (amt: number) => void;
  depositMemo: string;
  vietQrUrl: string;
  copiedMemo: boolean;
  setCopiedMemo: (val: boolean) => void;
  handleCheckDeposit: () => void;
  isCheckingDeposit: boolean;
  // History & Leaderboard & Settings
  historySearch: string;
  setHistorySearch: (val: string) => void;
  onDeleteOrder?: (orderId: string) => void;
  onClearHistory?: () => void;
  onSelectCtvHistory?: (item: LeaderboardItem) => void;
  onOpenAvatarModal?: () => void;
  leaderboard: LeaderboardItem[];
  isLeaderboardLoading: boolean;
  myRankItem: LeaderboardItem | null;
  myVipLevel: number | null;
  telegramInput: string;
  setTelegramInput: (val: string) => void;
  handleSaveTelegram: (e: React.FormEvent) => void;
  isSavingTelegram: boolean;
  handleRegenApiKey: () => void;
  isRegenKeyLoading: boolean;
  copiedApiKey: boolean;
  setCopiedApiKey: (val: boolean) => void;
  oldPassword: string;
  setOldPassword: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  isChangingPassword: boolean;
  handleChangePassword: (e: React.FormEvent) => void;
}

export const CtvMobileView: React.FC<CtvMobileViewProps> = ({
  token, ctv, orders, activeTab, setActiveTab,
  loginUser, setLoginUser, loginPass, setLoginPass, isLoading, error, handleLogin, handleLogout,
  targetUser, setTargetUser, selectedPkg, setSelectedPkg, isUpgrading, handleUpgrade, handlePasteClipboard, liveUser, isSearchingUser,
  customBuyCount, setCustomBuyCount, buyingPackageType, setConfirmPackage,
  depositAmount, setDepositAmount, depositMemo, vietQrUrl, copiedMemo, setCopiedMemo, handleCheckDeposit, isCheckingDeposit,
  historySearch, setHistorySearch, onDeleteOrder, onClearHistory, onSelectCtvHistory, onOpenAvatarModal, leaderboard, isLeaderboardLoading, myRankItem, myVipLevel,
  telegramInput, setTelegramInput, handleSaveTelegram, isSavingTelegram, handleRegenApiKey, isRegenKeyLoading, copiedApiKey, setCopiedApiKey,
  oldPassword, setOldPassword, newPassword, setNewPassword, confirmPassword, setConfirmPassword, isChangingPassword, handleChangePassword
}) => {

  // 1. MOBILE LOGIN VIEW
  if (!token || !ctv) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-slate-50 dark:bg-[#090810] text-slate-900 dark:text-white font-sans">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-500/25">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black">Portal CTV Mobile</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hệ thống kích hoạt Locket Gold tự động</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <input
                type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)}
                required placeholder="Tên tài khoản CTV"
                className="w-full px-4 py-3.5 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] text-sm text-[#111827] dark:text-[#F9FAFB] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 transition-all duration-150"
              />
            </div>
            <div>
              <input
                type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
                required placeholder="Mật khẩu"
                className="w-full px-4 py-3.5 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] text-sm text-[#111827] dark:text-[#F9FAFB] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 transition-all duration-150"
              />
            </div>
            <button
              type="submit" disabled={isLoading}
              className="w-full py-4 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-sm disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98] transition-all duration-150"
            >
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin inline" /> : 'Đăng Nhập Ngay'}
            </button>
          </form>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {[
              { icon: '⚡', title: 'Kích hoạt 3s', sub: 'Tự động 24/7' },
              { icon: '💳', title: 'VietQR Auto', sub: 'Cộng tiền 10s' },
            ].map(f => (
              <div key={f.title} className="p-3 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-center">
                <div className="text-lg mb-0.5">{f.icon}</div>
                <div className="text-xs font-bold">{f.title}</div>
                <div className="text-[10px] text-slate-400">{f.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. MOBILE LOGGED IN PORTAL
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans pb-24">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => onOpenAvatarModal && onOpenAvatarModal()}
            className="w-9 h-9 rounded-xl bg-[#6D28D9] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md cursor-pointer overflow-hidden active:scale-95 transition-transform"
            title="Đổi avatar"
          >
            {ctv.avatar ? (
              <img src={ctv.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              ctv.displayName.charAt(0).toUpperCase()
            )}
          </button>
          <div className="min-w-0">
            <div className="font-extrabold text-xs text-slate-900 dark:text-white truncate flex items-center gap-1">
              {ctv.displayName}
              {myVipLevel && <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 font-bold text-[9px]">VIP {myVipLevel}</span>}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">@{ctv.username}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Balance Badge */}
          <button
            onClick={() => setActiveTab('deposit')}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono font-black text-xs flex items-center gap-1 active:scale-95 transition-transform"
          >
            <span>💳</span>
            <span>{ctv.balance.toLocaleString('vi-VN')}đ</span>
          </button>
          
          <ThemeToggle />
          
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-rose-500 cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="px-3.5 pt-3 space-y-3">

        {/* 2.1 TAB: GOLD UPGRADE */}
        {activeTab === 'upgrade' && (
          <div className="space-y-3">
            {/* Quick Request Quota Banner */}
            <div className="p-3.5 rounded-2xl bg-linear-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2 text-xs">
                <Package className="w-4 h-4 text-amber-300 shrink-0" />
                <span>Lượt gói nạp sẵn:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-amber-300 text-sm">{(ctv.remainingRequests || 0).toLocaleString('vi-VN')} lượt</span>
                <button
                  onClick={() => setActiveTab('packages')}
                  className="px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold"
                >
                  + Mua thêm
                </button>
              </div>
            </div>

            {/* Upgrade Form Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#12101d] border border-slate-200 dark:border-white/10 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="font-extrabold text-xs flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <span>Kích Hoạt Locket Gold Tự Động</span>
                </div>
                <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">⚡ Tự động 3s</span>
              </div>

              <form onSubmit={handleUpgrade} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-500">Username Locket cần kích hoạt:</label>
                  <div className="relative flex items-center">
                    <input
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
                      placeholder="Nhập username (VD: vanle)"
                      className="w-full py-3 pl-3 pr-16 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs font-semibold focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="absolute right-2 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[11px] flex items-center gap-1"
                    >
                      <Clipboard className="w-3 h-3" /> Dán
                    </button>
                  </div>
                </div>

                {/* Live Preview Card */}
                {liveUser && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {liveUser.avatar ? (
                        <img src={liveUser.avatar} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {(liveUser.username || targetUser).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">{liveUser.full_name || liveUser.username}</div>
                        <div className="text-[10px] text-slate-400 truncate">@{liveUser.username}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      liveUser.valid === false || !liveUser.uid
                        ? 'bg-rose-500/10 text-rose-500'
                        : liveUser.hasActiveGold
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {liveUser.valid === false || !liveUser.uid ? '❌ Thất bại' : liveUser.hasActiveGold ? '👑 Đã có Gold' : '✓ Sẵn sàng'}
                    </span>
                  </div>
                )}

                {/* Payment Selection Options */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-500">Chọn gói & phương thức thanh toán:</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      {
                        id: 'quota' as const,
                        label: '📦 1 Năm (Dùng 1 Lượt Gói)',
                        sub: `Trừ 1 lượt (Còn ${(ctv.remainingRequests || 0).toLocaleString('vi-VN')} lượt)`,
                        color: 'text-purple-500',
                        isQuota: true
                      },
                      {
                        id: '1year' as const,
                        label: '⭐ 1 Năm (Ví CTV)',
                        sub: `${(ctv.prices?.['1year'] || 65000).toLocaleString('vi-VN')}đ / lượt`,
                        color: 'text-emerald-500',
                        isQuota: false
                      },
                      {
                        id: 'lifetime' as const,
                        label: '👑 Vĩnh Viễn (Ví CTV)',
                        sub: `${(ctv.prices?.['lifetime'] || 350000).toLocaleString('vi-VN')}đ / lượt`,
                        color: 'text-amber-500',
                        isQuota: false
                      },
                    ].map(pkg => (
                      <button
                        key={pkg.id} type="button" onClick={() => setSelectedPkg(pkg.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          selectedPkg === pkg.id
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/15'
                            : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1">
                            {pkg.label}
                            {pkg.isQuota && (ctv.remainingRequests || 0) > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 text-[9px]">Khả dụng</span>
                            )}
                          </div>
                          <div className={`text-[10px] font-medium mt-0.5 ${pkg.color}`}>{pkg.sub}</div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedPkg === pkg.id ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300'}`}>
                          {selectedPkg === pkg.id && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUpgrading || !targetUser.trim() || !!liveUser?.hasActiveGold || (!!liveUser && (liveUser.valid === false || !liveUser.uid))}
                  className="w-full py-3.5 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs disabled:opacity-40 cursor-pointer shadow-md shadow-purple-500/20 active:scale-[0.98]"
                >
                  {isUpgrading
                    ? <><RefreshCw className="w-4 h-4 animate-spin inline mr-1" />Đang kích hoạt...</>
                    : liveUser && (liveUser.valid === false || !liveUser.uid) ? '❌ Username không tồn tại'
                    : liveUser?.hasActiveGold ? '⚠️ Đã có Gold'
                    : '👑 Xác Nhận Kích Hoạt Gold'
                  }
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 2.2 TAB: PACKAGES */}
        {activeTab === 'packages' && (
          <div className="space-y-3.5">
            {/* Custom Quantity Calculator Card */}
            {(() => {
              const unitPrice = ctv.prices?.['1year'] || 65000;
              const count = Math.max(1, customBuyCount || 1);
              const rawTotal = unitPrice * count;
              const discount = Math.floor(count / 50) * 50000;
              const totalPrice = Math.max(0, rawTotal - discount);
              const isBuying = buyingPackageType === `custom_${count}`;

              return (
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] space-y-3.5 border border-[#E5E7EB] dark:border-[#374151] shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#6D28D9]/10 text-[#6D28D9] dark:text-[#8D71FF] text-[10px] font-bold uppercase">
                      ✨ Tùy Chọn Số Lượt
                    </span>
                    <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] font-mono">Đơn giá: {unitPrice.toLocaleString('vi-VN')}đ</span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 font-bold">Số lượng lượt cần mua:</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customBuyCount ? customBuyCount.toLocaleString('vi-VN') : ''}
                        onChange={e => {
                          const raw = parseInt(e.target.value.replace(/\D/g, ''), 10);
                          setCustomBuyCount(isNaN(raw) ? 0 : Math.max(1, raw));
                        }}
                        className="w-full px-3.5 py-3 rounded-xl bg-white dark:bg-[#0B0F17] border border-[#E5E7EB] dark:border-[#374151] text-[#F59E0B] font-bold text-lg focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 pr-14"
                        placeholder="Nhập số lượt..."
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#6B7280] dark:text-[#9CA3AF] pointer-events-none">lượt</span>
                    </div>

                    {/* Quick Pills */}
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {[50, 100, 500, 1000].map(val => (
                        <button
                          key={val} type="button"
                          onClick={() => setCustomBuyCount(val)}
                          className={`py-1 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                            customBuyCount === val
                              ? 'bg-[#6D28D9] border-[#6D28D9] text-white shadow-xs'
                              : 'bg-[#F5F5F5] dark:bg-[#1F2937] border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F9FAFB]'
                          }`}
                        >
                          {val} lượt
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F5F5F5] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] space-y-1 text-[11px]">
                    <div className="flex justify-between text-[#6B7280] dark:text-[#9CA3AF]"><span>Số lượt:</span><span className="font-mono text-[#111827] dark:text-[#F9FAFB] font-bold">{count.toLocaleString('vi-VN')} lượt</span></div>
                    <div className="flex justify-between text-[#6B7280] dark:text-[#9CA3AF]"><span>Thành tiền gốc:</span><span className="font-mono">{rawTotal.toLocaleString('vi-VN')}đ</span></div>
                    {discount > 0 ? (
                      <div className="flex justify-between text-[#22C55E] font-bold pt-1 border-t border-[#E5E7EB] dark:border-[#374151]">
                        <span>Chiết khấu (cứ 50 lượt -50k):</span>
                        <span className="font-mono">-{discount.toLocaleString('vi-VN')}đ</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-[#F59E0B] italic pt-1 border-t border-[#E5E7EB] dark:border-[#374151]">💡 Mua từ 50 lượt trở lên được giảm 50k!</div>
                    )}
                    <div className="flex justify-between text-xs font-black pt-1.5 border-t border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F9FAFB]">
                      <span>Thanh toán:</span>
                      <span className="text-[#F59E0B] font-mono text-sm">{totalPrice.toLocaleString('vi-VN')}đ</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setConfirmPackage({ type: `custom_${count}`, name: `Gói Tùy Chọn (${count} Lượt)`, count, price: totalPrice })}
                    disabled={isBuying || count < 1 || ctv.balance < totalPrice}
                    className="w-full py-3.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-xs disabled:bg-slate-200 dark:disabled:bg-[#1F2937] disabled:text-[#9CA3AF] dark:disabled:text-[#6B7280] disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98] transition-all duration-150"
                  >
                    {isBuying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                    {ctv.balance < totalPrice ? 'Số dư ví không đủ' : `Mua ${count} Lượt (${totalPrice.toLocaleString('vi-VN')}đ)`}
                  </button>
                </div>
              );
            })()}

            {/* Quick Presets List */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Các gói chọn nhanh</div>
              {[
                { count: 50, tag: 'Giảm 50k', btn: 'bg-[#22C55E] hover:bg-[#16A34A] text-white' },
                { count: 500, tag: 'Giảm 500k', btn: 'bg-[#F59E0B] hover:bg-[#D97706] text-slate-950' },
                { count: 1000, tag: 'Giảm 1 Triệu', btn: 'bg-[#6D28D9] hover:bg-[#5B21B6] text-white' },
              ].map(p => {
                const unitPrice = ctv.prices?.['1year'] || 65000;
                const rawTotal = unitPrice * p.count;
                const discount = Math.floor(p.count / 50) * 50000;
                const price = rawTotal - discount;
                const isBuying = buyingPackageType === String(p.count);
                return (
                  <div key={p.count} className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between gap-2 shadow-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#111827] dark:text-[#F9FAFB]">{p.count} Lượt</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#6D28D9]/10 text-[#6D28D9] dark:text-[#8D71FF] text-[9px] font-bold">{p.tag}</span>
                      </div>
                      <div className="text-[11px] font-bold text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                        <span className="line-through text-[#9CA3AF]">{rawTotal.toLocaleString('vi-VN')}đ</span>{' '}
                        <span className="font-bold text-[#111827] dark:text-[#F9FAFB]">{price.toLocaleString('vi-VN')}đ</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmPackage({ type: String(p.count), name: `Gói ${p.count} Lượt`, count: p.count, price })}
                      disabled={isBuying || ctv.balance < price}
                      className={`px-3.5 py-2 rounded-lg font-bold text-xs disabled:bg-slate-200 dark:disabled:bg-[#1F2937] disabled:text-[#9CA3AF] dark:disabled:text-[#6B7280] disabled:cursor-not-allowed transition-all duration-150 ${p.btn}`}
                    >
                      {isBuying ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Mua'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2.3 TAB: DEPOSIT */}
        {activeTab === 'deposit' && (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#12101d] border border-slate-200 dark:border-white/10 space-y-3.5 shadow-sm">
            <div>
              <h2 className="text-xs font-black flex items-center gap-1.5">
                <span>💳</span> Nạp Tiền VietQR SePay Auto Tức Thì
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Quét QR hoặc chuyển đúng nội dung bên dưới</p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 space-y-1">
              <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">🔑 Nội dung chuyển khoản cố định của bạn:</div>
              <div className="flex items-center gap-2">
                <span className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-black/30 border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono font-black text-sm tracking-wider">
                  {depositMemo}
                </span>
                <button
                  type="button"
                  onClick={() => { try { navigator.clipboard.writeText(depositMemo); setCopiedMemo(true); setTimeout(() => setCopiedMemo(false), 2000); } catch (_) {} }}
                  className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                >
                  {copiedMemo ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] dark:text-[#9CA3AF] mb-1.5">
                Chọn hoặc nhập số tiền muốn nạp:
              </label>

              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {[100000, 200000, 500000].map(amt => (
                  <button
                    key={amt} type="button" onClick={() => setDepositAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0B0F17] border border-[#E5E7EB] dark:border-[#374151] font-bold text-sm text-[#F59E0B] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 pr-12 transition-all duration-150"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] pointer-events-none">đ</span>
              </div>
            </div>

            <div className="flex items-center justify-center p-2 rounded-2xl bg-white border border-slate-200 dark:border-white/10">
              <img src={vietQrUrl} alt="VietQR" className="w-44 h-44 object-contain" />
            </div>

            <button
              onClick={handleCheckDeposit}
              disabled={isCheckingDeposit}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95"
            >
              {isCheckingDeposit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {isCheckingDeposit ? 'Đang kiểm tra giao dịch...' : 'Xác Nhận Đã Chuyển Khoản'}
            </button>
          </div>
        )}

        {/* 2.4 TAB: HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12101d] border border-slate-200 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>📜 Lịch sử ({orders.length} đơn)</span>
                {orders.length > 0 && onClearHistory && (
                  <button
                    onClick={onClearHistory}
                    className="text-[10px] text-red-500 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Xóa tất cả
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text" value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Tìm theo username..."
                  className="w-full py-2 pl-8 pr-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              {orders.filter(o => o.userUpgraded.toLowerCase().includes(historySearch.toLowerCase())).map((o, idx) => (
                <div key={o.orderId || o.id || idx} className="p-3 rounded-xl bg-white dark:bg-[#12101d] border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-purple-600 dark:text-purple-400">@{o.userUpgraded}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(o.createdAt).toLocaleString('vi-VN')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-mono font-bold text-amber-500">{o.amount > 0 ? `${o.amount.toLocaleString('vi-VN')}đ` : 'Trừ lượt gói'}</div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 font-bold">Thành công</span>
                    </div>
                    {onDeleteOrder && (
                      <button
                        onClick={() => onDeleteOrder(o.orderId || o.id || '')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="Xóa đơn hàng này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2.5 TAB: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#12101d] border border-slate-200 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" /> Bảng Xếp Hạng CTV</span>
              {myRankItem && <span className="text-[10px] text-purple-500">Hạng bạn: #{myRankItem.rank}</span>}
            </div>

            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((item, idx) => (
                <div
                  key={item.username}
                  onClick={() => onSelectCtvHistory && onSelectCtvHistory(item)}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-100 dark:border-white/5 flex items-center justify-between text-xs cursor-pointer hover:border-purple-500/30 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                      idx === 0 ? 'bg-amber-400 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 dark:bg-white/10'
                    }`}>{idx + 1}</span>
                    <div className="min-w-0">
                      <div className="font-bold truncate text-slate-900 dark:text-white">@{item.username}</div>
                      <div className="text-[9px] text-slate-400 font-semibold">{item.totalOrders} đơn nâng cấp</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-amber-500">{item.totalAmount.toLocaleString('vi-VN')}đ</div>
                    <div className="text-[9px] text-purple-500 font-bold">👁️ Xem lịch sử</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2.6 TAB: API KEY & SETTINGS */}
        {activeTab === 'api' && (
          <div className="space-y-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#12101d] border border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between font-bold text-xs">
                <div className="flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-purple-500" /> API Key CTV
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text" readOnly value={ctv.apiKey || 'Chưa khởi tạo'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 font-mono text-xs font-bold"
                />
                <button
                  onClick={() => { try { if (ctv.apiKey) navigator.clipboard.writeText(ctv.apiKey); setCopiedApiKey(true); setTimeout(() => setCopiedApiKey(false), 2000); } catch (_) {} }}
                  className="p-2 rounded-xl bg-purple-500/10 text-purple-500 shrink-0"
                  title="Copy Key"
                >
                  {copiedApiKey ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleRegenApiKey}
                  className="p-2 rounded-xl bg-purple-500/10 text-purple-500 shrink-0"
                  title="Tạo ngẫu nhiên lại Key"
                >
                  <RefreshCw className={`w-4 h-4 ${isRegenKeyLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* POSTMAN DOCS BUTTON */}
              <a
                href="/postman"
                className="flex items-center justify-between p-3.5 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-md hover:opacity-95 transition-opacity"
              >
                <span>📖 Tài Liệu API & Postman Collection</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Telegram Bot Notification */}
            <form onSubmit={handleSaveTelegram} className="p-4 rounded-2xl bg-white dark:bg-[#12101d] border border-slate-200 dark:border-white/10 space-y-3">
              <div className="font-bold text-xs flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-indigo-500" /> Thông Báo Telegram
              </div>
              <input
                type="text" value={telegramInput} onChange={e => setTelegramInput(e.target.value)}
                placeholder="Nhập Chat ID Telegram"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-xs"
              />
              <button
                type="submit" disabled={isSavingTelegram}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs disabled:opacity-50"
              >
                {isSavingTelegram ? <RefreshCw className="w-3.5 h-3.5 animate-spin inline" /> : 'Lưu Chat ID'}
              </button>
            </form>
          </div>
        )}

      </main>

      {/* 3. MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border-t border-slate-200/80 dark:border-white/10 px-2 py-2 flex items-center justify-around shadow-lg">
        {[
          { id: 'upgrade' as const, label: 'Kích Hoạt', icon: Crown },
          { id: 'packages' as const, label: 'Gói Lượt', icon: Package },
          { id: 'deposit' as const, label: 'Nạp Ví', icon: QrCode },
          { id: 'history' as const, label: 'Lịch Sử', icon: History },
          { id: 'leaderboard' as const, label: 'BXH', icon: Trophy },
          { id: 'api' as const, label: 'API', icon: Key },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-purple-600 dark:text-purple-400 font-bold scale-105' : 'text-slate-400 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px]">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};


