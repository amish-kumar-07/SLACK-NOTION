"use client";

import { useEffect, useRef, useCallback } from "react";
import { Send, Paperclip, Smile, AtSign, FileText, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebSocket, IncomingMessage } from "@/app/context/WebSocketProvider";
import { useAuth } from "@/app/context/AuthContext";
import { useMessages } from "@/app/hooks/useMessages";
import { useMessageStore } from "@/app/store/useMessageStore";

// ========================================
// TYPES
// ========================================
type ChatViewProps = {
  workspaceId: string;
  channelId: string;
  channelName: string;
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
export const ChatView = ({ workspaceId, channelId, channelName }: ChatViewProps) => {
  // Lazy-loaded + cached messages from useMessages hook
  const { messages, isLoading, isLoadingMore, hasMore, loadMore, error } =
    useMessages(channelId, channelName);

  // Zustand action to append incoming WebSocket messages
  const { appendMessage, reconcileMessage } = useMessageStore();

  const { sendMessage, subscribe } = useWebSocket();
  const { user } = useAuth();

  // Refs for scroll logic
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on initial load only
  useEffect(() => {
    if (messages.length > 0 && isFirstLoad.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      isFirstLoad.current = false;
    }
  }, [messages.length]);

  // Reset first load flag on channel change
  useEffect(() => {
    isFirstLoad.current = true;
  }, [channelId]);

  // Load more with scroll position preservation
  const handleLoadMore = useCallback(async () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const prevScrollHeight = container.scrollHeight;
    await loadMore();

    requestAnimationFrame(() => {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - prevScrollHeight;
    });
  }, [loadMore]);

  // IntersectionObserver watching top sentinel
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { root: scrollContainerRef.current, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, handleLoadMore]);

  // Subscribe to WebSocket incoming messages
  useEffect(() => {
    const unsubscribe = subscribe((incoming: IncomingMessage) => {
      if (incoming.type !== "message:receive" || !incoming.data) return;
      if (incoming.data.channelId !== channelId) return;

      const serverMsg = incoming.data;

      // If this echo has a tempId it means WE sent it — reconcile instead of appending
      if (serverMsg.tempId) {
        reconcileMessage(channelId, serverMsg.tempId, {
          id: serverMsg.id ?? serverMsg.tempId,
          content: serverMsg.content,
          channelId: serverMsg.channelId,
          userId: serverMsg.userId,
          parentMessageId: null,
          name: channelName,
          attachments: [],
          createdAt: serverMsg.timestamp,
          user: {
            id: serverMsg.userId,
            name: serverMsg.userEmail,
            email: serverMsg.userEmail,
          },
        });
      } else {
        // Someone else sent it — just append
        appendMessage(channelId, {
          id: serverMsg.id ?? `${Date.now()}-${Math.random()}`,
          content: serverMsg.content,
          channelId: serverMsg.channelId,
          userId: serverMsg.userId,
          parentMessageId: null,
          name: channelName,
          attachments: [],
          createdAt: serverMsg.timestamp,
          user: {
            id: serverMsg.userId,
            name: serverMsg.userEmail,
            email: serverMsg.userEmail,
          },
        });
      }

      // Auto-scroll to bottom for new messages
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    });

    return () => unsubscribe();
  }, [subscribe, channelId, channelName, appendMessage]);

  // Send message with optimistic update
  const handleSend = useCallback(() => {
    const content = inputRef.current?.value.trim();
    if (!content || !user) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const createdAt = new Date().toISOString();

    // Optimistically add to the store immediately
    appendMessage(channelId, {
      id: tempId,
      content,
      channelId,
      userId: user.id,
      parentMessageId: null,
      name: channelName,
      attachments: [],
      createdAt,
      user: {
        id: user.id,
        name: user.email,
        email: user.email,
      },
    });

    if (inputRef.current) inputRef.current.value = "";

    // Scroll to bottom after optimistic message
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    // Send via WebSocket
    sendMessage({
      type: "message:send",
      data: {
        channelId,
        channelName,
        userId: user.id,
        content,
        tempId,
        createdAt,
      },
    });
  }, [user, channelId, channelName, sendMessage, appendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Initial loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950">
        <p className="text-gray-500 text-sm">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-6"
      >
        {/* Top sentinel — triggers lazy load when visible */}
        <div ref={topSentinelRef} className="h-1" />

        {/* Loading older messages */}
        {isLoadingMore && (
          <div className="text-center text-sm text-gray-500 py-2">
            Loading older messages...
          </div>
        )}

        {/* Beginning of channel */}
        {!hasMore && messages.length > 0 && (
          <div className="text-center text-sm text-gray-600 py-2">
            Beginning of #{channelName}
          </div>
        )}

        {/* Fetch error */}
        {error && (
          <div className="text-center text-sm text-red-400 py-2">{error}</div>
        )}

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, index) => {
          const isCurrentUser = msg.userId === user?.id;
          const avatarGradient = getAvatarGradient(msg.userId);
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
                  <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                </div>
                <p className="mt-1 text-gray-300">{msg.content}</p>
              </div>
            </div>
          );
        })}

        {/* Invisible anchor for auto-scroll to bottom */}
        <div ref={bottomRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-900 rounded-xl border border-slate-700 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
          <div className="flex items-center gap-2 px-4 py-3">
            <input
              ref={inputRef}
              type="text"
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