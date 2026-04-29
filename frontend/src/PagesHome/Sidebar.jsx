/* ===================== Sidebar.jsx ===================== */

import { useNavigate, useLocation } from "react-router-dom";
import { 
  MessageCircle, 
  Search, 
  Users, 
  Bell, 
  User, 
  LogOut,
} from "lucide-react";
import { logout } from "../lib/api";
import { disconnectSocket } from "../Sockets/Socket";

const Sidebar = ({ me, isMobile = false, onClose = null }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Top section icons (3 icons)
  const topNavItems = [
    { path: "/home", label: "Messages", icon: MessageCircle },
    { path: "/discover", label: "Discover", icon: Search },
    { path: "/friends", label: "Friends", icon: Users },
  ];

  // Bottom section icons (3 icons)
  const bottomNavItems = [
    { path: "/requests", label: "Requests", icon: Bell },
    { path: "/profile", label: "Profile", icon: User, isProfile: true },
    { path: "/logout", label: "Logout", icon: LogOut, isLogout: true },
  ];

  const handleNavigate = (path) => {
    try {
      if (path === "/logout") {
        handleLogout();
        return;
      }
      
      if (path === "/profile" && me?._id) {
        navigate(`/profile/${me._id}`);
      } else {
        navigate(path);
      }
      
      if (isMobile && onClose) {
        onClose();
      }
    } catch (err) {
      console.error("[Sidebar] Navigation error:", err);
    }
  };

  const handleLogout = async () => {
    try {
      disconnectSocket();
      await logout();
      navigate("/login");
      window.location.reload();
    } catch (err) {
      console.error("[Sidebar] Logout error:", err);
      disconnectSocket();
      navigate("/login");
    }
  };

  const isActive = (path) => {
    if (path === "/profile" && me?._id) {
      return location.pathname === `/profile/${me._id}`;
    }
    return location.pathname === path;
  };

  return (
    <div className="w-24 bg-gradient-to-b from-[#0B0B0F]/95 to-[#030305]/95 backdrop-blur-xl flex flex-col py-6 px-3 border-r border-white/5 shadow-2xl h-full">
      
      {/* TOP SECTION - Logo & 3 Navigation Icons */}
      <div className="flex flex-col items-center gap-4">
        
        {/* Animated Logo */}
        <div className="relative group mb-2">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl blur-lg opacity-0 group-hover:opacity-75 transition-opacity duration-500"></div>
          <button
            onClick={() => handleNavigate("/home")}
            className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-lg hover:scale-110 transition-transform duration-300 shadow-lg"
          >
            D
          </button>
        </div>

        {/* Top Navigation Items - Messages, Discover, Friends */}
        {topNavItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNavigate(item.path)}
            className={`
              w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 group relative
              ${isActive(item.path)
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-600/50"
                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 border border-white/5"
              }
            `}
            // REMOVED: title={item.label} - This was causing duplicate tooltip
          >
            <item.icon size={20} />
            
            {/* Custom Tooltip - Only one label now */}
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0B0B0F]/95 backdrop-blur-xl border border-white/10 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 shadow-xl">
              {item.label}
            </div>
          </button>
        ))}
      </div>

      {/* FLEXIBLE SPACER - Pushes bottom section down */}
      <div className="flex-1"></div>

      {/* BOTTOM SECTION - Requests, Profile, Logout */}
      <div className="flex flex-col items-center gap-3">
        
        {/* Bottom Navigation Items - Requests, Profile, Logout */}
        {bottomNavItems.map((item) => {
          const isLogout = item.isLogout;
          const isProfile = item.isProfile;
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={`
                w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 group relative
                ${isLogout 
                  ? "bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                  : isActive(item.path)
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-600/50"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 border border-white/5"
                }
              `}
              // REMOVED: title={item.label} - This was causing duplicate tooltip
            >
              {/* Profile Image */}
              {isProfile && me?.profilePic ? (
                <img
                  src={me.profilePic}
                  alt={me.fullName || "User"}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <item.icon size={20} />
              )}
              
              {/* Hover Glow for Profile */}
              {isProfile && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 to-blue-600/0 group-hover:from-purple-600/20 group-hover:to-blue-600/20 rounded-2xl transition-all duration-300"></div>
              )}
              
              {/* Custom Tooltip - Only one label now */}
              <div className={`absolute left-full ml-3 px-3 py-1.5 bg-[#0B0B0F]/95 backdrop-blur-xl border border-white/10 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 shadow-xl ${
                isLogout ? 'border-red-500/20' : ''
              }`}>
                {item.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Background Effects */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        div:first-child {
          animation: slideIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Sidebar;