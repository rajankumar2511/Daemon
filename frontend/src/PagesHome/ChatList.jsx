import { useEffect, useState } from "react";
import { Search, User, Users, Plus, Menu } from "lucide-react";
import { socket, connectSocket } from "../Sockets/Socket";

const ChatList = ({
  chats,
  filteredChats,
  setFilteredChats,
  searchQuery,
  setSearchQuery,
  selectedChat,
  setSelectedChat,
  formatTime,
  getOtherUser,
  onOpenFriends,
  isMobile = false,
  onMobileSelect = () => {},
  onMenuClick = null,
}) => {
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    const handleUserOnline = ({ userId }) => {
      const id = String(userId);

      setOnlineUsers(prev => {
        if (prev.has(id)) return prev;
        const updated = new Set(prev);
        updated.add(id);
        return updated;
      });
    };

    const handleUserOffline = ({ userId }) => {
      const id = String(userId);

      setOnlineUsers(prev => {
        if (!prev.has(id)) return prev;
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
    };

    const handleInitialOnline = ({ users }) => {
      const normalized = users.map(id => String(id));
      setOnlineUsers(new Set(normalized));
    };

    // Remove existing listeners to prevent duplicates
    socket.off("user-online", handleUserOnline);
    socket.off("user-offline", handleUserOffline);
    socket.off("online-users", handleInitialOnline);

    // Attach listeners
    socket.on("user-online", handleUserOnline);
    socket.on("user-offline", handleUserOffline);
    socket.on("online-users", handleInitialOnline);

    // Ensure connection
    if (!socket.connected) {
      connectSocket();
    } else {
      socket.emit("get-online-users");
    }

    // Also fetch after reconnect
    const handleConnect = () => {
      socket.emit("get-online-users");
    };

    socket.on("connect", handleConnect);

    return () => {
      socket.off("user-online", handleUserOnline);
      socket.off("user-offline", handleUserOffline);
      socket.off("online-users", handleInitialOnline);
      socket.off("connect", handleConnect);
    };
  }, []);

  useEffect(() => {
    try {
      if (!searchQuery.trim()) {
        setFilteredChats(chats);
        return;
      }

      const q = searchQuery.toLowerCase();

      const filtered = chats.filter((chat) => {
        const user = getOtherUser(chat);
        return (
          user?.fullName?.toLowerCase().includes(q) ||
          chat.lastMessage?.content?.toLowerCase().includes(q)
        );
      });

      setFilteredChats(filtered);

    } catch (err) {
      console.error("[ChatList] Filter error:", err);
    }
  }, [searchQuery, chats, getOtherUser, setFilteredChats]);

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    if (isMobile && onMobileSelect) {
      onMobileSelect();
    }
  };

  return (
    <div className={`flex flex-col bg-[#0B0B0F] border-r border-white/10 ${isMobile ? 'w-full' : 'w-80'}`}>
      {/* Header */}
      <div className="p-4 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-2">
          {/* Menu Button - Mobile only */}
          {isMobile && onMenuClick && (
            <button
              onClick={onMenuClick}
              className="p-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500 hover:to-blue-500 text-gray-400 hover:text-white transition-all duration-200 border border-white/10 hover:border-transparent mr-2"
              aria-label="Menu"
            >
              <Menu size={18} />
            </button>
          )}
          
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 flex items-center justify-center">
            <Users size={16} className="text-purple-400" />
          </div>
          <h1 className="font-semibold text-white text-lg">Chats</h1>
        </div>

        <button
          onClick={onOpenFriends}
          className="p-2 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500 hover:to-blue-500 text-gray-400 hover:text-white transition-all duration-200 border border-white/10 hover:border-transparent"
          aria-label="Add new chat"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 pb-3">
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-purple-500 transition-all duration-200">
          <Search size={16} className="text-gray-400 mr-2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="bg-transparent outline-none text-sm w-full text-white placeholder-gray-400"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-gray-500 mt-20 px-8">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Users size={24} className="text-gray-600" />
            </div>
            <p className="text-sm font-medium">No conversations yet</p>
            <p className="text-xs mt-1">Click the + button to start a new chat</p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const user = getOtherUser(chat);

            if (!user) return null;

            const isActive = selectedChat?._id === chat._id;
            const isOnline = onlineUsers.has(String(user._id));

            return (
              <div
                key={chat._id}
                onClick={() => handleChatSelect(chat)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 ${
                  isActive 
                    ? "bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-l-2 border-purple-500" 
                    : "hover:bg-white/5"
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center overflow-hidden">
                    {user.profilePic ? (
                      <img
                        src={user.profilePic}
                        alt={user.fullName || "User"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={20} className="text-gray-400" />
                    )}
                  </div>

                  {/* Online Status Dot */}
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0B0B0F] animate-pulse" />
                  )}
                </div>

                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {user.fullName || "Unknown User"}
                    </p>

                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {formatTime(
                        chat.lastMessage?.createdAt || chat.updatedAt
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-400 truncate flex-1">
                      {chat.lastMessage?.content 
                        ? chat.lastMessage.content.length > 30 
                          ? chat.lastMessage.content.substring(0, 30) + "..." 
                          : chat.lastMessage.content
                        : "No messages yet"}
                    </p>

                    {/* Unread Badge */}
                    {chat.unreadCount > 0 && (
                      <div className="w-5 h-5 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                        {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Custom Scrollbar Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.8);
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      ` }} />
    </div>
  );
};

export default ChatList;