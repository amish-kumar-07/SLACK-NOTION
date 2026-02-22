// hooks/useMessageHistory.ts
import { useState, useEffect, useCallback, useRef } from "react";

// ========================================
// TYPES
// ========================================

type MessageUser = {
    id: string;
    name: string;
    email: string;
};

// ✅ Full union so ChatView can use "sending" and "error" for optimistic messages
export type MessageStatus = "sending" | "sent" | "error";

export type HistoryMessage = {
    id: string;
    tempId?: string;              // ✅ Added — required for optimistic reconciliation
    content: string | null;
    channelId: string;
    userId: string;
    parentMessageId: string | null;
    attachments: unknown;
    createdAt: string;
    user: MessageUser;
    status: MessageStatus;        // ✅ Full union, was "sent" only
};

type UseMessageHistoryReturn = {
    messages: HistoryMessage[];
    isLoading: boolean;
    isFetchingMore: boolean;
    hasMore: boolean;
    error: string | null;
    loadMore: () => void;
    prependMessage: (msg: HistoryMessage) => void;
    replaceOptimistic: (tempId: string, confirmed: HistoryMessage) => void;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const LIMIT = 30;

export function useMessageHistory(channelId: string): UseMessageHistoryReturn {
    const [messages, setMessages] = useState<HistoryMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const cursorRef = useRef<string | null>(null);

    const fetchMessages = useCallback(async (cursor: string | null, isInitial: boolean) => {
        if (isInitial) setIsLoading(true);
        else setIsFetchingMore(true);
        setError(null);

        try {
            const params = new URLSearchParams({ channelId, limit: String(LIMIT) });
            if (cursor) params.set("cursor", cursor);

            const res = await fetch(`${BASE_URL}/message/getMessages?${params}`, {
                credentials: "include",
            });

            if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);

            const data: { messages: HistoryMessage[]; nextCursor: string | null } = await res.json();

            cursorRef.current = data.nextCursor;
            setHasMore(data.nextCursor !== null);

            const withStatus: HistoryMessage[] = data.messages.map((m) => ({
                ...m,
                status: "sent" as MessageStatus,
            }));

            setMessages((prev) =>
                isInitial ? withStatus : [...withStatus, ...prev]
            );
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to load messages";
            setError(msg);
        } finally {
            if (isInitial) setIsLoading(false);
            else setIsFetchingMore(false);
        }
    }, [channelId]);

    useEffect(() => {
        cursorRef.current = null;
        setMessages([]);
        setHasMore(true);
        setError(null);
        fetchMessages(null, true);
    }, [channelId, fetchMessages]);

    const loadMore = useCallback(() => {
        if (isFetchingMore || !hasMore) return;
        fetchMessages(cursorRef.current, false);
    }, [isFetchingMore, hasMore, fetchMessages]);

    const prependMessage = useCallback((msg: HistoryMessage) => {
        setMessages((prev) => [...prev, msg]);
    }, []);

    const replaceOptimistic = useCallback((tempId: string, confirmed: HistoryMessage) => {
        setMessages((prev) =>
            prev.map((m) => (m.tempId === tempId ? confirmed : m))
        );
    }, []);

    return {
        messages,
        isLoading,
        isFetchingMore,
        hasMore,
        error,
        loadMore,
        prependMessage,
        replaceOptimistic,
    };
}