import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import type { Chat, ChatMessage, Friend, UserProfile } from '../types';
import {
  Send,
  MessageSquare,
  Users,
  Search,
  Plus,
  ChevronLeft,
  Check,
  CheckCheck,
  Circle,
  Heart,
  Smile,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfileModal } from '../components/UserProfileModal';
import { InAppNotificationToast, type InAppNotifData } from '../components/InAppNotificationToast';

interface ChatPageProps {
  initialFriendUid?: string | null;
  onClearInitialFriend?: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ initialFriendUid, onClearInitialFriend }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [heartAnimId, setHeartAnimId] = useState<string | null>(null);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<string | null>(null);
  const [viewProfileUid, setViewProfileUid] = useState<string | null>(null);
  const [activeInAppNotif, setActiveInAppNotif] = useState<InAppNotifData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef<{ msgId: string; time: number } | null>(null);
  const longPressTimerRef = useRef<any>(null);

  const toggleReaction = async (msgId: string, emoji: string = '❤️') => {
    if (!activeChatId || !user) return;
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;

    const currentReactions = msg.reactions || {};
    const updatedReactions = { ...currentReactions };

    if (updatedReactions[user.uid] === emoji) {
      delete updatedReactions[user.uid];
    } else {
      updatedReactions[user.uid] = emoji;
    }

    try {
      await updateDoc(doc(db, 'chats', activeChatId, 'messages', msgId), {
        reactions: updatedReactions,
      });
    } catch (err) {
      console.error('Error updating reaction:', err);
    }
  };

  const handleMessageTap = (msgId: string) => {
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.msgId === msgId && now - lastTapRef.current.time < 300) {
      toggleReaction(msgId, '❤️');
      setHeartAnimId(msgId);
      setTimeout(() => setHeartAnimId(null), 900);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { msgId, time: now };
    }
  };

  const handleTouchStart = (msgId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setActiveReactionPickerMsgId((prev) => (prev === msgId ? null : msgId));
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const isInitialChatsLoad = useRef(true);

  // Play a soft chime sound on message receive
  const playChimeSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (_e) {}
  };

  const processedMessageKeysRef = useRef<Set<string>>(new Set());

  // Helper to show notification on PC and Mobile
  // - App VISIBLE: show in-app banner toast + chime only (no Chrome/OS notification)
  // - App HIDDEN/BACKGROUNDED: show OS system notification via service worker
  const triggerMessageNotification = (title: string, body: string, photo?: string, chatId?: string, senderUid?: string) => {
    const isAppVisible = document.visibilityState === 'visible';

    if (isAppVisible) {
      // App is open and user can see it — show in-app floating banner + chime only
      playChimeSound();
      setActiveInAppNotif({
        id: String(Date.now()),
        senderUid: senderUid || '',
        senderName: title,
        senderPhoto: photo || '',
        text: body,
        chatId: chatId || '',
      });
    } else {
      // App is backgrounded/minimized — show OS system notification
      playChimeSound();
      if ('Notification' in window && Notification.permission === 'granted') {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(`💬 ${title}`, {
              body,
              icon: photo || './pwa-192x192.png',
              badge: './pwa-192x192.png',
              tag: chatId || 'veyra-msg',
              renotify: true,
              vibrate: [200, 100, 200],
              data: { chatId },
            } as any);
          });
        } else {
          const notif = new Notification(`💬 ${title}`, {
            body,
            icon: photo || './pwa-192x192.png',
            tag: chatId || 'veyra-msg',
          });
          notif.onclick = () => { window.focus(); };
        }
      }
    }
  };

  // Load my chats in real-time & notify on new incoming messages
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Chat[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chat));
        list.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

        list.forEach((c) => {
          if (c.lastSenderId && c.lastSenderId !== user.uid && c.lastMessageAt) {
            const key = `${c.id}_${c.lastMessageAt}_${c.lastMessage}`;
            if (!processedMessageKeysRef.current.has(key)) {
              processedMessageKeysRef.current.add(key);
              // Only trigger notification if this is a live incoming message after initial load
              if (!isInitialChatsLoad.current) {
                const senderName = c.participantNames?.[c.lastSenderId] || 'New Message';
                const senderPhoto = c.participantPhotos?.[c.lastSenderId] || '';
                triggerMessageNotification(
                  senderName,
                  c.lastMessage || 'Sent a message',
                  senderPhoto,
                  c.id,
                  c.lastSenderId
                );
              }
            }
          }
        });

        isInitialChatsLoad.current = false;
        setChats(list);
      },
      (err) => {
        console.error('Error fetching chats:', err);
      }
    );
    return () => unsub();
  }, [user]);

  // Listen for notification click postMessage from service worker (when app is backgrounded)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.chatId) {
        setActiveChatId(event.data.chatId);
        setShowMobileChat(true);
        window.focus();
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

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

  // Keep activeChat updated when chats list updates
  useEffect(() => {
    if (!activeChatId || chats.length === 0) return;
    const updated = chats.find((c) => c.id === activeChatId);
    if (updated) {
      setActiveChat(updated);
    }
  }, [chats, activeChatId]);

  // Handle navigation to specific friend's chat
  useEffect(() => {
    if (!initialFriendUid || !user) return;

    const targetChat = chats.find((c) => c.participants.includes(initialFriendUid));
    if (targetChat) {
      setActiveChatId(targetChat.id);
      setActiveChat(targetChat);
      setShowMobileChat(true);
      if (onClearInitialFriend) onClearInitialFriend();
    } else {
      // Query directly in case chats list snapshot is still updating, or create if missing
      const findOrCreateTargetChat = async () => {
        try {
          const q = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', user.uid)
          );
          const snap = await getDocs(q);
          const matchDoc = snap.docs.find((d) => {
            const data = d.data();
            return data.participants?.includes(initialFriendUid);
          });
          if (matchDoc) {
            const cData = { id: matchDoc.id, ...matchDoc.data() } as Chat;
            setActiveChatId(cData.id);
            setActiveChat(cData);
            setShowMobileChat(true);
            if (onClearInitialFriend) onClearInitialFriend();
          } else {
            // Create chat if non-existent
            const friendProfSnap = await getDoc(doc(db, 'users', initialFriendUid));
            const friendProf = friendProfSnap.exists() ? (friendProfSnap.data() as UserProfile) : null;
            const friendName = friendProf?.displayName || 'Friend';
            const friendPhoto = friendProf?.photoURL || '';

            const newDocRef = await addDoc(collection(db, 'chats'), {
              participants: [user.uid, initialFriendUid],
              participantNames: {
                [user.uid]: user.displayName || 'User',
                [initialFriendUid]: friendName,
              },
              participantPhotos: {
                [user.uid]: user.photoURL || '',
                [initialFriendUid]: friendPhoto,
              },
              lastMessage: '',
              lastMessageAt: Date.now(),
              lastSenderId: '',
              unreadCount: { [user.uid]: 0, [initialFriendUid]: 0 },
              createdAt: Date.now(),
            });

            const newChat: Chat = {
              id: newDocRef.id,
              participants: [user.uid, initialFriendUid],
              participantNames: {
                [user.uid]: user.displayName || 'User',
                [initialFriendUid]: friendName,
              },
              participantPhotos: {
                [user.uid]: user.photoURL || '',
                [initialFriendUid]: friendPhoto,
              },
              lastMessage: '',
              lastMessageAt: Date.now(),
              lastSenderId: '',
              unreadCount: { [user.uid]: 0, [initialFriendUid]: 0 },
              createdAt: Date.now(),
            };

            setActiveChatId(newChat.id);
            setActiveChat(newChat);
            setShowMobileChat(true);
            if (onClearInitialFriend) onClearInitialFriend();
          }
        } catch (e) {
          console.error('Error finding or creating target chat:', e);
        }
      };
      findOrCreateTargetChat();
    }
  }, [initialFriendUid, chats, user, onClearInitialFriend]);

  // Load messages for active chat in real-time
  useEffect(() => {
    if (!activeChatId) return;
    setMessages([]);
    const q = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs: ChatMessage[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage));
        setMessages(msgs);
        // mark messages as seen
        msgs.forEach((m) => {
          if (m.senderId !== user?.uid && m.status !== 'seen') {
            updateDoc(doc(db, 'chats', activeChatId, 'messages', m.id), { status: 'seen' }).catch(() => {});
          }
        });
        // reset unread count
        if (user) {
          updateDoc(doc(db, 'chats', activeChatId), {
            [`unreadCount.${user.uid}`]: 0,
          }).catch(() => {});
        }
      },
      (err) => {
        console.error('Error fetching messages:', err);
      }
    );
    return () => unsub();
  }, [activeChatId, user]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openChat = (chat: Chat) => {
    setActiveChatId(chat.id);
    setActiveChat(chat);
    setShowMobileChat(true);
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const startChatWithFriend = async (friend: Friend) => {
    if (!user) return;
    try {
      const existing = chats.find((c) => c.participants.includes(friend.uid));
      if (existing) {
        openChat(existing);
        return;
      }

      const newDocRef = await addDoc(collection(db, 'chats'), {
        participants: [user.uid, friend.uid],
        participantNames: {
          [user.uid]: user.displayName || 'User',
          [friend.uid]: friend.displayName || 'Friend',
        },
        participantPhotos: {
          [user.uid]: user.photoURL || '',
          [friend.uid]: friend.photoURL || '',
        },
        lastMessage: '',
        lastMessageAt: Date.now(),
        lastSenderId: '',
        unreadCount: { [user.uid]: 0, [friend.uid]: 0 },
        createdAt: Date.now(),
      });

      const newChat: Chat = {
        id: newDocRef.id,
        participants: [user.uid, friend.uid],
        participantNames: {
          [user.uid]: user.displayName || 'User',
          [friend.uid]: friend.displayName || 'Friend',
        },
        participantPhotos: {
          [user.uid]: user.photoURL || '',
          [friend.uid]: friend.photoURL || '',
        },
        lastMessage: '',
        lastMessageAt: Date.now(),
        lastSenderId: '',
        unreadCount: { [user.uid]: 0, [friend.uid]: 0 },
        createdAt: Date.now(),
      };

      openChat(newChat);
    } catch (err) {
      console.error('Error starting chat:', err);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeChatId || !user || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const msgRef = collection(db, 'chats', activeChatId, 'messages');
      await addDoc(msgRef, {
        text,
        senderId: user.uid,
        senderName: user.displayName || 'User',
        senderPhoto: user.photoURL || '',
        chatId: activeChatId,
        createdAt: Date.now(),
        type: 'text',
        status: 'sent',
      });

      // update last message in chat doc
      const otherUid = activeChat?.participants.find((p) => p !== user.uid);
      await updateDoc(doc(db, 'chats', activeChatId), {
        lastMessage: text,
        lastMessageAt: Date.now(),
        lastSenderId: user.uid,
        ...(otherUid ? { [`unreadCount.${otherUid}`]: (activeChat?.unreadCount?.[otherUid] || 0) + 1 } : {}),
      });
    } finally {
      setSending(false);
    }
  };

  const getOtherParticipant = (chat: Chat) => {
    const otherId = chat.participants.find((p) => p !== user?.uid);
    return {
      uid: otherId || '',
      name: otherId ? chat.participantNames?.[otherId] || 'User' : 'Unknown',
      photo: otherId ? chat.participantPhotos?.[otherId] || '' : '',
    };
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex-1 h-full w-full flex overflow-hidden">
      {/* --- Sidebar: Chat List --- */}
      <div className={`flex flex-col w-full md:w-80 lg:w-96 bg-[#0F1724] border-r border-slate-800/60 flex-shrink-0 ${showMobileChat ? 'hidden md:flex' : 'flex'}`} style={{ minHeight: 0 }}>
        <div className="px-4 py-4 border-b border-slate-800/60 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-amber-400" />
            <span>Messages</span>
            {chats.reduce((acc, c) => acc + (c.unreadCount?.[user?.uid || ''] || 0), 0) > 0 && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold">
                {chats.reduce((acc, c) => acc + (c.unreadCount?.[user?.uid || ''] || 0), 0)}
              </span>
            )}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                Start a Conversation
              </p>
              {friends.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 border border-slate-800/60 rounded-2xl bg-slate-900/40">
                  <Users className="w-7 h-7 text-slate-500" />
                  <p className="text-sm text-slate-300">No friends added yet</p>
                  <p className="text-xs text-slate-500">Go to Friends tab to find and add friends!</p>
                </div>
              ) : (
                friends.map((friend) => (
                  <button
                    key={friend.uid}
                    onClick={() => startChatWithFriend(friend)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/60 transition-all text-left group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <img
                          src={friend.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(friend.displayName)}`}
                          alt={friend.displayName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-700"
                        />
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0F1724] ${friend.isOnline ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200 group-hover:text-amber-400 transition-colors truncate">
                          {friend.displayName}
                        </p>
                        <p className="text-[10px] text-emerald-400">
                          {friend.isOnline ? 'Online' : 'Click to start chat'}
                        </p>
                      </div>
                    </div>
                    <MessageSquare className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  </button>
                ))
              )}
            </div>
          ) : (
            chats.map((chat) => {
              const other = getOtherParticipant(chat);
              const unread = chat.unreadCount?.[user?.uid || ''] || 0;
              const isActive = activeChatId === chat.id;

              return (
                <button
                  key={chat.id}
                  onClick={() => openChat(chat)}
                  className={`w-full flex items-center space-x-3 px-4 py-3.5 text-left transition-all border-b border-slate-800/30 ${
                    isActive ? 'bg-amber-500/8 border-l-2 border-l-amber-500' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={other.photo || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(other.name)}`}
                      alt={other.name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-700"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-100 truncate">{other.name}</span>
                      {chat.lastMessageAt && (
                        <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">
                          {formatTime(chat.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-slate-400 truncate flex items-center space-x-1">
                        {chat.lastSenderId === user?.uid && <CheckCheck className="w-3 h-3 text-slate-500 flex-shrink-0" />}
                        <span>{chat.lastMessage || 'No messages yet'}</span>
                      </p>
                      {unread > 0 && (
                        <span className="ml-2 w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* --- Main Chat Window --- */}
      <div className={`flex-1 flex overflow-hidden ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Conversation Panel */}
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          {!activeChatId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <MessageSquare className="w-9 h-9 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Select a conversation</h3>
                <p className="text-xs text-slate-500 mt-1">Choose from your chats or add a new friend</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center space-x-3 px-4 py-3 bg-[#0F1724] border-b border-slate-800/60 flex-shrink-0">
                <button
                  onClick={() => { setShowMobileChat(false); }}
                  className="md:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                {activeChat && (() => {
                  const other = getOtherParticipant(activeChat);
                  return (
                    <button
                      onClick={() => setViewProfileUid(other.uid)}
                      className="flex items-center space-x-3 hover:opacity-80 transition-opacity text-left"
                    >
                      <img
                        src={other.photo || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(other.name)}`}
                        alt={other.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-700 hover:border-amber-500/50 transition-colors"
                      />
                      <div>
                        <h3 className="text-sm font-bold text-slate-100 hover:text-amber-400 transition-colors">{other.name}</h3>
                        <p className="text-[10px] text-emerald-400">Tap to view profile</p>
                      </div>
                    </button>
                  );
                })()}
              </div>

              {/* Messages — independently scrollable */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0B0F17]" style={{ minHeight: 0 }}>
                {messages.map((msg, i) => {
                  const isMe = msg.senderId === user?.uid;
                  const showAvatar = !isMe && (i === 0 || messages[i - 1]?.senderId !== msg.senderId);

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-end space-x-2 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}
                    >
                      {!isMe && (
                        <div className="w-7 flex-shrink-0">
                          {showAvatar && (
                            <button onClick={() => setViewProfileUid(msg.senderId)} className="block">
                              <img
                                src={msg.senderPhoto || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(msg.senderName)}`}
                                alt={msg.senderName}
                                className="w-7 h-7 rounded-full object-cover border border-slate-700 hover:border-amber-500/50 transition-colors hover:scale-110"
                              />
                            </button>
                          )}
                        </div>
                      )}
                      <div className={`max-w-[70%] space-y-0.5 ${isMe ? 'items-end' : 'items-start'} flex flex-col relative group`}>
                        {!isMe && showAvatar && (
                          <button onClick={() => setViewProfileUid(msg.senderId)} className="text-[10px] text-slate-500 ml-1 hover:text-amber-400 transition-colors">{msg.senderName}</button>
                        )}

                        {/* Floating Emoji Picker Popup */}
                        <AnimatePresence>
                          {activeReactionPickerMsgId === msg.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: -8 }}
                              exit={{ opacity: 0, scale: 0.8, y: 5 }}
                              className={`absolute z-30 -top-9 ${isMe ? 'right-0' : 'left-0'} bg-[#0F1724] border border-slate-700/80 rounded-full px-2 py-1 shadow-2xl flex items-center space-x-1.5 backdrop-blur-md`}
                            >
                              {['❤️', '👍', '😂', '😮', '😢', '🔥'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleReaction(msg.id, emoji);
                                    setActiveReactionPickerMsgId(null);
                                  }}
                                  className="hover:scale-130 active:scale-95 transition-transform text-sm leading-none p-1 rounded-full hover:bg-slate-800"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Heart Burst Double-Tap Animation */}
                        <AnimatePresence>
                          {heartAnimId === msg.id && (
                            <motion.div
                              initial={{ opacity: 1, scale: 0.4, y: 0 }}
                              animate={{ opacity: 0, scale: 2.2, y: -30 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.7, ease: 'easeOut' }}
                              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                            >
                              <span className="text-4xl drop-shadow-xl select-none">❤️</span>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Message Content Bubble */}
                        <div className="relative flex items-center group/bubble">
                          <div
                            onTouchStart={() => handleTouchStart(msg.id)}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={() => handleTouchStart(msg.id)}
                            onMouseUp={handleTouchEnd}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setActiveReactionPickerMsgId((prev) => (prev === msg.id ? null : msg.id));
                            }}
                            onClick={() => handleMessageTap(msg.id)}
                            className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed cursor-pointer select-none transition-all ${
                              isMe
                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-br-sm font-medium shadow-md shadow-amber-500/10'
                                : 'bg-[#1E293B] text-slate-100 border border-slate-800/80 rounded-bl-sm shadow-md'
                            }`}
                          >
                            {msg.text}
                          </div>

                          {/* Desktop Hover Quick React Trigger */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReactionPickerMsgId((prev) => (prev === msg.id ? null : msg.id));
                            }}
                            className={`opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1 rounded-full text-slate-400 hover:text-amber-400 hover:bg-slate-800 ${
                              isMe ? '-order-1 mr-1' : 'ml-1'
                            }`}
                            title="React"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Reactions Badge */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReaction(msg.id, '❤️');
                            }}
                            className={`-mt-1.5 z-20 inline-flex items-center space-x-1 bg-[#0F1724] border border-slate-700/80 rounded-full px-2 py-0.5 shadow-md cursor-pointer hover:scale-105 transition-transform ${
                              isMe ? 'self-end mr-1' : 'self-start ml-1'
                            }`}
                            title="Click to toggle reaction"
                          >
                            {Array.from(new Set(Object.values(msg.reactions))).map((emoji, idx) => (
                              <span key={idx} className="text-xs leading-none">
                                {emoji}
                              </span>
                            ))}
                            {Object.keys(msg.reactions).length > 1 && (
                              <span className="text-[10px] font-bold text-slate-400">
                                {Object.keys(msg.reactions).length}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Timestamp & Status */}
                        <div className={`flex items-center space-x-1 px-1 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                          <span className="text-[10px] text-slate-600">{formatTime(msg.createdAt)}</span>
                          {isMe && (
                            msg.status === 'seen'
                              ? <CheckCheck className="w-3 h-3 text-amber-400" />
                              : <Check className="w-3 h-3 text-slate-500" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar — always visible, pinned at bottom */}
              <div className="px-4 py-3 bg-[#0F1724] border-t border-slate-800/60 flex items-center space-x-2 flex-shrink-0">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim() || sending}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* --- Friends Panel (right side) --- */}
        {friends.length > 0 && (
          <div className="hidden lg:flex flex-col w-64 bg-[#0F1724] border-l border-slate-800/60 flex-shrink-0" style={{ minHeight: 0 }}>
            <div className="px-4 py-4 border-b border-slate-800/60 flex-shrink-0">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Friends</span>
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500">{friends.length}</span>
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {friends.map((friend) => (
                <div
                  key={friend.uid}
                  className="w-full flex items-center space-x-3 p-2.5 rounded-xl hover:bg-slate-800/60 transition-all group"
                >
                  <button
                    onClick={() => setViewProfileUid(friend.uid)}
                    className="relative flex-shrink-0"
                    title="View profile"
                  >
                    <img
                      src={friend.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(friend.displayName)}`}
                      alt={friend.displayName}
                      className="w-9 h-9 rounded-full object-cover border border-slate-700 hover:border-amber-500/50 hover:scale-110 transition-all"
                    />
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0F1724] ${friend.isOnline ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                  </button>
                  <button onClick={() => startChatWithFriend(friend)} className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-amber-400 transition-colors truncate">
                      {friend.displayName}
                    </p>
                    <p className={`text-[10px] truncate ${friend.isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {friend.isOnline ? 'Online · tap name to chat' : 'Offline'}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        uid={viewProfileUid}
        onClose={() => setViewProfileUid(null)}
        onSendMessage={(uid, name, photo) => {
          const friend = friends.find((f) => f.uid === uid);
          if (friend) {
            startChatWithFriend(friend);
          } else {
            startChatWithFriend({ uid, displayName: name, username: '', photoURL: photo, isOnline: false, lastSeen: 0 });
          }
        }}
      />

      {/* Floating In-App Real-Time Notification Toast */}
      <InAppNotificationToast
        notification={activeInAppNotif}
        onDismiss={() => setActiveInAppNotif(null)}
        onSelectNotif={(notif) => {
          setActiveChatId(notif.chatId);
          setShowMobileChat(true);
        }}
      />
    </div>
  );
};
