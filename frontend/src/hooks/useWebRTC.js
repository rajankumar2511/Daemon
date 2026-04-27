import { useEffect, useRef, useState, useCallback } from "react";
import Peer from "simple-peer";
import { socket, connectSocket } from "../Sockets/Socket";
import { toast } from "react-toastify";

export const useWebRTC = () => {
  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

  const [incomingCall, setIncomingCall] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callError, setCallError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [callType, setCallType] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);

  // 📺 ATTACH REMOTE STREAM WHEN VIDEO REF IS READY
  useEffect(() => {
    let playTimeout;
    
    const attachStream = async () => {
      if (remoteStream && remoteVideoRef.current) {
        console.log("[MEDIA] Attaching remote stream to video element. Tracks:", 
          remoteStream.getTracks().map(t => `${t.kind}:${t.enabled}`));
        
        remoteVideoRef.current.srcObject = remoteStream;
        
        try {
          // Explicitly play and handle potential autoplay blocks
          await remoteVideoRef.current.play();
          console.log("[MEDIA] Remote playback started successfully");
        } catch (err) {
          console.warn("[MEDIA] Auto-play failed, waiting for user interaction:", err);
          // Retry playback after a short delay if it's a transient issue
          playTimeout = setTimeout(() => {
            remoteVideoRef.current?.play().catch(() => {});
          }, 1000);
        }
      }
    };

    attachStream();
    return () => {
      if (playTimeout) clearTimeout(playTimeout);
    };
  }, [remoteStream, callAccepted]); // Re-run when stream or acceptance changes

  // 📺 ATTACH LOCAL STREAM WHEN VIDEO REF IS READY
  useEffect(() => {
    if (streamRef.current && myVideoRef.current) {
      console.log("[MEDIA] Attaching local stream to video element. Tracks:",
        streamRef.current.getTracks().map(t => `${t.kind}:${t.enabled}`));
      myVideoRef.current.srcObject = streamRef.current;
    }
  }, [callAccepted, incomingCall, remoteUserId, callType]); // Re-run when call state changes

  // 🎥 GET CAMERA + MIC
  const getMedia = async (useVideo = true) => {
    try {
      console.log("[MEDIA] Requesting media. Video:", useVideo);
      
      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: useVideo,
        audio: true,
      });

      console.log("[MEDIA] Media stream received");
      streamRef.current = stream;

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
      toast.error(errorMsg);
      throw err;
    }
  };

  // 📞 CALL USER (CALLER)
  const callUser = useCallback(async ({ to, type = "video" }) => {
    try {
      console.log("[CALL] Calling user:", to, "Type:", type);
      setIsConnecting(true);
      setCallError(null);
      setRemoteUserId(to);
      setCallType(type);
      setIsVideoOn(type === "video");
      setIsMicOn(true);

      const stream = await getMedia(type === "video");

      peerRef.current = new Peer({
        initiator: true,
        trickle: false,
        stream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      peerRef.current.on("signal", (offer) => {
        console.log("[PEER] Signal generated (offer):", offer.type);
        socket.emit("call:request", { to, offer, callType: type });
      });

      peerRef.current.on("stream", (stream) => {
        console.log("[PEER] Remote stream received. Tracks:", stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
        setRemoteStream(stream);
      });

      peerRef.current.on("error", (err) => {
        console.error("[PEER] Error:", err.code || err.message, err);
        setCallError(`Connection error: ${err.message || "Unknown"}`);
        endCall();
      });

      peerRef.current.on("connect", () => {
        console.log("[PEER] Connection established (Data Channel ready)");
        setIsConnecting(false);
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      });

      peerRef.current.on("close", () => {
        console.log("[PEER] Closed");
        endCall();
      });

      connectionTimeoutRef.current = setTimeout(() => {
        if (!callAccepted) {
          console.error("[PEER] Connection timeout");
          setCallError("No response from user");
          endCall();
        }
      }, 30000);

    } catch (err) {
      console.error("[CALL] Error", err);
      setIsConnecting(false);
    }
  }, []);

  // ✅ ANSWER CALL (RECEIVER)
  const answerCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      console.log("[CALL] Answering call from:", incomingCall.from);
      setIsConnecting(true);
      setCallError(null);
      setRemoteUserId(incomingCall.from);
      setCallType(incomingCall.callType);
      setIsVideoOn(incomingCall.callType === "video");
      setIsMicOn(true);

      const stream = await getMedia(incomingCall.callType === "video");

      peerRef.current = new Peer({
        initiator: false,
        trickle: false,
        stream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      peerRef.current.on("signal", (answer) => {
        console.log("[PEER] Signal generated (answer):", answer.type);
        socket.emit("call:answer", { to: incomingCall.from, answer });
      });

      peerRef.current.on("stream", (stream) => {
        console.log("[PEER] Remote stream received. Tracks:", stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
        setRemoteStream(stream);
      });

      peerRef.current.on("error", (err) => {
        console.error("[PEER] Error:", err.code || err.message, err);
        setCallError(`Connection error: ${err.message || "Unknown"}`);
        endCall();
      });

      peerRef.current.on("connect", () => {
        console.log("[PEER] Connection established (Data Channel ready)");
        setIsConnecting(false);
        setCallAccepted(true);
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      });

      peerRef.current.on("close", () => {
        console.log("[PEER] Closed");
        endCall();
      });

      peerRef.current.signal(incomingCall.offer);

    } catch (err) {
      console.error("[CALL] Error answering", err);
      endCall();
    }
  }, [incomingCall]);

  // ❌ END CALL
  const endCall = useCallback(() => {
    console.log("[CALL] Ending call");

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    if (remoteUserId) {
      socket.emit("call:end", { to: remoteUserId });
    }

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (myVideoRef.current) myVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setRemoteStream(null);
    setIncomingCall(null);
    setCallAccepted(false);
    setRemoteUserId(null);
    setIsConnecting(false);
    setCallType(null);
    setIsMicOn(true);
    setIsVideoOn(true);
  }, [remoteUserId]);

  // 🎤 TOGGLE MIC
  const toggleMic = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
        console.log("[MEDIA] Mic toggled:", audioTrack.enabled);
      }
    }
  }, []);

  // 📹 TOGGLE VIDEO
  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
        console.log("[MEDIA] Video toggled:", videoTrack.enabled);
      }
    }
  }, []);

  // 🔌 SOCKET EVENTS
  useEffect(() => {
    if (!socket.connected) connectSocket();

    const handleIncomingCall = (data) => {
      console.log("[SOCKET] Incoming call request from:", data.from, "Type:", data.callType);
      setIncomingCall(data);
    };

    // 🛑 HANDLE CALL ANSWERED
    const handleCallAnswered = (data) => {
      console.log("[SOCKET] Call answered by:", data.from);
      if (peerRef.current) {
        console.log("[PEER] Signaling answer to local peer");
        try {
          peerRef.current.signal(data.answer);
          setCallAccepted(true);
          setIsConnecting(false);
        } catch (err) {
          console.error("[PEER] Error signaling answer:", err);
          setCallError("Failed to establish peer connection");
        }
      } else {
        console.warn("[SOCKET] Received answer but peerRef.current is null! Retrying in 500ms...");
        // Retry logic: if peer is not ready, wait a bit and check again
        setTimeout(() => {
          if (peerRef.current) {
            console.log("[SOCKET] Retry: Signaling answer to local peer");
            peerRef.current.signal(data.answer);
            setCallAccepted(true);
            setIsConnecting(false);
          } else {
            console.error("[SOCKET] Peer still null after retry.");
          }
        }, 500);
      }
    };

    const handleIceCandidate = (data) => {
      console.log("[SOCKET] Received ICE candidate from:", data.from);
      if (peerRef.current && data.candidate) {
        try {
          peerRef.current.signal(data.candidate);
        } catch (err) {
          console.error("[PEER] ICE signaling error:", err);
        }
      } else if (!peerRef.current) {
        console.warn("[SOCKET] Received ICE but peerRef.current is null!");
      }
    };

    const handleCallEnded = (data) => {
      console.log("[SOCKET] Call ended by remote user:", data?.from || "Unknown");
      endCall();
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

  return {
    myVideoRef,
    remoteVideoRef,
    incomingCall,
    callAccepted,
    callUser,
    answerCall,
    endCall,
    callError,
    isConnecting,
    setCallError,
    callType,
    remoteUserId,
    isMicOn,
    isVideoOn,
    toggleMic,
    toggleVideo,
  };
};
