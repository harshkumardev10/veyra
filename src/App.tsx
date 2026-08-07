import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { ChatPage } from './pages/ChatPage';
import { FriendsPage } from './pages/FriendsPage';
import { ProfilePage } from './pages/ProfilePage';
import { Heart, MessageSquare, Users, User, Sparkles, Loader2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { InstallBanner, triggerAppInstall } from './components/InstallBanner';

type Tab = 'chat' | 'friends' | 'profile';

const AppShell: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [chatNavigationData, setChatNavigationData] = useState<{
    friendUid: string; friendName: string; friendPhoto: string;
  } | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex flex-col items-center justify-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-400 p-[2px] shadow-2xl shadow-rose-500/20">
          <div className="w-full h-full bg-[#0B0F17] rounded-[14px] flex items-center justify-center">
            <Heart className="w-7 h-7 text-rose-400 fill-rose-400/20" />
          </div>
        </div>
        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  const handleOpenChatFromFriends = (friendUid: string, friendName: string, friendPhoto: string) => {
    setChatNavigationData({ friendUid, friendName, friendPhoto });
    setActiveTab('chat');
  };

  const tabs = [
    { id: 'chat' as Tab, label: 'Chat', Icon: MessageSquare },
    { id: 'friends' as Tab, label: 'Friends', Icon: Users },
    { id: 'profile' as Tab, label: 'Profile', Icon: User },
  ];

  return (
    <div className="h-screen w-screen bg-[#0B0F17] flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="flex-shrink-0 z-40 bg-[#0B0F17]/90 backdrop-blur-md border-b border-slate-800/60 px-4 py-3 flex items-center justify-between">
        <div
          onClick={() => window.location.reload()}
          className="flex items-center space-x-2.5 cursor-pointer hover:opacity-85 transition-opacity"
          title="Click to refresh VEYRA"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-400 p-[2px] shadow-lg shadow-rose-500/20">
            <div className="w-full h-full bg-[#0B0F17] rounded-[9px] flex items-center justify-center">
              <Heart className="w-4 h-4 text-rose-400 fill-rose-400/30" />
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-bold text-lg tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-400 to-amber-300">
              VEYRA
            </span>
            <Sparkles className="w-3 h-3 text-amber-400" />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => triggerAppInstall()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-semibold shadow-md shadow-rose-500/20 active:scale-95 transition-all"
            title="Install VEYRA App"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Install App</span>
          </button>

          <div
            onClick={() => setActiveTab('profile')}
            className="flex items-center space-x-2.5 cursor-pointer hover:opacity-85 transition-opacity p-1 rounded-xl hover:bg-slate-800/40"
            title="View Profile"
          >
            <img
              src={user.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.displayName)}`}
              alt={user.displayName}
              className="w-8 h-8 rounded-full object-cover border-2 border-amber-500/30"
            />
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-200 leading-none">{user.displayName}</p>
              <p className="text-[10px] text-emerald-400 mt-0.5">Online</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden max-w-7xl w-full mx-auto flex flex-col pb-[58px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-hidden h-full flex flex-col"
          >
            {activeTab === 'chat' && (
              <ChatPage
                initialFriendUid={chatNavigationData?.friendUid}
                onClearInitialFriend={() => setChatNavigationData(null)}
              />
            )}
            {activeTab === 'friends' && <FriendsPage onOpenChat={handleOpenChatFromFriends} />}
            {activeTab === 'profile' && (
              <div className="flex-1 overflow-y-auto">
                <ProfilePage />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F17]/95 backdrop-blur-md border-t border-slate-800/60">
        <div className="max-w-md mx-auto flex items-center justify-around px-4 py-2">
          {tabs.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative flex flex-col items-center py-1.5 px-5 rounded-xl transition-all duration-200 ${
                  isActive ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-amber-500/10 rounded-xl border border-amber-500/20"
                  />
                )}
                <Icon className={`w-5 h-5 relative z-10 ${isActive ? 'scale-110' : ''} transition-transform`} />
                <span className="text-[10px] font-semibold mt-0.5 relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      {/* PWA Install Banner */}
      <InstallBanner />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
