import React, { useEffect, useState } from 'react';
import { Download, X, Heart, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Global trigger function so any button can trigger app installation directly
let globalTriggerInstall: (() => void) | null = null;
export const triggerAppInstall = () => {
  if (globalTriggerInstall) globalTriggerInstall();
};

export const InstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check if running as installed standalone PWA app
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (checkStandalone) {
      setIsStandalone(true);
      setShowBanner(false);
      return;
    }

    // Listen for browser beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (installing) return;
    setInstalling(true);

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsStandalone(true);
          setShowBanner(false);
        }
      } catch (_err) {
        // ignore errors
      }
    }
    setInstalling(false);
  };

  // Assign global trigger for Header / Profile install buttons
  globalTriggerInstall = () => {
    setShowBanner(true);
    handleInstallClick();
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-2 flex justify-center pointer-events-none"
        >
          <div className="w-full max-w-md bg-[#161F30] border border-amber-500/30 rounded-3xl p-4 shadow-2xl shadow-black/80 pointer-events-auto flex items-center gap-3">
            {/* VEYRA Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-400 p-[2px] shadow-lg shadow-rose-500/20">
                <div className="w-full h-full bg-[#161F30] rounded-[9px] flex items-center justify-center">
                  <Heart className="w-4 h-4 text-rose-400 fill-rose-400/30" />
                </div>
              </div>
              <span className="font-bold text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-400 to-amber-300 hidden sm:block">
                VEYRA
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-100">Install VEYRA App</p>
              <p className="text-[10px] text-slate-400 leading-tight">
                Add to home screen for real-time worldwide chat
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={handleInstallClick}
                disabled={installing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{installing ? 'Installing…' : 'Install'}</span>
              </button>

              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
