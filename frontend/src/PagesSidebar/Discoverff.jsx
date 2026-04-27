import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getUserFriends,
  getMyFriends,
  getUserProfile,
  getMe,
} from "../lib/api";

const Discoverff = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [mutual, setMutual] = useState([]);
  const [others, setOthers] = useState([]);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const [targetRes, myRes, profile, me] = await Promise.all([
          getUserFriends(userId),
          getMyFriends(),
          getUserProfile(userId),
          getMe(),
        ]);

        // ✅ normalize data
        const targetFriends = Array.isArray(targetRes)
          ? targetRes
          : targetRes?.friends || [];

        const myFriends = Array.isArray(myRes)
          ? myRes
          : myRes?.friends || [];

        setUserName(profile?.user?.fullName || "User");

        const myId = me._id;

        // 🔥 FIX: convert to string
        const myIds = new Set(
          myFriends.map((f) => f._id.toString())
        );

        // 🔥 mutual
        const mutualFriends = targetFriends.filter(
          (f) =>
            myIds.has(f._id.toString()) &&
            f._id.toString() !== myId
        );

        // 🔥 others
        const otherFriends = targetFriends.filter(
          (f) =>
            !myIds.has(f._id.toString()) &&
            f._id.toString() !== myId
        );

        setMutual(mutualFriends);
        setOthers(otherFriends);

      } catch (err) {
        console.error("[Discoverff]", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  const goToProfile = (id) => {
    navigate(`/profile/${id}`);
  };

  if (loading) return <p className="p-6 text-white">Loading...</p>;

  return (
    <div className="p-6 text-white">

      {/* ================= MUTUAL FRIENDS ================= */}
      <h2 className="text-xl font-semibold mb-4">
        Mutual Friends
      </h2>

      {mutual.length === 0 && (
        <p className="text-gray-400 mb-6">No mutual friends</p>
      )}

      <div className="space-y-3 mb-8">
        {mutual.map((user) => (
          <div
            key={user._id}
            onClick={() => goToProfile(user._id)}
            className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-lg"
          >
            <img
              src={user.profilePic}
              className="w-10 h-10 rounded-full"
              alt=""
            />
            <span>{user.fullName}</span>
          </div>
        ))}
      </div>

      {/* ================= USER FRIENDS ================= */}
      <h2 className="text-xl font-semibold mb-4">
        {userName}'s Friends
      </h2>

      {others.length === 0 && (
        <p className="text-gray-400">No other friends</p>
      )}

      <div className="space-y-3">
        {others.map((user) => (
          <div
            key={user._id}
            onClick={() => goToProfile(user._id)}
            className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-lg"
          >
            <img
              src={user.profilePic}
              className="w-10 h-10 rounded-full"
              alt=""
            />
            <span>{user.fullName}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Discoverff;