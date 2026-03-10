import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import jwt from "jsonwebtoken";
import { isValidWorkspace } from "../../../services/workspace/index.js";
import { randomUUID } from "crypto";
import {
  registerSocket,
  joinRoom,
  leaveRoom,
  getRoomSockets,
  getSocketMetadata,
  removeSocket,
} from "../../../utils/Redis.js";
import { saveMessage, editMessage, deleteMessage, replyMessage, getParentMessageSnapshot } from "../../../services/message/index.js";

// ========================================
// LOCAL STATE (Per Server Instance)
// ========================================
/**
 * Maps socketId → WebSocket object.
 * Cannot be in Redis — WebSocket objects are not serializable.
 */
const socketConnections = new Map<string, WebSocket>();

// ========================================
// TYPE GUARDS
// ========================================
interface JoinChannelMessage {
  type: "JOIN_CHANNEL";
  workspaceId: string;
  channelId: string;
}

interface LeaveChannelMessage {
  type: "LEAVE_CHANNEL";
  workspaceId: string;
  channelId: string;
}

type Attachment = {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
};

interface SendMessagePayload {
  type: "message:send";
  data: {
    channelId: string;
    channelName: string;
    userId: string;
    content: string;
    tempId?: string;
    createdAt?: string;
    threadId?: string | null;
    parentMessageId?: string | null;
    attachments?: Attachment[];
  };
}

// ✅ NEW: Edit message payload
interface EditMessagePayload {
  type: "message:edit";
  data: {
    messageId: string;
    channelId: string;
    content: string;
  };
}

// ✅ NEW: Delete message payload
interface DeleteMessagePayload {
  type: "message:delete";
  data: {
    messageId: string;
    channelId: string;
  };
}

type IncomingMessage =
  | { type: "PING" }
  | JoinChannelMessage
  | LeaveChannelMessage
  | SendMessagePayload
  | EditMessagePayload    // ✅ NEW
  | DeleteMessagePayload; // ✅ NEW

function isJoinChannel(m: any): m is JoinChannelMessage {
  return (
    m?.type === "JOIN_CHANNEL" &&
    typeof m.workspaceId === "string" &&
    m.workspaceId.length > 0 &&
    typeof m.channelId === "string" &&
    m.channelId.length > 0
  );
}

function isLeaveChannel(m: any): m is LeaveChannelMessage {
  return (
    m?.type === "LEAVE_CHANNEL" &&
    typeof m.workspaceId === "string" &&
    typeof m.channelId === "string"
  );
}

function isSendMessage(m: any): m is SendMessagePayload {
  const hasContent =
    typeof m.data?.content === "string" && m.data.content.trim().length > 0;
  const hasAttachments =
    Array.isArray(m.data?.attachments) && m.data.attachments.length > 0;

  return (
    m?.type === "message:send" &&
    typeof m.data?.content === "string" &&   // content field must exist (can be empty string)
    (hasContent || hasAttachments) &&          // but must have text OR at least one attachment
    typeof m.data?.channelId === "string" &&
    typeof m.data?.channelName === "string"
  );
}

// ✅ NEW
function isEditMessage(m: any): m is EditMessagePayload {
  return (
    m?.type === "message:edit" &&
    typeof m.data?.messageId === "string" &&
    typeof m.data?.channelId === "string" &&
    typeof m.data?.content === "string" &&
    m.data.content.trim().length > 0
  );
}

// ✅ NEW
function isDeleteMessage(m: any): m is DeleteMessagePayload {
  return (
    m?.type === "message:delete" &&
    typeof m.data?.messageId === "string" &&
    typeof m.data?.channelId === "string"
  );
}

// ========================================
// HELPERS
// ========================================

/**
 * Safe send — never throws. Checks readyState before sending.
 */
function safeSend(ws: WebSocket, payload: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error("❌ safeSend failed:", err);
    }
  }
}

/**
 * Send an error message back to a specific socket.
 */
function sendError(ws: WebSocket, message: string): void {
  safeSend(ws, { type: "ERROR", message });
}

// ========================================
// WEBSOCKET SERVER SETUP
// ========================================
export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  // ----------------------------------------
  // UPGRADE HANDLER (Authentication)
  // ----------------------------------------
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url!, `http://${request.headers.host}`);

    if (url.pathname !== "/ws/c") {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token");

    if (!token) {
      console.log("❌ WebSocket upgrade: No token");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string;
        email: string;
        role: "admin" | "user";
      };

      console.log(`✅ WebSocket token verified for ${decoded.email}`);

      wss.handleUpgrade(request, socket, head, (ws) => {
        (ws as any).userId = decoded.id;
        (ws as any).userEmail = decoded.email;
        (ws as any).userRole = decoded.role;
        wss.emit("connection", ws, request);
      });
    } catch (error) {
      console.log("❌ WebSocket upgrade: Invalid token");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  // ----------------------------------------
  // CONNECTION HANDLER
  // ----------------------------------------
  wss.on("connection", async (ws: WebSocket) => {
    const userId: string = (ws as any).userId;
    const userEmail: string = (ws as any).userEmail;
    const userRole: string = (ws as any).userRole;

    const socketId = randomUUID();

    console.log(`🔌 WebSocket connected: ${userEmail} (socketId: ${socketId})`);

    // Register in Redis
    try {
      await registerSocket(socketId, {
        userId,
        userEmail,
        userRole,
        currentRoom: null,
        connectedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Failed to register socket in Redis:", error);
      ws.close(1011, "Internal server error during registration");
      return;
    }

    // Store in local map and attach socketId to ws object
    socketConnections.set(socketId, ws);
    (ws as any).socketId = socketId;

    console.log(`📊 Active connections: ${socketConnections.size}`);

    // ----------------------------------------
    // MESSAGE HANDLER
    // ----------------------------------------
    ws.on("message", async (data) => {
      let message: any;

      // Parse JSON — reject malformed payloads immediately
      try {
        message = JSON.parse(data.toString());
      } catch {
        console.warn(`⚠️ Malformed JSON from socket ${socketId}`);
        sendError(ws, "Invalid JSON payload");
        return;
      }

      console.log(`📩 [${userEmail}] type=${message?.type}`);

      switch (message.type) {
        // ----------------------------------
        case "PING":
          safeSend(ws, { type: "PONG" });
          break;

        // ----------------------------------
        case "JOIN_CHANNEL": {
          if (!isJoinChannel(message)) {
            sendError(ws, "JOIN_CHANNEL requires workspaceId and channelId");
            break;
          }

          // Validate the user actually has access to this workspace/channel
          let isValid = false;
          try {
            isValid = !!(await isValidWorkspace(
              message.workspaceId,
              message.channelId,
              userId,
            ));
          } catch (err) {
            console.error("❌ isValidWorkspace threw:", err);
            sendError(ws, "Failed to validate workspace access");
            break;
          }

          if (!isValid) {
            console.warn(
              `🚫 Access denied: ${userEmail} → workspace=${message.workspaceId} channel=${message.channelId}`,
            );
            sendError(ws, "Access denied to workspace/channel");
            break;
          }

          await handleJoinChannel(
            ws,
            socketId,
            message.workspaceId,
            message.channelId,
          );
          break;
        }

        // ----------------------------------
        case "LEAVE_CHANNEL": {
          if (!isLeaveChannel(message)) {
            sendError(ws, "LEAVE_CHANNEL requires workspaceId and channelId");
            break;
          }
          await handleLeaveChannel(
            ws,
            socketId,
            message.workspaceId,
            message.channelId,
          );
          break;
        }

        // ----------------------------------
        case "message:send": {
          if (!isSendMessage(message)) {
            sendError(
              ws,
              "message:send requires data.channelId and data.content",
            );
            break;
          }
          await handleSendMessage(socketId, message.data);
          break;
        }

        // ✅ NEW: Edit message
        case "message:edit": {
          if (!isEditMessage(message)) {
            sendError(ws, "message:edit requires data.messageId, data.channelId, and data.content");
            break;
          }
          await handleEditMessage(ws, socketId, message.data);
          break;
        }

        // ✅ NEW: Delete message
        case "message:delete": {
          if (!isDeleteMessage(message)) {
            sendError(ws, "message:delete requires data.messageId and data.channelId");
            break;
          }
          await handleDeleteMessage(ws, socketId, message.data);
          break;
        }

        // ── GET_PRESENCE: client requests current room members ──
        case "GET_PRESENCE": {
          try {
            const meta = await getSocketMetadata(socketId);
            if (!meta || !meta.currentRoom) break;

            const roomSocketIds = await getRoomSockets(meta.currentRoom);
            const seen = new Set<string>();
            const presenceList: { userId: string; userEmail: string }[] = [];

            for (const sid of roomSocketIds) {
              const m = await getSocketMetadata(sid);
              if (m && !seen.has(m.userId)) {
                seen.add(m.userId);
                presenceList.push({ userId: m.userId, userEmail: m.userEmail });
              }
            }

            // currentRoom format is "workspaceId:channelId"
            const channelId = meta.currentRoom.split(":")[1] ?? "";

            safeSend(ws, {
              type: "ROOM_PRESENCE",
              channelId,
              users: presenceList,
            });
          } catch (err) {
            console.warn("⚠️ GET_PRESENCE failed:", err);
          }
          break;
        }

        // ----------------------------------
        default:
          console.log(
            `⚠️ Unknown message type from ${userEmail}: ${message?.type}`,
          );
      }
    });

    // ----------------------------------------
    // CLOSE HANDLER
    // ----------------------------------------
    ws.on("close", async (code, reason) => {
      console.log(
        `🔌 WebSocket closed: ${userEmail} (socketId: ${socketId}) code=${code} reason=${reason?.toString()}`,
      );

      // Remove from local map immediately
      socketConnections.delete(socketId);

      // Async Redis cleanup (non-blocking from caller's perspective)
      try {
        await removeSocket(socketId);
        console.log(`✅ Cleanup complete for socket ${socketId}`);
      } catch (error) {
        console.error(`❌ Redis cleanup failed for socket ${socketId}:`, error);
      }
    });

    // ----------------------------------------
    // ERROR HANDLER
    // ----------------------------------------
    ws.on("error", (error) => {
      console.error(`❌ WebSocket error [${userEmail} / ${socketId}]:`, error);
      // The 'close' event will fire after 'error', so cleanup happens there
    });

    // Welcome handshake
    safeSend(ws, {
      type: "connected",
      message: "Connected to CollabAI",
      userId,
      userEmail,
      socketId,
    });
  });

  return wss;
}

// ========================================
// MESSAGE HANDLERS
// ========================================

/**
 * JOIN_CHANNEL
 *
 * Flow:
 * 1. Join the Redis room (auto-leaves previous room)
 * 2. Confirm to this socket: CHANNEL_JOINED
 * 3. Broadcast USER_JOINED to the entire room
 */
async function handleJoinChannel(
  ws: WebSocket,
  socketId: string,
  workspaceId: string,
  channelId: string,
): Promise<void> {
  const roomId = `${workspaceId}:${channelId}`;

  try {
    const meta = await getSocketMetadata(socketId);
    if (!meta) {
      console.error(
        `❌ handleJoinChannel: socket ${socketId} not found in Redis`,
      );
      sendError(ws, "Session not found. Please reconnect.");
      return;
    }

    console.log(`🔍 ${meta.userEmail} joining room ${roomId}`);

    // joinRoom handles leaving the old room atomically
    await joinRoom(socketId, roomId);

    // Confirm to the joining socket
    safeSend(ws, {
      type: "CHANNEL_JOINED",
      workspaceId,
      channelId,
      roomId,
    });

    // Broadcast presence event to entire room (including the joiner)
    await broadcastToRoom(roomId, {
      type: "USER_JOINED",
      userId: meta.userId,
      userEmail: meta.userEmail,
      timestamp: new Date().toISOString(),
    });

    // ── NEW: Send presence snapshot to the joining socket only ──
    // Collect metadata for all sockets currently in the room so the
    // joiner immediately knows who's already active — without waiting
    // for future USER_JOINED events.
    try {
      const roomSocketIds = await getRoomSockets(roomId);
      const presenceList: { userId: string; userEmail: string }[] = [];

      for (const sid of roomSocketIds) {
        const m = await getSocketMetadata(sid);
        if (m) presenceList.push({ userId: m.userId, userEmail: m.userEmail });
      }

      safeSend(ws, {
        type: "ROOM_PRESENCE",
        channelId,
        users: presenceList,
      });
    } catch (presenceErr) {
      // Non-critical — sidebar will still fill in via USER_JOINED events
      console.warn("⚠️ Failed to send ROOM_PRESENCE snapshot:", presenceErr);
    }

    console.log(`✅ ${meta.userEmail} successfully joined room ${roomId}`);
  } catch (error) {
    console.error(`❌ handleJoinChannel failed for socket ${socketId}:`, error);
    sendError(ws, "Failed to join channel. Please try again.");
  }
}

/**
 * LEAVE_CHANNEL
 *
 * Flow:
 * 1. Broadcast USER_LEFT to room BEFORE leaving (so others see it)
 * 2. Remove from Redis room
 * 3. Confirm to this socket: CHANNEL_LEFT
 */
async function handleLeaveChannel(
  ws: WebSocket,
  socketId: string,
  workspaceId: string,
  channelId: string,
): Promise<void> {
  const roomId = `${workspaceId}:${channelId}`;

  try {
    const meta = await getSocketMetadata(socketId);
    if (!meta) {
      console.error(
        `❌ handleLeaveChannel: socket ${socketId} not found in Redis`,
      );
      return;
    }

    console.log(`👋 ${meta.userEmail} leaving room ${roomId}`);

    // Broadcast BEFORE leaving so all members (including the leaver) receive it
    await broadcastToRoom(roomId, {
      type: "USER_LEFT",
      userId: meta.userId,
      userEmail: meta.userEmail,
      timestamp: new Date().toISOString(),
    });

    // Remove from Redis
    await leaveRoom(socketId, roomId);

    // Confirm to the leaving socket
    safeSend(ws, {
      type: "CHANNEL_LEFT",
      workspaceId,
      channelId,
    });

    console.log(`✅ ${meta.userEmail} successfully left room ${roomId}`);
  } catch (error) {
    console.error(
      `❌ handleLeaveChannel failed for socket ${socketId}:`,
      error,
    );
  }
}

/**
 * message:send
 *
 * Flow:
 * 1. Get sender metadata from Redis (authoritative source — not client-provided)
 * 2. Verify sender is in a room
 * 3. Broadcast message:receive to entire room (including sender for confirmation)
 */
async function handleSendMessage(
  socketId: string,
  data: SendMessagePayload["data"],
): Promise<void> {
  try {
    const meta = await getSocketMetadata(socketId);
    if (!meta) {
      console.error(
        `❌ handleSendMessage: socket ${socketId} not found in Redis`,
      );
      return;
    }

    // Guard: socket must be in a room
    if (!meta.currentRoom) {
      console.warn(
        `⚠️ handleSendMessage: socket ${socketId} (${meta.userEmail}) is not in any room. ` +
          `They must send JOIN_CHANNEL before sending messages.`,
      );

      const ws = socketConnections.get(socketId);
      if (ws) {
        sendError(ws, "You must join a channel before sending messages.");
      }
      return;
    }

    // Save message — use replyMessage service when it's a reply (has parentMessageId)
    // so the parent-exists validation runs. Otherwise use saveMessage for regular messages.
    const savedMessage = data.parentMessageId
      ? await replyMessage({
          channelId: data.channelId,
          channelName: data.channelName,
          content: data.content,
          userId: meta.userId,
          parentMessageId: data.parentMessageId,
          attachments: data.attachments ?? [],
        })
      : await saveMessage({
          userId: meta.userId,
          channelId: data.channelId,
          channelName: data.channelName,
          content: data.content,
          parentMessageId: null,
          attachments: data.attachments ?? [],
        });

    console.log(
      `💬 ${meta.userEmail} → room ${meta.currentRoom}: "${data.content ? data.content.slice(0, 60) : `[${(data.attachments ?? []).length} attachment(s)]`}"`,
    );

    // If this is a reply, fetch the parent snapshot so the reply badge
    // renders correctly for ALL recipients immediately — including the sender
    // after reconciliation replaces the optimistic message.
    const parentMessage = data.parentMessageId
      ? await getParentMessageSnapshot(data.parentMessageId)
      : null;

    // Broadcast to entire room — userId/userEmail come from Redis (trusted), not the client
    await broadcastToRoom(meta.currentRoom, {
      type: "message:receive",
      data: {
        id: savedMessage?.id,
        tempId: data.tempId,
        channelId: data.channelId,
        channelName: data.channelName,
        userId: meta.userId,
        userEmail: meta.userEmail,
        content: data.content,
        parentMessageId: data.parentMessageId ?? null,
        parentMessage, // ✅ real DB snapshot — never null for replies
        attachments: data.attachments ?? [],  // ✅ FIX: include attachments so receivers can see files
        timestamp: savedMessage?.createdAt ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`❌ handleSendMessage failed for socket ${socketId}:`, error);
  }
}

// ✅ NEW
/**
 * message:edit
 *
 * Flow:
 * 1. Get sender metadata from Redis
 * 2. Verify sender is in a room
 * 3. Update the message in DB via editMessage service
 * 4. Broadcast message:edited to entire room
 */
async function handleEditMessage(
  ws: WebSocket,
  socketId: string,
  data: EditMessagePayload["data"],
): Promise<void> {
  try {
    const meta = await getSocketMetadata(socketId);
    if (!meta) {
      console.error(`❌ handleEditMessage: socket ${socketId} not found in Redis`);
      return;
    }

    if (!meta.currentRoom) {
      sendError(ws, "You must join a channel before editing messages.");
      return;
    }

    const updated = await editMessage(data.messageId, data.channelId, data.content);
    if (!updated || updated.length === 0) {
      sendError(ws, "Failed to edit message. It may not exist.");
      return;
    }

    console.log(`✏️ ${meta.userEmail} edited message ${data.messageId}`);

    // Broadcast the confirmed edit to everyone in the room
    await broadcastToRoom(meta.currentRoom, {
      type: "message:edited",
      data: {
        messageId: data.messageId,
        channelId: data.channelId,
        content: data.content,
        userId: meta.userId,
      },
    });
  } catch (error) {
    console.error(`❌ handleEditMessage failed for socket ${socketId}:`, error);
  }
}

// ✅ NEW
/**
 * message:delete
 *
 * Flow:
 * 1. Get sender metadata from Redis
 * 2. Verify sender is in a room
 * 3. Delete the message in DB via deleteMessage service
 * 4. Broadcast message:deleted to entire room
 */
async function handleDeleteMessage(
  ws: WebSocket,
  socketId: string,
  data: DeleteMessagePayload["data"],
): Promise<void> {
  try {
    const meta = await getSocketMetadata(socketId);
    if (!meta) {
      console.error(`❌ handleDeleteMessage: socket ${socketId} not found in Redis`);
      return;
    }

    if (!meta.currentRoom) {
      sendError(ws, "You must join a channel before deleting messages.");
      return;
    }

    const deleted = await deleteMessage(data.messageId, data.channelId);
    if (!deleted) {
      sendError(ws, "Failed to delete message. It may not exist.");
      return;
    }

    console.log(`🗑️ ${meta.userEmail} deleted message ${data.messageId}`);

    // Broadcast the confirmed delete to everyone in the room
    await broadcastToRoom(meta.currentRoom, {
      type: "message:deleted",
      data: {
        messageId: data.messageId,
        channelId: data.channelId,
        userId: meta.userId,
      },
    });
  } catch (error) {
    console.error(`❌ handleDeleteMessage failed for socket ${socketId}:`, error);
  }
}

/**
 * Broadcast a message to every open socket in a room.
 *
 * Uses Redis to get the room membership, then looks up each socket
 * in the local in-memory map.
 */
async function broadcastToRoom(roomId: string, message: object): Promise<void> {
  try {
    const socketIds = await getRoomSockets(roomId);

    if (socketIds.length === 0) {
      console.log(`ℹ️ broadcastToRoom: room ${roomId} is empty`);
      return;
    }

    console.log(
      `📡 Broadcasting to room ${roomId} (${socketIds.length} socket(s))`,
    );

    let sent = 0;
    let skipped = 0;

    for (const socketId of socketIds) {
      const ws = socketConnections.get(socketId);

      if (!ws) {
        // Socket registered in Redis but not on this server instance.
        // In a multi-server setup you'd use a pub/sub layer here.
        console.warn(
          `⚠️ Socket ${socketId} in Redis but not in local map (stale or different instance)`,
        );
        skipped++;
        continue;
      }

      safeSend(ws, message);
      sent++;
    }

    console.log(`✅ Broadcast done — sent: ${sent}, skipped: ${skipped}`);
  } catch (error) {
    console.error(`❌ broadcastToRoom failed for room ${roomId}:`, error);
  }
}

// ========================================
// DEBUG / MONITORING
// ========================================
export function getLocalStats() {
  return {
    totalConnections: socketConnections.size,
    connections: Array.from(socketConnections.entries()).map(([id, ws]) => ({
      socketId: id,
      readyState: ws.readyState,
    })),
  };
}