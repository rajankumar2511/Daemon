import { useEffect, useState } from "react";
import { useCall } from "../context/CallContext";
import { getMyFriends } from "../lib/api";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from "lucide-react";

const CallModal = () => {
  const {
    myVideoRef,
    remoteVideoRef,
    incomingCall,
    callAccepted,
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
  } = useCall();

  const [friends, setFriends] = useState([]);
  const [targetUser, setTargetUser] = useState(null);

  useEffect(() => {
    const loadFriends = async () => {
      try {
        const data = await getMyFriends();
        setFriends(data || []);
      } catch (err) {
        console.error("[CallModal] Load friends error:", err);
      }
    };
    loadFriends();
  }, []);

  useEffect(() => {
    if (incomingCall) {
      const found = friends.find((f) => f._id === incomingCall.from);
      setTargetUser(found);
    } else if (remoteUserId) {
      const found = friends.find((f) => f._id === remoteUserId);
      setTargetUser(found);
    } else {
      setTargetUser(null);
    }
  }, [incomingCall, remoteUserId, friends]);

  if (!incomingCall && !callAccepted && !callError && !isConnecting && !remoteUserId) return null;

  console.log("[MODAL] Rendering. Incoming:", !!incomingCall, "Accepted:", !!callAccepted, "Connecting:", isConnecting, "Target:", targetUser?.fullName);

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-500 ${
      (callAccepted || remoteUserId || incomingCall) ? "bg-black/90 backdrop-blur-md" : "pointer-events-none"
    }`}>
      <div className="w-full h-full flex items-center justify-center p-4">
        {/* OUTGOING CALL (SENDER) */}
        {!incomingCall && !callAccepted && remoteUserId && (
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl text-center max-w-sm shadow-2xl">
            <div className="mb-4">
              <img
                src={targetUser?.profilePic || "https://via.placeholder.com/80"}
                alt={targetUser?.fullName}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-blue-500 animate-pulse"
              />
            </div>
            <p className="text-xl font-semibold mb-2 text-white">{targetUser?.fullName || "Calling..."}</p>
            <p className="text-sm text-gray-400 mb-6 capitalize">
              Calling {callType || "user"}...
            </p>
            <button
              onClick={endCall}
              className="w-full bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-white"
            >
              <PhoneOff size={20} /> Cancel
            </button>
          </div>
        )}

        {/* INCOMING CALL NOTIFICATION */}
        {incomingCall && !callAccepted && (
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl text-center max-w-sm shadow-2xl animate-bounce-slow">
            <div className="mb-4">
              <img
                src={targetUser?.profilePic || "https://via.placeholder.com/80"}
                alt={targetUser?.fullName}
                className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-2 border-blue-500"
              />
            </div>
            <p className="text-xl font-semibold mb-2 text-white">{targetUser?.fullName || "Unknown User"}</p>
            <p className="text-sm text-gray-400 mb-6 capitalize">
              Incoming {incomingCall.callType} call...
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={answerCall}
                className="flex-1 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-white"
              >
                <Phone size={20} /> Accept
              </button>
              <button
                onClick={endCall}
                className="flex-1 bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-white"
              >
                <PhoneOff size={20} /> Reject
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE CALL INTERFACE */}
        {callAccepted && (
          <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[10000]">
            {isConnecting && (
              <div className="absolute top-4 bg-yellow-600/20 border border-yellow-600 px-4 py-2 rounded-lg text-sm text-yellow-300 animate-pulse z-[10001]">
                🔌 Connecting Securely...
              </div>
            )}

            <div className="relative w-full h-full flex items-center justify-center p-4">
              {/* REMOTE MEDIA ELEMENT */}
               <div className={`relative w-full h-full max-w-6xl aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl ${callType === "video" ? "block" : "flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900"}`}>
                 <video
                   ref={remoteVideoRef}
                   autoPlay
                   playsInline
                   className={`w-full h-full object-cover ${callType === "video" ? "block" : "absolute opacity-0 pointer-events-none w-1 h-1"}`}
                 />
                 
                 {/* Audio Call UI Overlay */}
                 {callType !== "video" && (
                   <div className="flex flex-col items-center justify-center w-full h-full">
                     <div className="absolute inset-0 opacity-20">
                       <div className="absolute inset-0 bg-blue-500 animate-pulse blur-3xl"></div>
                     </div>
                     <img
                       src={targetUser?.profilePic || "https://via.placeholder.com/150"}
                       className="w-32 h-32 rounded-full border-4 border-blue-500 mb-6 object-cover relative z-10 shadow-2xl"
                       alt=""
                     />
                     <h2 className="text-3xl font-bold text-white relative z-10 mb-2">{targetUser?.fullName}</h2>
                     <div className="flex items-center gap-2 relative z-10">
                       <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                       <p className="text-blue-400 font-medium">Active Audio Call</p>
                     </div>
                   </div>
                 )}

                 <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm backdrop-blur-md z-10">
                   {targetUser?.fullName || "Remote User"}
                 </div>
               </div>

               {/* LOCAL MEDIA ELEMENT */}
               <div className={`absolute top-8 right-8 w-48 aspect-video bg-gray-800 rounded-xl overflow-hidden shadow-xl border-2 border-gray-700 ${callType === "video" ? "block" : "hidden"}`}>
                 <video
                   ref={myVideoRef}
                   autoPlay
                   playsInline
                   muted
                   className="w-full h-full object-cover"
                 />
                 <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded text-white text-[10px]">
                   You
                 </div>
               </div>

               {/* HIDDEN LOCAL VIDEO FOR AUDIO CALLS (to keep ref attached) */}
               {callType !== "video" && (
                 <video ref={myVideoRef} muted autoPlay playsInline className="absolute opacity-0 pointer-events-none w-1 h-1" />
               )}

              {/* CONTROLS */}
              <div className="absolute bottom-10 flex gap-6 z-[10001] items-center">
                <button
                  onClick={toggleMic}
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95 ${
                    isMicOn ? "bg-gray-700 text-white" : "bg-red-500 text-white"
                  }`}
                  title={isMicOn ? "Mute Mic" : "Unmute Mic"}
                >
                  {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                </button>

                <button
                  onClick={endCall}
                  className="bg-red-600 hover:bg-red-700 w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-transform hover:scale-110 active:scale-95"
                  title="End Call"
                >
                  <PhoneOff size={28} />
                </button>

                {callType === "video" && (
                  <button
                    onClick={toggleVideo}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95 ${
                      isVideoOn ? "bg-gray-700 text-white" : "bg-red-500 text-white"
                    }`}
                    title={isVideoOn ? "Turn Off Video" : "Turn On Video"}
                  >
                    {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {callError && (
          <div className="bg-red-900/90 border border-red-700 p-6 rounded-xl text-center max-w-sm shadow-2xl backdrop-blur-md">
            <p className="text-white mb-4 font-medium">{callError}</p>
            <button
              onClick={() => setCallError(null)}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallModal;
