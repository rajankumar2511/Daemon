import { useEffect, useState, useCallback, useRef } from "react";
import apiClient from "../lib/apiClient";
import { getMe } from "../lib/api";
import {
  socket,
  markChatSeen,
  connectSocket,
  joinChatRoom,
  leaveChatRoom,
} from "../Sockets/Socket";

export const useChat = () => {
  /* ───────── CURRENT USER ───────── */
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getMe();
        if (user && user._id) setMe(user);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCurrentUser();
  }, []);

  /* ───────── SOCKET CONNECT ───────── */
  useEffect(() => {
    if (me && !socket.connected) {
      console.log("[useChat] Socket not connected, connecting now");
      connectSocket();
    }
  }, [me]);

  // ✅ Track socket connection state for proper dependency
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const handleConnect = () => {
      console.log("[useChat] Socket connection state changed to connected");
      setSocketConnected(true);
    };

    const handleDisconnect = () => {
      console.log("[useChat] Socket connection state changed to disconnected");
      setSocketConnected(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // Set initial state
    if (socket.connected) setSocketConnected(true);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  // ✅ Removed duplicate connection handler - now using socketConnected state variable

  /* ───────── CHATS ───────── */
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const selectedChatRef = useRef(null);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat || !me || !socketConnected) {
      console.log("[useChat] Not ready to join chat:", {
        hasChat: !!selectedChat,
        hasMe: !!me,
        socketConnected
      });
      return;
    }

    console.log("[useChat] Joining chat room:", selectedChat._id);
    joinChatRoom({ chatId: selectedChat._id });

    return () => {
      if (selectedChat?._id) {
        console.log("[useChat] Leaving chat room:", selectedChat._id);
        leaveChatRoom({ chatId: selectedChat._id });
      }
    };
  }, [selectedChat, me, socketConnected]);

  /* ───────── MESSAGES ───────── */
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  // ✅ Track processed message IDs to prevent duplicates from multiple socket events
  const processedMessagesRef = useRef(new Set());

  // ✅ Debounce mark-seen to batch rapid incoming messages
  const markSeenTimeoutRef = useRef(null);
  const lastMarkedSeenRef = useRef(0);
  const MARK_SEEN_BATCH_DELAY = 500; // Wait 500ms after last message before marking seen

  const triggerMarkSeenDebounced = useCallback((chatId) => {
    // Clear existing timeout
    if (markSeenTimeoutRef.current) {
      clearTimeout(markSeenTimeoutRef.current);
    }

    // Set new timeout to batch mark-seen calls
    markSeenTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      // Only mark seen if enough time has passed since last mark-seen (prevent spam)
      if (now - lastMarkedSeenRef.current > 1000) {
        console.log("[useChat] Batched mark-seen triggered for chat:", chatId);
        lastMarkedSeenRef.current = now;
        markChatSeen({ chatId });
      }
    }, MARK_SEEN_BATCH_DELAY);
  }, []);

  /* ───────── FRIENDS ───────── */
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [showFriends, setShowFriends] = useState(false);

  /* ───────── TYPING ───────── */
  const [typing, setTyping] = useState(null);

  /* ───────── LOAD CHATS ───────── */
  useEffect(() => {
    if (!me) return;

    const loadChats = async () => {
      try {
        const res = await apiClient.get("/chats");
        setChats(res.data);
        setFilteredChats(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    loadChats();
  }, [me]);

  /* ───────── LOAD MESSAGES ───────── */
  const loadMessages = useCallback(async () => {
    if (!selectedChat || !me) return;

    setMessagesLoading(true);
    try {
      const res = await apiClient.get(`/chats/${selectedChat._id}/messages`);
      const newMessages = res.data.messages || [];

      // ✅ Add all loaded messages to processed cache to prevent duplicates
      newMessages.forEach(msg => {
        if (msg._id) {
          processedMessagesRef.current.add(msg._id.toString());
        }
      });

      setMessages(
        newMessages.sort((a, b) => {
          const aTime = a.serverTimestamp || new Date(a.createdAt).getTime();
          const bTime = b.serverTimestamp || new Date(b.createdAt).getTime();
          return aTime - bTime;
        })
      );
    } catch (err) {
      console.error(err);
    } finally {
      setMessagesLoading(false);
    }
  }, [selectedChat, me]);

  /* ───────── SOCKET RECONNECT HANDLER ───────── */
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      console.log("[useChat] Socket reconnected - reloading messages and rejoining chat");
      if (selectedChatRef.current && me) {
        // Important: Rejoin chat room after reconnect
        console.log("[useChat] Rejoining chat room after reconnect:", selectedChatRef.current._id);
        joinChatRoom({ chatId: selectedChatRef.current._id });
        // Reload messages
        loadMessages();
      }
    };

    const handleServerReady = () => {
      console.log("[useChat] Server became ready - reloading messages");
      if (selectedChatRef.current && me) {
        loadMessages();
      }
    };

    socket.on("connect", handleReconnect);
    socket.on("server-ready", handleServerReady);

    return () => {
      socket.off("connect", handleReconnect);
      socket.off("server-ready", handleServerReady);
    };
  }, [loadMessages, me]);

  useEffect(() => {
    const handleBlur = () => {
      console.log("[useChat] Window blurred (user opened file / switched tab)");

      // ❗ DO NOT disconnect
      // Just log — prevents false offline logic
    };

    const handleFocus = () => {
      console.log("[useChat] Window focused");

      // 🔥 FORCE reconnect + room join
      if (!socket.connected) {
        console.log("[useChat] Reconnecting socket after blur...");
        connectSocket();
      }

      if (selectedChatRef.current) {
        joinChatRoom({ chatId: selectedChatRef.current._id });
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);
  // ✅ CRITICAL FIX: Ensure room is joined whenever selectedChat changes
  useEffect(() => {
    if (!selectedChat || !me || loading) return;

    // ✅ Clear processed messages cache when switching chats
    processedMessagesRef.current.clear();
    console.log("[useChat] Cleared message processing cache for new chat");

    loadMessages();

    // ✅ FIXED: Use debounced mark-seen for initial load too
    triggerMarkSeenDebounced(selectedChat._id);

    // ✅ NEW: Force rejoin room to handle reconnections
    console.log("[useChat] Ensuring chat room is joined for:", selectedChat._id);
    joinChatRoom({ chatId: selectedChat._id });

  }, [selectedChat, me, loading, loadMessages, triggerMarkSeenDebounced]);

  /* ───────── MESSAGE COUNTER FOR UNIQUE IDS ───────── */
  const lastTimeRef = { current: 0 };
  const counterRef = { current: 0 };

  const generateTempId = () => {
    const now = performance.now(); // high precision (microseconds-ish)

    if (now === lastTimeRef.current) {
      counterRef.current++;
    } else {
      counterRef.current = 0;
      lastTimeRef.current = now;
    }

    return `temp-${Math.floor(now * 1000)}-${counterRef.current}`;
  };

  /* ───────── HELPERS ───────── */
  const getOtherUser = useCallback(
    (chat) => chat?.participants?.find(p => p._id !== me?._id),
    [me]
  );

  const formatTime = useCallback((dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  /* ───────── THROTTLE SEND MESSAGE ───────── */
  // ✅ Prevent rapid message sends that overwhelm the backend
  const lastSendTimeRef = useRef(0);
  const MIN_SEND_INTERVAL = 100; // ✅ Minimum 100ms between sends (max 10 msg/sec)

  /* ───────── SEND MESSAGE ───────── */
  const sendMessage = useCallback(async (tempIdFromUI = null) => {
    if (!newMessage.trim() || !selectedChat || !me) return;

    const now = Date.now();
    if (now - lastSendTimeRef.current < 100) return;
    lastSendTimeRef.current = now;

    const content = newMessage.trim();
    const tempId = tempIdFromUI || generateTempId();

    const tempMessage = {
      _id: tempId,
      tempId,
      content,
      sender: {
        _id: me._id,
        fullName: me.fullName,
        profilePic: me.profilePic,
      },
      chatId: selectedChat._id,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    // ✅ FIX: ADD THIS LINE
    setMessages(prev => [...prev, tempMessage]);

    setNewMessage("");

    try {
      await apiClient.post(`/chats/${selectedChat._id}/messages`, {
        text: content,
        tempId,
      });
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.tempId === tempId ? { ...m, status: "failed" } : m
        )
      );
    }
  }, [newMessage, selectedChat, me]);

  /* ───────── DELETE MESSAGES ───────── */
  const deleteMessages = useCallback(async (messageIds) => {
    if (!selectedChat || !messageIds?.length) return;

    try {
      setMessages(prev => prev.filter(m => !messageIds.includes(m._id)));

      await apiClient.delete(
        `/chats/${selectedChat._id}/messages/bulk`,
        { data: { messageIds } }
      );
    } catch (err) {
      console.error(err);
      loadMessages();
    }
  }, [selectedChat, loadMessages]);

  /* ───────── SOCKET: NEW MESSAGE ───────── */
  useEffect(() => {
    if (!socket) {
      console.warn("[useChat] Socket not available for message listener");
      return;
    }

    console.log("[useChat] Registering new-message listener");

    const handleNew = (msg) => {
      console.log("═══════════════════════════════════════════");
      console.log("[useChat] 🎯 RECEIVED new-message socket event");
      console.log("═══════════════════════════════════════════");
      console.log({
        messageId: msg._id,
        content: msg.content,
        chatId: msg.chatId,
        senderId: msg.sender?._id,
        tempId: msg.tempId,
        serverTimestamp: msg.serverTimestamp,
      });

      // ✅ Prevent duplicate processing of same message
      if (processedMessagesRef.current.has(msg._id?.toString())) {
        console.log("[useChat] ⚠️ Message already processed, skipping duplicate event", { messageId: msg._id });
        return;
      }
      processedMessagesRef.current.add(msg._id?.toString());

      const currentChat = selectedChatRef.current;
      console.log("[useChat] Current selected chat:", { chatId: currentChat?._id });

      if (!currentChat) {
        console.warn("[useChat] ⚠️ No chat open - message not shown");
        return;
      }

      // Safe chatId comparison (handles both string and ObjectId)
      const msgChatId = msg.chatId?.toString();
      const selectedChatId = currentChat._id?.toString();

      console.log("[useChat] Comparing chatIds:", { msgChatId, selectedChatId, match: msgChatId === selectedChatId });

      if (msgChatId === selectedChatId) {
        console.log("[useChat] ✅ Chat match! Adding message to state");
        setMessages(prev => {
          // ✅ Check if message with this _id already exists (prevent duplication)
          if (prev.some(m => m._id === msg._id)) {
            console.log("[useChat] Message already exists by _id, skipping");
            return prev;
          }

          // ✅ CRITICAL: Match temp message by tempId instead of content
          // This prevents duplicate messages when multiple messages have same content
          const tempIndex = msg.tempId
            ? prev.findIndex(m => m.tempId === msg.tempId)
            : -1;

          if (tempIndex !== -1) {
            const updated = [...prev];

            const oldMessage = prev[tempIndex];

            updated[tempIndex] = {
              ...msg,
              // ✅ PRESERVE STATUS IF ALREADY SEEN
              status:
                oldMessage.status === "seen"
                  ? "seen"
                  : msg.status || "sent",
            };

            return updated;
          }
          console.log("[useChat] ✨ Adding new message to state (no temp found)", {
            tempId: msg.tempId,
            messageId: msg._id
          });
          // ✅ Insert in chronological order (don't just push)
          return [...prev, msg].sort((a, b) => {
            const aTime = a.serverTimestamp || new Date(a.createdAt).getTime();
            const bTime = b.serverTimestamp || new Date(b.createdAt).getTime();
            return aTime - bTime;
          });
        });

        // ✅ FIXED: Use debounced mark-seen instead of immediate call
        // This batches rapid mark-seen calls and prevents them from racing
        triggerMarkSeenDebounced(msg.chatId);
      } else {
        console.warn("[useChat] ❌ ChatId mismatch - message for different chat");
      }

      // Always update filteredChats with the latest message
      setFilteredChats(prev =>
        prev.map(c =>
          c._id?.toString() === msg.chatId?.toString() ? { ...c, lastMessage: msg } : c
        )
      );
    };

    const handleDelete = ({ chatId, messageIds }) => {
      const currentChat = selectedChatRef.current;
      if (currentChat && chatId?.toString() === currentChat._id?.toString()) {
        setMessages(prev => prev.filter(m => !messageIds.includes(m._id)));
      }
    };

    // ✅ Remove any existing listeners before adding new ones
    socket.off("new-message", handleNew);
    socket.off("messages-deleted", handleDelete);

    socket.on("new-message", handleNew);
    socket.on("messages-deleted", handleDelete);

    console.log("[useChat] ✅ Socket listeners registered");

    return () => {
      console.log("[useChat] Unregistering socket listeners");
      socket.off("new-message", handleNew);
      socket.off("messages-deleted", handleDelete);
    };
  }, []);

  /* ───────── SOCKET: ACK ───────── */
  useEffect(() => {
    if (!me) return;

    const handleSent = ({ tempId, message }) => {
      console.log("[useChat] Received message-sent ACK", { tempId, messageId: message._id });

      setMessages(prev =>
        prev.map(msg => {
          if (msg.tempId === tempId) {
            // ✅ Use status from server instead of hardcoding "sent"
            return { ...message, status: message.status || "sent" };
          }
          return msg;
        })
      );
    };

    socket.on("message-sent", handleSent);

    return () => socket.off("message-sent", handleSent);
  }, [me]);

  /* ───────── SOCKET: STATUS ───────── */
  useEffect(() => {
    if (!me) return;

    const handleSeen = ({ chatId, messageIds }) => {
      console.log("[useChat] 📥 Received messages-seen event", {
        chatId,
        count: messageIds.length,
        messageIds
      });

      setMessages(prev => {
        let updateCount = 0;
        const updated = prev.map(m => {
          // ✅ Robust ID comparison (handle string vs object)
          const mIdStr = m._id?.toString();
          const isTargetMessage = messageIds.some(id => id.toString() === mIdStr);

          // ✅ Mark as seen if it's in the list and current status is not already "seen"
          // We allow "sent", "delivered", and even "sending" (though rare) to be updated to "seen"
          if (m.chatId?.toString() === chatId?.toString() && isTargetMessage && m.status !== "seen") {
            updateCount++;
            console.log("[useChat] ✅ Message marked seen:", mIdStr, "Type:", m.type);
            return { ...m, status: "seen" };
          }
          return m;
        });

        if (updateCount > 0) {
          console.log("[useChat] Total messages marked seen in this batch:", updateCount, "/", messageIds.length);
        }
        return updated;
      });
    };

    socket.on("messages-seen", handleSeen);

    const handleStatusUpdate = ({ messageId, status }) => {
      console.log("[useChat] 📥 Received message-status-update", { messageId, status });
      setMessages(prev =>
        prev.map(m =>
          m._id?.toString() === messageId?.toString() ? { ...m, status } : m
        )
      );
    };

    socket.on("message-status-update", handleStatusUpdate);

    return () => {
      socket.off("messages-seen", handleSeen);
      socket.off("message-status-update", handleStatusUpdate);
    };
  }, [me]);

  /* ───────── SOCKET: TYPING ───────── */
  useEffect(() => {
    if (!me) return;

    const onTyping = ({ from }) => {
      const currentChat = selectedChatRef.current;
      if (currentChat && getOtherUser(currentChat)?._id === from) {
        setTyping({ userId: from });
      }
    };

    const onStop = ({ from }) => {
      const currentChat = selectedChatRef.current;
      if (currentChat && getOtherUser(currentChat)?._id === from) {
        setTyping(null);
      }
    };

    socket.on("user-typing", onTyping);
    socket.on("user-stop-typing", onStop);

    return () => {
      socket.off("user-typing", onTyping);
      socket.off("user-stop-typing", onStop);
    };
  }, [me, getOtherUser]);

  /* ───────── START CHAT ───────── */
  const startChat = useCallback(async (friendId) => {
    try {
      const res = await apiClient.get(`/chats/${friendId}`);
      const chat = res.data;

      setChats(prev =>
        prev.some(c => c._id === chat._id) ? prev : [chat, ...prev]
      );

      setFilteredChats(prev =>
        prev.some(c => c._id === chat._id) ? prev : [chat, ...prev]
      );

      setSelectedChat(chat);
    } catch (err) {
      console.error(err);
    }
  }, []);

  /* ───────── LOAD FRIENDS ───────── */
  const loadFriends = useCallback(async () => {
    try {
      const res = await apiClient.get("/friends/friendslist");
      const data = res.data;
      setFriends(data.friends || data);
      setFilteredFriends(data.friends || data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  /* ───────── FILE SEND ───────── */
  const handleFileSend = useCallback(async (file, tempIdFromUI) => {
    if (!file || !selectedChat || !me) {
      throw new Error("File or chat not selected");
    }

    const tempId = tempIdFromUI || generateTempId();

    const tempMessage = {
      _id: tempId,
      tempId,
      type: "file",
      content: file.name,
      file: {
        name: file.name,
        size: file.size,
        mimeType: file.type,
      },
      sender: {
        _id: me._id,
        fullName: me.fullName,
        profilePic: me.profilePic,
      },
      chatId: selectedChat._id,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    // ✅ FIX: ADD THIS LINE
    setMessages(prev => [...prev, tempMessage]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tempId", tempId);

      const res = await apiClient.post(
        `/chats/${selectedChat._id}/file`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120000,
        }
      );

      // ✅ Update message with real data from server response immediately
      if (res.data?.success && res.data.message) {
        const serverMsg = res.data.message;
        setMessages(prev =>
          prev.map(m =>
            m.tempId === tempId ? { ...serverMsg, status: serverMsg.status || "sent" } : m
          )
        );
      }

    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.tempId === tempId ? { ...m, status: "failed" } : m
        )
      );

      throw err;
    }
  }, [selectedChat, me]);

  /* ───────── VISIBILITY CHANGE FIX ───────── */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[useChat] Tab active again");

        if (!socket.connected) {
          console.log("[useChat] Reconnecting socket...");
          connectSocket();
        }

        if (selectedChatRef.current) {
          joinChatRoom({ chatId: selectedChatRef.current._id });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  /* ───────── WINDOW FOCUS FIX ───────── */
  useEffect(() => {
    const handleFocus = () => {
      console.log("[useChat] Window focused");

      if (!socket.connected) {
        connectSocket();
      }

      if (selectedChatRef.current) {
        joinChatRoom({ chatId: selectedChatRef.current._id });
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  /* ───────── RETURN ───────── */
  return {
    loading,
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
    typing,
    handleFileSend,
    messagesLoading,
  };
};