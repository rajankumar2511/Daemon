/* ===================== FriendsModal.jsx ===================== */

import { useEffect } from "react";
import { Search, User, X } from "lucide-react";

const FriendsModal = ({
  showFriends,
  setShowFriends,
  friends,
  filteredFriends,
  setFilteredFriends,
  searchFriendQuery,
  setSearchFriendQuery,
  onStartChat,
}) => {
  // Filter friends based on search query
  useEffect(() => {
    if (!showFriends) return; // Don't filter if modal is closed

    try {
      if (!searchFriendQuery.trim()) {
        setFilteredFriends(friends);
        return;
      }

      const q = searchFriendQuery.toLowerCase();

      const filtered = friends.filter((f) => {
        return (
          f?.fullName?.toLowerCase().includes(q) ||
          f?.email?.toLowerCase().includes(q)
        );
      });

      console.log("[FriendsModal] Filtered friends:", filtered.length);
      setFilteredFriends(filtered);

    } catch (err) {
      console.error("[FriendsModal] Filter error:", err);
    }
  }, [searchFriendQuery, friends, setFilteredFriends, showFriends]);

  // Reset search when modal opens
  useEffect(() => {
    if (showFriends) {
      console.log("[FriendsModal] Modal opened, resetting search");
      setSearchFriendQuery("");
      setFilteredFriends(friends);
    }
  }, [showFriends, setSearchFriendQuery, setFilteredFriends, friends]);

  if (!showFriends) return null;

  const handleClose = () => {
    console.log("[FriendsModal] Closing modal");
    setShowFriends(false);
    setSearchFriendQuery(""); // Reset search on close
  };

  const handleStartChat = (friendId) => {
    console.log("[FriendsModal] Starting chat with friend:", friendId);
    onStartChat(friendId);
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-full max-w-sm bg-[#0d0d0d] rounded-lg p-4 border border-gray-800">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white">New Chat</h3>

          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition p-1"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* SEARCH */}
        <div className="flex items-center bg-[#1a1a1a] px-3 py-2 rounded-md mb-4">
          <Search size={16} className="text-gray-400 mr-2" />
          <input
            value={searchFriendQuery}
            onChange={(e) => setSearchFriendQuery(e.target.value)}
            placeholder="Search friends by name or email..."
            className="bg-transparent outline-none text-sm w-full text-white placeholder-gray-400"
            autoFocus
          />
        </div>

        {/* FRIENDS LIST */}
        <div className="max-h-72 overflow-y-auto space-y-1">
          {filteredFriends.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">
                {friends.length === 0 
                  ? "No friends yet. Add some friends to start chatting!" 
                  : "No friends match your search"}
              </p>
            </div>
          ) : (
            filteredFriends.map((friend) => {
              if (!friend?._id) {
                console.warn("[FriendsModal] Invalid friend data:", friend);
                return null;
              }

              return (
                <div
                  key={friend._id}
                  onClick={() => handleStartChat(friend._id)}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-[#1a1a1a] cursor-pointer transition group"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {friend.profilePic ? (
                      <img
                        src={friend.profilePic}
                        alt={friend.fullName || "User"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error("[FriendsModal] Image failed to load:", friend.profilePic);
                          e.target.style.display = "none";
                          // Show fallback icon
                          const parent = e.target.parentElement;
                          if (parent) {
                            parent.innerHTML = '<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>';
                          }
                        }}
                      />
                    ) : (
                      <User size={18} className="text-gray-400" />
                    )}
                  </div>

                  {/* Friend Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {friend.fullName || "Unknown User"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {friend.email || "No email"}
                    </p>
                  </div>

                  {/* Start chat indicator on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with friend count */}
        <div className="mt-4 pt-3 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            {filteredFriends.length} friend{filteredFriends.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FriendsModal;