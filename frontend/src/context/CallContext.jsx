import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import Peer from "simple-peer";
import { socket, connectSocket } from "../Sockets/Socket";
import { toast } from "react-toastify";

const CallContext = createContext();

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const [incomingCall, setIncomingCall] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [callError, setCallError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeUser, setActiveUser] = useState(null);
  const [callType, setCallType] = useState(null); // "video" or "audio"
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const isEndingRef = useRef(false); // Prevent multiple endCall calls

  // 🎥 GET CAMERA + MIC
  const getMedia = async (video = true) => {
    try {
      console.log("[MEDIA] Requesting media. Video:", video);
      setCallError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720 } : false,
        audio: true,
      });

      console.log("[MEDIA] Media stream received:", stream);
      streamRef.current = stream;
      setLocalStream(stream);

      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (err) {
      console.error("[MEDIA] Failed to get media", err);
      const errorMsg = 
        err.name === "NotAllowedError" 
          ? "Camera/Microphone access denied" 
          : err.name === "NotFoundError"
          ? "No camera/microphone found"
          : err.message;
      setCallError(errorMsg);
      throw err;
    }
  };

  // ❌ END CALL
  const endCall = useCallback((emitSocketEvent = true) => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    console.log("[CALL] Ending call. Emit event:", emitSocketEvent);

    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (e) {
        console.error("[CALL] Error destroying peer:", e);
      }
      peerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (emitSocketEvent) {
      // Use state values or fallback to refs if needed
      if (incomingCall) {
          socket.emit("call:end", { to: incomingCall.from });
      } else if (activeUser) {
          socket.emit("call:end", { to: activeUser._id });
      }
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
    setCallAccepted(false);
    setCallEnded(true);
    setIsConnecting(false);
    setActiveUser(null);
    setCallType(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setCallDuration(0);
    
    // Reset the flag after state updates
    setTimeout(() => {
        isEndingRef.current = false;
    }, 1000);
  }, [incomingCall, activeUser]);

  // 📞 CALL USER (CALLER)
  const callUser = async ({ to, user, type = "video" }) => {
    try {
      console.log("[CALL] Calling user:", to, "Type:", type);
      setIsConnecting(true);
      setCallError(null);
      setActiveUser(user);
      setCallType(type);
      setCallEnded(false);

      const stream = await getMedia(type === "video");
      console.log("[CALL] Media stream obtained, creating peer...");

      const peer = new Peer({
        initiator: true,
        trickle: false, // Wait for all ICE candidates before signaling
        stream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
          ],
        },
      });

      peerRef.current = peer;

      peer.on("signal", (offer) => {
        console.log("[SIGNAL] Offer/SDP generated, sending to:", to);
        socket.emit("call:request", { to, offer, callType: type });
      });

      peer.on("connect", () => {
        console.log("[PEER] P2P Connection established (caller)");
        setIsConnecting(false);
      });

      peer.on("stream", (remoteStream) => {
        console.log("[STREAM] Remote stream received (caller)");
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          console.log("[STREAM] Remote video attached to ref (caller)");
        } else {
          console.warn("[STREAM] remoteVideoRef.current is null (caller), will attach via useEffect");
        }
      });

      peer.on("error", (err) => {
        console.error("[PEER ERROR]", err);
        setCallError("Connection failed: " + err.message);
        endCall(true); // Notify other side of failure
      });

      peer.on("close", () => {
        console.log("[PEER] Connection closed event triggered");
        endCall(false); // Don't emit again, usually close follows an end event
      });

    } catch (err) {
      console.error("[CALL] Failed to call user:", err);
      setCallError(err.message || "Failed to initiate call");
      setIsConnecting(false);
    }
  };

  // ✅ ANSWER CALL (RECEIVER)
  const answerCall = async () => {
    try {
      if (!incomingCall) return;

      console.log("[CALL] Answering incoming call:", incomingCall);
      setIsConnecting(true);
      setCallError(null);
      setCallType(incomingCall.callType);
      setCallEnded(false);

      const stream = await getMedia(incomingCall.callType === "video");
      console.log("[CALL] Media stream obtained (receiver), setting callAccepted=true");
      setCallAccepted(true);

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
          ],
        },
      });

      peerRef.current = peer;

      peer.on("signal", (answer) => {
        console.log("[SIGNAL] Answer/SDP generated, sending to:", incomingCall.from);
        socket.emit("call:answer", {
          to: incomingCall.from,
          answer,
        });
      });

      peer.on("connect", () => {
        console.log("[PEER] P2P Connection established (receiver)");
        setIsConnecting(false);
      });

      peer.on("stream", (remoteStream) => {
        console.log("[STREAM] Remote stream received (receiver)");
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          console.log("[STREAM] Remote video attached to ref (receiver)");
        } else {
          console.warn("[STREAM] remoteVideoRef.current is null (receiver), will attach via useEffect");
        }
      });

      peer.on("error", (err) => {
        console.error("[PEER ERROR]", err);
        setCallError("Connection failed: " + err.message);
        endCall(true);
      });

      peer.on("close", () => {
        console.log("[PEER] Connection closed event triggered");
        endCall(false);
      });

      console.log("[SIGNAL] Applying received offer to peer...");
      peer.signal(incomingCall.offer);
    } catch (err) {
      console.error("[CALL] CRITICAL ERROR in answerCall:", err);
      toast.error("Failed to answer call: " + (err.message || "Unknown error"));
      setCallError(err.message || "Failed to answer call");
      setCallAccepted(false);
      setIsConnecting(false);
    }
  };

  // 🔌 SOCKET EVENTS
  useEffect(() => {
    if (!socket.connected) {
      connectSocket();
    }

    const handleIncomingCall = (data) => {
      console.log("[SOCKET] Incoming call from:", data.from);
      
      // BUSY HANDLING: If already in a call, notify the caller
      if (peerRef.current || incomingCall || activeUser) {
        console.log("[SOCKET] User is busy, notifying caller...");
        socket.emit("call:end", { to: data.from });
        return;
      }
      
      setIncomingCall(data);
    };

    const handleCallAnswered = (data) => {
      console.log("[SOCKET] Call answered by remote user:", data.from);
      if (peerRef.current) {
        console.log("[SIGNAL] Applying remote answer to peer...");
        peerRef.current.signal(data.answer);
      } else {
        console.warn("[SOCKET] Received answer but peerRef.current is null!");
      }
      setCallAccepted(true);
      setIsConnecting(false);
    };

    const handleIceCandidate = (data) => {
        if (data.candidate) {
            console.log("[SOCKET] Received ICE candidate from remote");
            if (peerRef.current) {
                peerRef.current.signal(data.candidate);
            }
        }
    };

    const handleCallEnded = () => {
      console.log("[SOCKET] Call ended by remote user");
      endCall(false); // Other side already ended, don't emit back
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:answered", handleCallAnswered);
    socket.on("call:ice", handleIceCandidate);
    socket.on("call:ended", handleCallEnded);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:answered", handleCallAnswered);
      socket.off("call:ice", handleIceCandidate);
      socket.off("call:ended", handleCallEnded);
    };
  }, [endCall]);

  // ✅ Auto-attach streams when refs become available
  useEffect(() => {
    if (!isVideoOff && localStream && myVideoRef.current && !myVideoRef.current.srcObject) {
      console.log("[EFFECT] Auto-attaching local stream");
      myVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callAccepted, isVideoOff]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
      console.log("[EFFECT] Auto-attaching remote stream");
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callAccepted]);

  // ✅ Call Duration Timer
  useEffect(() => {
    let interval = null;
    if (callAccepted) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [callAccepted]);

  // ✅ Manage local tracks (mute/video off)
  useEffect(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMuted;
        console.log(`[MEDIA] Audio track ${isMuted ? "disabled" : "enabled"}`);
      }
    }
  }, [isMuted]);

  useEffect(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOff;
        console.log(`[MEDIA] Video track ${isVideoOff ? "disabled" : "enabled"}`);
      }
    }
  }, [isVideoOff]);

  const value = {
    myVideoRef,
    remoteVideoRef,
    incomingCall,
    callAccepted,
    callEnded,
    callError,
    isConnecting,
    activeUser,
    callType,
    callUser,
    answerCall,
    endCall,
    setCallError,
    setIncomingCall,
    setActiveUser,
    toggleMute: () => setIsMuted((prev) => !prev),
    toggleVideo: () => setIsVideoOff((prev) => !prev),
    isMuted,
    isVideoOff,
    callDuration,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
