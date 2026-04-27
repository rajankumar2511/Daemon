/* ===================== Messages.jsx ===================== */

import { useRef, useEffect, useState, useCallback } from "react";
import { Send, Paperclip, Trash2, X, CheckCircle, Smile, Image, Mic, File, MoreHorizontal, Download, Eye, Check, CheckCheck } from "lucide-react";
import { toast } from "react-toastify";
import ChatHeader from "./ChatHeader";
import { emitTyping, emitStopTyping, socket } from "../Sockets/Socket";
import { onMessageSent } from "../Sockets/Socket";

const Messages = ({
  me,
  selectedChat,
  messages,
  newMessage,
  setNewMessage,
  setMessages,
  sendMessage,
  deleteMessages,
  getOtherUser,
  formatTime,
  typing,
  onOpenFriends,
  handleFileSend,
  isMobile = false,
  onBack = null,
}) => {
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [localFileBlobUrls, setLocalFileBlobUrls] = useState({}); // ✅ Store blob URLs by messageId

  const otherUser = selectedChat ? getOtherUser(selectedChat) : null;

  /* ================= FILE VIEW HANDLER (FOR SENDER) ================= */
  const handleFileView = async (e, messageId, fileData) => {
    e.preventDefault();

    try {
      // ✅ 1. Already cached
      const localBlob = localFileBlobUrls[messageId];
      if (localBlob) {
        window.open(localBlob, "_blank", "noopener,noreferrer");
        return;
      }

      // ❌ No URL
      if (!fileData?.url) {
        toast.error("File not available");
        return;
      }

      // ✅ 2. Fetch from cloud (first time)
      const response = await fetch(fileData.url);

      if (!response.ok) {
        throw new Error("Failed to fetch file");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // ✅ 3. Store locally
      setLocalFileBlobUrls(prev => ({
        ...prev,
        [messageId]: blobUrl
      }));

      // ✅ 4. Open
      window.open(blobUrl, "_blank", "noopener,noreferrer");

    } catch (error) {
      console.error("File view error:", error);

      // fallback
      if (fileData?.url) {
        window.open(fileData.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Failed to open file");
      }
    }
  };
  /* ================= FILE DOWNLOAD HANDLER (FOR RECEIVER) ================= */
  const handleFileDownload = (e, fileData) => {
    e.preventDefault();
    if (!fileData) return;

    try {
      // ✅ Priority: use backend endpoint for CORS-safe download
      const downloadUrl = fileData.downloadUrl || fileData.url;

      if (!downloadUrl) {
        toast.error("Download URL not available");
        return;
      }

      // ✅ Create a temporary link and trigger download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileData.name || "file";
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Downloading: ${fileData.name}`);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

  /* ================= AUTO SCROLL ================= */
  useEffect(() => {
    if (!isSelectMode) {
      endRef.current?.scrollIntoView({
        behavior: "auto"
      });
    }
  }, [messages, typing, isSelectMode]);

  useEffect(() => {
    const handler = ({ tempId, message }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.tempId === tempId
            ? { ...message, status: "sent" }
            : msg
        )
      );

      if (message.type === "file") {
        setLocalFileBlobUrls(prev => {
          // ✅ find blob using tempId
          const blob = prev[tempId];

          if (!blob) return prev;

          const updated = { ...prev };

          // ✅ move temp → real
          updated[message._id] = blob;
          delete updated[tempId];

          return updated;
        });
      }
    };

    socket.on("message-sent", handler);

    return () => {
      socket.off("message-sent", handler);
    };
  }, []);

  /* ================= SELECTION LOGIC ================= */
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(i => i !== id);
        if (next.length === 0) setIsSelectMode(false);
        return next;
      }
      return [...prev, id];
    });
  };

  const enterSelectMode = (id) => {
    setIsSelectMode(true);
    setSelectedIds([id]);
    if (window.navigator.vibrate) window.navigator.vibrate(50);
  };

  const handleSelectAll = useCallback(() => {
    if (!messages.length) return;
    const allIds = messages
      .filter(m => {
        const senderId = typeof m.sender === "object" ? m.sender._id : m.sender;
        return senderId === me?._id && !m.isDeleted;
      })
      .map(m => m._id);
    setSelectedIds(allIds);
    setIsSelectMode(true);
  }, [messages, me]);

  const cancelSelection = () => {
    setIsSelectMode(false);
    setSelectedIds([]);
  };

  /* ================= KEYBOARD SHORTCUTS ================= */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        if (selectedChat) {
          e.preventDefault();
          handleSelectAll();
        }
      }
      if (e.key === 'Escape' && isSelectMode) {
        cancelSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectMode, selectedChat, handleSelectAll]);

  /* ================= DELETE ACTION ================= */
  const handleDelete = async () => {
    if (!selectedIds.length) return;

    const idsToDelete = [...selectedIds];
    cancelSelection();
    setIsDeleting(true);

    let isCancelled = false;

    const undoToast = toast.info(
      <div className="flex items-center justify-between">
        <span>Deleting {idsToDelete.length} messages...</span>
        <button
          onClick={() => { isCancelled = true; toast.dismiss(undoToast); }}
          className="ml-4 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-bold transition"
        >
          UNDO
        </button>
      </div>,
      {
        autoClose: 5000,
        pauseOnHover: true,
        closeOnClick: false,
        draggable: false,
        onClose: async () => {
          if (!isCancelled) {
            try {
              await deleteMessages(idsToDelete);
              toast.success("Messages deleted", { autoClose: 2000 });
            } catch (err) {
              console.error("Deletion failed:", err);
              toast.error("Failed to delete messages. Please try again.");
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }
          } else {
            toast.info("Deletion cancelled", { autoClose: 2000 });
          }
          setIsDeleting(false);
        }
      }
    );
  };

  /* ================= TYPING ================= */
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  const handleTypingInput = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    if (!otherUser?._id || !selectedChat?._id) return;

    try {
      if (value.trim() && !isTypingRef.current) {
        emitTyping({ to: otherUser._id, chatId: selectedChat._id });
        isTypingRef.current = true;
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          emitStopTyping({ to: otherUser?._id, chatId: selectedChat._id });
          isTypingRef.current = false;
        }
      }, 1000);

      if (!value.trim() && isTypingRef.current) {
        emitStopTyping({ to: otherUser._id, chatId: selectedChat._id });
        isTypingRef.current = false;
      }
    } catch (err) {
      console.error("[Messages] Typing error:", err);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (isTypingRef.current && otherUser?._id && selectedChat?._id) {
        emitStopTyping({ to: otherUser._id, chatId: selectedChat._id });
        isTypingRef.current = false;
      }
    };
  }, [selectedChat?._id, otherUser?._id]);

  /* ================= SEND ================= */
  const handleSend = async () => {
    if (!newMessage.trim()) return;
    if (!selectedChat?._id) return;

    try {
      emitStopTyping({ to: otherUser?._id, chatId: selectedChat._id });
      const tempId = `temp-${Date.now()}`;
      await sendMessage(tempId);
    } catch (err) {
      console.error("[Messages] Send error:", err);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxFileSize = 50 * 1024 * 1024;
    if (file.size > maxFileSize) {
      toast.error("File too large! Maximum size: 50MB", { autoClose: 3000 });
      e.target.value = '';
      return;
    }

    const allowedTypes = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "video/mp4", "video/quicktime",
      "audio/mpeg", "audio/wav",
      "application/zip",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error(`File type not supported: ${file.type}`, { autoClose: 3000 });
      e.target.value = '';
      return;
    }

    try {
      setIsFileUploading(true);
      console.log("📤 Uploading file:", file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // ✅ Create blob URL from file BEFORE sending
      const blobUrl = URL.createObjectURL(file);

      // ✅ create SAME tempId
      const tempId = `temp-${Date.now()}`;

      // ✅ store blob WITH tempId
      setLocalFileBlobUrls(prev => ({
        ...prev,
        [tempId]: blobUrl
      }));

      await handleFileSend(file, tempId);

      toast.success(`File sent: ${file.name}`, { autoClose: 2000 });
      e.target.value = '';
    } catch (err) {
      console.error("[Messages] File send error:", err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to send file",
        { autoClose: 3000 }
      );
    } finally {
      setIsFileUploading(false);
    }
  };
  const getMessageStatusUI = (status) => {
    if (status === "sending") {
      return (
        <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
      );
    }

    if (status === "sent") {
      return (
        <Check
          size={16}
          strokeWidth={2.8}
          className="text-gray-300 drop-shadow-[0_0_2px_rgba(255,255,255,0.4)]"
        />
      );
    }

    if (status === "delivered") {
      return (
        <CheckCheck
          size={16}
          strokeWidth={2.8}
          className="text-gray-300 drop-shadow-[0_0_2px_rgba(255,255,255,0.4)]"
        />
      );
    }

    if (status === "seen") {
      return (
        <CheckCheck
          size={16}
          strokeWidth={3}
          className="text-green-400 drop-shadow-[0_0_4px_rgba(59,130,246,0.8)]"
        />
      );
    }

    return null;
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatFileName = (name) => {
    if (!name) return "File";

    const maxPerLine = 10;
    const maxLines = 2;

    const parts = [];

    for (let i = 0; i < name.length; i += maxPerLine) {
      parts.push(name.slice(i, i + maxPerLine));
    }

    const visible = parts.slice(0, maxLines);

    if (parts.length > maxLines) {
      visible[maxLines - 1] =
        visible[maxLines - 1].slice(0, maxPerLine - 3) + "...";
    }

    return visible;
  };

  /* ================= EMPTY STATE ================= */
  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a]">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">No conversation selected</h3>
          <p className="text-gray-400 mb-6">Choose a chat from the list to start messaging</p>
          <button
            onClick={onOpenFriends}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            Start New Chat
          </button>
        </div>
      </div>
    );
  }

  /* ================= RENDER ================= */
  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-[#0a0a0a] to-[#0d0d0d] relative overflow-hidden">
      <ChatHeader otherUser={otherUser} />

      {/* SELECT MODE OVERLAY HEADER */}
      {isSelectMode && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-[#1a1a1a] to-[#141414] border-b border-white/10 p-4 flex items-center justify-between animate-slide-down shadow-2xl backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={cancelSelection}
              className="p-2 rounded-lg hover:bg-white/10 transition-all duration-200"
            >
              <X size={20} className="text-gray-400" />
            </button>
            <span className="font-semibold text-white">{selectedIds.length} selected</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 text-sm font-medium text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all duration-200"
            >
              Select All
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-lg transition-all duration-200 shadow-lg shadow-red-900/20 transform hover:scale-105"
            >
              <Trash2 size={18} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* MESSAGES AREA */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 transition-opacity duration-300 ${isDeleting ? 'opacity-50' : 'opacity-100'} custom-scrollbar`}>        {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-gray-400">No messages yet</p>
            <p className="text-sm text-gray-600 mt-1">Send a message to start the conversation</p>
          </div>
        </div>
      ) : (
        messages.map((msg, idx) => {
          if (!msg) return null;

          const senderId = typeof msg.sender === "object" ? msg.sender._id : msg.sender;
          const isMe = senderId === me?._id;
          const isSelected = selectedIds.includes(msg._id);
          const isCached = !!localFileBlobUrls[msg._id];
          const showDate = idx === 0 || (new Date(msg.createdAt).toDateString() !== new Date(messages[idx - 1]?.createdAt).toDateString());

          return (
            <div
              key={msg._id ? msg._id.toString() : `temp-${msg.tempId}`}
              className="group relative"              >
              {showDate && (
                <div className="text-center my-6">
                  <span className="text-xs text-gray-500 bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                    {new Date(msg.createdAt).toLocaleDateString(undefined, {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}

              <div className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>                  {/* MULTI-SELECT CHECKBOX */}
                {(isSelectMode && isMe) && (
                  <div
                    onClick={() => toggleSelect(msg._id)}
                    className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-200 mb-2 ${isSelected
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 border-purple-500 shadow-md'
                      : 'border-gray-600 hover:border-purple-400'
                      }`}
                  >
                    {isSelected && <CheckCircle size={12} className="text-white" />}
                  </div>
                )}

                <div
                  onContextMenu={(e) => {
                    if (isMe) {
                      e.preventDefault();
                      enterSelectMode(msg._id);
                    }
                  }}
                  onClick={() => {
                    if (isSelectMode && isMe) toggleSelect(msg._id);
                  }}
                  className={`px-4 py-2.5 rounded-2xl relative shadow-md
  ${msg.type === "file"
                      ? "w-[320px] max-w-[320px]"           // ✅ fixed for files
                      : "max-w-[75%] w-fit"                // ✅ flexible for text
                    }
  ${isMe
                      ? `bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-sm ${isSelected ? "ring-2 ring-purple-400 ring-offset-2 ring-offset-[#0d0d0d]" : ""
                      }`
                      : "bg-white/5 backdrop-blur-sm text-white rounded-bl-sm border border-white/10"
                    }
`}
                >
                  {msg.type === "file" && (
                    <div className="flex items-center gap-3 group/file">

                      {/* FILE ICON */}
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-white/10 group-hover/file:scale-105 transition">
                        <File size={20} className="text-white/80" />
                      </div>

                      {/* FILE INFO */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-medium leading-tight text-white truncate"
                          title={msg.file?.name}
                        >
                          {formatFileName(msg.file?.name).map((line, idx) => (
                            <div key={idx}>{line}</div>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                          <span>
                            {msg.file?.size
                              ? `${(msg.file.size / 1024 / 1024).toFixed(2)} MB`
                              : "File"}
                          </span>

                          {/* DOT */}
                          <span className="w-1 h-1 bg-gray-500 rounded-full"></span>

                          <span className="uppercase text-[10px] tracking-wide">
                            {msg.file?.mimeType?.split("/")[1] || "file"}
                          </span>
                        </div>
                      </div>

                      {/* ACTION BUTTON */}
                      <button
                        onClick={(e) => handleFileView(e, msg._id, msg.file)}
                        className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200
    ${isCached
                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            : "bg-white/10 text-gray-300 hover:bg-white/20"
                          }
  `}
                        title={isCached ? "Open file" : "Download file"}
                      >
                        {isCached ? <Eye size={16} /> : <Download size={16} />}
                      </button>
                    </div>
                  )}
                  {(!msg.type || msg.type === "text") && (
                    <p className="text-sm text-white break-words leading-relaxed">
                      {msg.content}
                    </p>
                  )}


                  <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] opacity-70">
                    <span>{msg.createdAt ? formatTime(msg.createdAt) : ""}</span>
                    {isMe && msg.status && (
                      <span className="flex items-center gap-1 ml-1">
                        {getMessageStatusUI(msg.status)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

        {/* TYPING INDICATOR */}
        {typing && typing.userId !== me?._id && otherUser && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-white/5 backdrop-blur-sm px-5 py-3 rounded-2xl rounded-bl-sm border border-white/10">
              <div className="flex gap-1.5 mb-1">
                <span className="w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span className="text-xs text-gray-400">
                {otherUser?.fullName?.split(' ')[0] || "User"} is typing...
              </span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* INPUT AREA */}
      <div className={`p-4 border-t border-white/10 bg-white/5 backdrop-blur-sm transition-transform duration-300 ${isSelectMode ? 'translate-y-full' : 'translate-y-0'}`}>
        <div className="flex gap-2 items-end">
          {/* FILE BUTTON */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isFileUploading}
            className={`p-2.5 rounded-xl transition-all duration-200 ${isFileUploading
              ? "bg-white/5 text-gray-600 cursor-not-allowed"
              : "bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white border border-white/10"
              }`}
            title={isFileUploading ? "Uploading file..." : "Attach file"}
          >
            {isFileUploading ? (
              <div className="w-4 h-4 border-2 border-gray-600 border-t-purple-400 rounded-full animate-spin" />
            ) : (
              <Paperclip size={18} />
            )}
          </button>

          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={handleFileChange}
            disabled={isFileUploading}
          />

          {/* TEXT INPUT */}
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={handleTypingInput}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="w-full bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl outline-none resize-none text-white placeholder-gray-400 max-h-32 border border-white/10 focus:border-purple-500 transition-all duration-200"
              rows={Math.min(3, Math.ceil(newMessage.length / 50) || 1)}
            />
          </div>

          {/* SEND BUTTON */}
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className={`p-2.5 rounded-xl transition-all duration-200 transform ${newMessage.trim()
              ? "bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25 hover:scale-105"
              : "bg-white/10 text-gray-600 cursor-not-allowed"
              }`}
            title="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fade-out {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.9); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down { animation: slide-down 0.3s ease-out forwards; }
        .animate-fade-out { animation: fade-out 0.3s ease-in forwards; }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b5cf6, #3b82f6);
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #7c3aed, #2563eb);
        }
      `}</style>
    </div>
  );
};

export default Messages; 