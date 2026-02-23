import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useMessageStore, Message } from "@/app/store/useMessageStore";
import { ToastProvider, useToast } from "../context/ToastContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const LIMIT = 10;

interface UseMessagesReturn {
  messages: Message[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  error: string | null;
}

export function useMessages(
  channelId: string,
  channelName: string,
): UseMessagesReturn {
  const { channels, setInitialMessages, prependMessages, isChannelFetched } =
    useMessageStore();

  const channelState = channels[channelId];
  const messages = channelState?.messages ?? [];
  const hasMore = channelState?.hasMore ?? false;
  const nextCursor = channelState?.nextCursor ?? null;
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Initial Fetch (only if not already cached) ──────────────────────────────
  useEffect(() => {
    if (!channelId || isChannelFetched(channelId)) return;

    const fetchInitial = async () => {
      const token = sessionStorage.getItem("CollabAIToken");
      if (!token) {
        toast.warning("Please Login Again!");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API_BASE}/message/getMessages`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: { channelId, name: channelName, limit: LIMIT },
        });

        if (res.data.success) {
          setInitialMessages(
            channelId,
            res.data.messages,
            res.data.nextCursor ?? null,
          );
        }
      } catch (err) {
        setError("Failed to load messages. Please try again.");
        console.error("[useMessages] initial fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitial();
  }, [channelId, channelName]); // re-runs only when channel changes

  // ─── Load More (called when user scrolls to top) ─────────────────────────────
  const loadMore = useCallback(async () => {
    // Guard: don't fetch if already loading, no more pages, or no cursor
    if (isLoadingMore || !hasMore || !nextCursor) return;

    // ✅ Get token here too — same as initial fetch
    const token = sessionStorage.getItem("CollabAIToken");
    if (!token) {
      toast.warning("Please Login Again!");
      return;
    }

    setIsLoadingMore(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/message/getMessages`, {
        headers: {
          Authorization: `Bearer ${token}`,  // ✅ was missing here
        },
        params: {
          channelId,
          name: channelName,
          limit: LIMIT,
          cursor: nextCursor,
        },
      });

      if (res.data.success) {
        prependMessages(
          channelId,
          res.data.messages,
          res.data.nextCursor ?? null,
        );
      }
    } catch (err) {
      setError("Failed to load older messages.");
      console.error("[useMessages] loadMore error:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [channelId, channelName, isLoadingMore, hasMore, nextCursor]);

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    error,
  };
}