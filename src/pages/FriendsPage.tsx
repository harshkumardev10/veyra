import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  limit,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import type { FriendRequest, Friend, UserProfile } from '../types';
import {
  Users,
  Search,
  UserPlus,
  Check,
  X,
  Clock,
  MessageSquare,
  Bell,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FriendsPageProps {
  onOpenChat: (friendUid: string, friendName: string, friendPhoto: string) => void;
}

export const FriendsPage: React.FC<FriendsPageProps> = ({ onOpenChat }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Load friends list in real-time
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'friends'),
      where('users', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const list: Friend[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        const otherUid = data.users.find((u: string) => u !== user.uid);
        if (otherUid) {
          const profSnap = await getDoc(doc(db, 'users', otherUid));
          if (profSnap.exists()) {
            const prof = profSnap.data() as UserProfile;
            list.push({
              uid: otherUid,
              displayName: prof.displayName,
              username: prof.username,
              photoURL: prof.photoURL,
              isOnline: prof.isOnline,
              lastSeen: prof.lastSeen,
            });
          }
        }
      }
      setFriends(list);
    });
    return () => unsub();
  }, [user]);

  // Load incoming requests in real-time
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'friend_requests'),
      where('toUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snap) => {
      setIncomingRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest)));
    });
    return () => unsub();
  }, [user]);

  // Load sent requests in real-time
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'friend_requests'),
      where('fromUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snap) => {
      setSentRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest)));
    });
    return () => unsub();
  }, [user]);

  // Search users by display name or username
  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('displayName', '>=', searchQuery),
        where('displayName', '<=', searchQuery + '\uf8ff'),
        limit(10)
      );
      const snap = await getDocs(q);
      const results: UserProfile[] = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter((u) => u.uid !== user.uid);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  const isFriend = (uid: string) => friends.some((f) => f.uid === uid);
  const hasSentRequest = (uid: string) => sentRequests.some((r) => r.toUid === uid);

  const sendFriendRequest = async (target: UserProfile) => {
    if (!user || processingIds.has(target.uid)) return;
    setProcessingIds((prev) => new Set(prev).add(target.uid));
    try {
      await addDoc(collection(db, 'friend_requests'), {
        fromUid: user.uid,
        fromName: user.displayName,
        fromPhoto: user.photoURL,
        fromUsername: user.username,
        toUid: target.uid,
        status: 'pending',
        createdAt: Date.now(),
      });
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(target.uid); return s; });
    }
  };

  const acceptRequest = async (req: FriendRequest) => {
    if (!user || processingIds.has(req.id)) return;
    setProcessingIds((prev) => new Set(prev).add(req.id));
    try {
      // Create friendship doc
      await setDoc(doc(collection(db, 'friends')), {
        users: [user.uid, req.fromUid],
        createdAt: Date.now(),
      });
      // Update request status
      await updateDoc(doc(db, 'friend_requests', req.id), { status: 'accepted' });
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(req.id); return s; });
    }
  };

  const rejectRequest = async (reqId: string) => {
    await updateDoc(doc(db, 'friend_requests', reqId), { status: 'rejected' });
  };

  const openChatWithFriend = async (friend: Friend) => {
    if (!user) return;
    // Check if chat exists
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
    );
    const snap = await getDocs(q);
    const existing = snap.docs.find((d) => {
      const data = d.data();
      return data.participants.includes(friend.uid) && data.participants.length === 2;
    });

    if (existing) {
      onOpenChat(friend.uid, friend.displayName, friend.photoURL);
      return;
    }

    // Create new chat
    await addDoc(collection(db, 'chats'), {
      participants: [user.uid, friend.uid],
      participantNames: {
        [user.uid]: user.displayName,
        [friend.uid]: friend.displayName,
      },
      participantPhotos: {
        [user.uid]: user.photoURL,
        [friend.uid]: friend.photoURL,
      },
      lastMessage: '',
      lastMessageAt: Date.now(),
      lastSenderId: '',
      unreadCount: { [user.uid]: 0, [friend.uid]: 0 },
      createdAt: Date.now(),
    });

    onOpenChat(friend.uid, friend.displayName, friend.photoURL);
  };

  const tabs = [
    { id: 'friends' as const, label: 'Friends', Icon: Users, count: friends.length },
    { id: 'requests' as const, label: 'Requests', Icon: Bell, count: incomingRequests.length },
    { id: 'search' as const, label: 'Search', Icon: Search, count: 0 },
  ];

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col px-4 py-4">
      {/* Tab Bar */}
      <div className="flex gap-2 mb-5">
        {tabs.map(({ id, label, Icon, count }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-semibold transition-all duration-200 border ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white border-transparent shadow-lg shadow-rose-500/20'
                  : 'bg-[#0F1724] text-slate-400 border-slate-800/60 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{label}</span>
              {count > 0 && (
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold flex-shrink-0 ${
                  isActive ? 'bg-white/25 text-white' : 'bg-rose-500 text-white'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {/* FRIENDS TAB */}
        {activeTab === 'friends' && (
          friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
              <Users className="w-12 h-12 text-slate-700" />
              <p className="text-sm text-slate-400">No friends yet</p>
              <button
                onClick={() => setActiveTab('search')}
                className="text-xs text-amber-400 hover:underline flex items-center space-x-1"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search and add people</span>
              </button>
            </div>
          ) : (
            friends.map((friend) => (
              <motion.div
                key={friend.uid}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center space-x-3 bg-[#0F1724] rounded-2xl border border-slate-800/60 p-3"
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={friend.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(friend.displayName)}`}
                    alt={friend.displayName}
                    className="w-11 h-11 rounded-full object-cover border border-slate-700"
                  />
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0F1724] ${friend.isOnline ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{friend.displayName}</p>
                  <p className="text-[11px] text-slate-500">
                    {friend.isOnline ? 'Online' : `Last seen ${new Date(friend.lastSeen).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => openChatWithFriend(friend)}
                  className="p-2 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </motion.div>
            ))
          )
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="space-y-2">
            {incomingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-2 text-center">
                <UserPlus className="w-12 h-12 text-slate-700" />
                <p className="text-sm text-slate-400">No pending requests</p>
              </div>
            ) : (
              incomingRequests.map((req) => (
                <div key={req.id} className="flex items-center space-x-3 bg-[#0F1724] rounded-2xl border border-amber-500/20 p-3">
                  <img
                    src={req.fromPhoto || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(req.fromName)}`}
                    alt={req.fromName}
                    className="w-11 h-11 rounded-full object-cover border border-slate-700"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100">{req.fromName}</p>
                    <p className="text-[11px] text-slate-500">@{req.fromUsername} • wants to connect</p>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => acceptRequest(req)}
                      disabled={processingIds.has(req.id)}
                      className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => rejectRequest(req.id)}
                      className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full bg-[#0F1724] border border-slate-800 rounded-2xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {searching ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Search'}
              </button>
            </div>

            <div className="space-y-2">
              {searchResults.map((result) => {
                const alreadyFriend = isFriend(result.uid);
                const alreadySent = hasSentRequest(result.uid);

                return (
                  <div key={result.uid} className="flex items-center space-x-3 bg-[#0F1724] rounded-2xl border border-slate-800/60 p-3">
                    <img
                      src={result.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(result.displayName)}`}
                      alt={result.displayName}
                      className="w-11 h-11 rounded-full object-cover border border-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{result.displayName}</p>
                      <p className="text-[11px] text-slate-500">@{result.username}</p>
                    </div>
                    {alreadyFriend ? (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-medium flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Friends</span>
                      </span>
                    ) : alreadySent ? (
                      <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 text-xs font-medium flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>Sent</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => sendFriendRequest(result)}
                        disabled={processingIds.has(result.uid)}
                        className="p-2 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
