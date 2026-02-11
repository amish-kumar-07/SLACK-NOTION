// WorkspaceSidebar.tsx
'use client';
import { useState } from "react";
import { MessageSquare, FileText, PenTool, Settings, Plus, ChevronDown, Hash, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { InviteBox } from "../customComponent/Invitepopup";
import { useInvite } from "@/app/hooks/useInvites";
import { useToast } from "@/app/context/ToastContext";
import { useAuth } from "@/app/context/AuthContext";

interface WorkspaceSidebarProps {
  activeMode: "chat" | "documents";
  onModeChange: (mode: "chat" | "documents") => void;
  workspaceName: string;
  workspaceId: string;
  channelId: string
}

export const WorkspaceSidebar = ({ activeMode, onModeChange, workspaceName, workspaceId, channelId }: WorkspaceSidebarProps) => {
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { invite } = useInvite();
  const toast = useToast();
  const { user } = useAuth();

  const channels = [
    { id: "general", name: "general", unread: 3 },
    { id: "design", name: "design", unread: 0 },
    { id: "engineering", name: "engineering", unread: 1 },
  ];

  const handleInvite = async (name: string, email: string,role : "admin" | "member") => {
    // Validate user is logged in
    if (!user?.email) {
      toast.warning("Please Login Again");
      return;
    }

    // Validate workspaceId exists
    if (!workspaceId) {
      toast.error("Workspace ID not found");
      console.error("Missing workspaceId from params");
      return;
    }

    // Create payload with explicit property assignment
    const invitePayload = {
      email: email,
      invitedById: user.id,
      invitedByEmail: user.email,
      workspaceId: workspaceId,
      role
    };

    // Log for debugging (remove in production)
    console.log("handleInvite payload:", invitePayload);

    const success = await invite(invitePayload);

    if (success) {
      setIsInviteDialogOpen(false);
    }
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

        {/* Channels (visible in chat mode) */}
        {activeMode === "chat" && (
          <div className="p-3 flex-1 overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Channels
              </p>
              <button
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
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

            <div className="flex items-center justify-between px-3 py-2 mt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Members {/* Here Direct Message Feature can be implemented */}
              </p>
              <button
                className="text-gray-400 hover:text-white transition-colors"
                onClick={() => setIsInviteDialogOpen(true)}
              >
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

        {/* Documents List (visible in documents mode) */}
        {activeMode === "documents" && (
          <div className="p-3 flex-1 overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Recent Documents
              </p>
              <button className="text-gray-400 hover:text-white transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-0.5">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded text-gray-400 hover:bg-slate-800 hover:text-white transition-colors w-full text-left">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="flex-1 truncate">Project Roadmap 2024</span>
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded text-gray-400 hover:bg-slate-800 hover:text-white transition-colors w-full text-left">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="flex-1 truncate">Meeting Notes</span>
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded text-gray-400 hover:bg-slate-800 hover:text-white transition-colors w-full text-left">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="flex-1 truncate">Design Specs</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Section */}
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

      {/* Invite Dialog - ADD THIS OUTSIDE THE ASIDE */}
      <InviteBox
        open={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onInvite={handleInvite}
        roomName={workspaceName}
      />
    </>
  );
};