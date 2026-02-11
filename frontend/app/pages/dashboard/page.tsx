'use client';
import { useEffect, useState } from 'react';
import {
  Plus,
  Layers,
  LogOut,
  MessageSquare,
  FileText,
  Pencil,
  ArrowRight,
  Sparkles,
  Bell
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { useAuth } from "@/app/context/AuthContext";
import { Button } from '@/components/ui/button';
import { InviteDialog } from '@/components/customComponent/workspacepopup';
import { useNotifications } from '@/app/context/NotificationContext';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;


interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  created_by: string;
}

interface Workspace {
  id: string;
  name: string;
  description: string;
  defaultChannel?: Channel | null; // add default channel
}

type AllWorkspaces = Workspace[];

export default function Dashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const { invites } = useNotifications();
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  const [workspaces, setworkspaces] = useState<AllWorkspaces>([]);
  const router = useRouter();
  const toast = useToast();
  const { user, logout } = useAuth();
  

  useEffect(() => {
    const fetchWorkspaces = async () => {
      const token = sessionStorage.getItem("CollabAIToken");
      if (!token) return;

      const wsResponse = await fetch(`${BASE_URL}/workspace/allWorkspace`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const wsResult = await wsResponse.json();

      const workspacesWithChannels: Workspace[] = await Promise.all(
        wsResult.allWorkspace.map(async (ws: any) => {
          const chRes = await fetch(`${BASE_URL}/channel/getChannel/${ws.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const ch = chRes.ok ? (await chRes.json()).channel : null;
          return {
            id: ws.id,
            name: ws.WorkspaceName,
            description: ws.Description ?? "",
            defaultChannel: ch,
          };
        })
      );

      setworkspaces(workspacesWithChannels);
    };

    fetchWorkspaces();
  }, []);

  const handleCreateWorkspace = async () => {
    const token = sessionStorage.getItem("CollabAIToken");

    if (!token) {
      toast.warning("Please login again");
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/workspace/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspaceName: newWorkspaceName,
          description: newWorkspaceDesc,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.message || "Failed to create workspace");
        return;
      }

      toast.success("Workspace created successfully");

      // reset state only on success
      setNewWorkspaceName("");
      setNewWorkspaceDesc("");
      setDialogOpen(false);

      // optionally refetch workspace list here
      // await fetchWorkspaces();
      const formattedWorkspace: Workspace = {
        id: result.workspace.id,
        name: result.workspace.WorkspaceName,
        description: result.workspace.Description ?? "",
        defaultChannel: {
          id: result.newChannel.id,
          workspaceId: result.newChannel.workspaceId,
          name: result.newChannel.name,
          created_by: result.newChannel.created_by,
        },
      };
      console.log("Final output after workspace creation : ", result);
      setworkspaces((prev) => [...prev, formattedWorkspace]);

      // Add default channel to state
      const formattedChannel: Channel = {
        id: result.newChannel.id,
        workspaceId: result.newChannel.workspaceId,
        name: result.newChannel.name,
        created_by: result.newChannel.created_by,
      };
      console.log("All workspace : ", workspaces);
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    }
  };

  const handleLogOut = () => {
    logout();
    router.push("/");
    toast.success("Logout Successfull!");
  }
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-linear-to-br from-purple-500 to-pink-500">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">CollabAI</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:block">
              {user?.email}
            </span>
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


            {/* Invite dialog */}
            <InviteDialog
              open={inviteOpen}
              onClose={() => setInviteOpen(false)}
            />


            <button className="px-3 py-2 text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm" onClick={handleLogOut}>
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Welcome section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Your Workspaces</h1>
              <p className="text-gray-400 mt-1">
                Select a workspace or create a new one to get started
              </p>
            </div>

            <button
              onClick={() => setDialogOpen(true)}
              className="px-6 py-3 bg-linear-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 font-medium w-fit"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </button>
          </div>

          {/* Workspaces grid */}
          {workspaces.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No workspaces yet
              </h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Create your first workspace to start collaborating with your team on documents, chats, and whiteboards.
              </p>
              <button
                onClick={() => setDialogOpen(true)}
                className="px-6 py-3 bg-linear-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                Create your first workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="group p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5 transition-all cursor-pointer"
                  onClick={() => {
                    if (!workspace.defaultChannel) return toast.warning("Channel not ready!");
                    router.push(`/pages/w/${workspace.id}/c/${workspace.defaultChannel.id}`);
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                      <Layers className="w-6 h-6 text-purple-400" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-purple-400 transition-colors">
                    {workspace.name}
                  </h3>
                  <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                    {workspace.description || 'No description'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Docs</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Board</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dialog for creating workspace */}
      {dialogOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-2">Create a new workspace</h2>
              <p className="text-gray-400 text-sm">
                A workspace is where your team collaborates on projects.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-gray-300 block">
                  Workspace Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="My awesome team"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium text-gray-300 block">
                  Description (optional)
                </label>
                <input
                  id="description"
                  type="text"
                  placeholder="What's this workspace for?"
                  value={newWorkspaceDesc}
                  onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDialogOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWorkspace}
                  disabled={!newWorkspaceName.trim()}
                  className="flex-1 px-4 py-2.5 bg-linear-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Workspace
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}