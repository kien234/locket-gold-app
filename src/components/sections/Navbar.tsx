import React, { useState, useEffect } from 'react';
import { Lock, BookOpen, UserCheck, LogOut } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';

interface NavbarProps {
  onCtvLoginClick?: () => void;
  isCtvPage?: boolean;
  isLoggedIn?: boolean;
  username?: string;
  vipLevel?: number | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onCtvLoginClick, isCtvPage, isLoggedIn: propIsLoggedIn, username, vipLevel, onLogout }) => {
  const [scrolled, setScrolled] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!localStorage.getItem('ctv_token'));
    const handleScroll = () => setScrolled(window.scrollY > 15);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loggedIn = propIsLoggedIn !== undefined ? propIsLoggedIn : hasToken;

  const handleLogoClick = () => {
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('ctv_token');
      window.location.href = '/';
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 font-sans ${
        scrolled
          ? 'py-2.5 sm:py-3 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-indigo-100 dark:border-white/10 shadow-md shadow-indigo-500/5'
          : 'py-3.5 sm:py-5 bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2">
        
        {/* Brand Logo & Title */}
        <div
          className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0"
          onClick={handleLogoClick}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 to-amber-400 p-0.5 shadow-md shadow-indigo-500/20">
            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[10px] sm:rounded-[14px] flex items-center justify-center overflow-hidden">
              <img src="/assets/logo.png" alt="Kawaii Locket" className="w-5 h-5 sm:w-7 sm:h-7 object-contain" />
            </div>
          </div>
          <div>
            <span className="text-base sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white font-purrfect block leading-tight">
              Kawaii Locket
            </span>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Online 24/7</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* API Docs Button */}
          <a
            href="/postman"
            title="Tài liệu API"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Tài liệu API</span>
          </a>

          {/* Theme Switcher */}
          <ThemeToggle />

          {/* User Auth Controls */}
          {loggedIn ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <a
                href="/"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-bold transition-all"
              >
                {vipLevel === 1 ? (
                  <img src="/assets/vip1.gif" alt="VIP 1" className="w-4 h-4 object-contain" />
                ) : vipLevel === 2 ? (
                  <img src="/assets/vip2.png" alt="VIP 2" className="w-4 h-4 object-contain" />
                ) : vipLevel === 3 ? (
                  <img src="/assets/vip3.png" alt="VIP 3" className="w-4 h-4 object-contain" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                )}
                <span className="max-w-[80px] sm:max-w-none truncate">@{username || 'CTV'}</span>
              </a>
              <button
                type="button"
                onClick={handleLogoutClick}
                title="Đăng xuất"
                className="p-1.5 sm:p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onCtvLoginClick?.()}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-500/20 active:scale-[0.98]"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Đăng nhập </span>CTV
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

