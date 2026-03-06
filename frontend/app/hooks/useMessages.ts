import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useMessageStore, Message, Attachment } from "@/app/store/useMessageStore";
import { useToast } from "../context/ToastContext";

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

// ─── Normalize a single attachment from ANY possible DB shape ────────────────
//
// The DB / ORM may return attachments in several shapes depending on how
// the relation is set up. This function handles all of them:
//
//   Shape A — full object (our upload endpoint shape):
//     { id, url, name, type, size, uploadedAt }
//
//   Shape B — partial object (only url + name saved):
//     { url, name }  or  { url }
//
//   Shape C — join-table row (Prisma/Drizzle many-to-many):
//     { attachment: { id, url, name, ... } }
//     { messageAttachment: { id, url, name, ... } }
//
//   Shape D — plain URL string:
//     "https://bucket.supabase.co/..."
//
function normalizeAttachment(item: unknown): Attachment | null {
  if (!item) return null;

  // Shape D — plain string URL
  if (typeof item === "string") {
    const fileName = decodeURIComponent(item.split("/").pop() ?? "file");
    return { id: item, url: item, name: fileName, type: "application/octet-stream", size: 0, uploadedAt: "" };
  }

  if (typeof item !== "object") return null;

  const obj = item as Record<string, unknown>;

  // Shape C — join-table wrapper: unwrap the nested attachment object
  const nested =
    (obj.attachment as Record<string, unknown> | undefined) ??
    (obj.messageAttachment as Record<string, unknown> | undefined);

  if (nested && typeof nested === "object") {
    return normalizeAttachment(nested);
  }

  // Shape A / B — direct object with at least a url
  const url = (obj.url as string) ?? "";
  if (!url) return null; // no url = not a valid attachment, skip it

  const fileName =
    (obj.name as string) ??
    decodeURIComponent(url.split("/").pop() ?? "file");

  return {
    id: (obj.id as string) ?? url,
    url,
    name: fileName,
    type: (obj.type as string) ?? "application/octet-stream",
    size: (obj.size as number) ?? 0,
    uploadedAt: (obj.uploadedAt as string) ?? "",
  };
}

// ─── Normalize all messages coming from the REST API ─────────────────────────
// Ensures every message has a valid Attachment[] regardless of DB shape.
// All other message fields are passed through untouched.
function normalizeMessages(raw: unknown[]): Message[] {
  return raw.map((msg) => {
    const m = msg as Message & { attachments?: unknown[] };

    const normalized = Array.isArray(m.attachments)
      ? (m.attachments
          .map(normalizeAttachment)
          .filter(Boolean) as Attachment[])
      : [];

    return { ...m, attachments: normalized };
  });
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

  // ─── Initial Fetch (only if not already cached) ───────────────────────────
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
          headers: { Authorization: `Bearer ${token}` },
          params: { channelId, name: channelName, limit: LIMIT },
        });

        if (res.data.success) {
          // Debug: log raw first message to see what DB actually returns
          if (res.data.messages?.length > 0) {
            console.log("[useMessages] raw message sample:", JSON.stringify(res.data.messages[0], null, 2));
          }

          setInitialMessages(
            channelId,
            normalizeMessages(res.data.messages),
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
  }, [channelId, channelName]);

  // ─── Load More (called when user scrolls to top) ──────────────────────────
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextCursor) return;

    const token = sessionStorage.getItem("CollabAIToken");
    if (!token) {
      toast.warning("Please Login Again!");
      return;
    }

    setIsLoadingMore(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/message/getMessages`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { channelId, name: channelName, limit: LIMIT, cursor: nextCursor },
      });

      if (res.data.success) {
        prependMessages(
          channelId,
          normalizeMessages(res.data.messages),
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

  return { messages, isLoading, isLoadingMore, hasMore, loadMore, error };
}