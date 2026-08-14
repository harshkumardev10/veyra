import React, { useEffect, useState } from 'react';
import { Download, X, Heart, Sparkles, Smartphone, Share, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DISMISSED_KEY = 'veyra_install_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Global hook/state so header button can also trigger install
let globalTriggerInstall: (() => void) | null = null;
export const triggerAppInstall = () => {
  if (globalTriggerInstall) globalTriggerInstall();
};

export const InstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check if running as installed standalone PWA
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (checkStandalone) {
      setIsStandalone(true);
      return;
    }

    // Capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Auto-show banner if not dismissed yet
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }

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
          setShowGuideModal(false);
        }
      } catch (_err) {
        setShowGuideModal(true);
      }
    } else {
      // Browser didn't provide prompt object -> show sleek install modal
      setShowGuideModal(true);
    }
    setInstalling(false);
  };

  // Assign global trigger so Header button can call it
  globalTriggerInstall = () => {
    setShowBanner(true);
    handleInstallClick();
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  if (isStandalone) return null;

  return (
    <>
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

      {/* Sleek Install Guide Modal (shown when browser requires menu action e.g. iOS Safari / Chrome Desktop) */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowGuideModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[#161F30] rounded-3xl border border-slate-800 p-6 space-y-4 shadow-2xl relative"
            >
              <button
                onClick={() => setShowGuideModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-400 p-[2px] shadow-lg shadow-rose-500/20">
                  <div className="w-full h-full bg-[#161F30] rounded-[14px] flex items-center justify-center">
                    <Heart className="w-5 h-5 text-rose-400 fill-rose-400/30" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Install VEYRA App</h3>
                  <p className="text-xs text-slate-400">Quick App Setup</p>
                </div>
              </div>

              <div className="space-y-2.5 bg-slate-900/60 rounded-2xl p-3.5 border border-slate-800/60 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="font-semibold text-slate-100">Chrome / Edge / Android:</span>
                    <p className="text-[11px] text-slate-400">Tap browser menu (<MoreVertical className="inline w-3.5 h-3.5 text-amber-400" />) → Select <strong>"Install VEYRA"</strong> or <strong>"Add to Home screen"</strong>.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <span className="font-semibold text-slate-100">iPhone / Safari:</span>
                    <p className="text-[11px] text-slate-400">Tap Share (<Share className="inline w-3.5 h-3.5 text-rose-400" />) → Select <strong>"Add to Home Screen"</strong>.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold text-xs shadow-md transition-colors"
              >
                Got It
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

