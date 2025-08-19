// src/hooks/useAppConfig.js
import { useState, useMemo, useEffect } from "react";
import { getParamsFromUrl, generateRandomChannelName } from "../utils/agoraUtils";
import { NativeBridge } from "../utils/nativeBridge";

export const useAppConfig = () => {
  const urlParams = useMemo(() => getParamsFromUrl(), []);
  const nativeBridge = useMemo(() => new NativeBridge(), []);

  const [agoraConfig, setAgoraConfig] = useState(() => ({
    appId: process.env.REACT_APP_AGORA_APP_ID,
    channelName: urlParams.channelName ?? process.env.REACT_APP_AGORA_CHANNEL_NAME,
    token: process.env.REACT_APP_AGORA_TOKEN || null,
    uid: urlParams.name || process.env.REACT_APP_AGORA_UID || null, // Use name if provided
    name: urlParams.name || null, // Store name separately too
    voice_id: urlParams.voice_id || null,
    prompt: urlParams.prompt || null,
    greeting: urlParams.greeting || null,
    profile: urlParams.profile || null,
    endpoint: urlParams.endpoint  ?? process.env.REACT_APP_AGENT_ENDPOINT,
  }));

  const [videoAvatarConfig, setVideoAvatarConfig] = useState(() => ({
    avatarId: urlParams.avatarId ?? process.env.REACT_APP_VIDEO_AVATAR_ID,
    profileBase: process.env.REACT_APP_VIDEO_AVATAR_PROFILE_BASE || null,
  }));

  const derivedChannelName = useMemo(() => {
    if (agoraConfig.channelName === "random") {
      return generateRandomChannelName();
    }
    return agoraConfig.channelName;
  }, [agoraConfig.channelName]);

  // Debugging logs
  useEffect(() => {
    if (!process.env.REACT_APP_AGORA_APP_ID) {
      console.error(
        "Missing Agora App ID. Set REACT_APP_AGORA_APP_ID in your .env file"
      );
    }
    console.log("URL Parameters:", urlParams);
    console.log("Continue param:", urlParams.continue);
    console.log("Name param:", urlParams.name);
    console.log("Content params:", {
      type: urlParams.contentType,
      url: urlParams.contentURL,
      alt: urlParams.contentALT
    });
  }, [urlParams]);

  useEffect(() => {
    const handleAgoraDetailsUpdated = (data) => {
      const { appId, channelName, uid, voice_id, prompt, greeting, profile, endpoint, name } = data;
      setAgoraConfig(_agoraConfig => ({
        ..._agoraConfig,
        appId,
        channelName,
        uid: name || uid, // Prefer name if provided
        name: name || _agoraConfig.name, // Update name if provided
        voice_id,
        prompt,
        greeting,
        profile,
        endpoint
      }));
    };

    const handleVideoAvatarDetailsUpdated = ({ avatarId }) => {
      setVideoAvatarConfig(config => ({ ...config, avatarId }));
    };

    if (nativeBridge) {
      nativeBridge.on("agoraDetailsUpdated", handleAgoraDetailsUpdated);
      nativeBridge.on("videoAvatarDetailsUpdated", handleVideoAvatarDetailsUpdated);
    }

    return () => {
      if (nativeBridge) {
        nativeBridge.off("agoraDetailsUpdated", handleAgoraDetailsUpdated);
        nativeBridge.off("videoAvatarDetailsUpdated", handleVideoAvatarDetailsUpdated);
      }
    };
  }, [nativeBridge]);

  return {
    urlParams,
    agoraConfig,
    setAgoraConfig,
    videoAvatarConfig,
    derivedChannelName,
  };
};