import axios from "axios";

const apiClient = axios.create({
  baseURL: (import.meta.env.VITE_BACKEND_URL || "http://localhost:9000") + "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;