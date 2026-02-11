import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  // ========================================
  // Upgrade Handler
  // ========================================
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    
    if (url.pathname !== '/ws/c') {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token');
    
    if (!token) {
      console.log('❌ WebSocket: No token');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string;
        email: string;
        role: 'admin' | 'user';
      };

      console.log('✅ WebSocket: Token verified for', decoded.email);

      wss.handleUpgrade(request, socket, head, (ws) => {
        (ws as any).userId = decoded.id;
        (ws as any).userEmail = decoded.email;
        (ws as any).userRole = decoded.role;
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      console.log('❌ WebSocket: Invalid token');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  // ========================================
  // Connection Handler
  // ========================================
  wss.on('connection', (ws: WebSocket) => {
    const userId = (ws as any).userId;
    const userEmail = (ws as any).userEmail;

    console.log(`✅ WebSocket connected: ${userEmail}`);

    (ws as any).currentWorkspaceId = null;
    (ws as any).currentChannelId = null;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'JOIN_CHANNEL':
            handleJoinChannel(ws, wss, message.workspaceId, message.channelId);
            break;

          case 'LEAVE_CHANNEL':
            handleLeaveChannel(ws, wss, message.workspaceId, message.channelId);
            break;

          case 'message:send':
            handleSendMessage(ws, wss, message.data);
            break;

          default:
            console.log('⚠️ Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`🔌 WebSocket disconnected: ${userEmail}`);
      if ((ws as any).currentChannelId) {
        handleLeaveChannel(ws, wss, (ws as any).currentWorkspaceId, (ws as any).currentChannelId);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to CollabAI',
      userId,
      userEmail
    }));
  });

  return wss;
}

// ========================================
// Helper Functions
// ========================================
function handleJoinChannel(ws: WebSocket, wss: WebSocketServer, workspaceId: string, channelId: string) {
  const userEmail = (ws as any).userEmail;
  
  console.log(`📍 ${userEmail} joining channel ${channelId}`);
  
  (ws as any).currentWorkspaceId = workspaceId;
  (ws as any).currentChannelId = channelId;

  ws.send(JSON.stringify({
    type: 'CHANNEL_JOINED',
    workspaceId,
    channelId
  }));

  broadcastToChannel(wss, workspaceId, channelId, {
    type: 'USER_JOINED',
    userId: (ws as any).userId,
    userEmail
  }, ws);
}

function handleLeaveChannel(ws: WebSocket, wss: WebSocketServer, workspaceId: string, channelId: string) {
  const userEmail = (ws as any).userEmail;
  
  console.log(`👋 ${userEmail} leaving channel ${channelId}`);
  
  (ws as any).currentWorkspaceId = null;
  (ws as any).currentChannelId = null;

  ws.send(JSON.stringify({
    type: 'CHANNEL_LEFT',
    workspaceId,
    channelId
  }));

  broadcastToChannel(wss, workspaceId, channelId, {
    type: 'USER_LEFT',
    userId: (ws as any).userId,
    userEmail
  }, ws);
}

function handleSendMessage(ws: WebSocket, wss: WebSocketServer, data: any) {
  const { channelId, content } = data;
  const userId = (ws as any).userId;
  const userEmail = (ws as any).userEmail;
  const currentWorkspaceId = (ws as any).currentWorkspaceId;

  if (data.type === "PING") {
      ws.send(JSON.stringify({ type: "PONG" }));
      return;
  }

  console.log(`💬 ${userEmail} sending message to ${channelId}`);

  broadcastToChannel(wss, currentWorkspaceId, channelId, {
    type: 'message:receive',
    data: {
      ...data,
      userId,
      userEmail,
      timestamp: new Date().toISOString()
    }
  });
}

function broadcastToChannel(
  wss: WebSocketServer, 
  workspaceId: string, 
  channelId: string, 
  message: any, 
  exclude?: WebSocket
) {
  wss.clients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN &&
      (client as any).currentWorkspaceId === workspaceId &&
      (client as any).currentChannelId === channelId &&
      client !== exclude
    ) {
      client.send(JSON.stringify(message));
    }
  });
}