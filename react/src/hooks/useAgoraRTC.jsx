import { useState, useCallback, useEffect } from 'react';
import AgoraRTC from "agora-rtc-sdk-ng";
import { ConnectionState } from "../utils/connectionState";
import { callNativeAppFunction } from '../utils/nativeBridge';

/**
 * Custom hook for managing Agora RTC functionality
 */
export function useAgoraRTC({
  agoraConfig,
  derivedChannelName,
  updateConnectionState,
  showToast,
  agoraClientRef,
  videoAvatarRef
}) {
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasReceivedVideo, setHasReceivedVideo] = useState(false);

  const initializeAgoraClient = useCallback((
    agoraClientRef,
    videoAvatarRef
  ) => {
    if (agoraClientRef.current) {
      console.warn("Agora client already initialized. Skipping.");
      return () => {};
    }
  
    // Create Agora client
    agoraClientRef.current = AgoraRTC.createClient();
  
    // Set up event listeners
    agoraClientRef.current.on("user-published", async (user, mediaType) => {
      callNativeAppFunction("agoraUserPublished");
      console.log("User published:", user.uid, mediaType, user);
  
      if (user.uid) {
        await agoraClientRef.current.subscribe(user, mediaType);
      } else {
        return;
      }
  
      if (mediaType === "audio") {
        console.log("Audio track received - playing audio");
        // Create audio element and play the audio track
        let audioNode = document.getElementById("audio_" + user.uid);
        if (!audioNode) {
          audioNode = document.createElement("div");
          audioNode.setAttribute("id", "audio_" + user.uid);
          audioNode.style.display = "none"; // Hide audio element
          
          const mainVideoContainer = document.getElementById("mainvideo");
          if (mainVideoContainer) {
            mainVideoContainer.appendChild(audioNode);
          }
        }
        // Play audio track
        user.audioTrack.play(audioNode);
      } else if (mediaType === "video") {
        console.log("Video track received - this indicates avatar is ready");
        
        // Mark that we've received video (avatar is ready)
        setHasReceivedVideo(true);
        
        // Update connection state to indicate avatar is loaded and connected
        updateConnectionState(ConnectionState.AVATAR_LOADED);
        updateConnectionState(ConnectionState.AVATAR_CONNECTED);
        
        // Handle video track - play it in the video avatar container
        let videoNode = document.getElementById("video_" + user.uid);
        if (!videoNode) {
          videoNode = document.createElement("div");
          videoNode.setAttribute("id", "video_" + user.uid);
          videoNode.style.width = "100%";
          videoNode.style.height = "100%";
          videoNode.style.position = "absolute";
          videoNode.style.top = "0";
          videoNode.style.left = "0";
          
          const mainVideoContainer = document.getElementById("mainvideo");
          if (mainVideoContainer) {
            mainVideoContainer.appendChild(videoNode);
          }
        }
        user.videoTrack.play(videoNode);
      }
    });
  
    // Handle user unpublished event
    agoraClientRef.current.on("user-unpublished", (user, mediaType) => {
      callNativeAppFunction("agoraUserUnpublished", { user, mediaType });
      if (mediaType === "video") {
        // Remove the video element
        const videoNode = document.getElementById("video_" + user.uid);
        if (videoNode) {
          videoNode.remove();
        }
        
        // Reset video received state when video stops
        setHasReceivedVideo(false);
        updateConnectionState(ConnectionState.AVATAR_DISCONNECT);
      } else if (mediaType === "audio") {
        // Remove the audio element
        const audioNode = document.getElementById("audio_" + user.uid);
        if (audioNode) {
          audioNode.remove();
        }
      }
    });
  
    agoraClientRef.current.on("user-joined", () => {
      callNativeAppFunction("agoraUserJoined");
    });
  
    agoraClientRef.current.on("user-left", (user) => {
      callNativeAppFunction("agoraUserLeft");
      // Clean up video element when user leaves
      const videoNode = document.getElementById("video_" + user.uid);
      if (videoNode) {
        videoNode.remove();
      }
      // Clean up audio element when user leaves
      const audioNode = document.getElementById("audio_" + user.uid);
      if (audioNode) {
        audioNode.remove();
      }
      
      // Reset states when user leaves
      setHasReceivedVideo(false);
      updateConnectionState(ConnectionState.AVATAR_DISCONNECT);
    });
  
    // Cleanup function
    return () => {
      if (agoraClientRef.current) {
        agoraClientRef.current.leave();
      }
    }
  }, [updateConnectionState]);

  // Initialize Agora client once
  useEffect(() => {
    const cleanupAgora = initializeAgoraClient(agoraClientRef, videoAvatarRef);
    return cleanupAgora;
    // Dependencies are intentionally omitted as we only want this to run once
    // agoraClientRef and videoAvatarRef are refs and don't need to be in dependencies
    // initializeAgoraClient is memoized and stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeAgoraClient]);

  const requestMicrophonePermission = useCallback(async () => {
    try {
      await AgoraRTC.createMicrophoneAudioTrack();
    } catch (error) {
      // showToast("Microphone Access Denied", null, true)
      showToast("Mic Access Needed", "Enable mic permission.", true);
      return false
    }
    return true
  }, [showToast])

  // Function to connect to Agora RTC
  const connectToAgoraRTC = useCallback(async (token, uid) => {
    updateConnectionState(ConnectionState.AGORA_CONNECTING);
    
    try {
      const numericUid = uid ? parseInt(uid, 10) : 0;
      
      // Join the channel
      await agoraClientRef.current.join(
        agoraConfig.appId,
        derivedChannelName,
        token,
        numericUid
      );
      
      console.log("Joined Agora RTC channel successfully with UID:", numericUid);
      
      (async () => {
        try {
          // Create microphone track
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          setLocalAudioTrack(audioTrack);
          
          // Publish the audio track
          await agoraClientRef.current.publish([audioTrack]);
          setIsMuted(false)
        } catch (error) {
          console.warn("Could not create/publish audio track:", error);
          setIsMuted(true)
        }
      })()
      
      updateConnectionState(ConnectionState.AGORA_CONNECTED);
      
      return true;
    } catch (error) {
      console.error("Error connecting to Agora RTC:", error);
      
      if (error.message && error.message.includes("Permission denied")) {
        // we have already alert the user
      } else {
        showToast("Connection Error", error.message, true);
      }
      
      return false;
    }
  }, [agoraConfig.appId, derivedChannelName, updateConnectionState, showToast, agoraClientRef]);

  // Function to disconnect from Agora RTC
  const disconnectFromAgoraRTC = useCallback(async () => {
    if (localAudioTrack) {
      localAudioTrack.close();
      setLocalAudioTrack(null);
    }
    
    // Reset video state
    setHasReceivedVideo(false);
    
    // Clean up all video and audio elements
    const mainVideoContainer = document.getElementById("mainvideo");
    if (mainVideoContainer) {
      const videoElements = mainVideoContainer.querySelectorAll('[id^="video_"]');
      const audioElements = mainVideoContainer.querySelectorAll('[id^="audio_"]');
      videoElements.forEach(element => element.remove());
      audioElements.forEach(element => element.remove());
    }
    
    if (agoraClientRef.current) {
      try {
        await agoraClientRef.current.leave();
        updateConnectionState(ConnectionState.AGORA_DISCONNECT)
        updateConnectionState(ConnectionState.AVATAR_DISCONNECT);
      } catch (error) {
        console.error("Error leaving Agora channel:", error);
      }
    }
  }, [localAudioTrack, agoraClientRef, updateConnectionState]);

  // Function to toggle microphone mute/unmute
  const toggleMute = useCallback(() => {
    if (localAudioTrack) {
      const newMuteState = !isMuted;
      localAudioTrack.setMuted(newMuteState);
      setIsMuted(newMuteState);
    } else {
      showToast("Mic Access Needed", "Enable mic permission.", true);
    }
  }, [localAudioTrack, isMuted, showToast]);

  return {
    localAudioTrack,
    isMuted,
    hasReceivedVideo,
    connectToAgoraRTC,
    disconnectFromAgoraRTC,
    toggleMute,
    requestMicrophonePermission
  };
}