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
        messageId?: string;       // for message:edited and message:deleted events
        channelId: string;
        content: string;
        userId: string;
        userEmail: string;
        timestamp: string;
        tempId?: string;
        threadId?: string | null;
        parentMessageId?: string | null;
        // ✅ parent message snapshot — so reply badge works for incoming WS messages too
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
    /** Subscribe to incoming WebSocket messages. Returns an unsubscribe function. */
    subscribe: (callback: MessageCallback) => () => void;
};

const WSContext = createContext<WSContextType | null>(null);

// ========================================
// PROVIDER
// ========================================
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
    const socketRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const toast = useToast();

    // Subscriber registry: all components that want to listen to messages
    const subscribersRef = useRef<Set<MessageCallback>>(new Set());

    // Dispatch incoming messages to all subscribers
    const dispatch = useCallback((message: IncomingMessage) => {
        subscribersRef.current.forEach((cb) => cb(message));
    }, []);

    const connect = useCallback(() => {
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
            toast.warning("No token found. Login Again!");
            return;
        }

        console.log("🔌 Connecting WebSocket...");
        const socket = new WebSocket(`${BASE_URL}/ws/c?token=${token}`);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log('✅ WebSocket connected');
            setIsConnected(true);
        };

        socket.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };

        socket.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            setIsConnected(false);
        };

        // ✅ KEY CHANGE: Dispatch all incoming messages to subscribers
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

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            console.log("🔌 Disconnecting WebSocket...");
            socketRef.current.close();
            socketRef.current = null;
            setIsConnected(false);
        }
    }, []);

    const joinChannel = useCallback((workspaceId: string, channelId: string) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            console.warn("⚠️ WebSocket not connected when trying to join channel");
            return;
        }

        console.log(`🔍 Joining channel: ${channelId} in workspace: ${workspaceId}`);
        socketRef.current.send(JSON.stringify({
            type: 'JOIN_CHANNEL',
            workspaceId,
            channelId,
        }));
    }, []);

    const leaveChannel = useCallback((workspaceId: string, channelId: string) => {
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

    // ✅ KEY CHANGE: subscribe/unsubscribe system
    const subscribe = useCallback((callback: MessageCallback): (() => void) => {
        subscribersRef.current.add(callback);
        // Return an unsubscribe function
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

        return () => {
            clearInterval(interval);
        };
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