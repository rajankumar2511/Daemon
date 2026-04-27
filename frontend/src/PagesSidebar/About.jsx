import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, logout } from "../lib/api";
import { disconnectSocket } from "../Sockets/Socket";
import { ArrowLeft, Users, CalendarDays } from "lucide-react";

const About = () => {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔥 modal state
  const [showModal, setShowModal] = useState(false);
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getMe();
        setMe(userData);

        // prefill
        setBio(userData.bio || "");
        setLocation(userData.location || "");
      } catch (err) {
        console.error("[About]", err);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate]);

  const handleLogout = async () => {
    disconnectSocket();
    await logout();
    navigate("/login");
  };

  // 🔥 fake update (you will connect backend later)
  const handleSave = async () => {
    try {
      // TODO: replace with API
      setMe((prev) => ({
        ...prev,
        bio,
        location,
      }));

      setShowModal(false);
    } catch (err) {
      console.error("[EditProfile]", err);
    }
  };

  if (loading) return <p className="p-6 text-white">Loading...</p>;
  if (!me) return null;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white p-6">
      <div className="max-w-4xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Your Profile</h1>

          <button
            onClick={() => navigate("/home")}
            className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded hover:bg-white/10"
          >
            <ArrowLeft size={18} /> Back
          </button>
        </div>

        {/* PROFILE CARD */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">

          <div className="flex gap-6 items-center">
            <img
              src={me.profilePic || "https://via.placeholder.com/100"}
              className="w-24 h-24 rounded-full object-cover"
            />

            <div className="flex-1">
              <h2 className="text-2xl font-bold">{me.fullName}</h2>
              <p className="text-gray-400">{me.email}</p>

              <p className="mt-2 text-gray-300">
                {me.bio || "No bio added"}
              </p>

              <p className="text-sm text-gray-500 mt-1">
                📍 {me.location || "No location"}
              </p>
            </div>

            {/* EDIT BUTTON */}
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
            >
              Edit
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-4 mb-6">

          <div className="bg-white/5 p-4 rounded text-center">
            <div className="text-xl font-bold">
              {me.friendsCount || 0}
            </div>
            <p className="text-gray-400 text-sm">Friends</p>
          </div>

          <div className="bg-white/5 p-4 rounded text-center">
            <div className="text-xl font-bold">
              {me.isOnline ? "Online" : "Offline"}
            </div>
            <p className="text-gray-400 text-sm">Status</p>
          </div>

          <div className="bg-white/5 p-4 rounded text-center">
            <div className="text-xl font-bold">
              {me.createdAt
                ? new Date(me.createdAt).toDateString()
                : "-"}
            </div>
            <p className="text-gray-400 text-sm">Joined</p>
          </div>

        </div>

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 py-3 rounded font-semibold"
        >
          Logout
        </button>
      </div>

      {/* ================= MODAL ================= */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

          <div className="bg-[#111] p-6 rounded-xl w-full max-w-md">

            <h2 className="text-xl font-semibold mb-4">
              Edit Profile
            </h2>

            {/* BIO */}
            <div className="mb-4">
              <label className="text-sm text-gray-400">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full mt-1 p-2 bg-[#1a1a1a] rounded"
              />
            </div>

            {/* LOCATION */}
            <div className="mb-4">
              <label className="text-sm text-gray-400">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full mt-1 p-2 bg-[#1a1a1a] rounded"
              />
            </div>

            {/* ACTIONS */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1 bg-blue-600 py-2 rounded"
              >
                Save
              </button>

              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-600 py-2 rounded"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default About;