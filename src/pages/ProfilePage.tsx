import React, { useRef, useState } from 'react';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Mail,
  AtSign,
  Camera,
  LogOut,
  Check,
  Shield,
  Loader2,
  Download,
} from 'lucide-react';
import { triggerAppInstall } from '../components/InstallBanner';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const currentPhoto = photoPreview || user.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.displayName)}`;

  // Compress image to WebP base64 using Canvas — stored in Firestore (no Storage needed)
  const compressToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.src = ev.target?.result as string;
        img.onload = () => {
          const SIZE = 200; // 200×200 avatar
          const canvas = document.createElement('canvas');
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext('2d')!;
          // Crop center square
          const min = Math.min(img.width, img.height);
          const sx = (img.width - min) / 2;
          const sy = (img.height - min) / 2;
          ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
          resolve(canvas.toDataURL('image/webp', 0.75)); // ~10–20 KB
        };
        img.onerror = reject;
      };
      reader.readAsDataURL(file);
    });

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      const base64 = await compressToBase64(file);
      setPhotoPreview(base64);
      // Save directly to Firestore document (no Firebase Storage required)
      await updateDoc(doc(db, 'users', user.uid), { photoURL: base64 });
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const cleanUsername = username.trim().toLowerCase().replace(/\s/g, '_');
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        username: cleanUsername,
        bio: bio.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const formatJoiningDate = (rawDate: any): string => {
    if (!rawDate) return 'Recently';
    let date: Date;
    if (typeof rawDate === 'number') {
      date = new Date(rawDate);
    } else if (typeof rawDate === 'string') {
      date = new Date(rawDate);
    } else if (rawDate?.seconds) {
      date = new Date(rawDate.seconds * 1000);
    } else if (rawDate?.toDate && typeof rawDate.toDate === 'function') {
      date = rawDate.toDate();
    } else {
      date = new Date(rawDate);
    }

    if (isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleSignOut = async () => {
    await updateDoc(doc(db, 'users', user.uid), {
      isOnline: false,
      lastSeen: Date.now(),
    });
    await signOut(auth);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-4">

      {/* Avatar + Name Banner */}
      <div className="flex flex-col items-center space-y-3 bg-[#0F1724] rounded-3xl border border-slate-800/60 p-6 shadow-xl relative overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative group">
          <img
            src={currentPhoto}
            alt={user.displayName}
            className="w-24 h-24 rounded-full object-cover border-4 border-amber-500/30 shadow-xl"
          />
          {/* Upload overlay */}
          <label
            htmlFor="avatar-input"
            className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity"
          >
            {uploadingPhoto ? (
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            ) : (
              <>
                <Camera className="w-5 h-5 text-amber-400" />
                <span className="text-[9px] text-amber-300 mt-0.5 font-semibold">Change</span>
              </>
            )}
          </label>
          <input
            id="avatar-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />
          {/* Online dot */}
          <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0F1724]" />
        </div>

        <div className="text-center">
          <h2 className="text-lg font-bold text-slate-100">{user.displayName}</h2>
          <p className="text-xs text-slate-500">@{user.username}</p>
        </div>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Online</span>
        </div>
      </div>

      {/* Edit Profile Form */}
      <form onSubmit={handleSave} className="bg-[#0F1724] rounded-3xl border border-slate-800/60 p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 border-b border-slate-800/60 pb-3">
          <User className="w-4 h-4 text-amber-400" />
          <span>Edit Profile</span>
        </h3>

        <div className="space-y-3">
          {/* Display Name */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Display Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="Your name"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Username
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="username"
              />
            </div>
          </div>

          {/* Email (readonly) */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-700 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full bg-slate-900/40 border border-slate-800/40 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-600 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about yourself..."
              rows={3}
              maxLength={160}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
            />
            <p className="text-[10px] text-slate-600 text-right mt-0.5">{bio.length}/160</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-semibold text-sm shadow-lg shadow-rose-500/10 transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <>
              <Check className="w-4 h-4" />
              <span>Saved!</span>
            </>
          ) : (
            <span>Save Changes</span>
          )}
        </button>
      </form>

      {/* Account Info + Sign Out */}
      <div className="bg-[#0F1724] rounded-3xl border border-slate-800/60 p-5 space-y-3 shadow-xl">
        <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Account</span>
        </h3>

        <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-900/50 rounded-xl px-3 py-2">
          <span>Member since</span>
          <span className="text-slate-300 font-medium">
            {formatJoiningDate(user.createdAt)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-900/50 rounded-xl px-3 py-2">
          <span>User ID</span>
          <span className="text-slate-600 font-mono text-[10px]">{user.uid.slice(0, 16)}…</span>
        </div>

        <button
          onClick={() => triggerAppInstall()}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-semibold text-xs shadow-md shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center space-x-2 mt-2"
        >
          <Download className="w-4 h-4" />
          <span>Install VEYRA App</span>
        </button>

        <button
          onClick={handleSignOut}
          className="w-full py-2.5 rounded-xl border border-rose-500/25 text-rose-400 hover:bg-rose-500/8 text-sm font-semibold transition-colors flex items-center justify-center space-x-2 mt-1"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
