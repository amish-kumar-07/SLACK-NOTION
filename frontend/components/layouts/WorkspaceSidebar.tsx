// components/layouts/WorkspaceSidebar.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, FileText, PenTool, Settings, Plus, ChevronDown, Hash, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { InviteBox } from "../customComponent/Invitepopup";
import { useInvite } from "@/app/hooks/useInvites";
import { useToast } from "@/app/context/ToastContext";
import { useAuth } from "@/app/context/AuthContext";
import { useWebSocket, IncomingMessage } from "@/app/context/WebSocketProvider";
import { useDocuments } from "@/app/hooks/useDocuments";
import { useDocumentStore, Document } from "@/app/store/useDocumentStore";
import { CreateDocumentDrawer } from "@/components/features/DocumentsLanding";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceSidebarProps {
  activeMode: "chat" | "documents";
  onModeChange: (mode: "chat" | "documents") => void;
  workspaceName: string;
  workspaceId: string;
  channelId: string;
  activeDocumentId?: string | null;
}

interface ActiveUser {
  userId: string;
  userEmail: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "rashusingh110@gmail.com" → "Rashusingh" */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Deterministic avatar color from userId */
function getAvatarColor(seed: string): string {
  const colors = [
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
  return colors[Math.abs(hash) % colors.length];
}

// ─── Component ────────────────────────────────────────────────────────────────

export const WorkspaceSidebar = ({
  activeMode,
  onModeChange,
  workspaceName,
  workspaceId,
  channelId,
  activeDocumentId,
}: WorkspaceSidebarProps) => {
  const router = useRouter();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { invite } = useInvite();
  const toast = useToast();
  const { user } = useAuth();
  const { subscribe, requestPresence } = useWebSocket();

  // ── Documents ─────────────────────────────────────────────────────────────
  const { documents } = useDocuments(workspaceId, channelId);
  const prependDocument = useDocumentStore((s) => s.prependDocument);

  const handleDocumentCreated = (doc: Document) => {
    prependDocument(doc);
    setDrawerOpen(false);
    router.push(`/pages/w/${workspaceId}/c/${channelId}/d/${doc.id}`);
  };

  const handleSelectDoc = (docId: string) => {
    router.push(`/pages/w/${workspaceId}/c/${channelId}/d/${docId}`);
  };

  // ── Active users presence state ───────────────────────────────────────────
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const presenceReceivedRef = useRef(false);

  useEffect(() => {
    setActiveUsers([]);
    presenceReceivedRef.current = false;

    // Ask server for current room members immediately — no refresh needed
    requestPresence();

    const unsubscribe = subscribe((msg: IncomingMessage) => {
      // ROOM_PRESENCE — authoritative snapshot from server on join
      // After this arrives, ignore USER_JOINED (already included in snapshot)
      if (msg.type === "ROOM_PRESENCE") {
        const incoming = msg as any;
        if (incoming.channelId !== channelId) return;
        const seen = new Set<string>();
        const users: ActiveUser[] = (incoming.users ?? []).filter((u: any) => {
          if (!u.userId || seen.has(u.userId)) return false;
          seen.add(u.userId);
          return true;
        }).map((u: any) => ({ userId: u.userId, userEmail: u.userEmail }));
        presenceReceivedRef.current = true;
        setActiveUsers(users);
        return;
      }

      // USER_JOINED — always add new users, just dedupe
      // (presenceReceivedRef only blocks re-adding the joining user themselves)
      if (msg.type === "USER_JOINED") {
        const { userId, userEmail } = msg;
        if (!userId || !userEmail) return;
        setActiveUsers((prev) => {
          if (prev.some((u) => u.userId === userId)) return prev;
          return [...prev, { userId, userEmail }];
        });
        return;
      }

      // USER_LEFT — always remove regardless
      if (msg.type === "USER_LEFT") {
        const { userId } = msg;
        if (!userId) return;
        setActiveUsers((prev) => prev.filter((u) => u.userId !== userId));
        return;
      }
    });

    return () => unsubscribe();
  }, [subscribe, channelId, requestPresence]);

  // ── Existing logic (unchanged) ────────────────────────────────────────────

  const channels = [
    { id: "general", name: "general", unread: 3 },
  ];

  const handleInvite = async (name: string, email: string, role: "admin" | "member") => {
    if (!user?.email) {
      toast.warning("Please Login Again");
      return;
    }
    if (!workspaceId) {
      toast.error("Workspace ID not found");
      console.error("Missing workspaceId from params");
      return;
    }
    const invitePayload = {
      email,
      invitedById: user.id,
      invitedByEmail: user.email,
      workspaceId,
      role,
    };
    console.log("handleInvite payload:", invitePayload);
    const success = await invite(invitePayload);
    if (success) setIsInviteDialogOpen(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full">

        {/* Workspace Header */}
        <div className="p-4 border-b border-slate-800">
          <button className="flex items-center gap-2 w-full hover:bg-slate-800 rounded-lg p-2 -m-2 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
              {workspaceName.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-white flex-1 text-left truncate">
              {workspaceName}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Main Navigation */}
        <div className="p-3 space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 py-2">
            Workspace
          </p>
          <button
            onClick={() => onModeChange("chat")}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left",
              activeMode === "chat"
                ? "bg-purple-500/20 text-purple-300"
                : "text-gray-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {activeMode === "chat" && (
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400" />
              )}
            </div>
            <span className="font-medium">Chat</span>
          </button>
          <button
            onClick={() => onModeChange("documents")}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left",
              activeMode === "documents"
                ? "bg-purple-500/20 text-purple-300"
                : "text-gray-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <div className="relative">
              <FileText className="w-5 h-5" />
              {activeMode === "documents" && (
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-400" />
              )}
            </div>
            <span className="font-medium">Documents</span>
          </button>
        </div>

        {/* Channels (chat mode) */}
        {activeMode === "chat" && (
          <div className="p-3 flex-1 overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Channels
              </p>
            </div>
            <div className="space-y-0.5">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded text-gray-400 hover:bg-slate-800 hover:text-white transition-colors w-full text-left"
                >
                  <Hash className="w-4 h-4" />
                  <span className="flex-1">{channel.name}</span>
                  {channel.unread > 0 && (
                    <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                      {channel.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Active Now — NEW SECTION ── */}
            <div className="flex items-center justify-between px-3 py-2 mt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Active Now
              </p>
              {activeUsers.length > 0 && (
                <span className="text-xs text-green-400 font-medium">
                  {activeUsers.length} online
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              {activeUsers.length === 0 ? (
                <p className="text-xs text-gray-600 px-3 py-1.5">No one else here yet</p>
              ) : (
                activeUsers.map((u) => {
                  const isMe = u.userId === user?.id;
                  const displayName = isMe ? "You" : nameFromEmail(u.userEmail);
                  const initial = displayName.charAt(0).toUpperCase();
                  const gradient = getAvatarColor(u.userId);

                  return (
                    <div
                      key={u.userId}
                      className="flex items-center gap-2 px-3 py-1.5 rounded text-gray-300"
                    >
                      {/* Avatar with green online dot */}
                      <div className="relative shrink-0">
                        <div
                          className={`w-6 h-6 rounded-full bg-linear-to-br ${gradient} flex items-center justify-center text-white text-xs font-semibold`}
                        >
                          {initial}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-slate-900" />
                      </div>
                      <span className="flex-1 text-sm truncate">
                        {displayName}
                      </span>
                      {isMe && (
                        <span className="text-xs text-gray-500">(you)</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Documents List (documents mode) */}
        {activeMode === "documents" && (
          <div className="p-3 flex-1 overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Documents
              </p>
              <button
                className="text-gray-400 hover:text-white transition-colors"
                onClick={() => setDrawerOpen(true)}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-0.5">
              {documents.length === 0 && (
                <p className="text-xs text-gray-500 px-3 py-2">No documents yet</p>
              )}
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleSelectDoc(doc.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded transition-colors w-full text-left",
                    activeDocumentId === doc.id
                      ? "bg-blue-500/20 text-blue-300"
                      : "text-gray-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="flex-1 truncate text-sm">{doc.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Section — unchanged */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => router.push(`/pages/w/${workspaceId}/c/${channelId}/s`)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-slate-800 hover:text-white transition-colors w-full text-left"
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>
        </div>
      </aside>

      <InviteBox
        open={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onInvite={handleInvite}
        roomName={workspaceName}
      />

      <CreateDocumentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        workspaceId={workspaceId}
        channelId={channelId}
        onCreated={handleDocumentCreated}
      />
    </>
  );
};