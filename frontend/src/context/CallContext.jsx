import { createContext, useContext } from "react";
import { useWebRTC } from "../hooks/useWebRTC";

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const callData = useWebRTC();

  // Debug logging for context state changes
  if (callData.incomingCall) {
    console.log("[CONTEXT] Incoming call detected in provider:", callData.incomingCall.from);
  }
  if (callData.callAccepted) {
    console.log("[CONTEXT] Call accepted state in provider");
  }

  return (
    <CallContext.Provider value={callData}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};
