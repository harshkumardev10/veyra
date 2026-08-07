// All TypeScript types for the VEYRA app
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  photoURL: string;
  bio: string;
  createdAt: number;
  isOnline: boolean;
  lastSeen: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  chatId: string;
  createdAt: number;
  type: 'text' | 'image';
  imageUrl?: string;
  status: 'sent' | 'delivered' | 'seen';
  reactions?: Record<string, string>; // userUid -> emoji
}

export interface Chat {
  id: string;
  participants: string[];           // [uid1, uid2]
  participantNames: Record<string, string>;
  participantPhotos: Record<string, string>;
  lastMessage: string;
  lastMessageAt: number;
  lastSenderId: string;
  unreadCount: Record<string, number>;
  createdAt: number;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromPhoto: string;
  fromUsername: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export interface Friend {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string;
  isOnline: boolean;
  lastSeen: number;
}
