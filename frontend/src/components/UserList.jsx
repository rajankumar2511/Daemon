import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";

const UserList = ({
  users,
  loading,
  onAction,
  actionLabel,
  showEmail = false,
}) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() =>
    users.filter((u) =>
      u.fullName?.toLowerCase().includes(search.toLowerCase())
    ), [users, search]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-400">
        <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#0d0d0d] rounded-lg border border-gray-800">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
          <input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* User List */}
      <div className="max-h-96 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">No users found</p>
          </div>
        )}

        {filtered.map((user) => (
          <div
            key={user._id}
            className="flex items-center justify-between p-4 border-b border-gray-800/50 hover:bg-white/5 transition last:border-b-0"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <img
                src={user.profilePic || "https://via.placeholder.com/40"}
                alt={user.fullName}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {user.fullName}
                </p>
                {showEmail && (
                  <p className="text-xs text-gray-400 truncate">
                    {user.email}
                  </p>
                )}
              </div>
            </div>

            {onAction && (
              <button
                onClick={() => onAction(user._id)}
                className="ml-3 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition flex-shrink-0"
              >
                {actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList;