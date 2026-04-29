import React, { useEffect, useState } from "react";
import { useCall } from "../context/CallContext";
import { getMyFriends } from "../lib/api";
import { Phone, PhoneOff, Video } from "lucide-react";

const IncomingCallModal = () => {
  const { incomingCall, answerCall, endCall, setIncomingCall, setActiveUser, callAccepted } = useCall();
  const [caller, setCaller] = useState(null);

  useEffect(() => {
    if (incomingCall) {
      const fetchCallerInfo = async () => {
        try {
          const friends = await getMyFriends();
          const found = friends.find((f) => f._id === incomingCall.from);
          setCaller(found || { fullName: "Unknown User", _id: incomingCall.from });
        } catch (err) {
          console.error("Failed to fetch caller info", err);
          setCaller({ fullName: "Unknown User", _id: incomingCall.from });
        }
      };
      fetchCallerInfo();
      
      // Play ringtone logic could go here
    } else {
      setCaller(null);
    }
  }, [incomingCall]);

  if (!incomingCall || callAccepted) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl text-center max-w-sm w-full mx-4 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="mb-6">
          <div className="relative inline-block">
            {caller?.profilePic ? (
              <img
                src={caller.profilePic}
                alt={caller.fullName}
                className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-blue-500/30"
              />
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto bg-gray-800 flex items-center justify-center text-4xl border-4 border-blue-500/30">
                👤
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-blue-500 p-2 rounded-full animate-bounce">
              {incomingCall.callType === "video" ? <Video size={16} /> : <Phone size={16} />}
            </div>
          </div>
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-1">{caller?.fullName || "Incoming Call"}</h3>
        <p className="text-blue-400 text-sm font-medium mb-8 flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Incoming {incomingCall.callType} call...
        </p>
        
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => {
              console.log("[MODAL] Accept button clicked");
              setActiveUser(caller);
              answerCall();
            }}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
          >
            <Phone size={24} />
            <span>Accept</span>
          </button>
          <button
            onClick={() => {
                console.log("[MODAL] Decline button clicked");
                endCall();
            }}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
          >
            <PhoneOff size={24} />
            <span>Decline</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
