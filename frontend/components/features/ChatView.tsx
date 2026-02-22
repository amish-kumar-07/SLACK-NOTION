// ChatView.tsx
import { useEffect, useState, useRef, useCallback } from "react";
import { Send, Paperclip, Smile, AtSign, FileText, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebSocket, IncomingMessage } from "@/app/context/WebSocketProvider";
import { useAuth } from "@/app/context/AuthContext"; // adjust path to your useAuth hook

// ========================================
// TYPES
// ========================================
interface Message {
    /** Unique id — real id from server after echo, or tempId before echo */
    id: string;
    /** tempId is set for optimistic messages so we can reconcile on server echo */
    tempId?: string;
    user: {
        id: string;
        name: string;
    };
    content: string;
    timestamp: string;
    /** 'sending' = optimistic, not yet echoed; 'sent' = confirmed by server; 'error' = failed */
    status: "sending" | "sent" | "error";
    attachments?: {
        type: "document" | "whiteboard";
        name: string;
    }[];
}

type ChatViewProps = {
    workspaceId: string;
    channelId: string;
};

// ========================================
// HELPERS
// ========================================
function formatTime(isoString: string): string {
    try {
        return new Date(isoString).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
}

/** Generate a consistent avatar gradient from email/userId */
function getAvatarGradient(seed: string): string {
    const gradients = [
        "from-green-400 to-emerald-500",
        "from-orange-400 to-red-500",
        "from-blue-400 to-indigo-500",
        "from-purple-400 to-pink-500",
        "from-yellow-400 to-orange-500",
        "from-teal-400 to-cyan-500",
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
}

// ========================================
// COMPONENT
// ========================================
export const ChatView = ({ workspaceId, channelId }: ChatViewProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);

    const { sendMessage, subscribe } = useWebSocket();
    const { user } = useAuth();

    // ----------------------------------------
    // Auto-scroll to bottom when messages change
    // ----------------------------------------
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ----------------------------------------
    // Subscribe to incoming WebSocket messages
    // ----------------------------------------
    useEffect(() => {
        const unsubscribe = subscribe((incoming: IncomingMessage) => {
            // Only handle message:receive events
            if (incoming.type !== "message:receive" || !incoming.data) return;

            // Only handle messages for this channel
            if (incoming.data.channelId !== channelId) return;

            const serverMsg = incoming.data;

            setMessages((prev) => {
                // ✅ OPTIMISTIC RECONCILIATION:
                // If we find a message with the same tempId, replace it with the confirmed server version.
                // This prevents the sender from seeing a duplicate.
                if (serverMsg.tempId) {
                    const idx = prev.findIndex((m) => m.tempId === serverMsg.tempId);
                    if (idx !== -1) {
                        const updated = [...prev];
                        updated[idx] = {
                            id: serverMsg.tempId, // server doesn't return a db id yet — use tempId
                            tempId: serverMsg.tempId,
                            user: {
                                id: serverMsg.userId,
                                name: serverMsg.userEmail,
                            },
                            content: serverMsg.content,
                            timestamp: serverMsg.timestamp,
                            status: "sent",
                        };
                        return updated;
                    }
                }

                // For all other senders (receivers), just append the message
                const newMsg: Message = {
                    id: serverMsg.tempId ?? `${Date.now()}-${Math.random()}`,
                    tempId: serverMsg.tempId,
                    user: {
                        id: serverMsg.userId,
                        name: serverMsg.userEmail,
                    },
                    content: serverMsg.content,
                    timestamp: serverMsg.timestamp,
                    status: "sent",
                };

                return [...prev, newMsg];
            });
        });

        // Cleanup subscription when channelId changes or component unmounts
        return () => {
            unsubscribe();
        };
    }, [subscribe, channelId]);

    // ----------------------------------------
    // Send message with optimistic update
    // ----------------------------------------
    const handleSend = useCallback(() => {
        const content = inputValue.trim();
        if (!content || !user) return;

        // Generate a tempId so we can reconcile when server echoes back
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const createdAt = new Date().toISOString();

        // ✅ OPTIMISTIC: Add message to UI immediately
        const optimisticMsg: Message = {
            id: tempId,
            tempId,
            user: {
                id: user.id,
                name: user.email,
            },
            content,
            timestamp: createdAt,
            status: "sending",
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        setInputValue("");

        // Send to server
        sendMessage({
            type: "message:send",
            data: {
                channelId,
                userId: user.id,
                content,
                tempId,
                createdAt,
            },
        });
    }, [inputValue, user, channelId, sendMessage]);

    // Send on Enter key (Shift+Enter for newline if you later switch to textarea)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ========================================
    // RENDER
    // ========================================
    return (
        <div className="flex flex-col h-full bg-slate-950">

            {/* ── Messages Area ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 text-sm">No messages yet. Say hello! 👋</p>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const isCurrentUser = msg.user.id === user?.id;
                    const avatarGradient = getAvatarGradient(msg.user.id);
                    const displayName = isCurrentUser ? "You" : msg.user.name;
                    const initial = msg.user?.name?.charAt(0)?.toUpperCase();

                    return (
                        <div
                            key={msg.id}
                            className="flex gap-3 animate-fade-in"
                            style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                        >
                            {/* Avatar */}
                            <div
                                className={`w-10 h-10 rounded-full bg-linear-to-br ${avatarGradient} shrink-0 flex items-center justify-center text-white font-semibold text-sm`}
                            >
                                {initial}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                    <span className="font-semibold text-white">{displayName}</span>
                                    <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>

                                    {/* Status indicator (only for current user's messages) */}
                                    {isCurrentUser && (
                                        <span
                                            className={`text-xs ml-1 ${
                                                msg.status === "sending"
                                                    ? "text-gray-500"
                                                    : msg.status === "error"
                                                    ? "text-red-400"
                                                    : "text-green-400"
                                            }`}
                                        >
                                            {msg.status === "sending" ? "Sending..." : msg.status === "error" ? "Failed" : "✓"}
                                        </span>
                                    )}
                                </div>

                                <p
                                    className={`mt-1 ${
                                        msg.status === "sending" ? "text-gray-500" : "text-gray-300"
                                    }`}
                                >
                                    {msg.content}
                                </p>

                                {/* Attachments */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {msg.attachments.map((attachment, i) => (
                                            <button
                                                key={i}
                                                className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 transition-colors w-full max-w-md text-left group"
                                            >
                                                <div
                                                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                        attachment.type === "document"
                                                            ? "bg-blue-500/20 text-blue-400"
                                                            : "bg-green-500/20 text-green-400"
                                                    }`}
                                                >
                                                    {attachment.type === "document" ? (
                                                        <FileText className="w-5 h-5" />
                                                    ) : (
                                                        <PenTool className="w-5 h-5" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate text-white group-hover:text-purple-300 transition-colors">
                                                        {attachment.name}
                                                    </p>
                                                    <p className="text-xs text-gray-400 capitalize">{attachment.type}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Invisible anchor for auto-scroll */}
                <div ref={bottomRef} />
            </div>

            {/* ── Message Input ── */}
            <div className="p-4 border-t border-slate-800">
                <div className="bg-slate-900 rounded-xl border border-slate-700 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
                    <div className="flex items-center gap-2 px-4 py-3">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            className="flex-1 bg-transparent outline-none placeholder:text-gray-500 text-white"
                        />
                    </div>
                    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800">
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                                <Paperclip className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                                <AtSign className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                                <Smile className="w-4 h-4" />
                            </Button>
                            <div className="w-px h-4 bg-slate-700 mx-1" />
                            <Button variant="ghost" size="icon" className="text-blue-400 hover:bg-blue-500/10">
                                <FileText className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-green-400 hover:bg-green-500/10">
                                <PenTool className="w-4 h-4" />
                            </Button>
                        </div>
                        <Button
                            size="sm"
                            disabled={!inputValue.trim()}
                            onClick={handleSend}
                            className="bg-linear-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Send
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};