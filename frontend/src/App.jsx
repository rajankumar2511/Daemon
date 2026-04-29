import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useState, useEffect } from "react";

import Auth from "./PagesAuth/Auth.jsx";
import SignUp from "./PagesAuth/SignUpPage.jsx";
import Login from "./PagesAuth/LoginPage.jsx";
import Home from "./PagesHome/HomePage.jsx";
import About from "./PagesSidebar/About.jsx";
import FriendsPage from "./PagesSidebar/FriendsPage.jsx";
import Call from "./PagesCall/VideoCall.jsx";
import FriendRequests from "./PagesSidebar/FriendRequests.jsx";
import { connectSocket, socket } from "./Sockets/Socket";

import { getMe } from "./lib/api.js";
import Discover from "./PagesSidebar/Discover.jsx";
import ProfilePage from "./PagesSidebar/ProfilePage.jsx";
import Discoverff from "./PagesSidebar/Discoverff.jsx";
import { CallProvider } from "./context/CallContext";
import IncomingCallModal from "./components/IncomingCallModal";
import ActiveCallOverlay from "./components/ActiveCallOverlay";


// ==========================================
// 🔐 Protected Route (NO localStorage - Session Only)
// ==========================================

const ProtectedRoute = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: null,
    checked: false
  });

  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        await getMe();
        if (isMounted) {
          setAuthState({ isAuthenticated: true, checked: true });
          if (!socket.connected) {
            connectSocket();
          }
        }
      } catch (error) {
        if (isMounted) {
          setAuthState({ isAuthenticated: false, checked: true });
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  if (authState.isAuthenticated === null) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin animation-delay-150"></div>
          </div>
        </div>
        <p className="mt-4 text-gray-400 font-medium">Verifying session...</p>
      </div>
    );
  }

  return authState.isAuthenticated ? (
    children
  ) : (
    <Navigate to="/login" state={{ from: location.pathname }} replace />
  );
};

const PublicRoute = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: null,
    checked: false
  });

  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        await getMe();
        if (isMounted) {
          setAuthState({ isAuthenticated: true, checked: true });
        }
      } catch (error) {
        if (isMounted) {
          setAuthState({ isAuthenticated: false, checked: true });
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  if (authState.isAuthenticated === null) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin animation-delay-150"></div>
          </div>
        </div>
        <p className="mt-4 text-gray-400 font-medium">Checking existing session...</p>
      </div>
    );
  }

  return authState.isAuthenticated ? (
    <Navigate to="/home" replace />
  ) : (
    children
  );
};

// ==========================================
// 🚀 App Component
// ==========================================

function App() {
  useEffect(() => {
    const handleConnect = () => console.log("✅ Socket connected:", socket.id);
    const handleDisconnect = (reason) => console.log("❌ Socket disconnected:", reason);
    const handleConnectError = (error) => console.error("🔌 Socket connection error:", error.message);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    };
  }, []);

  return (
    <div className="App">
      <CallProvider>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
         <IncomingCallModal />
         <ActiveCallOverlay />

         <Routes>
          {/* Public routes */}
          <Route path="/" element={<PublicRoute><Navigate to="/auth" replace /></PublicRoute>} />
          <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          {/* Protected routes */}
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/chats" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/chat/:chatId" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
          <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
          <Route path="/call" element={<ProtectedRoute><Call /></ProtectedRoute>} />
          <Route path="/requests" element={<ProtectedRoute><FriendRequests /></ProtectedRoute>} />
          <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
          <Route path="/profile/:userId" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/discoverff/:userId" element={<ProtectedRoute><Discoverff /></ProtectedRoute>} />
          {/* 404 catch all */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </CallProvider>
    </div>
  );
}

export default App;