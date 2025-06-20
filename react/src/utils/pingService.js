/**
 * Service for sending periodic ping messages to the agent endpoint
 */

// Generate a random UUID v4
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
};

export class PingService {
  constructor() {
    this.intervalId = null;
    this.isActive = false;
    this.channelName = null;
    this.pingEndpoint = process.env.REACT_APP_PING_ENDPOINT;
    this.pingInterval = 30000; // 30 seconds default
  }

  /**
   * Start sending ping messages
   * @param {string} channelName - The channel name to ping for
   * @param {number} intervalMs - Ping interval in milliseconds (default: 30000)
   */
  start(channelName, intervalMs = 30000) {
    if (this.isActive) {
      console.log("Ping service already active, stopping previous instance");
      this.stop();
    }

    if (!this.pingEndpoint) {
      console.warn("Ping endpoint not configured, skipping ping service");
      return;
    }

    this.channelName = channelName;
    this.pingInterval = intervalMs;
    this.isActive = true;

    console.log(`Starting ping service for channel: ${channelName}, interval: ${intervalMs}ms`);

    // Send initial ping immediately
    this.sendPing();

    // Set up interval for subsequent pings
    this.intervalId = setInterval(() => {
      this.sendPing();
    }, this.pingInterval);
  }

  /**
   * Stop sending ping messages
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isActive = false;
    this.channelName = null;
    console.log("Ping service stopped");
  }

  /**
   * Send a single ping message
   */
  async sendPing() {
    if (!this.isActive || !this.channelName || !this.pingEndpoint) {
      return;
    }

    const requestId = generateUUID();
    const payload = {
      request_id: requestId,
      channel_name: this.channelName
    };

    try {
      console.log(`Sending ping to ${this.pingEndpoint}:`, payload);
      
      const response = await fetch(this.pingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Ping successful for channel ${this.channelName}:`, result);
      } else {
        console.warn(`Ping failed with status ${response.status} for channel ${this.channelName}`);
      }
    } catch (error) {
      console.error(`Ping error for channel ${this.channelName}:`, error);
    }
  }

  /**
   * Check if ping service is currently active
   */
  isRunning() {
    return this.isActive;
  }

  /**
   * Get current channel name being pinged
   */
  getCurrentChannel() {
    return this.channelName;
  }
}

// Export a singleton instance
export const pingService = new PingService();