import { useCallback, useMemo, useRef } from "react";
import { processMessageCommands } from "../utils/videoAvatarUtils";
import { callNativeAppFunction } from "../utils/nativeBridge";
import { ConnectionState } from "../utils/connectionState";

export default function useVideoAvatarManager({
  showToast,
  setLoadProgress,
  updateConnectionState,
  eventHandler = {}
}) {
  const videoAvatarRef = useRef(null);

  const eventHandlerRef = useRef();
  eventHandlerRef.current = eventHandler;

  // Video Avatar Event Handler
  const avatarEventHandlers = useMemo(() => {
    const eventHandler = eventHandlerRef.current
    return ({
    ...eventHandler,
    "auth-success": (data) => {
      console.log("Avatar auth success:", data);
      eventHandler["auth-success"]?.(data)
      callNativeAppFunction("avatarAuthSuccess", data);
    },
    "auth-fail": (data) => {
      showToast("Authentication Failed", data.message, true);
      eventHandler["auth-fail"]?.(data)
      callNativeAppFunction("avatarAuthFail", data);
    },
    "websocket-connect": (data) => {
      console.log("Avatar WebSocket connected:", data);
      eventHandler["websocket-connect"]?.(data)
      callNativeAppFunction("avatarWebsocketConnect", data);
      updateConnectionState(ConnectionState.AVATAR_CONNECTED);
    },
    "websocket-close": (data) => {
      eventHandler["websocket-close"]?.(data)
      callNativeAppFunction("avatarWebsocketClose", data);
    },
    "websocket-message": (msg) => {
      eventHandler["websocket-message"]?.(msg)
      callNativeAppFunction("avatarWebsocketMessage", msg);
    },
    "load-progress": ({ progress, ...details }) => {
      eventHandler["load-progress"]?.({ progress, ...details })
      setLoadProgress(progress);
      if (progress >= 1) {
        updateConnectionState(ConnectionState.AVATAR_LOADED);
      }
      callNativeAppFunction("avatarLoadProgress", { progress, ...details });
    },
    "mic-update": (data) => {
      eventHandler["mic-update"]?.(data)
      callNativeAppFunction("avatarMicUpdate",data)
    },
    "mic-access": (data) => {
      eventHandler["mic-access"]?.(data)
      callNativeAppFunction("avatarMicAccess", data)
    },
    "speaker-update": (data) => {
      eventHandler["speaker-update"]?.(data)
      callNativeAppFunction("avatarSpeakerUpdate", data)
    },
    "avatar-chat": (data) => {
      eventHandler["avatar-chat"]?.(data)
      callNativeAppFunction("avatarChat", data)
    },
    "avatar-status-update": (data) => {
      eventHandler["avatar-status-update"]?.(data)
    }
  })
}, [showToast, setLoadProgress, updateConnectionState]);


  // Function to send message to video avatar (placeholder for now)
  const sendMessageToAvatar = useCallback((message) => {
    // For video avatar, we might send messages through RTM or other channels
    // This is a placeholder implementation
    console.log("Sending message to video avatar:", message);
    return true;
  }, []);


  // Process message and handle any commands
  const processAndSendMessageToAvatar = useCallback((message, contextId = "") => {
    return processMessageCommands(message, sendMessageToAvatar, contextId);
  }, [sendMessageToAvatar]);


  const resetAvatarToDefault = useCallback(() => {
    // For video avatar, we might send reset commands through RTM or other channels
    console.log("Avatar reset triggered");
  }, []);


  return {
    videoAvatarRef,
    avatarEventHandlers,
    sendMessageToAvatar,
    processAndSendMessageToAvatar,
    resetAvatarToDefault
  }
}