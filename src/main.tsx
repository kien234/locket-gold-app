import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/index.css'

// Hide the pre-React HTML loading screen after app is fully painted
export function dismissLoader() {
  const loader = document.getElementById('app-preloader') || document.getElementById('kawaii-loader');
  if (!loader) return;

  const hide = () => {
    loader.classList.add('loaded');
    setTimeout(() => {
      try { loader.remove(); } catch (_e) {}
    }, 450);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (document.readyState === 'complete') {
        hide();
      } else {
        window.addEventListener('load', hide, { once: true });
        setTimeout(hide, 1200);
      }
    });
  });
}

if (typeof window !== 'undefined') {
  (window as any).dismissAppPreloader = dismissLoader;
  // Safety timeout fallback: ensure preloader is dismissed after 6 seconds even if network is slow/failed
  setTimeout(dismissLoader, 6000);
}

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

