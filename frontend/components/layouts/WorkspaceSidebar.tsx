// components/layouts/WorkspaceSidebar.tsx
'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, FileText, Settings, Plus, ChevronDown, Hash, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { InviteBox } from "../customComponent/Invitepopup";
import { useInvite } from "@/app/hooks/useInvites";
import { useToast } from "@/app/context/ToastContext";
import { useAuth } from "@/app/context/AuthContext";
import { useDocumentStore, Document } from "@/app/store/useDocumentStore";
import { useDocuments } from "@/app/hooks/useDocuments";
import { CreateDocumentDrawer } from "@/components/features/DocumentsLanding";

interface WorkspaceSidebarProps {
  activeMode: "chat" | "documents";
  onModeChange: (mode: "chat" | "documents") => void;
  workspaceName: string;
  workspaceId: string;
  channelId: string;
  activeDocumentId?: string | null;
}

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

  // Read from Zustand store — populated by useDocuments hook (called in landing too)
  const { documents } = useDocuments(workspaceId, channelId);
  const prependDocument = useDocumentStore((s) => s.prependDocument);

  const channels = [
    { id: "general", name: "general", unread: 3 },
  ];

  const handleDocumentCreated = (doc: Document) => {
    prependDocument(doc);
    setDrawerOpen(false);
    router.push(`/pages/w/${workspaceId}/c/${channelId}/d/${doc.id}`);
  };

  const handleSelectDoc = (docId: string) => {
    router.push(`/pages/w/${workspaceId}/c/${channelId}/d/${docId}`);
  };

  const handleInvite = async (name: string, email: string, role: "admin" | "member") => {
    if (!user?.email) { toast.warning("Please Login Again"); return; }
    if (!workspaceId) { toast.error("Workspace ID not found"); return; }
    const success = await invite({
      email,
      invitedById: user.id,
      invitedByEmail: user.email,
      workspaceId,
      role,
    });
    if (success) setIsInviteDialogOpen(false);
  };

  return (
    <>
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
        {/* Workspace Header */}
        <div className="p-4 border-b border-slate-800">
          <button className="flex items-center gap-2 w-full hover:bg-slate-800 rounded-lg p-2 -m-2 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
              {workspaceName.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-white flex-1 text-left truncate">{workspaceName}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Main Navigation */}
        <div className="p-3 space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 py-2">Workspace</p>
          <button
            onClick={() => onModeChange("chat")}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left",
              activeMode === "chat" ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {activeMode === "chat" && <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400" />}
            </div>
            <span className="font-medium">Chat</span>
          </button>
          <button
            onClick={() => onModeChange("documents")}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left",
              activeMode === "documents" ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <div className="relative">
              <FileText className="w-5 h-5" />
              {activeMode === "documents" && <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-400" />}
            </div>
            <span className="font-medium">Documents</span>
          </button>
        </div>

        {/* Channels */}
        {activeMode === "chat" && (
          <div className="p-3 flex-1 overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Channels</p>
            </div>
            <div className="space-y-0.5">
              {channels.map((channel) => (
                <button key={channel.id} className="flex items-center gap-2 px-3 py-1.5 rounded text-gray-400 hover:bg-slate-800 hover:text-white transition-colors w-full text-left">
                  <Hash className="w-4 h-4" />
                  <span className="flex-1">{channel.name}</span>
                  {channel.unread > 0 && (
                    <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">{channel.unread}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between px-3 py-2 mt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Members</p>
              <button className="text-gray-400 hover:text-white transition-colors" onClick={() => setIsInviteDialogOpen(true)}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-0.5">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded text-gray-400 hover:bg-slate-800 hover:text-white transition-colors w-full text-left">
                <div className="w-6 h-6 rounded-full bg-linear-to-br from-green-400 to-emerald-500 shrink-0" />
                <span className="flex-1">Sarah Chen</span>
                <div className="w-2 h-2 rounded-full bg-green-500" />
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded text-gray-400 hover:bg-slate-800 hover:text-white transition-colors w-full text-left">
                <div className="w-6 h-6 rounded-full bg-linear-to-br from-orange-400 to-red-500 shrink-0" />
                <span className="flex-1">Alex Rivera</span>
              </button>
            </div>
          </div>
        )}

        {/* Documents List */}
        {activeMode === "documents" && (
          <div className="p-3 flex-1 overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Documents</p>
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

        {/* Bottom */}
        <div className="p-3 border-t border-slate-800">
          <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-slate-800 hover:text-white transition-colors w-full text-left">
            <Users className="w-5 h-5" />
            <span className="font-medium">Team Members</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-slate-800 hover:text-white transition-colors w-full text-left">
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