// components/features/DocumentsLanding.tsx
'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Plus, Clock, Search, Grid, List,
  MoreHorizontal, Loader2, AlertCircle, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocuments } from "@/app/hooks/useDocuments";
import { useDocumentStore, Document } from "@/app/store/useDocumentStore";
import { CreateDocumentDrawer } from "@/components/customComponent/CreateDocumentDrawer"

interface DocumentsLandingProps {
  workspaceId: string;
  channelId: string;
}

export const DocumentsLanding = ({ workspaceId, channelId }: DocumentsLandingProps) => {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { documents, isLoading, error } = useDocuments(workspaceId, channelId);
  const prependDocument = useDocumentStore((s) => s.prependDocument);

  const handleDocumentCreated = (doc: Document) => {
    prependDocument(doc);
    setDrawerOpen(false);
    router.push(`/pages/w/${workspaceId}/c/${channelId}/d/${doc.id}`);
  };

  const handleSelect = (doc: Document) => {
    router.push(`/pages/w/${workspaceId}/c/${channelId}/d/${doc.id}`);
  };

  const filtered = documents.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="h-full bg-slate-950 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="border-b border-slate-800 px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Documents</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {isLoading ? "Loading..." : `${documents.length} document${documents.length !== 1 ? "s" : ""} in this workspace`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-56 rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-1 gap-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-slate-700 text-white" : "text-gray-400 hover:text-white"}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-slate-700 text-white" : "text-gray-400 hover:text-white"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <Button
              onClick={() => setDrawerOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white gap-2 h-9 px-4 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Document
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-sm text-gray-400">Loading documents...</p>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-400 text-sm">
                {searchQuery ? `No documents matching "${searchQuery}"` : "No documents yet"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Create your first document →
                </button>
              )}
            </div>
          )}

          {/* Doc list */}
          {!isLoading && !error && filtered.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-gray-400" />
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  All Documents
                </h2>
              </div>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleSelect(doc)}
                      className="group bg-slate-900 border border-slate-700 hover:border-purple-500/50 rounded-xl p-5 cursor-pointer transition-all hover:bg-slate-800/80 hover:shadow-lg hover:shadow-purple-500/5"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-white hover:bg-slate-700 transition-all"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-semibold text-white text-sm mb-1.5 truncate">{doc.title}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-4 pt-3 border-t border-slate-700/60">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleSelect(doc)}
                      className="group flex items-center gap-4 px-4 py-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-purple-500/40 hover:bg-slate-800 cursor-pointer transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{doc.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Created {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-white hover:bg-slate-700 transition-all"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Create CTA at bottom */}
          {!isLoading && !error && (
            <div
              onClick={() => setDrawerOpen(true)}
              className="mt-6 border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-purple-500/20 flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6 text-gray-400 group-hover:text-purple-400 transition-colors" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">Create a new document</p>
                <p className="text-xs text-gray-500 mt-1">Start fresh with a blank document</p>
              </div>
            </div>
          )}
        </div>
      </div>

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

export { CreateDocumentDrawer };
