// app/pages/w/[workspaceId]/c/[channelId]/d/[docId]/page.tsx
"use client";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DocumentsView } from "@/components/features/DocumentsView";

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();

  const workspaceId = params.workspaceId?.toString();
  const channelId = params.channelId?.toString();

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Minimal top bar */}
      <div className="h-10 shrink-0 border-b border-slate-800 flex items-center px-4 gap-3">
        <button
          onClick={() => router.push(`/pages/w/${workspaceId}/c/${channelId}`)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Documents
        </button>
      </div>

      {/* Full screen editor — useParams inside DocumentsView picks up docId */}
      <div className="flex-1 overflow-hidden">
        <DocumentsView />
      </div>
    </div>
  );
}