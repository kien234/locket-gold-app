import React from 'react';
import { Heart } from 'lucide-react';
import { KawaiiBunny } from '../mascot/KawaiiBunny';

export const Footer: React.FC = () => {
  return (
    <footer className="hidden sm:block relative pt-10 pb-10 bg-white dark:bg-slate-950 border-t border-pink-200/50 dark:border-pink-500/20 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-pink-100 dark:border-slate-800 font-sans">
          
          {/* Brand Info */}
          <div className="md:col-span-8 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-pink-500 to-amber-400 p-0.5 shadow-md">
                <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center overflow-hidden">
                  <img src="/assets/logo.png" alt="Kawaii Locket Logo" className="w-7 h-7 object-contain" />
                </div>
              </div>
              <span className="text-2xl font-black gradient-text-pink font-purrfect">
                Kawaii Locket
              </span>
            </div>

            <p className="text-sm text-slate-600 dark:text-[#C8CBD8] max-w-sm leading-[1.55] font-sans">
              Hệ thống kích hoạt Locket Gold tự động siêu tốc uy tín số 1 Việt Nam. Không tải app lạ, không login iCloud, an toàn 100%.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/30 dark:text-emerald-400 font-bold text-xs font-sans">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Tất Cả Hệ Thống Hoạt Động Bình Thường</span>
            </div>
          </div>

          {/* Mascot Card */}
          <div className="md:col-span-4 flex items-center justify-center bg-pink-50/60 dark:bg-slate-900/60 p-5 rounded-3xl border border-pink-200/50 dark:border-pink-500/20 text-center font-sans">
            <div className="flex flex-col items-center space-y-2">
              <KawaiiBunny size="sm" expression="love" />
              <p className="font-extrabold text-sm text-slate-900 dark:text-[#FFFFFF] font-sans">
                Thiết Kế Với <Heart className="w-4 h-4 inline text-pink-500 fill-current" /> Cho Người Dùng Locket
              </p>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF] font-sans">
                An toàn 100% • Bảo hành uy tín 1 Năm
              </p>
            </div>
          </div>

        </div>

        {/* Bottom copyright & legal */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] font-sans">
          <p>© 2026 Kawaii Locket. Bảo lưu mọi quyền.</p>
          <div className="flex items-center gap-6 font-sans">
            <a href="#" className="hover:text-pink-400 transition-colors">Chính Sách Bảo Mật</a>
            <a href="#" className="hover:text-pink-400 transition-colors">Điều Khoản Dịch Vụ</a>
            <a href="#" className="hover:text-pink-400 transition-colors">Cam Kết Bảo Hành</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

