import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { UserProfile } from '../types';
import { X, MessageSquare, AtSign, Circle, Clock, Loader2, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserProfileModalProps {
  uid: string | null;
  onClose: () => void;
  onSendMessage?: (uid: string, name: string, photo: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ uid, onClose, onSendMessage }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) { setProfile(null); return; }
    setLoading(true);
    getDoc(doc(db, 'users', uid))
      .then((snap) => {
        if (snap.exists()) setProfile({ uid, ...snap.data() } as UserProfile);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [uid]);

  const formatLastSeen = (ts: number) => {
    if (!ts) return 'Unknown';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <AnimatePresence>
      {uid && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#0F1724] rounded-3xl border border-slate-800/60 shadow-2xl overflow-hidden relative"
          >
            {/* Background glow */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-rose-500/8 rounded-full blur-3xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-400 p-[2px]">
                  <div className="w-full h-full bg-[#0F1724] rounded-[10px] flex items-center justify-center">
                    <Heart className="w-4 h-4 text-rose-400 fill-rose-400/20" />
                  </div>
                </div>
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              </div>
            ) : profile ? (
              <>
                {/* Header banner */}
                <div className="bg-gradient-to-b from-amber-500/10 to-transparent pt-8 pb-4 px-6 flex flex-col items-center space-y-3">
                  <div className="relative">
                    <img
                      src={profile.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(profile.displayName)}`}
                      alt={profile.displayName}
                      className="w-20 h-20 rounded-full object-cover border-4 border-amber-500/30 shadow-xl"
                    />
                    <span
                      className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-[#0F1724] ${
                        profile.isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    />
                  </div>

                  <div className="text-center space-y-0.5">
                    <h2 className="text-lg font-bold text-slate-100">{profile.displayName}</h2>
                    <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
                      <AtSign className="w-3 h-3" />
                      {profile.username || 'no username'}
                    </p>
                  </div>

                  {/* Online status badge */}
                  <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
                    profile.isOnline
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800/60 border-slate-700/40 text-slate-500'
                  }`}>
                    {profile.isOnline ? (
                      <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span>Online now</span></>
                    ) : (
                      <><Clock className="w-3 h-3" /><span>Last seen {formatLastSeen(profile.lastSeen)}</span></>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {profile.bio && (
                  <div className="px-6 pb-4">
                    <p className="text-xs text-slate-400 leading-relaxed text-center italic">
                      "{profile.bio}"
                    </p>
                  </div>
                )}

                {/* Divider */}
                <div className="mx-6 border-t border-slate-800/60" />

                {/* Action buttons */}
                <div className="p-5 space-y-2">
                  {onSendMessage && (
                    <button
                      onClick={() => {
                        onSendMessage(profile.uid, profile.displayName, profile.photoURL);
                        onClose();
                      }}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-semibold text-sm shadow-lg shadow-rose-500/10 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Send Message</span>
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="w-full py-2 rounded-xl border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 text-xs font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 space-y-2 text-slate-500">
                <Circle className="w-8 h-8 text-slate-700" />
                <p className="text-sm">Profile not found</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
