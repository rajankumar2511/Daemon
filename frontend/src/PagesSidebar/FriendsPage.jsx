import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Search, X } from "lucide-react";
import FriendsList from "./Friendslist";
import UserProfile from "./UserProfile";

const FriendsPage = () => {
  const [selected, setSelected] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close profile on mobile when selected
  const handleFriendSelect = (friend) => {
    setSelected(friend);
  };

  const handleCloseProfile = () => {
    setSelected(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0B0F] to-[#030305]">
      
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0B0B0F]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/home")}
              className="p-2 rounded-full hover:bg-white/10 transition-all duration-200"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                <Users size={16} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Friends</h1>
                <p className="text-xs text-gray-400">Connect with your network</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Main Content - Two Column Layout */}
        <div className={`flex gap-6 ${isMobile && selected ? 'flex-col' : 'flex-col lg:flex-row'}`}>
          
          {/* Friends List Column */}
          <div className={`
            ${isMobile && selected ? 'hidden' : 'w-full'}
            ${!isMobile && 'lg:w-1/2 xl:w-2/5'}
            transition-all duration-300
          `}>
            <FriendsList 
              onFriendSelect={handleFriendSelect} 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          </div>

          {/* User Profile Column - Shows when friend is selected */}
          {(selected || (!isMobile && !selected)) && (
            <div className={`
              ${isMobile ? 'fixed inset-0 z-30 bg-[#0B0B0F]' : 'lg:w-1/2 xl:w-3/5'}
              ${isMobile && !selected ? 'hidden' : 'block'}
              transition-all duration-300
            `}>
              {selected ? (
                <>
                  {/* Mobile Close Button */}
                  {isMobile && (
                    <button
                      onClick={handleCloseProfile}
                      className="absolute top-4 left-4 z-10 p-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 text-white hover:bg-white/20 transition-all duration-200"
                    >
                      <ArrowLeft size={20} />
                    </button>
                  )}
                  <UserProfile 
                    friend={selected} 
                    onClose={handleCloseProfile}
                    isMobile={isMobile}
                  />
                </>
              ) : (
                // Empty State - No friend selected on desktop
                <div className="hidden lg:flex h-full items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                      <Users size={32} className="text-gray-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">No friend selected</h3>
                    <p className="text-gray-400 text-sm">
                      Click on a friend to view their profile
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Overlay when profile is open */}
      {isMobile && selected && (
        <div 
          className="fixed inset-0 bg-black/50 z-20"
          onClick={handleCloseProfile}
        />
      )}
    </div>
  );
};

export default FriendsPage;