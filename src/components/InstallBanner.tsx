import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, Share, MoreVertical, CheckCircle2 } from 'lucide-react';
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
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsStandalone(true);
          setShowBanner(false);
        }
      } catch (err) {
        setShowGuideModal(true);
      }
    } else {
      // Browser didn't provide prompt object -> show simple guide modal
      setShowGuideModal(true);
    }
  };

  // Assign global trigger so Header button can call it
  globalTriggerInstall = handleInstallClick;

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Floating Bottom Banner */}
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
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-500/30">
                <Smartphone className="w-5 h-5 text-white" />
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
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install</span>
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

      {/* Manual Install Guide Modal (Fallback if browser prompt isn't directly triggered) */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#161F30] rounded-3xl border border-slate-800 p-6 space-y-4 shadow-2xl relative"
            >
              <button
                onClick={() => setShowGuideModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Download className="w-6 h-6 text-amber-400" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-100">Install VEYRA on Your Device</h3>
                <p className="text-xs text-slate-400 mt-1">
                  To install VEYRA as an app on your home screen:
                </p>
              </div>

              <div className="space-y-2.5 bg-slate-900/60 rounded-2xl p-3.5 border border-slate-800/60 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="font-semibold text-slate-100">Chrome / Edge / Android:</span>
                    <p className="text-[11px] text-slate-400">Click the top browser menu (<MoreVertical className="inline w-3.5 h-3.5 text-amber-400" />) → Select <strong>"Install VEYRA"</strong> or <strong>"Add to Home screen"</strong>.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <span className="font-semibold text-slate-100">iPhone / Safari:</span>
                    <p className="text-[11px] text-slate-400">Tap the Share button (<Share className="inline w-3.5 h-3.5 text-rose-400" />) → Select <strong>"Add to Home Screen"</strong>.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
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
