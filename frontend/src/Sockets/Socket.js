/* ===================== Socket.js ===================== */

import { io } from "socket.io-client";
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:9000";

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false,
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

console.log("[Socket] Socket.io client initialized");

/* ================= CONNECTION ================= */

let lastConnectTime = 0;
let isConnecting = false;
let isManuallyDisconnected = false;
let heartbeatInterval = null; // ✅ ADDED
let isSocketConnected = false; // ✅ Track connection state locally

export const connectSocket = () => {
  const now = Date.now();

  if (isConnecting) {
    console.warn("[Socket] Already connecting");
    return;
  }
  if (now - lastConnectTime < 3000) {
    console.warn("[Socket] Rate limited - too soon");
    return;
  }
  if (socket.connected || isSocketConnected) {
    console.log("[Socket] Already connected");
    return;
  }

  console.log("[Socket] Attempting to connect...");
  isConnecting = true;
  lastConnectTime = now;

  socket.connect();

  // Timeout to reset connecting flag
  setTimeout(() => {
    isConnecting = false;
  }, 5000);
};

// ✅ Start heartbeat to keep connection alive
const startHeartbeat = () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(() => {
    if (isSocketConnected && socket.connected) {
      socket.emit("heartbeat");
      console.log("[Socket] Heartbeat sent");
    }
  }, 10000); // Send heartbeat every 10 seconds
};

const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

// ✅ Track connection state - CONSOLIDATED HANDLER
socket.on("connect", () => {
  isSocketConnected = true;
  isConnecting = false;
  isManuallyDisconnected = false;
  socket.io.opts.reconnection = true;

  console.log("[Socket] Connected - starting heartbeat");
  console.log("[Socket] Socket ID:", socket.id);

  // Request online users list
  socket.emit("get-online-users");

  // Start heartbeat
  startHeartbeat();

  // Start online users refresh
  startOnlineUsersRefresh();
});

socket.on("disconnect", () => {
  isSocketConnected = false;
  isConnecting = false;

  console.log("[Socket] Disconnected - stopping heartbeat");

  // Stop heartbeat
  stopHeartbeat();

  // Stop online users refresh
  stopOnlineUsersRefresh();
});

socket.on("connect_error", (error) => {
  isConnecting = false;
  console.error("[Socket] Connection error:", error.message);
});

export const disconnectSocket = () => {
  isManuallyDisconnected = true;

  if (socket.connected) {
    socket.disconnect();
  }
};

/* ================= PRESENCE ================= */

export const requestOnlineUsers = () => {
  if (!socket.connected) return;
  socket.emit("get-online-users");
};

// ✅ OPTIONAL: Auto refresh online users every minute
let onlineUsersRefreshInterval = null;

const startOnlineUsersRefresh = () => {
  if (onlineUsersRefreshInterval) clearInterval(onlineUsersRefreshInterval);

  onlineUsersRefreshInterval = setInterval(() => {
    if (socket.connected) requestOnlineUsers();
  }, 60000);
};

const stopOnlineUsersRefresh = () => {
  if (onlineUsersRefreshInterval) {
    clearInterval(onlineUsersRefreshInterval);
    onlineUsersRefreshInterval = null;
  }
};

/* ================= MESSAGE EVENTS ================= */

export const emitMessageDelivered = ({ messageId, senderId }) => {
  socket.emit("message-delivered", { messageId, senderId });
};

export const markChatSeen = ({ chatId }) => {
  socket.emit("mark-seen", { chatId });
};

/* ================= CHAT ROOM JOIN/LEAVE ================= */

export const joinChatRoom = ({ chatId }) => {
  if (!chatId) {
    console.error("[Socket] Cannot join - no chatId");
    return;
  }

  // IMMEDIATE: Attempt join if socket already connected
  if (socket.connected) {
    console.log("[Socket] ✅ Socket connected, joining chat immediately", { chatId });
    socket.emit("join-chat", { chatId });
    return;
  }

  // FALLBACK: Retry logic - wait for socket to connect if needed
  const attemptJoin = (retries = 0) => {
    if (socket.connected) {
      console.log("[Socket] ✅ Socket now connected, joining chat", { chatId });
      socket.emit("join-chat", { chatId });
      return;
    }

    if (retries < 20) {
      console.warn("[Socket] Not connected yet, retrying join in 500ms", { chatId, retries });
      setTimeout(() => attemptJoin(retries + 1), 500);
    } else {
      console.error("[Socket] Failed to join after 10 seconds - socket not connected", { chatId });
    }
  };

  attemptJoin();
};

export const leaveChatRoom = ({ chatId }) => {
  if (!chatId) {
    console.error("[Socket] Cannot leave - no chatId");
    return;
  }

  if (!socket.connected) {
    console.warn("[Socket] Cannot leave - socket not connected");
    return;
  }

  console.log("[Socket] Emitting leave-chat event", { chatId });
  socket.emit("leave-chat", { chatId });
};

/* ================= TYPING ================= */

export const emitTyping = ({ to, chatId }) => {
  socket.emit("typing", { to, chatId });
};

export const emitStopTyping = ({ to, chatId }) => {
  socket.emit("stop-typing", { to, chatId });
};

/* ================= LISTENERS ================= */
// ✅ IMPROVED: Return cleanup function for better useEffect integration
export const onMessageSent = (cb) => {
  socket.on("message-sent", cb);
  return () => socket.off("message-sent", cb);
};

export const onNewMessage = (cb) => {
  socket.on("new-message", cb);
  return () => socket.off("new-message", cb);
};

export const onMessageStatusUpdate = (cb) => {
  socket.on("message-status-update", cb);
  return () => socket.off("message-status-update", cb);
};

export const onMessagesSeen = (cb) => {
  socket.on("messages-seen", cb);
  return () => socket.off("messages-seen", cb);
};

export const onUserOnline = (cb) => {
  socket.on("user-online", cb);
  return () => socket.off("user-online", cb);
};

export const onUserOffline = (cb) => {
  socket.on("user-offline", cb);
  return () => socket.off("user-offline", cb);
};

export const onTyping = (cb) => {
  socket.on("user-typing", cb);
  return () => socket.off("user-typing", cb);
};

export const onStopTyping = (cb) => {
  socket.on("user-stop-typing", cb);
  return () => socket.off("user-stop-typing", cb);
};

/* ================= CALL EVENTS ================= */

export const callUser = ({ to, offer, callType }) => {
  if (!socket.connected) return;
  if (!to || !offer) return;

  socket.emit("call:request", { to, offer, callType });
};
export const answerCall = ({ to, answer }) => {
  if (!socket.connected) return;
  socket.emit("call:answer", { to, answer });
};

export const sendIceCandidate = ({ to, candidate }) => {
  if (!socket.connected) return;
  socket.emit("call:ice", { to, candidate });
};

export const endCall = ({ to }) => {
  if (!socket.connected) return;
  socket.emit("call:end", { to });
};

/* ================= CALL LISTEN ================= */

export const onIncomingCall = (cb) => {
  socket.on("call:incoming", cb);
  return () => socket.off("call:incoming", cb);
};

export const onCallAnswered = (cb) => {
  socket.on("call:answered", cb);
  return () => socket.off("call:answered", cb);
};

export const onCallIce = (cb) => {
  socket.on("call:ice", cb);
  return () => socket.off("call:ice", cb);
};

export const onCallEnded = (cb) => {
  socket.on("call:ended", cb);
  return () => socket.off("call:ended", cb);
};

export const onSocketError = (cb) => {
  socket.on("error", cb);
  return () => socket.off("error", cb);
};

/* ================= CLEANUP ================= */

export const offEvent = (event, cb) => {
  socket.off(event, cb);
};

/* ================= SOCKET CORE EVENTS ================= */
/* ✅ ALL CORE EVENT HANDLERS ARE NOW CONSOLIDATED ABOVE */
/* No duplicates - each event has only ONE handler */

socket.io.on("reconnect_attempt", () => {
  if (isManuallyDisconnected) {
    socket.io.opts.reconnection = false;
  }
});

/* ================= LIFECYCLE ================= */

window.addEventListener("beforeunload", () => {
  disconnectSocket();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (!socket.connected && !isManuallyDisconnected) {
      connectSocket();
    }
  }
});

window.addEventListener("online", () => {
  if (!socket.connected && !isManuallyDisconnected) {
    connectSocket();
  }
});

/* ================= FAILSAFE ================= */
// ✅ IMPROVED: Less aggressive + better conditions

setInterval(() => {
  if (!socket.connected && !isManuallyDisconnected && !isConnecting) {
    connectSocket();
  }
}, 30000); // ✅ Increased to 30s

export default socket;