import apiClient from "./apiClient";

/* ====================================================
   🔐 AUTH APIs
==================================================== */

// Signup
export const signup = async (data) => {
  const res = await apiClient.post("/auth/signup", data);
  return res.data;
};

// Login
export const login = async (data) => {
  const res = await apiClient.post("/auth/login", data);
  return res.data;
};

// Logout
export const logout = async () => {
  const res = await apiClient.post("/auth/logout");
  return res.data;
};
export const updateProfile = async (data) => {
  const res = await apiClient.put("/auth/update-profile", data);
  return res.data;
};

// Get current user
export const getMe = async () => {
  const res = await apiClient.get("/auth/me");
  return res.data.user || res.data;
};

/* ====================================================
   👤 USER PROFILE (SMART API)
==================================================== */

// 🔥 Smart profile (public/private auto)
export const getUserProfile = async (userId) => {
  if (!userId) throw new Error("userId is required");

  const res = await apiClient.get(`/social/user/${userId}`);
  return res.data;
};

/* ====================================================
   👤 USER STATUS (PRESENCE)
==================================================== */

// Get last seen
export const getLastSeen = async (userId) => {
  if (!userId) throw new Error("userId is required");

  try {
    const res = await apiClient.get(`/auth/${userId}/last-seen`);
    return res.data;
  } catch (error) {
    console.error("[API] Error fetching last seen:", {
      userId,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    throw error;
  }
};

// Update last seen
export const updateLastSeen = async (userId, lastSeen = Date.now()) => {
  if (!userId) throw new Error("userId is required");

  try {
    const res = await apiClient.put(`/auth/${userId}/last-seen`, {
      lastSeen,
    });
    return res.data;
  } catch (error) {
    console.error("[API] Error updating last seen:", {
      userId,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    throw error;
  }
};

/* ====================================================
   👥 USERS LIST (IMPORTANT SECTION)
==================================================== */

// 🌍 All users (non-friends)
export const getAllUsers = async () => {
  const res = await apiClient.get("/friends/all");
  return res.data.users;
};

// 🤝 My friends
export const getMyFriends = async () => {
  const res = await apiClient.get("/friends/friendslist");
  return res.data.friends;
};

// 👤 Another user's friends (⚠️ make sure backend exists)
export const getUserFriends = async (userId) => {
  if (!userId) throw new Error("userId is required");

  const res = await apiClient.get(`/friends/${userId}`);
  return res.data.friends;
};

/* ====================================================
   🤝 FRIEND REQUEST APIs
==================================================== */

// Send friend request
export const sendFriendRequest = async (to) => {
  const res = await apiClient.post("/friends/request", { to });
  return res.data;
};

// Get incoming requests
export const getFriendRequests = async () => {
  const res = await apiClient.get("/friends/requests");
  return res.data.requests;
};

// Accept request
export const acceptFriendRequest = async (id) => {
  const res = await apiClient.post(`/friends/accept/${id}`);
  return res.data;
};

// Reject request
export const rejectFriendRequest = async (id) => {
  const res = await apiClient.post(`/friends/reject/${id}`);
  return res.data;
};

// Cancel request
export const cancelFriendRequest = async (id) => {
  const res = await apiClient.delete(`/friends/cancel/${id}`);
  return res.data;
};

/* ====================================================
   💬 CHAT APIs
==================================================== */

// Get all chats
export const getChats = async () => {
  const res = await apiClient.get("/chats");
  return res.data;
};

// Get or create chat
export const getOrCreateChat = async (friendId) => {
  const res = await apiClient.get(`/chats/${friendId}`);
  return res.data;
};

// Get messages
export const getMessages = async (chatId, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const res = await apiClient.get(`/chats/${chatId}/messages?${query}`);
  return res.data;
};

// Send message
export const sendMessage = async (chatId, payload) => {
  const res = await apiClient.post(`/chats/${chatId}/messages`, payload);
  return res.data;
};

// Send file
export const sendFile = async (chatId, formData) => {
  const res = await apiClient.post(`/chats/${chatId}/file`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

/* ====================================================
   📡 GENERIC API HELPER
==================================================== */

export const apiRequest = async (endpoint, options = {}) => {
  try {
    const method = options.method || "GET";

    const response = await apiClient({
      method,
      url: endpoint,
      data:
        options.body && !(options.body instanceof FormData)
          ? options.body
          : undefined,
      headers: options.headers,
      ...(options.body instanceof FormData && { data: options.body }),
    });

    return response.data;
  } catch (error) {
    console.error("[API ERROR]", {
      endpoint,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });

    if (error.response?.status === 401 || error.response?.status === 403) {
      window.location.href = "/login";
    }

    throw error;
  }
};