import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserProfile, sendFriendRequest, cancelFriendRequest, updateProfile } from "../lib/api";
import { toast } from "react-toastify";
import { 
  ArrowLeft, 
  MessageCircle, 
  Phone, 
  UserPlus, 
  UserCheck, 
  UserX,
  Calendar,
  MapPin,
  Users,
  Camera,
  X,
  Check,
  Edit2,
  Save
} from "lucide-react";

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [relationship, setRelationship] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullBio, setShowFullBio] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    fullName: "",
    username: "",
    bio: "",
    location: "",
    profilePic: ""
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await getUserProfile(userId);
        setUser(data.user);
        setRelationship(data.relationship);
        
        // Initialize edit form with user data
        if (data.user && data.relationship === "self") {
          setEditForm({
            fullName: data.user.fullName || "",
            username: data.user.username || "",
            bio: data.user.bio || "",
            location: data.user.location || "",
            profilePic: data.user.profilePic || ""
          });
        }
      } catch (err) {
        console.error("[ProfilePage]", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const handleAddFriend = async () => {
    try {
      await sendFriendRequest(user._id);
      setRelationship("requested");
      toast.success("Friend request sent!");
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (msg === "Request already sent") {
        toast.info("Request already sent");
      } else {
        toast.error(msg || "Failed to send friend request");
      }
    }
  };

  const handleCancelRequest = async () => {
    try {
      await cancelFriendRequest(user._id);
      setRelationship("stranger");
      toast.success("Friend request cancelled");
    } catch (err) {
      toast.error("Failed to cancel request");
    }
  };

  const goToFriendsList = () => {
    navigate(`/discoverff/${user._id}`);
  };

  const handleMessage = () => {
    navigate(`/home?chat=${user._id}`);
  };

  const handleCall = () => {
    navigate(`/call/${user._id}`);
  };

  // Handle edit form input changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  // Handle profile update submission
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    
    try {
      const updatedData = await updateProfile(editForm);
      setUser(prev => ({ ...prev, ...updatedData.user }));
      toast.success("Profile updated successfully!");
      setShowEditModal(false);
    } catch (err) {
      console.error("[ProfilePage] Update error:", err);
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0B0B0F] to-[#030305]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0B0B0F] to-[#030305] text-white p-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <p className="text-gray-400 text-center mt-20">User not found</p>
      </div>
    );
  }

  const bioText = user.bio || "No bio yet";
  const shouldTruncate = bioText.length > 100 && !showFullBio;
  const displayBio = shouldTruncate ? bioText.substring(0, 100) + "..." : bioText;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0B0F] to-[#030305]">
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0B0B0F]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-white/10 transition-all duration-200"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <h1 className="text-lg font-semibold text-white">Profile</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Avatar */}
          <div className="relative mb-4">
            <div className="w-28 h-28 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 p-0.5">
              <div className="w-full h-full rounded-full bg-[#0B0B0F] p-0.5">
                <img
                  src={user.profilePic || "https://via.placeholder.com/112"}
                  alt={user.fullName}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>
            
            {/* Online Status Badge */}
            {user.isOnline && (
              <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0B0B0F]"></div>
            )}
          </div>

          {/* Name & Username */}
          <h1 className="text-2xl font-bold text-white mb-1">{user.fullName}</h1>
          {user.username && (
            <p className="text-gray-400 text-sm mb-3">@{user.username}</p>
          )}

          {/* Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${user.isOnline ? "bg-green-500 animate-pulse" : "bg-gray-500"}`}></div>
            <span className="text-xs text-gray-400">
              {user.isOnline
                ? "Online"
                : user.lastSeen
                ? `Last active ${new Date(user.lastSeen).toLocaleDateString()}`
                : "Offline"}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center p-4 rounded-2xl bg-white/5 border border-white/10">
            <Users size={20} className="text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{user.friendsCount || 0}</p>
            <p className="text-xs text-gray-500">Friends</p>
          </div>
          <div className="text-center p-4 rounded-2xl bg-white/5 border border-white/10">
            <Calendar size={20} className="text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">
              {user.createdAt ? new Date(user.createdAt).getFullYear() : "N/A"}
            </p>
            <p className="text-xs text-gray-500">Joined</p>
          </div>
          <div className="text-center p-4 rounded-2xl bg-white/5 border border-white/10">
            <MessageCircle size={20} className="text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">—</p>
            <p className="text-xs text-gray-500">Posts</p>
          </div>
        </div>

        {/* Bio Section */}
        {user.bio && (
          <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-sm text-gray-300 leading-relaxed">
              {displayBio}
            </p>
            {bioText.length > 100 && (
              <button
                onClick={() => setShowFullBio(!showFullBio)}
                className="text-purple-400 text-xs mt-2 hover:text-purple-300 transition"
              >
                {showFullBio ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {/* Location */}
        {user.location && (
          <div className="mb-8 flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <MapPin size={18} className="text-gray-400" />
            <span className="text-sm text-gray-300">{user.location}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mb-8">
          {relationship === "self" && (
            <button
              onClick={() => setShowEditModal(true)}
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
            >
              <Edit2 size={18} /> Edit Profile
            </button>
          )}

          {relationship === "friend" && (
            <>
              <button
                onClick={handleMessage}
                className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
              >
                <MessageCircle size={18} /> Message
              </button>
              <button
                onClick={handleCall}
                className="flex-1 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 border border-white/10"
              >
                <Phone size={18} /> Call
              </button>
            </>
          )}

          {relationship === "stranger" && (
            <button
              onClick={handleAddFriend}
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
            >
              <UserPlus size={18} /> Add Friend
            </button>
          )}

          {relationship === "requested" && (
            <button
              onClick={handleCancelRequest}
              className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <UserCheck size={18} /> Request Sent
            </button>
          )}

          {relationship === "pending" && (
            <div className="flex gap-3 w-full">
              <button
                className="flex-1 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Check size={18} /> Accept
              </button>
              <button
                className="flex-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              >
                <X size={18} /> Decline
              </button>
            </div>
          )}
        </div>

        {/* Friends List Link */}
        {user.friendsCount > 0 && (
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={goToFriendsList}
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                  <Users size={18} className="text-purple-400" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Friends</p>
                  <p className="text-xs text-gray-500">{user.friendsCount} friends</p>
                </div>
              </div>
              <ArrowLeft size={18} className="text-gray-500 rotate-180 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-slideUp">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">Edit Profile</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpdateProfile} className="p-4 space-y-4">
              {/* Profile Picture */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Profile Picture URL
                </label>
                <input
                  type="text"
                  name="profilePic"
                  value={editForm.profilePic}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all"
                  placeholder="Enter image URL"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={editForm.fullName}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={editForm.username}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all"
                  placeholder="Enter username"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  name="bio"
                  value={editForm.bio}
                  onChange={handleEditChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all resize-none"
                  placeholder="Tell something about yourself"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={editForm.location}
                  onChange={handleEditChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all"
                  placeholder="Your location"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      ` }} />
    </div>
  );
};

export default ProfilePage;