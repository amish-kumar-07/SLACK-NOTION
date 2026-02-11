'use client';
import { useContext, createContext, useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "./ToastContext";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

export interface SendMessagePayload {
    type: "message:send";
    data: {
        channelId: string;
        userId: string;
        content: string;
        threadId?: string | null;
        parentMessageId?: string | null;
        attachments?: unknown[];
        tempId?: string;
        createdAt?: string;
    };
}

type WSContextType = {
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    joinChannel: (workspaceId: string, channelId: string) => void;
    leaveChannel: (workspaceId: string, channelId: string) => void;
    sendMessage: (payload: SendMessagePayload) => void;
};

const WSContext = createContext<WSContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
    const socketRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const toast = useToast();

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

        socket.onmessage = (event) => {
            console.log('📨 Message received:', event.data);
        };
    }, [toast]);

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

        console.log(`📍 Joining channel: ${channelId} in workspace: ${workspaceId}`);
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

        console.log(`📍 Leaving channel: ${channelId}`);
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

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    useEffect(() => {
        if (!isConnected || !socketRef.current) return;

        const interval = setInterval(() => {
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(
                    JSON.stringify({ type: "PING" })
                );
            }
        }, 25000); // 25 seconds (safe default)

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
            sendMessage
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