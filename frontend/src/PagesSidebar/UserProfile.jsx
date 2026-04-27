import { useEffect, useState } from "react";
import {
  onUserOnline,
  onUserOffline,
  offEvent
} from "../Sockets/Socket";

const UserProfile = ({ friend, onClose }) => {
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const isOnline = onlineUsers.has(friend._id);

  // ✅ Presence listeners (event-based)
  useEffect(() => {
    const handleUserOnline = ({ userId }) => {
      setOnlineUsers(prev => {
        if (prev.has(userId)) return prev;
        const updated = new Set(prev);
        updated.add(userId);
        return updated;
      });
    };

    const handleUserOffline = ({ userId }) => {
      setOnlineUsers(prev => {
        if (!prev.has(userId)) return prev;
        const updated = new Set(prev);
        updated.delete(userId);
        return updated;
      });
    };

    onUserOnline(handleUserOnline);
    onUserOffline(handleUserOffline);

    return () => {
      offEvent("user-online", handleUserOnline);
      offEvent("user-offline", handleUserOffline);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#080c16] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white">{friend?.fullName || "User"}</h3>
            <p className="text-sm text-gray-400">Profile details</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-gray-400 transition hover:border-emerald-400 hover:text-white"
            aria-label="Close profile"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white/5 p-5 text-center">
          {friend?.profilePic ? (
            <img
              src={friend.profilePic}
              className="h-24 w-24 rounded-full object-cover"
              alt="Friend profile"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#111827] text-4xl text-gray-400">👤</div>
          )}
          <div>
            <p className="text-sm text-gray-400">@{friend?.username || "user"}</p>
            <p className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold ${isOnline ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-gray-400"}`}>
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-sm text-gray-200">
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-gray-400">Email</p>
            <p className="mt-2">{friend?.email || "No email"}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-gray-400">Bio</p>
            <p className="mt-2">{friend?.bio || "No bio available."}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;