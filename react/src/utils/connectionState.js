export const initialConnectionState = {
  app: {
    loading: true,
    loaded: false,
    connectInitiated: false
  },
  avatar: {
    loading: false, // Changed: Not loading avatar from external service anymore
    loaded: false,  // Will be set to true when we receive video from Agora
    connecting: false,
    connected: false, // Will be set to true when we receive video from Agora
  },
  agent: {
    connecting: false,
    connected: false,
  },
  agora: {
    connecting: false,
    connected: false,
  },
  rtm: {
    connecting: false,
    connected: false,
  }
};

// Enum-like object for action types
export const ConnectionState = {
  APP_LOADED: 'APP_LOADED',
  APP_CONNECT_INITIATED: "APP_CONNECT_INITIATED",

  AVATAR_LOADING: 'AVATAR_LOADING',
  AVATAR_LOADED: 'AVATAR_LOADED',
  
  AVATAR_CONNECTING: 'AVATAR_CONNECTING',
  AVATAR_CONNECTED: 'AVATAR_CONNECTED',
  AVATAR_DISCONNECT: 'AVATAR_DISCONNECT',
  
  AGENT_CONNECTING: 'AGENT_CONNECTING',
  AGENT_CONNECTED: 'AGENT_CONNECTED',
  AGENT_DISCONNECT: 'AGENT_DISCONNECT',
  
  AGORA_CONNECTING: 'AGORA_CONNECTING',
  AGORA_CONNECTED: 'AGORA_CONNECTED',
  AGORA_DISCONNECT: 'AGORA_DISCONNECT',
  
  RTM_CONNECTING: 'RTM_CONNECTING',
  RTM_CONNECTED: 'RTM_CONNECTED',
  RTM_DISCONNECT: 'RTM_DISCONNECT',
  
  DISCONNECT: "DISCONNECT",
  DISCONNECTING: "DISCONNECTING"
};

// Helper function to compute full connection status
// Updated to reflect that avatar connection now depends on receiving video from Agora
export function checkIfFullyConnected(state) {
  return (
    state.avatar.connected &&  // This will be true when we receive video from Agora
    state.avatar.loaded &&    // This will be true when we receive video from Agora
    state.agent.connected &&  // Agent endpoint connected
    state.agora.connected     // Agora RTC connected
  );
}

// Reducer function
/**
 * 
 * @param {typeof initialConnectionState} state 
 * @param {*} action 
 * @returns 
 */
export function connectionReducer(state, action) {
  switch (action) {

    case ConnectionState.APP_LOADED:
      return {
        ...state,
        app: { ...state.app, loading: false, loaded: true },
      };

    case ConnectionState.APP_CONNECT_INITIATED:
      return {
        ...state,
        app: { ...state.app, connectInitiated: true },
      };

    // Avatar state handling - now tied to Agora video reception
    case ConnectionState.AVATAR_LOADING:
      return {
        ...state,
        avatar: { ...state.avatar, loading: true, loaded: false },
      };

    case ConnectionState.AVATAR_LOADED:
      return {
        ...state,
        avatar: { ...state.avatar, loading: false, loaded: true },
      };

    case ConnectionState.AVATAR_CONNECTING:
      return {
        ...state,
        avatar: { ...state.avatar, connecting: true },
      };

    case ConnectionState.AVATAR_CONNECTED: {
      return {
        ...state,
        avatar: { ...state.avatar, connecting: false, connected: true },
      };
    }

    case ConnectionState.AVATAR_DISCONNECT:
      return {
        ...state,
        avatar: { ...state.avatar, connected: false, connecting: false, loaded: false },
      };


    // Agent (LAMBDA Endpoint) state handling
    case ConnectionState.AGENT_CONNECTING:
      return { ...state, agent: { connecting: true, connected: false } };

    case ConnectionState.AGENT_CONNECTED: {
      return {
        ...state,
        agent: { connecting: false, connected: true },
      };
    }

    case ConnectionState.AGENT_DISCONNECT:
      return {
        ...state,
        agent: { connecting: false, connected: false }
      };


    // Agora RTC state
    case ConnectionState.AGORA_CONNECTING:
      return { ...state, agora: { connecting: true, connected: false } };

    case ConnectionState.AGORA_CONNECTED: {
      return {
        ...state,
        agora: { connecting: false, connected: true },
      };
    }
    case ConnectionState.AGORA_DISCONNECT:
      return {
        ...state,
        agora: { connecting: false, connected: false },
      };

    // RTM
    case ConnectionState.RTM_CONNECTING:
      return { ...state, rtm: { connecting: true, connected: false } };

    case ConnectionState.RTM_CONNECTED: {
      return {
        ...state,
        rtm: { connecting: false, connected: true },
      };
    }
    
    case ConnectionState.RTM_DISCONNECT:
      return {
        ...state,
        rtm: { connecting: false, connected: false }
      };

    case ConnectionState.DISCONNECTING:
      return { 
        ...state,
        app: { ...state.app, connectInitiated: false }
      };

    case ConnectionState.DISCONNECT:
      return { 
        ...state,
        app: { ...state.app, connectInitiated: false },
        rtm: { connecting: false, connected: false },
        agent: { connecting: false, connected: false },
        agora: { connecting: false, connected: false },
        avatar: { ...state.avatar, connected: false, loaded: false } // Reset avatar state on disconnect
      };

    case ConnectionState.RESET_STATE:
      return { ...initialConnectionState };

    default:
      return state;
  }
}