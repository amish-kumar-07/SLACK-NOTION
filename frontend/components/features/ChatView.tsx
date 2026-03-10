"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Send, Paperclip, Smile, AtSign, FileText,
  PenTool, MoreHorizontal, Reply, Pencil, Trash2, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebSocket, IncomingMessage, SendMessagePayload } from "@/app/context/WebSocketProvider";
import { useAuth } from "@/app/context/AuthContext";
import { useMessages } from "@/app/hooks/useMessages";
import { useMessageStore, Attachment, Message } from "@/app/store/useMessageStore";
import { useDocumentStore } from "@/app/store/useDocumentStore";
import { useDocuments } from "@/app/hooks/useDocuments";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ========================================
// TYPES
// ========================================
type ChatViewProps = {
  workspaceId: string;
  channelId: string;
  channelName: string;
};

// ========================================
// MODULE-LEVEL PURE HELPERS
// Defined outside the component — stable references, never recreated on render.
// This is the correct pattern for utility functions that don't need React state.
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

/**
 * "rashusingh110@gmail.com" → "Rashusingh110"
 * Used wherever we only have an email but need a display name.
 */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Normalizes the attachments field from the server.
 * WS broadcast may send full Attachment objects (new upload flow) or
 * plain URL strings (legacy DB rows). Handles both safely.
 */
function normalizeAttachments(raw: unknown[] | undefined): Attachment[] {
  if (!raw || raw.length === 0) return [];
  return raw.map((item): Attachment => {
    if (typeof item === "string") {
      const fileName = decodeURIComponent(item.split("/").pop() ?? "file");
      return {
        id: item,
        url: item,
        name: fileName,
        type: "application/octet-stream",
        size: 0,
        uploadedAt: "",
      };
    }
    return item as Attachment;
  });
}

// ========================================
// DOC LINK — encoding / decoding
// Messages that share a doc are plain text with this prefix so they
// round-trip cleanly through the existing WebSocket + message store
// without any schema changes.
// Format: %%DOC_LINK%%{"title":"...","url":"..."}
// ========================================
const DOC_LINK_PREFIX = "%%DOC_LINK%%";

function encodeDocLink(title: string, url: string): string {
  return `${DOC_LINK_PREFIX}${JSON.stringify({ title, url })}`;
}

function parseDocLink(content: string): { title: string; url: string } | null {
  if (!content.startsWith(DOC_LINK_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(DOC_LINK_PREFIX.length));
  } catch {
    return null;
  }
}

// ── Doc link rich card (shown instead of plain text) ─────────────────────────
function DocLinkCard({ title, url }: { title: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-purple-500/60 hover:bg-slate-800 transition-all max-w-sm group/card"
    >
      <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 group-hover/card:bg-purple-500/30 transition-colors">
        <FileText className="w-4 h-4 text-purple-400" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{title || "Untitled"}</p>
        <p className="text-xs text-gray-500 mt-0.5">Click to open document</p>
      </div>
    </a>
  );
}

// ── Doc picker modal ──────────────────────────────────────────────────────────
function DocPickerModal({
  documents,
  search,
  onSearch,
  onSelect,
  onClose,
}: {
  documents: { id: string; title: string }[];
  search: string;
  onSearch: (v: string) => void;
  onSelect: (doc: { id: string; title: string }) => void;
  onClose: () => void;
}) {
  const filtered = documents.filter((d) =>
    (d.title || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
        <span className="text-sm font-semibold text-white">Share a Document</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-0.5 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-700">
        <input
          autoFocus
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search documents..."
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>
      {/* List */}
      <div className="max-h-52 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">No documents found</div>
        ) : (
          filtered.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onSelect(doc)}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-slate-700 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <span className="text-sm text-gray-200 truncate">{doc.title || "Untitled"}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
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

  // ── Documents (reuse existing hook + store — no extra fetch if already loaded) ──
  const { documents } = useDocuments(workspaceId, channelId);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const docPickerRef = useRef<HTMLDivElement>(null);

  // ── Menu state ──
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Reply state ──
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    content: string;
    userName: string;
  } | null>(null);

  // ── Edit state ──
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // ── Attachment state ──
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ─── Reset all local state on channel change ──────────────────────────────
  useEffect(() => {
    isFirstLoad.current = true;
    setActiveMenu(null);
    setReplyingTo(null);
    setEditingMessage(null);
    setPendingAttachment(null);
    setShowDocPicker(false);
    setDocSearch("");
  }, [channelId]);

  // ─── Close menu on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
      if (docPickerRef.current && !docPickerRef.current.contains(e.target as Node)) {
        setShowDocPicker(false);
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
  // normalizeAttachments and nameFromEmail are module-level functions (not hooks),
  // so they are stable and do NOT need to be in the dependency array.
  useEffect(() => {
    const unsubscribe = subscribe((incoming: IncomingMessage) => {
      if (!incoming.data) return;

      // ── New message received ──
      if (incoming.type === "message:receive") {
        if (incoming.data.channelId !== channelId) return;
        const s = incoming.data;

        const confirmedMessage: Message = {
          id: s.id ?? s.tempId ?? `${Date.now()}-${Math.random()}`,
          content: s.content,
          channelId: s.channelId,
          userId: s.userId,
          parentMessageId: s.parentMessageId ?? null,
          parentMessage: s.parentMessage ?? null,
          name: channelName,
          attachments: normalizeAttachments(s.attachments),
          createdAt: s.timestamp,
          user: {
            id: s.userId,
            name: nameFromEmail(s.userEmail),
            email: s.userEmail,
          },
        };

        if (s.tempId) {
          // Sender's path: replace optimistic message with server-confirmed one
          reconcileMessage(channelId, s.tempId, confirmedMessage);
        } else {
          // Receiver's path: append as new message
          appendMessage(channelId, confirmedMessage);
        }

        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      }

      // ── Edit confirmed by server — update for ALL users in the room ──
      if (incoming.type === "message:edited") {
        if (incoming.data.channelId !== channelId) return;
        updateMessage(channelId, incoming.data.messageId as string, incoming.data.content);
      }

      // ── Delete confirmed by server — remove for ALL users in the room ──
      if (incoming.type === "message:deleted") {
        if (incoming.data.channelId !== channelId) return;
        deleteMessage(channelId, incoming.data.messageId as string);
      }
    });

    return () => unsubscribe();
  }, [subscribe, channelId, channelName, appendMessage, reconcileMessage, updateMessage, deleteMessage]);

  // ─── File upload ──────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so the same file can be re-selected immediately after
    e.target.value = "";

    const token = sessionStorage.getItem("CollabAIToken");
    if (!token) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Do NOT manually set Content-Type — the browser must set it
      // automatically so the multipart boundary is included correctly.
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success) {
        setPendingAttachment(res.data.attachment as Attachment);
      }
    } catch (err) {
      console.error("[ChatView] upload error:", err);
    } finally {
      setIsUploading(false);
    }
  }, []);

  // ─── Send (or reply) ──────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const content = inputRef.current?.value.trim();
    // Allow send if there's text OR a pending attachment
    if ((!content && !pendingAttachment) || !user) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const createdAt = new Date().toISOString();
    const messageContent = content ?? "";

    // Optimistic append — shows instantly in sender's UI
    appendMessage(channelId, {
      id: tempId,
      content: messageContent,
      channelId,
      userId: user.id,
      parentMessageId: replyingTo?.id ?? null,
      parentMessage: replyingTo
        ? { id: replyingTo.id, content: replyingTo.content, userId: "", userName: replyingTo.userName }
        : null,
      name: channelName,
      attachments: pendingAttachment ? [pendingAttachment] : [],
      createdAt,
      user: { id: user.id, name: nameFromEmail(user.email), email: user.email },
    });

    // Clear input immediately so the UI feels instant
    if (inputRef.current) inputRef.current.value = "";
    setReplyingTo(null);
    setPendingAttachment(null);

    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    // Send to server over WebSocket
    sendMessage({
      type: "message:send",
      data: {
        channelId,
        channelName,
        userId: user.id,
        content: messageContent,
        tempId,
        createdAt,
        parentMessageId: replyingTo?.id ?? null,
        attachments: pendingAttachment ? [pendingAttachment] : [],
      },
    });
  }, [user, channelId, channelName, sendMessage, appendMessage, replyingTo, pendingAttachment]);

  // ─── Edit submit — optimistic update + broadcast to server ───────────────
  const handleEditSubmit = useCallback(() => {
    const newContent = editInputRef.current?.value.trim();
    if (!newContent || !editingMessage || !user) return;

    // Optimistically update in store so UI reflects instantly
    updateMessage(channelId, editingMessage.id, newContent);

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

  // ─── Delete — optimistic remove + broadcast to server ────────────────────
  const handleDelete = useCallback((messageId: string) => {
    // Optimistically remove so UI reflects instantly
    deleteMessage(channelId, messageId);

    sendMessage({
      type: "message:delete",
      data: { messageId, channelId },
    } as any);
  }, [channelId, sendMessage, deleteMessage]);

  // ─── Share doc — sends a special encoded message that renders as a card ──
  const handleDocSelect = useCallback((doc: { id: string; title: string }) => {
    if (!user) return;

    const APP_BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const docUrl = `${APP_BASE}/pages/w/${workspaceId}/c/${channelId}/d/${doc.id}`;
    const content = encodeDocLink(doc.title, docUrl);

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const createdAt = new Date().toISOString();

    // Optimistic append
    appendMessage(channelId, {
      id: tempId,
      content,
      channelId,
      userId: user.id,
      parentMessageId: null,
      parentMessage: null,
      name: channelName,
      attachments: [],
      createdAt,
      user: { id: user.id, name: nameFromEmail(user.email), email: user.email },
    });

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
        parentMessageId: null,
        attachments: [],
      },
    });

    setShowDocPicker(false);
    setDocSearch("");
  }, [user, workspaceId, channelId, channelName, sendMessage, appendMessage]);

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

        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">No messages yet. Say hello! 👋</p>
          </div>
        )}

        {/* ── Message list ── */}
        {messages.map((msg: Message, index: number) => {
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

                {/* Reply context badge */}
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
                      defaultValue={editingMessage?.content ?? ""}
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
                  <>
                    {msg.content && (() => {
                      const docLink = parseDocLink(msg.content);
                      return docLink
                        ? <DocLinkCard title={docLink.title} url={docLink.url} />
                        : <p className="mt-1 text-gray-300 wrap-break-word">{msg.content}</p>;
                    })()}
                    {/* ── Attachment pills ── */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.attachments.map((att: Attachment) => (
                          <a
                            key={att.id ?? att.url}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={att.name}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-purple-500/60 hover:bg-slate-700 transition-colors max-w-xs"
                          >
                            <FileText className="w-4 h-4 shrink-0 text-purple-400" />
                            <span className="text-xs text-gray-400 truncate max-w-40">
                              {att.name}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </>
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

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />

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

        {/* Pending attachment preview */}
        {pendingAttachment && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-slate-800 border border-slate-700 rounded-lg">
            <FileText className="w-4 h-4 shrink-0 text-purple-400" />
            <span className="text-sm text-gray-300 truncate flex-1">{pendingAttachment.name}</span>
            <button
              onClick={() => setPendingAttachment(null)}
              className="text-gray-500 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`hover:text-white hover:bg-slate-800 ${pendingAttachment ? "text-purple-400" : "text-gray-400"}`}
              >
                {isUploading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Paperclip className="w-4 h-4" />
                }
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <AtSign className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <Smile className="w-4 h-4" />
              </Button>
              <div className="w-px h-4 bg-slate-700 mx-1" />
              <div className="relative" ref={docPickerRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setShowDocPicker((v) => !v); setDocSearch(""); }}
                  className={`hover:bg-blue-500/10 ${showDocPicker ? "text-blue-400 bg-blue-500/10" : "text-blue-400"}`}
                >
                  <FileText className="w-4 h-4" />
                </Button>
                {showDocPicker && (
                  <DocPickerModal
                    documents={documents}
                    search={docSearch}
                    onSearch={setDocSearch}
                    onSelect={handleDocSelect}
                    onClose={() => setShowDocPicker(false)}
                  />
                )}
              </div>
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