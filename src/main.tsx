import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initPWAListeners } from './utils/pwa.ts';

initPWAListeners();

createRoot(document.getElementById('root')!).render(<App />);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const registerServiceWorker = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        registration.update().catch(() => {});
      })
      .catch(() => {
        // Ignore service worker registration errors in unsupported environments
      });
  };

  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker, { once: true });
  }
}
