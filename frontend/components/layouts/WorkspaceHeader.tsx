// WorkspaceHeader.tsx
'use client';
import { useState } from "react";
import { Bell, Search, HelpCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteDialog } from "@/components/customComponent/workspacepopup";
import { InviteBox } from "../customComponent/Invitepopup";
import { useInvite } from "@/app/hooks/useInvites";
import { useToast } from "@/app/context/ToastContext";
import { useAuth } from "@/app/context/AuthContext";
import { useNotifications } from "@/app/context/NotificationContext";

interface WorkspaceHeaderProps {
  activeMode: "chat" | "documents";
  activeName?: string;
  workspaceId: string;
  channelId: string
}

const modeLabels = {
  chat: "Chat",
  documents: "Documents",
};

const modeColors = {
  chat: "bg-purple-400",
  documents: "bg-blue-400",
  whiteboard: "bg-green-400",
};

export const WorkspaceHeader = ({ activeMode, activeName, workspaceId, channelId }: WorkspaceHeaderProps) => {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { invite } = useInvite();
  const toast = useToast();
  const { user } = useAuth();
  const { invites } = useNotifications();

  const activeUsers = [
    { id: 1, name: "Sarah", color: "from-green-400 to-emerald-500" },
    { id: 2, name: "Alex", color: "from-orange-400 to-red-500" },
    { id: 3, name: "Jordan", color: "from-blue-400 to-indigo-500" },
    { id: 4, name: "Taylor", color: "from-purple-400 to-pink-500" },
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
      role, 
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
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${modeColors[activeMode]}`} />
          <div className="flex items-center gap-2">
            <span className="text-gray-600">/</span>
            <span className="font-medium text-white">{activeName || "General"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="h-9 w-64 rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-slate-800 px-1.5 py-0.5 rounded">
              ⌘K
            </kbd>
          </div>

          {/* Active Users */}
          <div className="flex items-center -space-x-2 ml-4">
            {activeUsers.map((user, index) => (
              <div
                key={user.id}
                className={`w-8 h-8 rounded-full bg-linear-to-br ${user.color} border-2 border-slate-900 flex items-center justify-center text-white text-xs font-medium hover:z-50 transition-all cursor-pointer`}
                style={{ zIndex: activeUsers.length - index }}
                title={user.name}
              >
                {user.name.charAt(0)}
              </div>
            ))}
            <button
              className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-gray-400 hover:text-white hover:bg-slate-700 transition-colors z-0"
              onClick={() => setIsInviteDialogOpen(true)}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setInviteOpen(true)}
              className="relative text-gray-400 hover:text-white hover:bg-slate-800"
            >
              <Bell className="w-4 h-4" />

              {invites.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1 rounded-full">
                  {invites.length}
                </span>
              )}
            </Button>


            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
              <HelpCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Invite Dialogs - ADD THESE OUTSIDE THE HEADER */}
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      <InviteBox
        open={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onInvite={handleInvite}
        roomName={activeName || "General"}
      />
    </>
  );
};