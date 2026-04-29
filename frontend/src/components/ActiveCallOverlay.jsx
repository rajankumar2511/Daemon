import React from "react";
import { useCall } from "../context/CallContext";
import { PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";

const ActiveCallOverlay = () => {
  const {
    myVideoRef,
    remoteVideoRef,
    callAccepted,
    isConnecting,
    activeUser,
    endCall,
    callType,
    toggleMute,
    toggleVideo,
    isMuted,
    isVideoOff,
    callDuration
  } = useCall();

  // Helper to format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!callAccepted && !isConnecting && !activeUser) return null;
  if (!callAccepted && !isConnecting) return null; // Only show if we are in the process of calling or in a call

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[9998]">
      {/* Connection Status & Timer */}
      <div className="absolute top-8 flex flex-col items-center gap-3 z-10">
        {isConnecting && (
          <div className="bg-blue-600/20 border border-blue-600 px-6 py-3 rounded-full text-sm text-blue-300 animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></span>
            Establishing P2P Connection...
          </div>
        )}
        
        {callAccepted && (
          <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-white font-mono text-sm tracking-widest flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            {formatTime(callDuration)}
          </div>
        )}
      </div>

      {/* Videos */}
      <div className="relative w-full h-full flex items-center justify-center p-4">
        {/* Remote Video (Main) */}
        <div className="relative w-full max-w-5xl aspect-video bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-800">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-6 left-6 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white font-medium">
            {activeUser?.fullName || "Remote User"}
          </div>
          
          {/* Local Video (PiP) */}
          <div className="absolute top-6 right-6 w-48 md:w-64 aspect-video bg-black rounded-2xl overflow-hidden shadow-xl border-2 border-white/20 z-20 flex items-center justify-center">
            {isVideoOff ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center">
                   <VideoOff size={20} className="text-gray-400" />
                </div>
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">Camera Off</span>
              </div>
            ) : (
              <video
                ref={myVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}
            <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] text-white/80 uppercase tracking-wider">
              You {isMuted && " (Muted)"}
            </div>
          </div>

          {!callAccepted && isConnecting && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="text-center">
                    <div className="w-20 h-20 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center animate-bounce">
                        {activeUser?.profilePic ? (
                             <img src={activeUser.profilePic} className="w-full h-full rounded-full object-cover" alt="" />
                        ) : (
                             <span className="text-3xl text-white">👤</span>
                        )}
                    </div>
                    <p className="text-xl font-bold text-white">Calling {activeUser?.fullName}...</p>
                    <p className="text-gray-400">Waiting for answer</p>
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="absolute bottom-10 flex items-center gap-6">
        {/* Mute Toggle */}
        <button
          onClick={toggleMute}
          className={`group relative flex items-center justify-center w-12 h-12 rounded-full transition-all transform hover:scale-110 active:scale-90 shadow-xl ${
            isMuted ? "bg-red-600 shadow-red-900/40" : "bg-gray-800 hover:bg-gray-700 shadow-black/40"
          }`}
        >
          {isMuted ? <MicOff size={24} className="text-white" /> : <Mic size={24} className="text-white" />}
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {isMuted ? "Unmute" : "Mute"}
          </span>
        </button>

        {/* End Call */}
        <button
          onClick={() => {
            console.log("[OVERLAY] End call clicked");
            endCall();
          }}
          className="group relative flex items-center justify-center w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full transition-all transform hover:scale-110 active:scale-90 shadow-xl shadow-red-900/40"
        >
          <PhoneOff size={28} className="text-white" />
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            End Call
          </span>
        </button>

        {/* Video Toggle */}
        {callType === "video" && (
          <button
            onClick={toggleVideo}
            className={`group relative flex items-center justify-center w-12 h-12 rounded-full transition-all transform hover:scale-110 active:scale-90 shadow-xl ${
              isVideoOff ? "bg-red-600 shadow-red-900/40" : "bg-gray-800 hover:bg-gray-700 shadow-black/40"
            }`}
          >
            {isVideoOff ? <VideoOff size={24} className="text-white" /> : <Video size={24} className="text-white" />}
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ActiveCallOverlay;
