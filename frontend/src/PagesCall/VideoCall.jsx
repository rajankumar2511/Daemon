import { useState, useEffect } from "react";
import { useCall } from "../context/CallContext";
import { getMyFriends } from "../lib/api";
import { toast } from "react-toastify";
import { onUserOnline, onUserOffline, offEvent } from "../Sockets/Socket";
import { Phone, PhoneOff, Video, VideoOff } from "lucide-react";

const VideoPage = () => {
    const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const {
    myVideoRef,
    remoteVideoRef,
    incomingCall,
    callAccepted,
    callUser,
    answerCall,
    endCall,
    callError,
    isConnecting,
    setCallError,
    activeUser,
    setActiveUser,
  } = useCall();

  // ✅ Load friends
  useEffect(() => {
    const loadFriends = async () => {
      try {
        const data = await getMyFriends();
        setFriends(data || []);
      } catch (err) {
        console.error("[Video] Load friends error:", err);
        toast.error("Failed to load friends");
      } finally {
        setLoading(false);
      }
    };
    loadFriends();
  }, []);

  // ✅ Presence listeners (event-based only)
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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading calls...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (callError) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
        <div className="text-center">
          <p className="text-red-400 mb-4">{callError}</p>
          <button
            onClick={() => setCallError(null)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0d0d0d] text-white flex flex-col">

      {/* HEADER */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="font-semibold">Calls</h2>
      </div>

      {/* FRIENDS LIST */}
      <div className="flex-1 overflow-y-auto">
        {friends.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-10">
            No friends found
          </div>
        )}

        {friends.map((f) => {
          const isOnline = onlineUsers.has(f._id);

          return (
            <div
              key={f._id}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-900"
            >
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-full overflow-hidden bg-[#1a1a1a]">
                  {f.profilePic ? (
                    <img
                      src={f.profilePic}
                      className="w-full h-full object-cover"
                      alt=""
                      onError={(e) => (e.target.style.display = "none")}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      👤
                    </div>
                  )}
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-[#0d0d0d]" />
                  )}
                </div>
                <p className="text-sm">{f.fullName || "Unknown"}</p>
              </div>

              {isOnline && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      console.log("[VIDEO PAGE] Initiating audio call to:", f.fullName);
                      callUser({ to: f._id, user: f, type: "audio" });
                    }}
                    className="px-2 py-1 bg-[#1a1a1a] rounded hover:bg-[#222]"
                  >
                    📞
                  </button>
                  <button
                    onClick={() => {
                      console.log("[VIDEO PAGE] Initiating video call to:", f.fullName);
                      callUser({ to: f._id, user: f, type: "video" });
                    }}
                    className="px-2 py-1 bg-[#1a1a1a] rounded hover:bg-[#222]"
                  >
                    🎥
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VideoPage;