import { useCallback, useMemo, useRef } from "react";
import { processMessageCommands } from "../utils/videoAvatarUtils";
import { callNativeAppFunction } from "../utils/nativeBridge";

export default function useVideoAvatarManager({
  showToast,
  setLoadProgress,
  updateConnectionState,
  eventHandler = {}
}) {
  const videoAvatarRef = useRef(null);

  const eventHandlerRef = useRef();
  eventHandlerRef.current = eventHandler;

  // Since we're not using Trulience avatars anymore, we'll create simplified event handlers
  // that don't actually connect to a video avatar service but still maintain the interface
  const avatarEventHandlers = useMemo(() => {
    const eventHandler = eventHandlerRef.current
    return ({
    ...eventHandler,
    "auth-success": (data) => {
      console.log("Avatar auth success (simulated):", data);
      eventHandler["auth-success"]?.(data)
      callNativeAppFunction("avatarAuthSuccess", data);
    },
    "auth-fail": (data) => {
      console.log("Avatar auth fail (simulated):", data);
      showToast("Authentication Failed", data.message, true);
      eventHandler["auth-fail"]?.(data)
      callNativeAppFunction("avatarAuthFail", data);
    },
    "websocket-connect": (data) => {
      console.log("Avatar WebSocket connected (simulated):", data);
      eventHandler["websocket-connect"]?.(data)
      callNativeAppFunction("avatarWebsocketConnect", data);
      // Note: We don't update AVATAR_CONNECTED here anymore - that happens when we receive video from Agora
    },
    "websocket-close": (data) => {
      console.log("Avatar WebSocket closed (simulated):", data);
      eventHandler["websocket-close"]?.(data)
      callNativeAppFunction("avatarWebsocketClose", data);
    },
    "websocket-message": (msg) => {
      console.log("Avatar WebSocket message (simulated):", msg);
      eventHandler["websocket-message"]?.(msg)
      callNativeAppFunction("avatarWebsocketMessage", msg);
    },
    "load-progress": ({ progress, ...details }) => {
      console.log("Avatar load progress (simulated):", progress);
      eventHandler["load-progress"]?.({ progress, ...details })
      setLoadProgress(progress);
      // Note: We don't update AVATAR_LOADED here anymore - that happens when we receive video from Agora
      callNativeAppFunction("avatarLoadProgress", { progress, ...details });
    },
    "mic-update": (data) => {
      console.log("Avatar mic update (simulated):", data);
      eventHandler["mic-update"]?.(data)
      callNativeAppFunction("avatarMicUpdate",data)
    },
    "mic-access": (data) => {
      console.log("Avatar mic access (simulated):", data);
      eventHandler["mic-access"]?.(data)
      callNativeAppFunction("avatarMicAccess", data)
    },
    "speaker-update": (data) => {
      console.log("Avatar speaker update (simulated):", data);
      eventHandler["speaker-update"]?.(data)
      callNativeAppFunction("avatarSpeakerUpdate", data)
    },
    "avatar-chat": (data) => {
      console.log("Avatar chat (simulated):", data);
      eventHandler["avatar-chat"]?.(data)
      callNativeAppFunction("avatarChat", data)
    },
    "avatar-status-update": (data) => {
      console.log("Avatar status update (simulated):", data);
      eventHandler["avatar-status-update"]?.(data)
    }
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [showToast, setLoadProgress]);


  // Function to send message to video avatar (now just a placeholder since we're using Agora RTC directly)
  const sendMessageToAvatar = useCallback((message) => {
    // Since we're not using Trulience avatars anymore, this is just a placeholder
    // Messages are now sent through RTM directly to the agent
    console.log("Sending message to avatar (via RTM):", message);
    return true;
  }, []);


  // Process message and handle any commands
  const processAndSendMessageToAvatar = useCallback((message, contextId = "") => {
    return processMessageCommands(message, sendMessageToAvatar, contextId);
  }, [sendMessageToAvatar]);


  const resetAvatarToDefault = useCallback(() => {
    // Since we're not using Trulience avatars anymore, this is just a placeholder
    console.log("Avatar reset triggered (placeholder)");
  }, []);


  return {
    videoAvatarRef,
    avatarEventHandlers,
    sendMessageToAvatar,
    processAndSendMessageToAvatar,
    resetAvatarToDefault
  }
}