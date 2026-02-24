"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Send, Paperclip, Smile, AtSign, FileText, PenTool, MoreHorizontal, Reply, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebSocket, IncomingMessage, SendMessagePayload } from "@/app/context/WebSocketProvider";
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
  const { messages, isLoading, isLoadingMore, hasMore, loadMore, error } =
    useMessages(channelId, channelName);

  const { appendMessage, reconcileMessage, updateMessage, deleteMessage } = useMessageStore();
  const { sendMessage, subscribe } = useWebSocket();
  const { user } = useAuth();

  // ── Menu state ──
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Reply state ──
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; userName: string } | null>(null);

  // ── Edit state ──
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // ── Scroll refs ──
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Scroll to bottom on initial load ────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0 && isFirstLoad.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      isFirstLoad.current = false;
    }
  }, [messages.length]);

  // ─── Reset on channel change ──────────────────────────────────────────────
  useEffect(() => {
    isFirstLoad.current = true;
    setActiveMenu(null);
    setReplyingTo(null);
    setEditingMessage(null);
  }, [channelId]);

  // ─── Close menu on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Focus edit input when editing starts ────────────────────────────────
  useEffect(() => {
    if (editingMessage) {
      setTimeout(() => editInputRef.current?.focus(), 0);
    }
  }, [editingMessage]);

  // ─── Load more with scroll position preservation ──────────────────────────
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

  // ─── IntersectionObserver ─────────────────────────────────────────────────
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

  // ─── WebSocket subscriber ─────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribe((incoming: IncomingMessage) => {
      if (!incoming.data) return;

      // ── New message ──
      if (incoming.type === "message:receive") {
        if (incoming.data.channelId !== channelId) return;
        const serverMsg = incoming.data;

        if (serverMsg.tempId) {
          reconcileMessage(channelId, serverMsg.tempId, {
            id: serverMsg.id ?? serverMsg.tempId,
            content: serverMsg.content,
            channelId: serverMsg.channelId,
            userId: serverMsg.userId,
            parentMessageId: serverMsg.parentMessageId ?? null,
            // parentMessage snapshot comes from DB on page load; for optimistic messages
            // we pass null here — the badge still shows from replyingTo state while composing
            parentMessage: serverMsg.parentMessage ?? null,
            name: channelName,
            attachments: [],
            createdAt: serverMsg.timestamp,
            user: { id: serverMsg.userId, name: serverMsg.userEmail, email: serverMsg.userEmail },
          });
        } else {
          appendMessage(channelId, {
            id: serverMsg.id ?? `${Date.now()}-${Math.random()}`,
            content: serverMsg.content,
            channelId: serverMsg.channelId,
            userId: serverMsg.userId,
            parentMessageId: serverMsg.parentMessageId ?? null,
            parentMessage: serverMsg.parentMessage ?? null,
            name: channelName,
            attachments: [],
            createdAt: serverMsg.timestamp,
            user: { id: serverMsg.userId, name: serverMsg.userEmail, email: serverMsg.userEmail },
          });
        }

        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      }

      // ✅ NEW: Edit confirmed by server — update for ALL users in the room
      if (incoming.type === "message:edited") {
        if (incoming.data.channelId !== channelId) return;
        updateMessage(channelId, incoming.data.messageId as string, incoming.data.content);
      }

      // ✅ NEW: Delete confirmed by server — remove for ALL users in the room
      if (incoming.type === "message:deleted") {
        if (incoming.data.channelId !== channelId) return;
        deleteMessage(channelId, incoming.data.messageId as string);
      }
    });

    return () => unsubscribe();
  }, [subscribe, channelId, channelName, appendMessage, reconcileMessage, updateMessage, deleteMessage]);

  // ─── Send (or reply) ──────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const content = inputRef.current?.value.trim();
    if (!content || !user) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const createdAt = new Date().toISOString();

    appendMessage(channelId, {
      id: tempId,
      content,
      channelId,
      userId: user.id,
      parentMessageId: replyingTo?.id ?? null,
      // Build parentMessage snapshot from replyingTo so badge shows instantly while optimistic
      parentMessage: replyingTo
        ? { id: replyingTo.id, content: replyingTo.content, userId: "", userName: replyingTo.userName }
        : null,
      name: channelName,
      attachments: [],
      createdAt,
      user: { id: user.id, name: user.email, email: user.email },
    });

    if (inputRef.current) inputRef.current.value = "";
    setReplyingTo(null);

    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    sendMessage({
      type: "message:send",
      data: {
        channelId,
        channelName,
        userId: user.id,
        content,
        tempId,
        createdAt,
        parentMessageId: replyingTo?.id ?? null,
      },
    });
  }, [user, channelId, channelName, sendMessage, appendMessage, replyingTo]);

  // ✅ NEW: Edit submit — optimistic update + send to server
  const handleEditSubmit = useCallback(() => {
    const newContent = editInputRef.current?.value.trim();
    if (!newContent || !editingMessage || !user) return;

    // Optimistically update the store immediately so the UI feels instant
    updateMessage(channelId, editingMessage.id, newContent);

    // Send to server — backend calls editMessage() service and broadcasts message:edited
    sendMessage({
      type: "message:edit",
      data: {
        messageId: editingMessage.id,
        channelId,
        content: newContent,
      },
    } as any);

    setEditingMessage(null);
  }, [editingMessage, user, channelId, sendMessage, updateMessage]);

  // ✅ NEW: Delete — optimistic remove + send to server
  const handleDelete = useCallback((messageId: string) => {
    // Optimistically remove from store immediately so the UI feels instant
    deleteMessage(channelId, messageId);

    // Send to server — backend calls deleteMessage() service and broadcasts message:deleted
    sendMessage({
      type: "message:delete",
      data: {
        messageId,
        channelId,
      },
    } as any);
  }, [channelId, sendMessage, deleteMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      setReplyingTo(null);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === "Escape") {
      setEditingMessage(null);
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950">
        <p className="text-gray-500 text-sm">Loading messages...</p>
      </div>
    );
  }

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="flex flex-col h-full bg-slate-950">

      {/* ── Messages Area ── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        <div ref={topSentinelRef} className="h-1" />

        {isLoadingMore && (
          <div className="text-center text-sm text-gray-500 py-2">Loading older messages...</div>
        )}

        {!hasMore && messages.length > 0 && (
          <div className="text-center text-sm text-gray-600 py-2">
            Beginning of #{channelName}
          </div>
        )}

        {error && (
          <div className="text-center text-sm text-red-400 py-2">{error}</div>
        )}

        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}

        {/* ── Message list ── */}
        {messages.map((msg, index) => {
          const isCurrentUser = msg.userId === user?.id;
          const avatarGradient = getAvatarGradient(msg.userId);
          const displayName = isCurrentUser ? "You" : msg.user.name;
          const initial = msg.user?.name?.charAt(0)?.toUpperCase();
          const isMenuOpen = activeMenu === msg.id;
          const isEditing = editingMessage?.id === msg.id;

          return (
            <div
              key={msg.id}
              className="flex gap-3 animate-fade-in group relative"
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

                {/* Reply context badge — uses parentMessage snapshot from DB, always accurate */}
                {msg.parentMessageId && msg.parentMessage && (
                  <div className="flex items-center gap-1.5 text-xs mb-1 bg-slate-800/60 border-l-2 border-purple-500/50 rounded px-2 py-1 max-w-sm">
                    <Reply className="w-3 h-3 shrink-0 text-purple-400" />
                    <span className="text-purple-400 font-medium shrink-0">
                      {msg.parentMessage.userId === user?.id ? "You" : msg.parentMessage.userName}:
                    </span>
                    <span className="truncate text-gray-500">
                      {msg.parentMessage.content || "📎 Attachment"}
                    </span>
                  </div>
                )}

                {/* Message content OR edit input */}
                {isEditing ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      ref={editInputRef}
                      defaultValue={editingMessage.content}
                      onKeyDown={handleEditKeyDown}
                      className="flex-1 bg-slate-800 border border-purple-500 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
                    />
                    <button
                      onClick={handleEditSubmit}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingMessage(null)}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-gray-300">{msg.content}</p>
                )}
              </div>

              {/* ── 3-dot menu button (shows on hover) ── */}
              <div className="relative shrink-0 self-start mt-1">
                <button
                  onClick={() => setActiveMenu(isMenuOpen ? null : msg.id)}
                  className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-slate-700
                             opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {/* ── Dropdown ── */}
                {isMenuOpen && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-7 z-50 w-40 bg-slate-800 border border-slate-700
                               rounded-lg shadow-xl overflow-hidden"
                  >
                    {/* Reply — everyone */}
                    <button
                      onClick={() => {
                        setReplyingTo({
                          id: msg.id,
                          content: msg.content,
                          userName: displayName,
                        });
                        setActiveMenu(null);
                        inputRef.current?.focus();
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300
                                 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <Reply className="w-4 h-4" />
                      Reply
                    </button>

                    {/* Edit — only own messages */}
                    {isCurrentUser && (
                      <button
                        onClick={() => {
                          setEditingMessage({ id: msg.id, content: msg.content });
                          setActiveMenu(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300
                                   hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    )}

                    {/* Delete — only own messages */}
                    {isCurrentUser && (
                      <button
                        onClick={() => {
                          handleDelete(msg.id);
                          setActiveMenu(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400
                                   hover:bg-red-500/10 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Message Input ── */}
      <div className="p-4 border-t border-slate-800">

        {/* Reply banner */}
        {replyingTo && (
          <div className="flex items-center justify-between px-3 py-2 mb-2 bg-slate-800 
                          border-l-2 border-purple-500 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-gray-400 min-w-0">
              <Reply className="w-3.5 h-3.5 shrink-0 text-purple-400" />
              <span className="text-purple-400 font-medium shrink-0">
                {replyingTo.userName}:
              </span>
              <span className="truncate text-gray-400">{replyingTo.content}</span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-gray-500 hover:text-white ml-2 shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        <div className="bg-slate-900 rounded-xl border border-slate-700 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
          <div className="flex items-center gap-2 px-4 py-3">
            <input
              ref={inputRef}
              type="text"
              onKeyDown={handleKeyDown}
              placeholder={replyingTo ? `Reply to ${replyingTo.userName}...` : "Type a message..."}
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