// app/pages/w/[workspaceId]/c/[channelId]/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { WorkspaceSidebar } from "@/components/layouts/WorkspaceSidebar";
import { WorkspaceHeader } from "@/components/layouts/WorkspaceHeader";
import { ChatView } from "@/components/features/ChatView";
import { DocumentsLanding } from "@/components/features/DocumentsLanding";
import { useWebSocket } from "@/app/context/WebSocketProvider";

type WorkspaceMode = "chat" | "documents";

const modeNames = {
  chat: "general",
  documents: "Documents",
};

export default function WorkspacePage() {
  const params = useParams<{ workspaceId: string; channelId: string }>();

  const workspaceId = params.workspaceId?.toString();
  const channelId = params.channelId?.toString();
  const router = useRouter();
  const didConnect = useRef(false);

  const { connect, disconnect, joinChannel, leaveChannel, isConnected } = useWebSocket();

  // Refs so cleanup always has the latest values regardless of closure staleness
  const workspaceIdRef = useRef(workspaceId);
  const channelIdRef   = useRef(channelId);
  const leaveChannelRef = useRef(leaveChannel);

  useEffect(() => { workspaceIdRef.current = workspaceId; }, [workspaceId]);
  useEffect(() => { channelIdRef.current = channelId; }, [channelId]);
  useEffect(() => { leaveChannelRef.current = leaveChannel; }, [leaveChannel]);

  if (!workspaceId || !channelId) {
    router.push("/pages/dashboard");
    return null;
  }

  const [activeMode, setActiveMode] = useState<WorkspaceMode>("chat");

  useEffect(() => {
    if (didConnect.current) return;
    connect();
    didConnect.current = true;
    return () => { disconnect(); };
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    joinChannel(workspaceId, channelId);
    return () => {
      // Use ref values — guaranteed to be current even during unmount
      leaveChannelRef.current(workspaceIdRef.current, channelIdRef.current);
    };
  }, [workspaceId, channelId, isConnected]);

  const renderContent = () => {
    switch (activeMode) {
      case "chat":
        return (
          <ChatView
            workspaceId={workspaceId}
            channelId={channelId}
            channelName={modeNames.chat}
          />
        );
      case "documents":
        return (
          <DocumentsLanding
            workspaceId={workspaceId}
            channelId={channelId}
          />
        );
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