'use client';
import { useContext, createContext, useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "./ToastContext";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

// ========================================
// TYPES
// ========================================
export interface SendMessagePayload {
    type: "message:send";
    data: {
        channelId: string;
        channelName: string;
        userId: string;
        content: string;
        threadId?: string | null;
        parentMessageId?: string | null;
        attachments?: unknown[];
        tempId?: string;
        createdAt?: string;
    };
}

export interface IncomingMessage {
    type: string;
    data?: {
        id?: string;
        messageId?: string;
        channelId: string;
        content: string;
        userId: string;
        userEmail: string;
        timestamp: string;
        tempId?: string;
        threadId?: string | null;
        parentMessageId?: string | null;
        parentMessage?: {
            id: string;
            content: string | null;
            userId: string;
            userName: string;
        } | null;
        attachments?: unknown[];
    };
    // For USER_JOINED / USER_LEFT events
    userId?: string;
    userEmail?: string;
    timestamp?: string;
    // For CHANNEL_JOINED
    workspaceId?: string;
    channelId?: string;
    roomId?: string;
    // For errors
    message?: string;
}

// Callback type for subscribers
type MessageCallback = (message: IncomingMessage) => void;

type WSContextType = {
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    joinChannel: (workspaceId: string, channelId: string) => void;
    leaveChannel: (workspaceId: string, channelId: string) => void;
    sendMessage: (payload: SendMessagePayload) => void;
    requestPresence: () => void;
    subscribe: (callback: MessageCallback) => () => void;
};

const WSContext = createContext<WSContextType | null>(null);

// ========================================
// RECONNECT CONFIG
// ========================================
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS  = 30000;
const RECONNECT_MAX_ATTEMPTS  = 10;

// ========================================
// PROVIDER
// ========================================
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
    const socketRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const toast = useToast();

    // Subscriber registry
    const subscribersRef = useRef<Set<MessageCallback>>(new Set());

    // Reconnect state
    const intentionalCloseRef = useRef(false);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Last known channel — for auto-rejoin after reconnect
    const lastChannelRef = useRef<{ workspaceId: string; channelId: string } | null>(null);

    // Pending join — for when joinChannel fires before socket is OPEN
    const pendingJoinRef = useRef<{ workspaceId: string; channelId: string } | null>(null);

    const dispatch = useCallback((message: IncomingMessage) => {
        subscribersRef.current.forEach((cb) => cb(message));
    }, []);

    const connectInternal = useCallback((isReconnect = false) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            console.log("✅ WebSocket already connected");
            return;
        }

        if (socketRef.current?.readyState === WebSocket.CONNECTING) {
            console.log("⏳ WebSocket already connecting...");
            return;
        }

        const token = sessionStorage.getItem('CollabAIToken');
        if (!token) {
            console.warn("❌ No token found");
            if (!isReconnect) toast.warning("No token found. Login Again!");
            return;
        }

        console.log(isReconnect
            ? `🔄 Reconnecting WebSocket (attempt ${reconnectAttemptRef.current})...`
            : "🔌 Connecting WebSocket..."
        );

        // WebSocket requires wss:// (not https://) — convert scheme
        const wsBase = BASE_URL
            .replace(/^https:\/\//, "wss://")
            .replace(/^http:\/\//, "ws://");
        const socket = new WebSocket(`${wsBase}/ws/c?token=${token}`);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log('✅ WebSocket connected');
            reconnectAttemptRef.current = 0;
            setIsConnected(true);

            // Priority: pendingJoin (set before socket opened) > lastChannel (reconnect)
            const toJoin = pendingJoinRef.current ?? (isReconnect ? lastChannelRef.current : null);

            if (toJoin) {
                console.log(`🔗 Sending JOIN_CHANNEL on open for channel ${toJoin.channelId}`);
                socket.send(JSON.stringify({
                    type: 'JOIN_CHANNEL',
                    workspaceId: toJoin.workspaceId,
                    channelId: toJoin.channelId,
                }));
                lastChannelRef.current = toJoin;
                pendingJoinRef.current = null;
            }
        };

        socket.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };

        socket.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            setIsConnected(false);

            if (intentionalCloseRef.current) {
                intentionalCloseRef.current = false;
                return;
            }

            if (reconnectAttemptRef.current < RECONNECT_MAX_ATTEMPTS) {
                const delay = Math.min(
                    RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttemptRef.current,
                    RECONNECT_MAX_DELAY_MS
                );
                reconnectAttemptRef.current += 1;
                console.log(`⏳ Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${RECONNECT_MAX_ATTEMPTS})`);
                reconnectTimerRef.current = setTimeout(() => connectInternal(true), delay);
            } else {
                console.warn("❌ Max reconnect attempts reached. Giving up.");
                toast.warning("Connection lost. Please refresh the page.");
            }
        };

        socket.onmessage = (event) => {
            try {
                const message: IncomingMessage = JSON.parse(event.data);
                console.log('📨 Message received:', message);
                dispatch(message);
            } catch (err) {
                console.error('❌ Failed to parse incoming WebSocket message:', err);
            }
        };
    }, [toast, dispatch]);

    const connect = useCallback(() => {
        intentionalCloseRef.current = false;
        reconnectAttemptRef.current = 0;
        connectInternal(false);
    }, [connectInternal]);

    const disconnect = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (socketRef.current) {
            console.log("🔌 Disconnecting WebSocket...");
            intentionalCloseRef.current = true;
            socketRef.current.close();
            socketRef.current = null;
            setIsConnected(false);
        }
        pendingJoinRef.current = null;
        lastChannelRef.current = null;
    }, []);

    const joinChannel = useCallback((workspaceId: string, channelId: string) => {
        // Always store as last known channel
        lastChannelRef.current = { workspaceId, channelId };

        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            // Queue it — will be sent in socket.onopen
            console.log(`⏳ Socket not ready — queuing JOIN_CHANNEL for channel ${channelId}`);
            pendingJoinRef.current = { workspaceId, channelId };
            return;
        }

        pendingJoinRef.current = null;
        console.log(`🔍 Joining channel: ${channelId} in workspace: ${workspaceId}`);
        socketRef.current.send(JSON.stringify({
            type: 'JOIN_CHANNEL',
            workspaceId,
            channelId,
        }));
    }, []);

    const leaveChannel = useCallback((workspaceId: string, channelId: string) => {
        // Clear both refs so we don't auto-rejoin
        lastChannelRef.current = null;
        pendingJoinRef.current = null;

        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            return;
        }

        console.log(`🔍 Leaving channel: ${channelId}`);
        socketRef.current.send(JSON.stringify({
            type: 'LEAVE_CHANNEL',
            workspaceId,
            channelId,
        }));
    }, []);

    const sendMessage = useCallback((payload: SendMessagePayload) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            console.warn("⚠️ WebSocket not connected when trying to send message");
            return;
        }
        socketRef.current.send(JSON.stringify(payload));
    }, []);

    const requestPresence = useCallback(() => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        socketRef.current.send(JSON.stringify({ type: "GET_PRESENCE" }));
    }, []);

    const subscribe = useCallback((callback: MessageCallback): (() => void) => {
        subscribersRef.current.add(callback);
        return () => {
            subscribersRef.current.delete(callback);
        };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    // Ping every 25 seconds to keep connection alive
    useEffect(() => {
        if (!isConnected || !socketRef.current) return;

        const interval = setInterval(() => {
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ type: "PING" }));
            }
        }, 25000);

        return () => clearInterval(interval);
    }, [isConnected]);

    return (
        <WSContext.Provider value={{
            isConnected,
            connect,
            disconnect,
            joinChannel,
            leaveChannel,
            sendMessage,
            requestPresence,
            subscribe,
        }}>
            {children}
        </WSContext.Provider>
    );
}

export const useWebSocket = () => {
    const ctx = useContext(WSContext);
    if (!ctx) throw new Error('useWebSocket must be used inside WebSocketProvider');
    return ctx;
};
