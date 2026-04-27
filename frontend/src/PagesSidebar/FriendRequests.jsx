import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
} from "../lib/api";
import { socket } from "../Sockets/Socket";
import { toast } from "react-toastify";
import { 
  ArrowLeft, 
  UserPlus, 
  UserX, 
  CheckCircle, 
  XCircle,
  Clock,
  Users,
  Sparkles,
  MessageCircle,
  User
} from "lucide-react";

const FriendRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const navigate = useNavigate();

  const loadRequests = async () => {
    try {
      const data = await getFriendRequests();
      setRequests(Array.isArray(data) ? data : (data.requests || []));
    } catch (err) {
      console.error("[FriendRequests] Load error:", err);
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();

    // Listen for new incoming friend requests in real-time
    const handleNewRequest = (req) => {
      console.log("[FriendRequests] New request received:", req);
      setRequests((prev) => [req, ...prev]);
      toast.info(`New friend request from ${req.from?.fullName || "Someone"}`);
    };

    socket.on("friend-request:new", handleNewRequest);

    return () => {
      socket.off("friend-request:new", handleNewRequest);
    };
  }, []);

  const handleAccept = async (id) => {
    setProcessingId(id);
    try {
      await acceptFriendRequest(id);
      toast.success("Friend request accepted!");
      setRequests((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      console.error("[FriendRequests] Accept error:", err);
      toast.error("Failed to accept request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    setProcessingId(id);
    try {
      await rejectFriendRequest(id);
      toast.success("Friend request rejected");
      setRequests((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      console.error("[FriendRequests] Reject error:", err);
      toast.error("Failed to reject request");
    } finally {
      setProcessingId(null);
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
          <p className="text-gray-400">Loading requests...</p>
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <UserPlus size={16} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Friend Requests</h1>
              <p className="text-xs text-gray-400">Manage pending requests</p>
            </div>
          </div>
          
          {/* Pending Count Badge */}
          <div className="ml-auto">
            <div className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-white/10">
              <span className="text-xs text-gray-400">Pending: </span>
              <span className="text-sm font-bold text-purple-400">{requests.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        
        {/* Empty State */}
        {requests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 mb-4 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <UserPlus size={32} className="text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No pending requests</h3>
            <p className="text-gray-400 text-sm text-center max-w-sm">
              When someone sends you a friend request, it will appear here
            </p>
            <button
              onClick={() => navigate("/discover")}
              className="mt-6 px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg"
            >
              <Users size={16} />
              Discover People
            </button>
          </div>
        )}

        {/* Requests List */}
        {requests.length > 0 && (
          <div className="space-y-3">
            {/* Header with stats */}
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} className="text-gray-500" />
              <span className="text-xs text-gray-500">
                {requests.length} pending request{requests.length !== 1 ? 's' : ''}
              </span>
            </div>

            {requests.map((req) => (
              <div
                key={req._id}
                className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-200 overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    
                    {/* User Info - Clickable */}
                    <div 
                      onClick={() => goToProfile(req.from?._id)}
                      className="flex items-center gap-4 cursor-pointer flex-1 min-w-0"
                    >
                      {/* Avatar */}
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 p-0.5">
                          <div className="w-full h-full rounded-full bg-[#0B0B0F] p-0.5">
                            <img
                              src={req.from?.profilePic || "https://via.placeholder.com/56"}
                              alt={req.from?.fullName}
                              className="w-full h-full rounded-full object-cover"
                            />
                          </div>
                        </div>
                        {req.from?.isOnline && (
                          <span className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0B0B0F]" />
                        )}
                      </div>

                      {/* User Details */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white group-hover:text-purple-400 transition-colors truncate">
                          {req.from?.fullName || "Unknown User"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          @{req.from?.username || "user"}
                        </p>
                        {req.from?.mutualFriendsCount > 0 && (
                          <p className="text-xs text-gray-600 mt-1">
                            {req.from.mutualFriendsCount} mutual friends
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 ml-auto sm:ml-0">
                      <button
                        onClick={() => handleAccept(req._id)}
                        disabled={processingId === req._id}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingId === req._id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle size={16} />
                        )}
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(req._id)}
                        disabled={processingId === req._id}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    </div>
                  </div>

                  {/* Request Date */}
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-gray-600">
                      Request sent {new Date(req.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Quick Action Banner */}
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-white/10">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-400" />
                  <p className="text-sm text-gray-300">
                    Connect with people who want to be your friend!
                  </p>
                </div>
                <button
                  onClick={() => navigate("/discover")}
                  className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-all duration-200"
                >
                  Discover More
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendRequests;