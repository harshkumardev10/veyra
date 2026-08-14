import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';

export interface InAppNotifData {
  id: string;
  senderUid: string;
  senderName: string;
  senderPhoto: string;
  text: string;
  chatId: string;
}

interface InAppNotificationToastProps {
  notification: InAppNotifData | null;
  onDismiss: () => void;
  onSelectNotif: (notif: InAppNotifData) => void;
}

export const InAppNotificationToast: React.FC<InAppNotificationToastProps> = ({
  notification,
  onDismiss,
  onSelectNotif,
}) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ y: -100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -100, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          onClick={() => {
            onSelectNotif(notification);
            onDismiss();
          }}
          className="fixed top-4 left-4 right-4 z-[9999] max-w-md mx-auto bg-[#161F30]/95 border border-amber-500/50 rounded-2xl p-3.5 shadow-2xl shadow-black/90 backdrop-blur-xl cursor-pointer active:scale-98 transition-all flex items-center space-x-3 pointer-events-auto"
        >
          {/* Sender Avatar */}
          <div className="relative flex-shrink-0">
            <img
              src={
                notification.senderPhoto ||
                `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(notification.senderName)}`
              }
              alt={notification.senderName}
              className="w-11 h-11 rounded-full object-cover border-2 border-amber-500/40 shadow-md"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gradient-to-tr from-amber-500 to-rose-500 rounded-full flex items-center justify-center text-[9px] text-white">
              <MessageSquare className="w-2.5 h-2.5 fill-white" />
            </span>
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-100 truncate">{notification.senderName}</p>
              <span className="text-[9px] font-semibold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                VEYRA
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate mt-0.5 font-medium">{notification.text}</p>
          </div>

          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
