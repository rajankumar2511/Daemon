import { useEffect, useState } from "react";
import { getMyFriends } from "../lib/api";
import { Search, User, Users, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

const FriendsList = ({ onFriendSelect, searchQuery, setSearchQuery }) => {
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFriends = async () => {
      try {
        setLoading(true);
        const data = await getMyFriends();
        setFriends(data);
        setFilteredFriends(data);
      } catch (err) {
        console.error("[FriendsList] Error:", err);
        toast.error("Failed to load friends");
      } finally {
        setLoading(false);
      }
    };
    loadFriends();
  }, []);

  // Filter friends based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = friends.filter(
      (friend) =>
        friend.fullName?.toLowerCase().includes(query) ||
        friend.username?.toLowerCase().includes(query) ||
        friend.email?.toLowerCase().includes(query)
    );
    setFilteredFriends(filtered);
  }, [searchQuery, friends]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 size={32} className="text-purple-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading your friends...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
      
      {/* Search Header */}
      <div className="p-4 border-b border-white/10">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search friends..."
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 text-sm transition-all"
          />
        </div>
      </div>

      {/* Friends Count */}
      <div className="px-4 py-2 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-purple-400" />
          <span className="text-xs text-gray-400">
            {filteredFriends.length} {filteredFriends.length === 1 ? 'friend' : 'friends'}
          </span>
        </div>
      </div>

      {/* Friends List */}
      <div className="divide-y divide-white/10 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
        {filteredFriends.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
              <Users size={24} className="text-gray-600" />
            </div>
            <p className="text-gray-400 text-sm">
              {searchQuery ? "No friends match your search" : "No friends yet"}
            </p>
            {!searchQuery && (
              <p className="text-xs text-gray-500 mt-1">
                Start adding friends to see them here
              </p>
            )}
          </div>
        ) : (
          filteredFriends.map((friend) => (
            <div
              key={friend._id}
              onClick={() => onFriendSelect(friend)}
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/10 transition-all duration-200 group"
            >
              {/* Avatar */}
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center overflow-hidden">
                  {friend.profilePic ? (
                    <img
                      src={friend.profilePic}
                      alt={friend.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={20} className="text-gray-400" />
                  )}
                </div>
                {friend.isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0B0B0F]" />
                )}
              </div>

              {/* Friend Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate group-hover:text-purple-400 transition-colors">
                  {friend.fullName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  @{friend.username || "user"}
                </p>
              </div>

              {/* Online Status Text */}
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  {friend.isOnline ? (
                    <span className="text-green-500">Online</span>
                  ) : friend.lastSeen ? (
                    <span className="text-gray-500">Offline</span>
                  ) : (
                    <span className="text-gray-500">Offline</span>
                  )}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <style >{`
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
      `}</style>
    </div>
  );
};

export default FriendsList;