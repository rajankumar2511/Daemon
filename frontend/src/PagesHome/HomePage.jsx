/* ===================== HomePage.jsx ===================== */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Menu } from "lucide-react";

import Sidebar from "./Sidebar";
import ChatList from "./ChatList";
import Messages from "./Messages";
import FriendsModal from "./FriendsModal";

import { useChat } from "./useChat";

const HomePage = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFriendQuery, setSearchFriendQuery] = useState("");
  const [showChatListOnMobile, setShowChatListOnMobile] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // useChat now fetches user internally via getMe()
  const {
    loading: chatLoading,
    me,
    chats,
    filteredChats,
    setFilteredChats,
    selectedChat,
    setSelectedChat,
    messages,
    setMessages,
    newMessage,
    setNewMessage,
    typing,
    friends,
    filteredFriends,
    setFilteredFriends,
    showFriends,
    setShowFriends,
    getOtherUser,
    formatTime,
    sendMessage,
    deleteMessages,
    startChat,
    loadFriends,
    handleFileSend,
  } = useChat();

  // ✅ Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Close mobile sidebar when resizing to desktop
      if (!mobile) {
        setShowMobileSidebar(false);
      }

      // If switching from desktop to mobile and chat is selected, show messages
      if (mobile && selectedChat) {
        setShowChatListOnMobile(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [selectedChat]);

  // ✅ When a chat is selected on mobile, show messages
  useEffect(() => {
    if (isMobile && selectedChat) {
      setShowChatListOnMobile(false);
    }
  }, [selectedChat, isMobile]);

  // ✅ Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (showMobileSidebar) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showMobileSidebar]);

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    } catch (err) {
      console.error("[HomePage] formatDate error:", err);
      return "";
    }
  };

  /* ================= AUTH GUARD ================= */
  useEffect(() => {
    if (!chatLoading && !me) {
      console.warn("[HomePage] No user found, redirecting to login");
      toast.error("Please login to continue");
      navigate("/login");
    }
  }, [me, chatLoading, navigate]);

  /* ================= LOADING STATES ================= */
  if (chatLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#0B0B0F] to-[#030305]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-600/20 border-t-purple-600 rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#0B0B0F] to-[#030305]">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No user session found</p>
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:scale-105 transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  /* ================= ACTIONS ================= */
  const handleOpenFriends = async () => {
    try {
      console.log("[HomePage] Opening friends modal");
      await loadFriends();
      console.log("[HomePage] Friends loaded, count:", friends.length);
      setShowFriends(true);
    } catch (err) {
      console.error("[HomePage] loadFriends error:", err);
      toast.error("Failed to load friends list");
    }
  };

  const handleStartChat = async (friendId) => {
    try {
      console.log("[HomePage] Starting chat with friend:", friendId);
      await startChat(friendId);
      console.log("[HomePage] Chat started successfully");
      setShowFriends(false);
      setSearchFriendQuery("");
    } catch (err) {
      console.error("[HomePage] startChat error:", err);
      toast.error("Failed to start conversation");
    }
  };

  const handleSendMessage = async (tempIdFromUI = null) => {
    if (!newMessage.trim()) {
      console.log("[HomePage] Empty message, not sending");
      return;
    }

    try {
      console.log("[HomePage] Sending message");
      await sendMessage(tempIdFromUI);
       console.log("[HomePage] Message sent successfully");
    } catch (err) {
      console.error("[HomePage] sendMessage error:", err);
      toast.error("Failed to send message");
    }
  };

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
  };

  const handleBackToChats = () => {
    setShowChatListOnMobile(true);
  };

  const toggleMobileSidebar = () => {
    setShowMobileSidebar(!showMobileSidebar);
  };

  const closeMobileSidebar = () => {
    setShowMobileSidebar(false);
  };

  return (
    <div className="h-screen flex bg-gradient-to-b from-[#0B0B0F] to-[#030305] overflow-hidden relative">

      {/* Mobile Menu Button - Only visible on mobile */}
      {isMobile && !selectedChat && (
        <button
          onClick={toggleMobileSidebar}
          className="fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-md border border-white/10 text-white hover:scale-105 transition-all duration-200 shadow-lg"
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* SIDEBAR - Hidden on mobile by default, appears as drawer */}
      {/* Desktop: always visible, Mobile: drawer with high z-index */}
      <div className={`
        ${isMobile ? 'fixed inset-y-0 left-0 z-[100] transform transition-transform duration-300 ease-in-out' : 'relative z-10'}
        ${isMobile && !showMobileSidebar ? '-translate-x-full' : 'translate-x-0'}
      `}>
        <Sidebar
          me={me}
          isMobile={isMobile}
          onClose={closeMobileSidebar}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobile && showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] animate-fadeIn"
          onClick={closeMobileSidebar}
        />
      )}

      {/* CHAT LIST - Hidden on mobile when a chat is selected */}
      <div className={`
        transition-all duration-300 ease-in-out
        md:w-80 md:block md:relative md:z-0
        ${isMobile && !showChatListOnMobile ? 'hidden w-0' : 'w-80 block'}
        ${isMobile && showChatListOnMobile ? 'w-full' : ''}
        border-r border-white/5
        bg-[#0B0B0F]/50 backdrop-blur-sm
        relative z-0
      `}>
        {/* Add this to your ChatList component in HomePage */}
        <ChatList
          chats={chats}
          filteredChats={filteredChats}
          setFilteredChats={setFilteredChats}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedChat={selectedChat}
          setSelectedChat={handleChatSelect}
          formatTime={formatTime}
          getOtherUser={getOtherUser}
          onOpenFriends={handleOpenFriends}
          isMobile={isMobile}
          onMenuClick={toggleMobileSidebar}  // ✅ Add this line
        />
      </div>

      {/* MESSAGES - Full width on mobile, flex on desktop */}
      <div className={`
        flex-1 flex flex-col
        transition-all duration-300 ease-in-out
        ${isMobile && showChatListOnMobile ? 'hidden w-0' : 'block w-full'}
        relative z-0
      `}>
        <Messages
          me={me}
          selectedChat={selectedChat}
          messages={messages}
          newMessage={newMessage}
          typing={typing}
          setMessages={setMessages}
          setNewMessage={setNewMessage}
          sendMessage={handleSendMessage}
          deleteMessages={deleteMessages}
          getOtherUser={getOtherUser}
          formatTime={formatTime}
          formatDate={formatDate}
          onOpenFriends={handleOpenFriends}
          handleFileSend={handleFileSend}
          isMobile={isMobile}
          onBack={isMobile && !showChatListOnMobile ? handleBackToChats : null}
        />
      </div>

      {/* FRIENDS MODAL */}
      <FriendsModal
        showFriends={showFriends}
        setShowFriends={setShowFriends}
        friends={friends}
        filteredFriends={filteredFriends}
        setFilteredFriends={setFilteredFriends}
        searchFriendQuery={searchFriendQuery}
        setSearchFriendQuery={setSearchFriendQuery}
        onStartChat={handleStartChat}
        isMobile={isMobile}
      />

      <style >{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default HomePage;