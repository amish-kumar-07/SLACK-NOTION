// components/features/CreateDocumentDrawer.tsx
'use client';
import { useState } from "react";
import { X, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Document } from "@/app/store/useDocumentStore";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

interface CreateDocumentDrawerProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  channelId: string;
  onCreated: (doc: Document) => void;
}

export const CreateDocumentDrawer = ({
  open,
  onClose,
  workspaceId,
  channelId,
  onCreated,
}: CreateDocumentDrawerProps) => {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleError = title.length > 0 && title.length < 6
    ? "Title must be at least 6 characters"
    : null;

  const canSubmit = title.length >= 6 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem("CollabAIToken");
      const res = await fetch(`${BASE_URL}/doc/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workspaceId, channelId, title }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "Failed to create document");
        return;
      }
      setTitle("");
      onCreated(json.data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setTitle("");
    setError(null);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-96 bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">New Document</h2>
              <p className="text-xs text-gray-400 mt-0.5">Create a new document in this workspace</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 px-6 py-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Document Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="e.g. Project Roadmap 2025"
              disabled={loading}
              className={cn(
                "w-full h-10 rounded-lg border bg-slate-950 px-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:opacity-50",
                titleError ? "border-red-500/60 focus:ring-red-500/40" : "border-slate-700 focus:ring-purple-500"
              )}
            />
            {titleError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />{titleError}
              </p>
            )}
            <p className="text-xs text-gray-500">{title.length}/255 characters</p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-800 flex items-center gap-3">
          <Button
            onClick={handleClose}
            disabled={loading}
            variant="ghost"
            className="flex-1 text-gray-400 hover:text-white hover:bg-slate-800 border border-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />Creating...
              </span>
            ) : "Create Document"}
          </Button>
        </div>
      </div>
    </>
  );
};
