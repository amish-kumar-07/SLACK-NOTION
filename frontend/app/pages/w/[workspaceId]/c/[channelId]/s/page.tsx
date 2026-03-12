"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Trash2, Users, Calendar, Hash, Shield,
  AlertTriangle, Copy, Check, Globe, Crown,
  ArrowLeft, Fingerprint, ChevronRight,
} from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkspaceData {
  name: string;
  createdAt?: string;
  memberCount?: number;
  ownerEmail?: string;
  plan?: "free" | "pro" | "enterprise";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

// ─── Plan Config ─────────────────────────────────────────────────────────────

const planConfig = {
  free:       { label: "Free",       color: "text-slate-400",  bg: "rgba(255,255,255,0.04)",  border: "rgba(255,255,255,0.08)",  dot: "#64748b" },
  pro:        { label: "Pro",        color: "text-violet-300", bg: "rgba(139,92,246,0.08)",   border: "rgba(139,92,246,0.2)",    dot: "#8b5cf6" },
  enterprise: { label: "Enterprise", color: "text-amber-300",  bg: "rgba(245,158,11,0.08)",   border: "rgba(245,158,11,0.2)",    dot: "#f59e0b" },
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: "rgba(255,255,255,0.05)" }}
    />
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <Skeleton className="h-4 w-32 mb-10" />
      <div className="flex items-center gap-4 mb-10">
        <Skeleton className="w-14 h-14 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  workspaceName,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  workspaceName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  const [input, setInput] = useState("");
  const match = input === workspaceName;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div
        className="w-full max-w-md rounded-2xl mx-4 overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #0f1117 0%, #13151f 100%)",
          border: "1px solid rgba(239,68,68,0.2)",
          boxShadow: "0 0 0 1px rgba(239,68,68,0.05), 0 32px 64px rgba(0,0,0,0.8), 0 0 80px rgba(239,68,68,0.06)",
        }}
      >
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(239,68,68,0.6), transparent)" }} />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Delete Workspace</h2>
              <p className="text-xs text-red-400/70 mt-0.5">This action is permanent and irreversible</p>
            </div>
          </div>

          <p className="text-sm text-slate-400 mb-5 leading-relaxed">
            All channels, messages, documents and member data inside{" "}
            <span className="text-white font-medium px-1.5 py-0.5 rounded bg-white/5 border border-white/10">{workspaceName}</span>{" "}
            will be permanently erased.
          </p>

          <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-widest">
            Type the workspace name to confirm
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={workspaceName}
            autoFocus
            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition-all mb-5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${match ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.07)"}`,
              boxShadow: match ? "0 0 0 3px rgba(239,68,68,0.08)" : "none",
            }}
          />

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!match || isDeleting}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: match ? "rgba(239,68,68,0.9)" : "rgba(239,68,68,0.3)", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              {isDeleting ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting…</>
              ) : (
                <><Trash2 className="w-4 h-4" /> Delete Workspace</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Info Row ────────────────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, mono = false, action, iconColor = "text-slate-500",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  action?: React.ReactNode;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/[0.02]">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-600 uppercase tracking-widest mb-0.5">{label}</p>
          <div className={`text-sm truncate ${mono ? "font-mono text-xs text-slate-400" : "font-medium text-slate-200"}`}>
            {value}
          </div>
        </div>
      </div>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, accent }: { icon: React.ReactNode; value: number; label: string; accent: string }) {
  return (
    <div className="relative rounded-2xl px-5 py-5 overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20" style={{ background: accent }} />
      <div className="relative flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
          <p className="text-xs text-slate-600 font-medium uppercase tracking-widest mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const params = useParams<{ workspaceId: string; channelId: string }>();
  const workspaceId = params.workspaceId;
  const channelId = params.channelId;

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Fetch workspace data ──────────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) return;
    const fetchWorkspace = async () => {
      try {
        const token = sessionStorage.getItem("CollabAIToken");
        const res = await fetch(`${BASE_URL}/workspace/${workspaceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch workspace");
        const data = await res.json();
        // Adapt field names to match your API response shape
        setWorkspace({
          name: data.workspace?.WorkspaceName ?? data.WorkspaceName ?? "",
          createdAt: data.workspace?.createdAt ?? data.createdAt,
          memberCount: data.workspace?.memberCount ?? data.memberCount ?? 0,
          ownerEmail: data.workspace?.ownerEmail ?? data.ownerEmail,
          plan: data.workspace?.plan ?? data.plan ?? "free",
        });
      } catch (err) {
        console.error("[WorkspaceSettings] fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspace();
  }, [workspaceId]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCopyId = () => {
    if (!workspaceId) return;
    navigator.clipboard.writeText(workspaceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const token = sessionStorage.getItem("CollabAIToken");
      const res = await fetch(`${BASE_URL}/workspace/${workspaceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete workspace");
      router.push("/pages/dashboard");
    } catch (err) {
      console.error("[WorkspaceSettings] delete error:", err);
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const plan = workspace?.plan ?? "free";
  const pc = planConfig[plan];
  const workspaceName = workspace?.name ?? "";
  const shortId = workspaceId ? `${workspaceId.slice(0, 8)}…` : "—";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen overflow-y-auto" style={{ background: "#080a0f" }}>
        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none" aria-hidden>
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] blur-[120px] opacity-20"
            style={{ background: "radial-gradient(ellipse, #6d28d9 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative">
          {loading ? (
            <PageSkeleton />
          ) : (
            <div className="max-w-2xl mx-auto px-6 py-12">

              {/* ── Back button ── */}
              <button
                onClick={() => router.push(`/pages/w/${workspaceId}/c/${channelId}`)}
                className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-400 transition-colors mb-8 group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                Back to workspace
              </button>

              {/* ── Header ── */}
              <div className="flex items-center gap-4 mb-10">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #6d28d9 0%, #db2777 100%)",
                    boxShadow: "0 0 0 1px rgba(109,40,217,0.4), 0 8px 32px rgba(109,40,217,0.3)",
                  }}
                >
                  {workspaceName.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">{workspaceName || "Workspace"}</h1>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: pc.bg, border: `1px solid ${pc.border}`, color: pc.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: pc.dot }} />
                      {pc.label}
                    </span>
                    <span className="text-xs text-slate-700">·</span>
                    <span className="text-xs text-slate-600">Workspace Settings</span>
                  </div>
                </div>
              </div>

              {/* ── Stats ── */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <StatCard icon={<Users className="w-5 h-5 text-blue-400" />} value={workspace?.memberCount ?? 0} label="Members" accent="#3b82f6" />
                <StatCard icon={<Hash className="w-5 h-5 text-violet-400" />} value={1} label="Channels" accent="#8b5cf6" />
              </div>

              {/* ── General Info ── */}
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest px-1 mb-3">General</p>
                <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="divide-y divide-white/[0.04]">
                    <InfoRow icon={<Globe className="w-4 h-4" />} label="Workspace Name" value={workspaceName} />
                    <InfoRow
                      icon={<Fingerprint className="w-4 h-4" />}
                      label="Workspace ID"
                      value={workspaceId}
                      mono
                      action={
                        <button
                          onClick={handleCopyId}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
                            color: copied ? "#4ade80" : "#94a3b8",
                          }}
                        >
                          {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                        </button>
                      }
                    />
                    <InfoRow icon={<Calendar className="w-4 h-4" />} label="Created" value={formatDate(workspace?.createdAt)} />
                    {workspace?.ownerEmail && (
                      <InfoRow icon={<Crown className="w-4 h-4" />} label="Owner" value={workspace.ownerEmail} iconColor="text-amber-500" />
                    )}
                    <InfoRow
                      icon={<Shield className="w-4 h-4" />}
                      label="Plan"
                      value={
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: pc.bg, border: `1px solid ${pc.border}`, color: pc.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: pc.dot }} />
                          {pc.label}
                        </span>
                      }
                      action={
                        plan !== "enterprise" && (
                          <button className="flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors">
                            Upgrade <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              {/* ── Danger Zone ── */}
              <div className="mt-8">
                <p className="text-[11px] font-semibold text-red-900/80 uppercase tracking-widest px-1 mb-3">Danger Zone</p>
                <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(239,68,68,0.04) 0%, rgba(239,68,68,0.02) 100%)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <div className="px-5 py-5 flex items-center justify-between gap-6">
                    <div>
                      <p className="text-sm font-semibold text-white mb-1">Delete this workspace</p>
                      <p className="text-xs text-slate-500 leading-relaxed">Permanently removes all channels, messages, and documents. Cannot be undone.</p>
                    </div>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 whitespace-nowrap transition-all"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Footer ── */}
              <p className="text-center text-xs text-slate-800 mt-10">
                Workspace ID: <span className="font-mono">{shortId}</span>
              </p>

            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <DeleteModal
          workspaceName={workspaceName}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
}