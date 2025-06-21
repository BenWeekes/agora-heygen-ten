// VideoAvatarView.js - Component for displaying video avatar from Agora RTC
import React from "react";

/**
 * Component to display the Video Avatar with integrated toast notifications
 */
export const VideoAvatarView = ({
  isAppConnected,
  isConnectInitiated,
  isAvatarLoaded,
  loadProgress,
  videoAvatarConfig,
  videoAvatarRef,
  eventCallbacks,
  children,
  isFullscreen,
  toggleFullscreen,
  toast, // Add toast prop here
  isPureChatMode = false,
}) => {
  return (
    <div className={`avatar-container ${isFullscreen ? "fullscreen" : ""}`}>
      {/* Fullscreen toggle button - hidden when not connected */}
      {isAppConnected && (
        <button
          className={`fullscreen-button`}
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isFullscreen ? (
              // Minimize icon
              <>
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </>
            ) : (
              // Maximize icon
              <>
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </>
            )}
          </svg>
        </button>
      )}


      {/* Video Avatar container - show when connected (video will appear from Agora RTC) */}
      <div 
        className={`video-avatar ${!isAppConnected ? "hidden" : ""}`}
        id="mainvideo"
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          backgroundColor: "#000000"
        }}
      >
        {/* Video elements will be dynamically added here by Agora RTC */}
        {/* Audio elements will also be added here for audio playback */}
      </div>

      {/* Loading overlay - show when connecting but no video received yet */}
      {/* This will be hidden automatically when video starts coming from Agora */}
      {isConnectInitiated && !isAvatarLoaded && !isPureChatMode && (
        <div className="loading-overlay">
          <div className="progress-bar">
            <div
              className="progress-indicator"
              style={{ width: `${Math.max(loadProgress * 100, 30)}%` }}
            />
          </div>
        </div>
      )}

      {/* Render children */}
      {children}
      <div id="floating-input"></div>
    </div>
  );
};