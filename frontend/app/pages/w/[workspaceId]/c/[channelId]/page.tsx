// app/workspace/[id]/page.tsx
"use client";
import { useEffect, useState , useRef } from "react";
import { useParams } from "next/navigation";
import { WorkspaceSidebar } from "@/components/layouts/WorkspaceSidebar";
import { WorkspaceHeader } from "@/components/layouts/WorkspaceHeader";
import { ChatView } from "@/components/features/ChatView";
import { DocumentsView } from "@/components/features/DocumentsView";
import { useRouter } from "next/navigation";
import { useWebSocket } from "@/app/context/WebSocketProvider";

type WorkspaceMode = "chat" | "documents";

const modeNames = {
  chat: "#general",
  documents: "Project Roadmap 2024",
  whiteboard: "System Architecture",
};


export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.workspaceId?.toString();
  const channelId = params.channelId?.toString();
  const router = useRouter();
  const didConnect = useRef(false);

  const { connect, disconnect, joinChannel, leaveChannel, isConnected } = useWebSocket();
  if (!workspaceId || !channelId) {
    router.push("/pages/dashboard");
    return null;
  }

  console.log('Workspace:', workspaceId, 'Channel:', channelId);
  const [activeMode, setActiveMode] = useState<WorkspaceMode>("chat");

  // Connect WebSocket when component mounts
  useEffect(() => {
    if (didConnect.current) return;
    console.log("🚀 Workspace page mounted, connecting WebSocket...");
    connect();
    didConnect.current = true;

    return () => {
      console.log("🔌 Workspace page unmounting, disconnecting...");
      disconnect();
    };
  }, []); // Only on mount/unmount

  // Join channel when WebSocket is connected
  useEffect(() => {
    if (!isConnected) {
      console.log("⏳ Waiting for WebSocket connection...");
      return;
    }

    console.log("✅ WebSocket connected, joining channel...");
    joinChannel(workspaceId, channelId);

    return () => {
      if (isConnected) {
        console.log("👋 Leaving channel...");
        leaveChannel(workspaceId, channelId);
      }
    };
  }, [workspaceId, channelId, isConnected]); // ← Missing joinChannel, leaveChannel

  const renderContent = () => {
    switch (activeMode) {
      case "chat":
        return (<ChatView workspaceId={workspaceId} channelId={channelId} />);
      case "documents":
        return <DocumentsView />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <WorkspaceSidebar
        activeMode={activeMode}
        onModeChange={setActiveMode}
        workspaceName="Product Team"
        workspaceId={workspaceId}
        channelId={channelId}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <WorkspaceHeader
          activeMode={activeMode}
          activeName={modeNames[activeMode]}
          workspaceId={workspaceId}
          channelId={channelId}
        />
        <main className="flex-1 overflow-hidden">
          <div className="h-full animate-fade-in" key={activeMode}>
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}