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
import type { Chat, ChatMessage } from '../types';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load my chats in real-time
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Chat[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chat));
      setChats(list);
    });
    return () => unsub();
  }, [user]);

  // Load messages for active chat in real-time
  useEffect(() => {
    if (!activeChatId) return;
    setMessages([]);
    const q = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage));
      setMessages(msgs);
      // mark messages as seen
      msgs.forEach((m) => {
        if (m.senderId !== user?.uid && m.status !== 'seen') {
          updateDoc(doc(db, 'chats', activeChatId, 'messages', m.id), { status: 'seen' });
        }
      });
      // reset unread count
      if (user) {
        updateDoc(doc(db, 'chats', activeChatId), {
          [`unreadCount.${user.uid}`]: 0,
        });
      }
    });
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
        senderName: user.displayName,
        senderPhoto: user.photoURL,
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
      <div className={`flex flex-col w-full md:w-80 lg:w-96 bg-[#0F1724] border-r border-slate-800/60 flex-shrink-0 ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-4 py-4 border-b border-slate-800/60">
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
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/60 flex items-center justify-center">
                <Users className="w-7 h-7 text-slate-500" />
              </div>
              <p className="text-sm text-slate-400">No conversations yet</p>
              <p className="text-xs text-slate-600">Add friends and start chatting!</p>
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
      <div className={`flex-1 flex flex-col ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>
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
            <div className="flex items-center space-x-3 px-4 py-3 bg-[#0F1724] border-b border-slate-800/60">
              <button
                onClick={() => { setShowMobileChat(false); }}
                className="md:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {activeChat && (() => {
                const other = getOtherParticipant(activeChat);
                return (
                  <>
                    <img
                      src={other.photo || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(other.name)}`}
                      alt={other.name}
                      className="w-9 h-9 rounded-full object-cover border border-slate-700"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{other.name}</h3>
                      <p className="text-[10px] text-emerald-400">Active</p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0B0F17]">
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
                          <img
                            src={msg.senderPhoto || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(msg.senderName)}`}
                            alt={msg.senderName}
                            className="w-7 h-7 rounded-full object-cover border border-slate-700"
                          />
                        )}
                      </div>
                    )}
                    <div className={`max-w-[70%] space-y-0.5 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {!isMe && showAvatar && (
                        <span className="text-[10px] text-slate-500 ml-1">{msg.senderName}</span>
                      )}
                      <div
                        className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-br-sm font-medium'
                            : 'bg-[#1E293B] text-slate-100 border border-slate-800/80 rounded-bl-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
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

            {/* Input Bar */}
            <div className="px-4 py-3 bg-[#0F1724] border-t border-slate-800/60 flex items-center space-x-2">
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
    </div>
  );
};
