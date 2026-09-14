import React, { useEffect } from 'react';
import { CtvPage } from '../components/ctv/CtvPage';
import { PostmanDocsPage } from '../components/ctv/PostmanDocsPage';
import { CustomerCheckoutPage } from '../components/customer/CustomerCheckoutPage';
import { useThemeStore } from '../stores/useThemeStore';

export const App: React.FC = () => {
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  const isAdmin = path === '/admin' || path.startsWith('/admin');
  const isCtv = path === '/ctv' || path.startsWith('/ctv');
  const isDocsOrPostman = path === '/postman' || path === '/docs' || path.startsWith('/postman') || path.startsWith('/docs');

  useEffect(() => {
    if (isAdmin) {
      window.location.href = '/admin.html';
    }
  }, [isAdmin]);

  // For non-customer routes (admin redirect, ctv portal, postman docs), dismiss preloader immediately
  useEffect(() => {
    if (isAdmin || isCtv || isDocsOrPostman) {
      const dismiss = (window as any).dismissAppPreloader;
      if (typeof dismiss === 'function') dismiss();
    }
  }, [isAdmin, isCtv, isDocsOrPostman]);

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F17] flex items-center justify-center p-4 text-sm font-bold text-[#6B7280]">
        Đang chuyển hướng sang Admin Portal (/admin.html)...
      </div>
    );
  }

  return (
    <div className="min-h-screen relative selection:bg-purple-500 selection:text-white">
      {isDocsOrPostman ? (
        <PostmanDocsPage />
      ) : isCtv ? (
        <CtvPage />
      ) : (
        <CustomerCheckoutPage />
      )}
    </div>
  );
};

export default App;

