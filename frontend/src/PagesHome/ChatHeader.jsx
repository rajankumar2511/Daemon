import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, Video, MoreVertical, Clock, Loader2, ChevronRight, ArrowLeft } from "lucide-react";
import { getLastSeen } from "../lib/api";
import { socket } from "../Sockets/Socket";
import { useCall } from "../context/CallContext";

const ChatHeader = ({ otherUser, onAudioCall, onVideoCall, isMobile = false, onBack = null }) => {

  const { callUser } = useCall();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const userId = otherUser?._id;
  const mountedRef = useRef(true);
  const menuRef = useRef(null);

  /* ================= FALLBACK LAST SEEN ================= */
  const fetchLastSeen = useCallback(async () => {
    if (!userId || !mountedRef.current) return;

    setIsLoading(true);
    try {
      const data = await getLastSeen(userId);
      if (mountedRef.current && data?.success) {
        setIsOnline(data.isOnline);
        if (!data.isOnline && data.lastSeen) {
          setLastSeenTimestamp(data.lastSeen);
        } else if (data.isOnline) {
          setLastSeenTimestamp(null);
        }
      }
    } catch (error) {
      console.error("[ChatHeader] Failed to fetch last seen:", error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId]);

  /* ================= HANDLE PROFILE CLICK ================= */
  const handleProfileClick = () => {
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  /* ================= HANDLE AUDIO CALL ================= */
  const handleAudioCall = () => {
    if (!userId) return;

    console.log("[CHAT HEADER] Initiating audio call to:", otherUser?.fullName);

    callUser({
      to: userId,
      user: otherUser,
      type: "audio",
    });

    setShowMenu(false);
  };

  const handleVideoCall = () => {
    if (!userId) return;

    console.log("[CHAT HEADER] Initiating video call to:", otherUser?.fullName);

    callUser({
      to: userId,
      user: otherUser,
      type: "video",
    });

    setShowMenu(false);
  };

  /* ================= CLICK OUTSIDE MENU ================= */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  /* ================= SINGLE CLEAN useEffect ================= */
  useEffect(() => {
    if (!userId) return;

    console.log("[ChatHeader] Setting up for user:", userId);

    // Reset state when switching user
    setIsOnline(false);
    setLastSeenTimestamp(null);
    setIsLoading(true);

    /* ================= EVENT HANDLERS ================= */
    const handleUserOnline = ({ userId: onlineUserId }) => {
      if (!mountedRef.current) return;

      console.log("[ChatHeader] 🟢 User online:", onlineUserId);

      if (onlineUserId === userId) {
        console.log("[ChatHeader] Target user is online");
        setIsOnline(true);
        setLastSeenTimestamp(null);
        setIsLoading(false);
      }
    };

    const handleUserOffline = ({ userId: offlineUserId, lastSeen }) => {
      if (!mountedRef.current) return;

      console.log("[ChatHeader] 🔴 User offline:", offlineUserId);

      if (offlineUserId === userId) {
        console.log("[ChatHeader] Target user is offline");
        setIsOnline(false);
        if (lastSeen) setLastSeenTimestamp(lastSeen);
        setIsLoading(false);
      }
    };

    const handleOnlineUsers = ({ users }) => {
      if (!mountedRef.current) return;

      console.log("[ChatHeader] Initial online users received");
      const isUserOnline = users.map(String).includes(String(userId));
      setIsOnline(isUserOnline);
      if (isUserOnline) setLastSeenTimestamp(null);
      setIsLoading(false);
    };

    // REGISTER LISTENERS (prevent duplicates)
    socket.off("user-online", handleUserOnline);
    socket.off("user-offline", handleUserOffline);
    socket.off("online-users", handleOnlineUsers);

    socket.on("user-online", handleUserOnline);
    socket.on("user-offline", handleUserOffline);
    socket.on("online-users", handleOnlineUsers);

    // Request current online users
    if (socket.connected) {
      socket.emit("get-online-users");
    }

    // Fallback: fetch last seen after a short delay
    const fallbackTimer = setTimeout(() => {
      if (mountedRef.current) {
        fetchLastSeen();
      }
    }, 1000);

    // CLEANUP
    return () => {
      console.log("[ChatHeader] Cleaning up for user:", userId);
      socket.off("user-online", handleUserOnline);
      socket.off("user-offline", handleUserOffline);
      socket.off("online-users", handleOnlineUsers);
      clearTimeout(fallbackTimer);
    };
  }, [userId, fetchLastSeen]);

  // Cleanup mounted ref
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const formatLastSeen = useCallback(() => {
    if (isOnline) return "Online";
    if (isLoading) return "Loading...";
    if (!lastSeenTimestamp) return "Last seen recently";

    const date = new Date(lastSeenTimestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date >= today) {
      return `Last seen at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    if (date >= yesterday) {
      return `Last seen yesterday at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    return `Last seen on ${date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    })} at ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }, [isOnline, isLoading, lastSeenTimestamp]);

  if (!otherUser) return null;

  return (
    <div className="flex items-center justify-between p-2 sm:p-3 border-b border-white/10 bg-[#0B0B0F]/90 backdrop-blur-sm">

      {/* Left Section - User Info with Back Button */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">

        {/* Back Button - Mobile Only */}
        {isMobile && onBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-all duration-200 flex-shrink-0 text-gray-400 hover:text-white"
            aria-label="Back to chats"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group flex-1 min-w-0"
          onClick={handleProfileClick}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:scale-105">
              {otherUser.profilePic ? (
                <img
                  src={otherUser.profilePic}
                  alt={otherUser.fullName || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={18} className="sm:w-5 sm:h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
              )}

              {/* Online Status Dot */}
              {isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-green-500 rounded-full border-2 border-[#0B0B0F]" />
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white group-hover:text-purple-400 transition-colors text-sm sm:text-base truncate">
              {otherUser.fullName || "Unknown User"}
            </p>

            {/* Last Seen Status */}
            <p className="text-xs text-gray-400 flex items-center gap-1">
              {isOnline ? (
                <span className="text-green-500 text-[10px] sm:text-xs">
                  {formatLastSeen()}
                </span>
              ) : isLoading ? (
                <>
                  <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" />
                  <span className="text-[10px] sm:text-xs">Loading...</span>
                </>
              ) : (
                <>
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span className="text-[10px] sm:text-xs truncate">
                    {formatLastSeen()}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Chevron Indicator */}
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all duration-200 opacity-0 group-hover:opacity-100" />
        </div>
      </div>

      {/* Right Section - Call Icons */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">

        {/* Audio Call Button */}
        <button
          onClick={handleAudioCall}
          className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500 hover:to-blue-500 text-gray-400 hover:text-white transition-all duration-200 border border-white/10 hover:border-transparent hover:scale-105 active:scale-95"
          aria-label="Audio call"
          title="Audio call"
        >
          <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Video Call Button */}
        <button
          onClick={handleVideoCall}
          className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 hover:from-pink-500 hover:to-purple-500 text-gray-400 hover:text-white transition-all duration-200 border border-white/10 hover:border-transparent hover:scale-105 active:scale-95"
          aria-label="Video call"
          title="Video call"
        >
          <Video className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Menu Button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-gray-500/10 to-gray-600/10 hover:from-purple-500 hover:to-blue-500 text-gray-400 hover:text-white transition-all duration-200 border border-white/10 hover:border-transparent hover:scale-105 active:scale-95 ${showMenu ? 'from-purple-500 to-blue-500 text-white scale-105' : ''
              }`}
            aria-label="More options"
          >
            <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/50 sm:hidden"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-slideDown">
                <button
                  onClick={() => {
                    handleProfileClick();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-purple-500/20 hover:text-white transition-colors flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  View Profile
                </button>
                <button
                  onClick={handleAudioCall}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-purple-500/20 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  Audio Call
                </button>
                <button
                  onClick={handleVideoCall}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-purple-500/20 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  Video Call
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style >{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ChatHeader;