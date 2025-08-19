import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageEngine, MessageStatus } from "../utils/messageService";
import ExpandableChatInput from "./ExpandableChatInput";
import Logger from "../utils/logger";

// Create logger instance for this component
const logger = new Logger('[RtmChatPanel]');

/**
 * Shared function to process and filter RTM messages
 * Handles command processing and determines if message should be displayed in chat
 */
const processRtmMessage = (message, currentUserId, processMessage, urlParams, isConnectInitiated) => {
  // Use the message type field to determine if it's from agent
  const isFromAgent = message.type === 'agent' || 
                     (message.type !== 'user' && message.userId !== String(currentUserId) && !message.isOwn);
  
  // Only process commands for agent messages with text content
  if (isFromAgent && processMessage && message.contentType === 'text') {
    const shouldProcessCommands = !(urlParams.purechat && !isConnectInitiated);
    
    if (shouldProcessCommands) {
      const processedText = processMessage(message.content, message.turn_id || "");
      
      // If message becomes empty after command processing, don't display it
      if (processedText === "" || processedText.trim() === "") {
        logger.log("Message was entirely commands, not displaying:", message.content);
        return null; // Don't display this message
      }
      
      // Return message with processed content (commands removed)
      return {
        ...message,
        content: processedText
      };
    }
  }
  
  // Return message as-is for user messages or when not processing commands
  return message;
};

/**
 * Component for RTM chat interface with WhatsApp-like styling and typing indicators
 */
export const RtmChatPanel = ({
  rtmClient,
  rtmMessages,
  rtmJoined,
  agoraConfig,
  agoraClient,
  isConnectInitiated,
  processMessage,
  isFullscreen,
  registerDirectSend,
  urlParams,
  getMessageChannelName,
  agentRtmUid // Add this parameter
}) => {
  const [rtmInputText, setRtmInputText] = useState("");
  const [liveSubtitles, setLiveSubtitles] = useState([]);
  const [combinedMessages, setCombinedMessages] = useState([]);
  const [pendingRtmMessages, setPendingRtmMessages] = useState([]);
  const [preservedSubtitleMessages, setPreservedSubtitleMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [rtmReceivedMessages, setRtmReceivedMessages] = useState(new Set()); // Track messages received via RTM listener
  const rtmMessageEndRef = useRef(null);
  const messageEngineRef = useRef(null);

  const floatingInput = document.getElementById("floating-input");
  const staticInput = document.getElementById("static-input");

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Determine if we're in purechat mode
  const isPureChatMode = urlParams?.purechat === true;

  // Determine if chat should be enabled - either connected normally OR purechat mode with RTM
  const isChatEnabled = isConnectInitiated || (isPureChatMode && rtmClient);

  // Handle disconnection in purechat mode - preserve messages
  useEffect(() => {
    if (isPureChatMode && !isConnectInitiated && liveSubtitles.length > 0) {
      logger.log("Preserving subtitle messages on purechat disconnect:", liveSubtitles.length);
      
      const messagesToPreserve = liveSubtitles.filter(msg => {
        const messageText = msg.text || (msg.metadata && msg.metadata.text) || "";
        return messageText && messageText.trim().length > 0;
      });
      
      if (messagesToPreserve.length > 0) {
        setPreservedSubtitleMessages(prevPreserved => {
          const newCompleted = messagesToPreserve.filter(newMsg => 
            !prevPreserved.some(preserved => 
              preserved.message_id === newMsg.message_id || 
              (preserved.turn_id === newMsg.turn_id && preserved.uid === newMsg.uid && 
               preserved.text === (newMsg.text || (newMsg.metadata && newMsg.metadata.text) || ""))
            )
          );
          logger.log("Adding", newCompleted.length, "new preserved messages");
          return [...prevPreserved, ...newCompleted];
        });
      }
      
      setLiveSubtitles([]);
    }
  }, [isPureChatMode, isConnectInitiated, liveSubtitles]);

  const directSendMessage = useCallback(async (message, skipHistory = false, channel = null) => {
    if (!message.trim()) return false;

    try {
      const targetChannel = channel || (getMessageChannelName ? getMessageChannelName() : '') || '';
      
      // Use agentRtmUid if available, otherwise fall back to the old format
      const publishTarget = agentRtmUid || (targetChannel ? `agent-${targetChannel}` : 'agent');
      
      logger.log("Direct send using rtmClient:", !!rtmClient, "Skip history:", skipHistory, "Target:", publishTarget);
      
      if (rtmClient) {
        const options = {
          customType: "user.transcription",
          channelType: "USER",
        };
        
        const messagePayload = JSON.stringify({
          message: message.trim(),
          priority: "APPEND"
       });
        
        await rtmClient.publish(publishTarget, messagePayload, options);
   
        logger.log("Message sent successfully via direct send to:", publishTarget);

        // Only add to local history if:
        // 1. Not explicitly skipping history AND
        // 2. We're in purechat mode without full agent connection
        const shouldAddToHistory = !skipHistory && (isPureChatMode && !isConnectInitiated);
        
        if (shouldAddToHistory) {
          logger.log("Adding user message to local history (purechat mode)");
          setPendingRtmMessages((prev) => [...prev, {
            type: "user",
            time: Date.now(),
            content: message.trim(),
            contentType: "text",
            userId: String(agoraConfig.uid),
            isOwn: true,
            fromRtmListener: false
          }]);
        } else {
          logger.log("Not adding to local history - message will echo back from agent or skipHistory=true");
        }

        return true;
      } else {
        logger.error("Direct send failed - rtmClient not available");
        return false;
      }
    } catch (error) {
      logger.error("Failed to send message via direct send:", error);
      return false;
    }
  }, [rtmClient, agoraConfig.uid, getMessageChannelName, isPureChatMode, isConnectInitiated, agentRtmUid]);  

  // Register the direct send function when available
  useEffect(() => {
    if (registerDirectSend && rtmClient) {
      logger.log("Registering direct send function with rtmClient");
      registerDirectSend(directSendMessage);
    }
  }, [registerDirectSend, rtmClient, directSendMessage]);

  const handleRtmMessageCallback = useCallback(
    (event) => {
      logger.log('[RTM] Raw message event received:', {
        channelName: event.channelName,
        publisher: event.publisher,
        messageType: event.messageType,
        timestamp: event.timestamp,
        messagePreview: event.message?.substring(0, 100)
      });
      
      try {
        const { message, messageType, timestamp, publisher } = event;
        
        // Create a unique key for this message
        const messageKey = `${publisher}-${timestamp}-${message?.substring(0, 50)}`;
        
        // Check if we've already processed this exact message
        if (rtmReceivedMessages.has(messageKey)) {
          logger.log('[RTM] Skipping already processed message:', messageKey);
          return;
        }
        
        // Mark this message as received
        setRtmReceivedMessages(prev => new Set([...prev, messageKey]));
        
        // Parse message first to determine actual sender
        let parsedMsg = null;
        let actualMessageType = null;
        
        if (messageType === "STRING") {
          try {
            parsedMsg = JSON.parse(message);
            
            // CRITICAL: Determine actual message type from transcription object
            if (parsedMsg.object === "user.transcription") {
              actualMessageType = 'user';
              logger.log('[RTM] Detected USER transcription despite publisher:', publisher);
            } else if (parsedMsg.object === "assistant.transcription") {
              actualMessageType = 'agent';
              logger.log('[RTM] Detected AGENT transcription from publisher:', publisher);
            }
          } catch (e) {
            // Not JSON, will process as plain text later
          }
        }
        
        // Only use publisher-based detection if we couldn't determine from content
        const isFromAgentByPublisher = publisher !== String(agoraConfig.uid);
        const effectiveType = actualMessageType || (isFromAgentByPublisher ? 'agent' : 'user');
        
        logger.log('[RTM] Message type determination:', {
          publisher,
          currentUserId: String(agoraConfig.uid),
          isFromAgentByPublisher,
          actualMessageType,
          effectiveType,
          transcriptionObject: parsedMsg?.object
        });
        
        if (messageType === "STRING") {
          let messageToProcess = null;
          
          if (parsedMsg) {
            // Handle transcription messages
            if (parsedMsg.object === "user.transcription" || parsedMsg.object === "assistant.transcription") {
              const isUserTranscription = parsedMsg.object === "user.transcription";
              
              // Check for duplicates based on content and timing
              const isDuplicate = pendingRtmMessages.some(msg => 
                msg.content === parsedMsg.text &&
                msg.type === (isUserTranscription ? 'user' : 'agent') &&
                Math.abs(msg.time - timestamp) < 2000 // Within 2 seconds
              );
              
              if (isDuplicate) {
                logger.log('[RTM] Skipping duplicate transcription:', parsedMsg.text);
                return;
              }
              
              // Create message with DEFINITIVE type from transcription object
              messageToProcess = {
                type: isUserTranscription ? 'user' : 'agent',
                time: timestamp || Date.now(),
                content: parsedMsg.text || '',
                contentType: 'text',
                userId: isUserTranscription ? String(agoraConfig.uid) : publisher,
                isOwn: isUserTranscription, // ALWAYS true for user transcriptions
                turn_id: parsedMsg.turn_id,
                message_id: parsedMsg.message_id,
                fromRtmListener: true // Mark that this came from RTM listener
              };
              
              logger.log('[RTM] Created transcription message:', {
                type: messageToProcess.type,
                isOwn: messageToProcess.isOwn,
                content: messageToProcess.content.substring(0, 50)
              });
            }
            // Handle typing indicators
            else if (parsedMsg.type === "typing_start") {
              if (effectiveType === 'agent') {
                logger.log('[RTM] Agent typing indicator received');
                setTypingUsers(prev => new Set([...prev, publisher]));
                setTimeout(() => {
                  setTypingUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(publisher);
                    return newSet;
                  });
                }, 15000);
              }
              return;
            }
            // Handle image messages
            else if (parsedMsg.img) {
              messageToProcess = {
                type: effectiveType,
                time: timestamp || Date.now(),
                content: parsedMsg.img,
                contentType: 'image',
                userId: publisher,
                isOwn: effectiveType === 'user',
                fromRtmListener: true
              };
            }
            // Handle text messages from JSON (without explicit transcription type)
            else if (parsedMsg.text !== undefined) {
              messageToProcess = {
                type: effectiveType,
                time: timestamp || Date.now(),
                content: parsedMsg.text,
                contentType: 'text',
                userId: publisher,
                isOwn: effectiveType === 'user',
                turn_id: parsedMsg.turn_id,
                fromRtmListener: true
              };
            }
            // Handle other JSON messages
            else {
              messageToProcess = {
                type: effectiveType,
                time: timestamp || Date.now(),
                content: message,
                contentType: 'text',
                userId: publisher,
                isOwn: effectiveType === 'user',
                fromRtmListener: true
              };
            }
            
          } else {
            // Not valid JSON, treat as plain text
            messageToProcess = {
              type: effectiveType,
              time: timestamp || Date.now(),
              content: message,
              contentType: 'text',
              userId: publisher,
              isOwn: effectiveType === 'user',
              fromRtmListener: true
            };
          }
          
          // Process the message through shared logic
          if (messageToProcess) {
            logger.log('[RTM] Processing message for display:', {
              type: messageToProcess.type,
              isOwn: messageToProcess.isOwn,
              contentPreview: messageToProcess.content.substring(0, 30)
            });
            
            // Clear typing indicator for any real message from agent
            if (messageToProcess.type === 'agent') {
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(publisher);
                return newSet;
              });
            }
            
            const processedMessage = processRtmMessage(
              messageToProcess, 
              agoraConfig.uid, 
              processMessage, 
              urlParams, 
              isConnectInitiated
            );
            
            if (processedMessage) {
              logger.log('[RTM] Adding to pending messages:', {
                type: processedMessage.type,
                isOwn: processedMessage.isOwn
              });
              setPendingRtmMessages(prev => [...prev, processedMessage]);
            } else {
              logger.log('[RTM] Message filtered out (commands only)');
            }
          }
          return;
        }
        
        // Handle binary messages
        if (messageType === "BINARY") {
          try {
            const decoder = new TextDecoder("utf-8");
            const decodedMessage = decoder.decode(message);
            
            // Clear typing indicator
            if (isFromAgentByPublisher) {
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(publisher);
                return newSet;
              });
            }
            
            let messageToProcess = null;
            
            try {
              const parsedMsg = JSON.parse(decodedMessage);
              
              // Check for transcription messages with explicit object type
              if (parsedMsg.object === "user.transcription" || parsedMsg.object === "assistant.transcription") {
                const isUserTranscription = parsedMsg.object === "user.transcription";
                
                // Check for duplicates
                const isDuplicate = pendingRtmMessages.some(msg => 
                  msg.content === parsedMsg.text &&
                  msg.type === (isUserTranscription ? 'user' : 'agent') &&
                  Math.abs(msg.time - timestamp) < 2000
                );
                
                if (isDuplicate) {
                  logger.log('[RTM] Skipping duplicate binary transcription:', parsedMsg.text);
                  return;
                }
                
                messageToProcess = {
                  type: isUserTranscription ? 'user' : 'agent',
                  time: timestamp || Date.now(),
                  content: parsedMsg.text || '',
                  contentType: 'text',
                  userId: isUserTranscription ? String(agoraConfig.uid) : publisher,
                  isOwn: isUserTranscription,
                  turn_id: parsedMsg.turn_id,
                  message_id: parsedMsg.message_id,
                  fromRtmListener: true
                };
              }
              else if (parsedMsg.text !== undefined) {
                messageToProcess = {
                  type: isFromAgentByPublisher ? 'agent' : 'user',
                  time: timestamp || Date.now(),
                  content: parsedMsg.text,
                  contentType: 'text',
                  userId: publisher,
                  isOwn: !isFromAgentByPublisher,
                  turn_id: parsedMsg.turn_id,
                  fromRtmListener: true
                };
              }
            } catch {
              // Not valid JSON, use decoded message as plain text
              messageToProcess = {
                type: isFromAgentByPublisher ? 'agent' : 'user',
                time: timestamp || Date.now(),
                content: decodedMessage,
                contentType: 'text',
                userId: publisher,
                isOwn: !isFromAgentByPublisher,
                fromRtmListener: true
              };
            }
            
            // Process through shared logic
            if (messageToProcess) {
              const processedMessage = processRtmMessage(
                messageToProcess, 
                agoraConfig.uid, 
                processMessage, 
                urlParams, 
                isConnectInitiated
              );
              
              if (processedMessage) {
                setPendingRtmMessages(prev => [...prev, processedMessage]);
              }
            }
          } catch (error) {
            logger.error("[RTM] Error processing binary message:", error);
          }
        }
      } catch (error) {
        logger.error("[RTM] Error processing RTM message:", error);
      }
    },
    [agoraConfig.uid, processMessage, urlParams, isConnectInitiated, pendingRtmMessages, rtmReceivedMessages]
  );

  // Initialize MessageEngine for subtitles with message processor
  useEffect(() => {
    if (isPureChatMode && !isConnectInitiated) {
      logger.log("Skipping MessageEngine initialization - purechat mode without agent connection");
      return;
    }

    if (!agoraClient) {
      logger.log("MessageEngine init blocked - no agoraClient");
      return;
    }
    
    if (messageEngineRef.current) {
      logger.log("MessageEngine init blocked - already exists");
      return;
    }
    
    if (!isConnectInitiated) {
      logger.log("MessageEngine init blocked - not connected");
      return;
    }
   
    logger.log("Initializing MessageEngine with client:", agoraClient, "purechat mode:", isPureChatMode);

    if (!messageEngineRef.current) {
      messageEngineRef.current = new MessageEngine(
        agoraClient,
        "auto",
        (messageList) => {
          logger.log(`Received ${messageList.length} subtitle messages (purechat: ${isPureChatMode})`);
          if (messageList && messageList.length > 0) {
            if (processMessage) {
              messageList.forEach(msg => {
                if (msg.status === MessageStatus.END && msg.text && msg.uid === 0) {
                  msg.text = processMessage(msg.text, msg.turn_id || "");
                }
              });
            }
            
            setLiveSubtitles((prev) => {
              const newMessages = [...messageList];
              
              const completedMessages = newMessages.filter(msg => 
                msg.status === MessageStatus.END && msg.text && msg.text.trim().length > 0
              );
              
              if (completedMessages.length > 0) {
                setPreservedSubtitleMessages(prevPreserved => {
                  const newCompleted = completedMessages.filter(newMsg => 
                    !prevPreserved.some(preserved => 
                      preserved.message_id === newMsg.message_id || 
                      (preserved.turn_id === newMsg.turn_id && preserved.uid === newMsg.uid)
                    )
                  );
                  return [...prevPreserved, ...newCompleted];
                });
              }
              
              return newMessages;
            });
          }
        },
        urlParams // Pass URL parameters to MessageEngine
      );
      logger.log("MessageEngine initialized successfully:", !!messageEngineRef.current, "purechat mode:", isPureChatMode);
    } else {
      if (messageEngineRef.current.messageList.length > 0) {
        setLiveSubtitles([...messageEngineRef.current.messageList]);
      }
    }

    return () => {
      if (messageEngineRef.current) {
        logger.log("Cleaning up MessageEngine");
        messageEngineRef.current.cleanup();
        messageEngineRef.current = null;
      }
    };
  }, [agoraClient, isConnectInitiated, processMessage, isPureChatMode, urlParams]);

  // Process messages from rtmMessages prop (skip if already received via listener)
  useEffect(() => {
    if (rtmMessages && rtmMessages.length > 0) {
      const newMessages = rtmMessages.filter(
        (msg) =>
          // Skip if we already have this message
          !pendingRtmMessages.some(
            (pending) =>
              pending.time === msg.time &&
              pending.content === msg.content &&
              pending.userId === msg.userId
          ) &&
          // Skip if this came from RTM listener (marked with fromRtmListener)
          !pendingRtmMessages.some(
            (pending) =>
              pending.fromRtmListener &&
              pending.content === msg.content &&
              Math.abs(pending.time - msg.time) < 2000
          )
      );

      if (newMessages.length > 0) {
        logger.log('[RTM] Processing messages from rtmMessages prop:', newMessages.length);
        
        // Process all new messages through shared logic
        const processedMessages = newMessages
          .map(msg => {
            // Mark these as NOT from RTM listener
            const processedMsg = processRtmMessage(
              { ...msg, fromRtmListener: false }, 
              agoraConfig.uid, 
              processMessage, 
              urlParams, 
              isConnectInitiated
            );
            return processedMsg;
          })
          .filter(msg => msg !== null); // Remove messages that were filtered out (commands only)

        if (processedMessages.length > 0) {
          logger.log("Adding processed messages from rtmMessages:", processedMessages);
          setPendingRtmMessages((prev) => [...prev, ...processedMessages]);
        } else {
          logger.log("All new messages were command-only, none added to chat");
        }
      }
    }
  }, [rtmMessages, pendingRtmMessages, agoraConfig.uid, processMessage, urlParams, isConnectInitiated]);

  // Combine live subtitles and RTM messages into a single timeline
  useEffect(() => {
    if (isPureChatMode && !isConnectInitiated) {
      // Create a map to deduplicate messages by turn_id/message_id
      const messageMap = new Map();
      
      // Process typed messages
      pendingRtmMessages
        .filter(msg => {
          // Filter out typing indicator messages
          try {
            const parsed = JSON.parse(msg.content);
            return parsed.type !== "typing_start";
          } catch {
            return true; // Keep non-JSON messages
          }
        })
        .forEach((msg, index) => {
          const validTime =
            msg.time && new Date(msg.time).getFullYear() > 1971 ? msg.time : Date.now();
          
          // Create unique key for deduplication
          const key = msg.message_id || msg.turn_id 
            ? `${msg.type}-${msg.turn_id || 'no-turn'}-${msg.message_id || index}`
            : `typed-${msg.userId}-${validTime}-${index}`;
          
          // For messages with the same turn_id, keep the most recent/complete one
          const existing = messageMap.get(key);
          if (!existing || msg.content.length >= existing.content.length) {
            messageMap.set(key, {
              id: key,
              ...msg,
              time: validTime,
              isSubtitle: false,
              fromPreviousSession: false,
            });
          }
        });

      // Process preserved subtitle messages
      preservedSubtitleMessages.forEach((msg) => {
        const messageText = msg.text || (msg.metadata && msg.metadata.text) || "";
        const msgTime = msg._time || msg.start_ms;
        const validTime = msgTime && new Date(msgTime).getFullYear() > 1971 ? msgTime : Date.now();

        // FIX: Normalize uid - treat empty string as 0
        const msgUid = (msg.uid === '' || msg.uid === null || msg.uid === undefined) ? 0 : msg.uid;

        const key = `preserved-subtitle-${msgUid}-${msg.turn_id}-${msg.message_id || validTime}`;
        
        messageMap.set(key, {
          id: key,
          type: msgUid === 0 || msgUid === '0' ? "agent" : "user",
          time: validTime,
          content: messageText,
          contentType: "text",
          userId: String(msgUid),
          isOwn: msgUid !== 0 && msgUid !== '0',
          isSubtitle: true,
          status: MessageStatus.END,
          turn_id: msg.turn_id,
          message_id: msg.message_id,
          fromPreviousSession: true,
        });
      });

      const allMessages = Array.from(messageMap.values());
      setCombinedMessages(allMessages.sort((a, b) => a.time - b.time));
      return;
    }

    const subtitleMessages = [];
    const now = Date.now();

    preservedSubtitleMessages.forEach((msg) => {
      const messageText = msg.text || (msg.metadata && msg.metadata.text) || "";
      if (!messageText || messageText.trim().length === 0) {
        return;
      }

      const msgTime = msg._time || msg.start_ms;
      const validTime =
        msgTime && new Date(msgTime).getFullYear() > 1971 ? msgTime : now;

      // FIX: Normalize uid - treat empty string as 0
      const msgUid = (msg.uid === '' || msg.uid === null || msg.uid === undefined) ? 0 : msg.uid;

      subtitleMessages.push({
        id: `preserved-subtitle-${msgUid}-${msg.turn_id}-${msg.message_id || now}`,
        type: msgUid === 0 || msgUid === '0' ? "agent" : "user",
        time: validTime,
        content: messageText,
        contentType: "text",
        userId: String(msgUid),
        isOwn: msgUid !== 0 && msgUid !== '0',
        isSubtitle: true,
        status: MessageStatus.END,
        turn_id: msg.turn_id,
        message_id: msg.message_id,
        fromPreviousSession: !isConnectInitiated,
      });
    });

    liveSubtitles.forEach((msg) => {
      const messageText = msg.text || (msg.metadata && msg.metadata.text) || "";
      if (!messageText || messageText.trim().length === 0) {
        return;
      }

      const alreadyPreserved = preservedSubtitleMessages.some(preserved => 
        preserved.message_id === msg.message_id || 
        (preserved.turn_id === msg.turn_id && preserved.uid === msg.uid && preserved.text === messageText)
      );
      
      if (alreadyPreserved) {
        return;
      }

      const msgTime = msg._time || msg.start_ms;
      const validTime =
        msgTime && new Date(msgTime).getFullYear() > 1971 ? msgTime : now;

      // FIX: Normalize uid - treat empty string as 0
      const msgUid = (msg.uid === '' || msg.uid === null || msg.uid === undefined) ? 0 : msg.uid;

      subtitleMessages.push({
        id: `subtitle-${msgUid}-${msg.turn_id}-${msg.message_id || now}`,
        type: msgUid === 0 || msgUid === '0' ? "agent" : "user",
        time: validTime,
        content: messageText,
        contentType: "text",
        userId: String(msgUid),
        isOwn: msgUid !== 0 && msgUid !== '0',
        isSubtitle: true,
        status: msg.status,
        turn_id: msg.turn_id,
        message_id: msg.message_id,
        fromPreviousSession: !isConnectInitiated,
      });
    });

    const typedMessages = pendingRtmMessages
      .filter(msg => {
        // Filter out typing indicator messages
        try {
          const parsed = JSON.parse(msg.content);
          return parsed.type !== "typing_start";
        } catch {
          return true; // Keep non-JSON messages
        }
      })
      .map((msg, index) => {
        const validTime =
          msg.time && new Date(msg.time).getFullYear() > 1971 ? msg.time : now;
        return {
          id: `typed-${msg.type}-${msg.userId}-${validTime}-${index}`,
          ...msg,
          time: validTime,
          isSubtitle: false,
          fromPreviousSession: !isConnectInitiated && validTime < now - 5000,
        };
      });

    const allMessageMap = new Map();

    // Add subtitle messages first
    subtitleMessages.forEach((msg) => {
      const key = msg.message_id || `${msg.type}-${msg.userId}-${msg.turn_id}-${msg.time}`;
      allMessageMap.set(key, msg);
    });

    // Add typed messages, checking for duplicates
    typedMessages.forEach((msg) => {
      // For messages with turn_id, check if we already have a message with the same turn_id
      if (msg.turn_id) {
        // Find existing message with same turn_id and type
        let existingKey = null;
        for (const [key, existingMsg] of allMessageMap) {
          if (existingMsg.turn_id === msg.turn_id && existingMsg.type === msg.type) {
            existingKey = key;
            break;
          }
        }
        
        if (existingKey) {
          // Update the existing message if the new one is more complete
          const existing = allMessageMap.get(existingKey);
          if (msg.content.length >= existing.content.length) {
            allMessageMap.set(existingKey, {
              ...existing,
              ...msg,
              id: existing.id // Keep the original ID
            });
          }
          return; // Don't add as a separate message
        }
      }
      
      // No duplicate found, add as new message
      const key = `typed-${msg.type}-${msg.userId}-${msg.time}`;
      
      // Check for duplicate based on content, type, and similar timing
      const hasSimilarMessage = Array.from(allMessageMap.values()).some(
        (existing) =>
          existing.type === msg.type &&
          existing.content.trim() === msg.content.trim() &&
          Math.abs(existing.time - msg.time) < 1000 // Within 1 second
      );

      if (!hasSimilarMessage) {
        allMessageMap.set(key, msg);
      }
    });

    const allMessages = Array.from(allMessageMap.values()).sort(
      (a, b) => a.time - b.time
    );

    logger.log("Combined messages count:", allMessages.length, "Subtitles:", subtitleMessages.length, "RTM:", typedMessages.length, "Preserved:", preservedSubtitleMessages.length);
    setCombinedMessages(allMessages);
  }, [liveSubtitles, pendingRtmMessages, preservedSubtitleMessages, isConnectInitiated, isPureChatMode]);

  // Force a re-render whenever the connection state changes
  useEffect(() => {
    if (isConnectInitiated && messageEngineRef.current && !isPureChatMode) {
      const messageList = messageEngineRef.current.messageList;
      if (messageList.length > 0) {
        logger.log("Connection status changed, forcing message update");
        setLiveSubtitles([...messageList]);
      }
    }
  }, [isConnectInitiated, isPureChatMode]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (rtmMessageEndRef.current && !isKeyboardVisible) {
      rtmMessageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [combinedMessages, isKeyboardVisible, typingUsers]);

  // Send RTM message to the agent
  const handleSendMessage = async () => {
    if (!rtmInputText.trim()) return;

    const messageToSend = rtmInputText.trim();
    setRtmInputText("");

    await directSendMessage(messageToSend);
  };

  // Set up RTM message listener
  useEffect(() => {
    if (rtmClient) {
      rtmClient.addEventListener("message", handleRtmMessageCallback);
      
      return () => {
        rtmClient.removeEventListener("message", handleRtmMessageCallback);
      };
    }
  }, [rtmClient, handleRtmMessageCallback]);

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (typingUsers.size === 0) return null;

    return (
      <div key="typing-indicator" className="rtm-message other-message typing-indicator">
        <div className="rtm-message-content">
          <div className="typing-dots">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        </div>
      </div>
    );
  };

  // Render a message (WhatsApp style)
  const renderMessage = (message, index) => {
    if (!message.content || message.content.trim().length === 0) {
      return null;
    }
    
    let messageClass = `rtm-message ${
      message.isOwn ? "own-message" : "other-message"
    }`;

    if (message.isSubtitle && message.status === MessageStatus.IN_PROGRESS) {
      messageClass += " message-in-progress";
    }

    if (!isConnectInitiated && message.fromPreviousSession) {
      messageClass += " previous-session";
    }

    const messageTime = message.time || Date.now();
    const messageDate = new Date(messageTime);
    const isValidDate = messageDate.getFullYear() > 1971;

    return (
      <div key={message.id || index} className={messageClass}>
        <div className="rtm-message-content">
          {message.contentType === "image" ? (
            <img
              src={message.content}
              className="rtm-image-content"
              alt="Shared content"
            />
          ) : (
            message.content
          )}
        </div>
        <div className="rtm-message-time">
          {isValidDate
            ? messageDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
        </div>
      </div>
    );
  };

  // Show a date divider between messages on different days
  const renderMessageGroup = () => {
    if (combinedMessages.length === 0 && typingUsers.size === 0) return null;

    const result = [];
    let lastDate = null;
    const now = new Date();

    combinedMessages.forEach((message, index) => {
      if (!message.content || message.content.trim().length === 0) {
        return;
      }
      
      const messageTime = message.time || Date.now();
      const messageDate = new Date(messageTime);

      const isValidDate = messageDate.getFullYear() > 1971;
      const messageLocaleDateString = isValidDate
        ? messageDate.toLocaleDateString()
        : now.toLocaleDateString();

      if (messageLocaleDateString !== lastDate && isValidDate) {
        result.push(
          <div key={`date-${messageLocaleDateString}`} className="date-divider">
            {messageLocaleDateString}
          </div>
        );
        lastDate = messageLocaleDateString;
      }

      const renderedMessage = renderMessage(message, index);
      if (renderedMessage) {
        result.push(renderedMessage);
      }
    });

    // Add typing indicator at the end if someone is typing
    if (typingUsers.size > 0) {
      result.push(renderTypingIndicator());
    }

    return result;
  };

  const getEmptyStateMessage = () => {
    if (isPureChatMode) {
      return isChatEnabled 
        ? "Chat connected. Start typing to send messages!" 
        : "Connecting to chat...";
    }
    return isConnectInitiated
      ? "No messages yet. Start the conversation by speaking or typing!"
      : "No messages";
  };

  // Clean up tracking sets when component unmounts
  useEffect(() => {
    return () => {
      setRtmReceivedMessages(new Set());
    };
  }, []);

  return (
    <div className={`rtm-container  ${isFullscreen ? "hidden": ""}`} >
      <div className="rtm-messages">
        {combinedMessages.length === 0 && typingUsers.size === 0 ? (
          <div className="rtm-empty-state">
            {getEmptyStateMessage()}
          </div>
        ) : (
          <>{renderMessageGroup()}</>
        )}
        <div ref={rtmMessageEndRef} />
      </div>
      <div id="static-input"></div>

      {floatingInput &&
        staticInput &&
        createPortal(
          <ExpandableChatInput 
                rtmInputText={rtmInputText}
                setRtmInputText={setRtmInputText}
                handleSendMessage={handleSendMessage}
                disabled={!isChatEnabled}
                isKeyboardVisible={isKeyboardVisible} 
                setIsKeyboardVisible={setIsKeyboardVisible}
                isPureChatMode={isPureChatMode}
              />
          ,
          isKeyboardVisible ? floatingInput : staticInput
        )}
    </div>
  );
};