import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyFriends,
  getAllUsers,
  sendFriendRequest,
  getMe,
} from "../lib/api";
import { toast } from "react-toastify";
import { ArrowLeft, UserPlus, Users, Search, UserCheck, UserX, Sparkles, TrendingUp } from "lucide-react";

const Discover = () => {
  const [friends, setFriends] = useState([]);
  const [others, setOthers] = useState([]);
  const [requested, setRequested] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOthers, setFilteredOthers] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [meRes, friendsRes, usersRes] = await Promise.all([
          getMe(),
          getMyFriends(),
          getAllUsers(),
        ]);

        const myId = meRes._id;

        // Set friends
        setFriends(friendsRes);

        // Remove self + friends from all users
        const friendIds = new Set(friendsRes.map((f) => f._id));

        const filtered = usersRes.filter(
          (u) => u._id !== myId && !friendIds.has(u._id)
        );

        setOthers(filtered);
        setFilteredOthers(filtered);

      } catch (err) {
        console.error("[Discover]", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOthers(others);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = others.filter(
      (user) =>
        user.fullName?.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query)
    );
    setFilteredOthers(filtered);
  }, [searchQuery, others]);

  const handleAddFriend = async (userId) => {
    try {
      await sendFriendRequest(userId);
      setRequested((prev) => new Set(prev).add(userId));
      toast.success("Friend request sent!");
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      
      if (msg === "Request already sent") {
        setRequested((prev) => new Set(prev).add(userId));
        toast.info("Request already sent");
      } else if (msg === "Already friends") {
        toast.info("Already friends with this user");
      } else {
        toast.error(msg || "Failed to send friend request");
      }
    }
  };

  const goToProfile = (userId) => {
    navigate(`/profile/${userId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0B0B0F] to-[#030305]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Discovering users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0B0F] to-[#030305]">
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0B0B0F]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate("/home")}
            className="p-2 rounded-full hover:bg-white/10 transition-all duration-200"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-white">Discover</h1>
            <p className="text-xs text-gray-400">Find new friends</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or username..."
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all"
            />
          </div>
        </div>

        {/* Friends Section */}
        {friends.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <Users size={16} className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Your Friends</h2>
              <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-gray-400">
                {friends.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {friends.map((user) => (
                <div
                  key={user._id}
                  onClick={() => goToProfile(user._id)}
                  className="group cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 hover:border-emerald-500/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={user.profilePic || "https://via.placeholder.com/48"}
                        alt={user.fullName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-white/10 group-hover:border-emerald-500 transition-all"
                      />
                      {user.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0B0B0F]"></span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">
                        {user.fullName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        @{user.username || "user"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Discover Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <TrendingUp size={16} className="text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Discover People</h2>
            <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-gray-400">
              {filteredOthers.length}
            </span>
          </div>

          {filteredOthers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                <UserPlus size={24} className="text-gray-500" />
              </div>
              <p className="text-gray-400 font-medium">No users to discover</p>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery ? "Try a different search term" : "You're already connected with everyone!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredOthers.map((user) => (
                <div
                  key={user._id}
                  className="group rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 hover:border-purple-500/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    {/* Profile Click */}
                    <div
                      onClick={() => goToProfile(user._id)}
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    >
                      <div className="relative">
                        <img
                          src={user.profilePic || "https://via.placeholder.com/48"}
                          alt={user.fullName}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white/10 group-hover:border-purple-500 transition-all"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm truncate">
                          {user.fullName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          @{user.username || "user"}
                        </p>
                      </div>
                    </div>

                    {/* Add Button */}
                    {requested.has(user._id) ? (
                      <button
                        className="px-3 py-1.5 bg-gray-600/50 text-gray-300 text-xs font-medium rounded-lg cursor-not-allowed flex-shrink-0 flex items-center gap-1"
                        disabled
                      >
                        <UserCheck size={12} />
                        Requested
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddFriend(user._id);
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-medium rounded-lg transition-all duration-200 flex-shrink-0 flex items-center gap-1 shadow-lg hover:scale-105"
                      >
                        <UserPlus size={12} />
                        Add
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suggestions Banner */}
        {filteredOthers.length > 3 && (
          <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-purple-400" />
              <p className="text-xs text-gray-400">
                Connect with more people to grow your network!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Discover;