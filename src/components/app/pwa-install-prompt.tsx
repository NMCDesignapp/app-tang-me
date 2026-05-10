'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((navigator as unknown as { standalone?: boolean }).standalone) return;

    // iOS detection
    const isIOSSafari = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) &&
      !window.matchMedia('(display-mode: standalone)').matches;
    if (isIOSSafari) {
      setIsIOS(true);
      // Show iOS prompt after a short delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a short delay
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for this session
    sessionStorage.setItem('pwa_dismissed', '1');
  };

  if (!showPrompt) return null;
  if (sessionStorage.getItem('pwa_dismissed')) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[70] p-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-2xl border border-rose-100 p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-md">
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">Cài đặt ứng dụng</p>
          {isIOS ? (
            <p className="text-xs text-gray-500 mt-0.5">
              Nhấn <span className="inline-block px-1 py-0.5 bg-gray-100 rounded text-[10px] font-bold">⬆️</span> rồi &quot;Thêm ra Màn hình chính&quot;
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">
              Thêm vào màn hình chính để dùng nhanh hơn
            </p>
          )}
        </div>
        {!isIOS && (
          <Button
            size="sm"
            onClick={handleInstall}
            className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl px-4 flex-shrink-0"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Cài đặt
          </Button>
        )}
        <button
          onClick={dismiss}
          className="text-gray-300 hover:text-gray-500 transition-colors p-1 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
