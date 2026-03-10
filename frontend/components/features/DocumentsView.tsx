'use client';
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import ImageExt from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import {
  Bold, Italic, Underline, List, ListOrdered, Quote,
  ImageIcon, Link, Code, MessageSquare, Save, Loader2,
  CheckCircle2, AlertCircle, X, Send, Heading1, Heading2,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string };
}

interface DocData {
  id: string;
  title: string;
  content: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getToken = () => sessionStorage.getItem("CollabAIToken");

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ─── Toolbar Button ───────────────────────────────────────────────────────────

const ToolbarBtn = ({
  onClick, active, title, children, className,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={cn(
      "p-1.5 rounded transition-colors",
      active
        ? "bg-purple-500/20 text-purple-300"
        : "text-gray-400 hover:text-white hover:bg-slate-700",
      className
    )}
  >
    {children}
  </button>
);

// ─── Custom Floating Bubble Menu ──────────────────────────────────────────────

interface BubbleMenuState {
  visible: boolean;
  top: number;
  left: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const DocumentsView = () => {
  const params      = useParams();
  const docId       = params.docId?.toString();
  const workspaceId = params.workspaceId?.toString();
  const channelId   = params.channelId?.toString();

  // Doc state
  const [doc, setDoc]               = useState<DocData | null>(null);
  const [title, setTitle]           = useState("");
  const [docLoading, setDocLoading] = useState(true);
  const [docError, setDocError]     = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved]   = useState<string | null>(null);

  // Comments state
  const [showComments, setShowComments]         = useState(true);
  const [comments, setComments]                 = useState<Comment[]>([]);
  const [commentText, setCommentText]           = useState("");
  const [commentsLoading, setCommentsLoading]   = useState(false);
  const [postingComment, setPostingComment]     = useState(false);

  // Link popover
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkUrl, setLinkUrl]                 = useState("");

  // Image upload
  const imageInputRef                       = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);

  // Floating bubble menu
  const [bubble, setBubble] = useState<BubbleMenuState>({ visible: false, top: 0, left: 0 });
  const editorWrapperRef    = useRef<HTMLDivElement>(null);

  // Track whether we've set editor content from fetched doc
  const contentSetRef = useRef(false);

  // ── Editor ────────────────────────────────────────────────────────────────

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      UnderlineExt,
      ImageExt.configure({ inline: false, allowBase64: false }),
      LinkExt.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-purple-400 underline cursor-pointer" },
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "notion-editor focus:outline-none min-h-[400px]",
      },
    },
    onSelectionUpdate: ({ editor: e }) => {
      const { empty } = e.state.selection;
      if (empty) {
        setBubble((b) => ({ ...b, visible: false }));
        return;
      }
      // Position bubble above the selection
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range    = selection.getRangeAt(0);
      const rect     = range.getBoundingClientRect();
      const wrapper  = editorWrapperRef.current;
      if (!wrapper) return;
      const wRect    = wrapper.getBoundingClientRect();
      setBubble({
        visible: true,
        top:  rect.top  - wRect.top  - 48, // 48px above selection
        left: rect.left - wRect.left + rect.width / 2 - 100, // centered
      });
    },
  });

  // Hide bubble when clicking outside
  useEffect(() => {
    const hide = () => setBubble((b) => ({ ...b, visible: false }));
    document.addEventListener("mousedown", hide);
    return () => document.removeEventListener("mousedown", hide);
  }, []);

  // ── Fetch doc ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!docId) return;
    contentSetRef.current = false;

    const fetchDoc = async () => {
      setDocLoading(true);
      setDocError(null);
      try {
        const res = await fetch(BASE_URL+`/doc/${docId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error("Failed to load document");
        const json = await res.json();
        const data: DocData = json.data ?? json;
        setDoc(data);
        setTitle(data.title);
        setLastSaved(data.updatedAt);
      } catch (err: any) {
        setDocError(err.message || "Something went wrong");
      } finally {
        setDocLoading(false);
      }
    };
    fetchDoc();
  }, [docId]);

  // Set editor content once BOTH editor and doc are ready
  useEffect(() => {
    if (!editor || !doc || contentSetRef.current) return;
    if (doc.content && Object.keys(doc.content).length > 0) {
      editor.commands.setContent(doc.content);
    }
    contentSetRef.current = true;
  }, [editor, doc]);

  // ── Fetch comments ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!docId) return;
    const fetchComments = async () => {
      setCommentsLoading(true);
      try {
        const res = await fetch(BASE_URL+`/doc/comments/${docId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        setComments(Array.isArray(json) ? json : (json.data ?? []));
      } catch {
        // silently fail
      } finally {
        setCommentsLoading(false);
      }
    };
    fetchComments();
  }, [docId]);

  // ── Save doc ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!docId || !editor) return;
    setSaveStatus("saving");
    try {
      const content = editor.getJSON();
      const res = await fetch(BASE_URL+`/doc/${docId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLastSaved((json.data ?? json).updatedAt ?? new Date().toISOString());
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [docId, editor, title]);

  // ── Post comment ──────────────────────────────────────────────────────────

  const handlePostComment = async () => {
    if (!commentText.trim() || !docId) return;
    setPostingComment(true);
    try {
      const res = await fetch(BASE_URL+`/doc/comments/${docId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ text: commentText.trim() }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const newComment: Comment = json.data ?? json;
      setComments((prev) => [newComment, ...prev]);
      setCommentText("");
    } catch {
      // silently fail
    } finally {
      setPostingComment(false);
    }
  };

  // ── Image upload ──────────────────────────────────────────────────────────

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(BASE_URL+"/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const json = await res.json();
      const url: string | undefined = json?.attachment?.url;
      if (url) {
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      }
    } catch {
      // silently fail
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  // ── Link insert ───────────────────────────────────────────────────────────

  const handleInsertLink = () => {
    if (!linkUrl.trim() || !editor) return;
    editor.chain().focus().setLink({ href: linkUrl }).run();
    setLinkUrl("");
    setShowLinkPopover(false);
  };

  const handleRemoveLink = () => {
    editor?.chain().focus().unsetLink().run();
    setShowLinkPopover(false);
  };

  // ─── Loading / Error ──────────────────────────────────────────────────────

  if (docLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <p className="text-sm text-gray-400">Loading document...</p>
        </div>
      </div>
    );
  }

  if (docError) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-red-400">{docError}</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-slate-950 overflow-hidden">
      <style>{`
        .notion-editor {
          color: #e2e8f0;
          font-size: 16px;
          line-height: 1.75;
          font-family: ui-sans-serif, system-ui, sans-serif;
          caret-color: #a78bfa;
        }
        .notion-editor p {
          margin: 0 0 4px 0;
          min-height: 1.75em;
        }
        .notion-editor h1 {
          font-size: 2rem;
          font-weight: 700;
          color: #f8fafc;
          margin: 24px 0 8px 0;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }
        .notion-editor h2 {
          font-size: 1.4rem;
          font-weight: 600;
          color: #f1f5f9;
          margin: 20px 0 6px 0;
          line-height: 1.3;
          letter-spacing: -0.01em;
        }
        .notion-editor h3 {
          font-size: 1.15rem;
          font-weight: 600;
          color: #e2e8f0;
          margin: 16px 0 4px 0;
        }
        .notion-editor strong {
          font-weight: 700;
          color: #f8fafc;
        }
        .notion-editor em {
          font-style: italic;
          color: #cbd5e1;
        }
        .notion-editor u {
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .notion-editor ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin: 4px 0;
        }
        .notion-editor ol {
          list-style: decimal;
          padding-left: 1.5rem;
          margin: 4px 0;
        }
        .notion-editor li {
          margin: 2px 0;
          padding-left: 0.25rem;
        }
        .notion-editor li p {
          margin: 0;
        }
        .notion-editor blockquote {
          border-left: 3px solid #7c3aed;
          padding-left: 1rem;
          margin: 8px 0;
          color: #94a3b8;
          font-style: italic;
        }
        .notion-editor pre {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 1rem 1.25rem;
          margin: 8px 0;
          overflow-x: auto;
        }
        .notion-editor code {
          font-family: 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.875em;
          color: #a78bfa;
          background: #1e1b4b;
          padding: 0.1em 0.35em;
          border-radius: 4px;
        }
        .notion-editor pre code {
          background: transparent;
          color: #e2e8f0;
          padding: 0;
          font-size: 0.875rem;
        }
        .notion-editor hr {
          border: none;
          border-top: 1px solid #1e293b;
          margin: 16px 0;
        }
        .notion-editor a {
          color: #a78bfa;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .notion-editor img {
          max-width: 100%;
          border-radius: 8px;
          margin: 8px 0;
        }
        .notion-editor .ProseMirror-selectednode {
          outline: 2px solid #7c3aed;
          border-radius: 4px;
        }
      `}</style>

      {/* Hidden image input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* ── Editor area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Toolbar */}
        <div className="border-b border-slate-800 px-4 py-2 shrink-0">
          <div className="flex items-center gap-1 flex-wrap">

            {/* Text formatting */}
            <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-900">
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive("bold")} title="Bold">
                <Bold className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")} title="Italic">
                <Italic className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive("underline")} title="Underline">
                <Underline className="w-4 h-4" />
              </ToolbarBtn>
            </div>

            <div className="w-px h-5 bg-slate-700" />

            {/* Headings */}
            <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-900">
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive("heading", { level: 1 })} title="Heading 1">
                <Heading1 className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive("heading", { level: 2 })} title="Heading 2">
                <Heading2 className="w-4 h-4" />
              </ToolbarBtn>
            </div>

            <div className="w-px h-5 bg-slate-700" />

            {/* Lists + Quote + Code + Divider */}
            <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-900">
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive("bulletList")} title="Bullet List">
                <List className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive("orderedList")} title="Ordered List">
                <ListOrdered className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive("blockquote")} title="Quote">
                <Quote className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive("codeBlock")} title="Code Block">
                <Code className="w-4 h-4" />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Divider">
                <Minus className="w-4 h-4" />
              </ToolbarBtn>
            </div>

            <div className="w-px h-5 bg-slate-700" />

            {/* Link */}
            <div className="relative">
              <ToolbarBtn
                onClick={() => setShowLinkPopover((v) => !v)}
                active={editor?.isActive("link") || showLinkPopover}
                title="Insert Link"
              >
                <Link className="w-4 h-4" />
              </ToolbarBtn>
              {showLinkPopover && (
                <div className="absolute top-9 left-0 z-50 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl flex gap-2 w-72">
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInsertLink()}
                    placeholder="https://..."
                    autoFocus
                    className="flex-1 h-8 px-3 text-sm bg-slate-950 border border-slate-600 rounded text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button onClick={handleInsertLink} className="px-3 h-8 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded transition-colors">
                    Add
                  </button>
                  {editor?.isActive("link") && (
                    <button onClick={handleRemoveLink} className="px-3 h-8 bg-red-600/30 hover:bg-red-600/50 text-red-400 text-sm rounded transition-colors">
                      Remove
                    </button>
                  )}
                  <button onClick={() => setShowLinkPopover(false)} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Image upload */}
            <ToolbarBtn
              onClick={() => imageInputRef.current?.click()}
              title="Insert Image"
              className={imageUploading ? "opacity-50 cursor-wait" : ""}
            >
              {imageUploading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ImageIcon className="w-4 h-4" />
              }
            </ToolbarBtn>

            <div className="flex-1" />

            {/* Last saved */}
            {lastSaved && (
              <span className="text-xs text-gray-500 mr-2">
                Last saved {timeAgo(lastSaved)}
              </span>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium transition-all",
                saveStatus === "saving" && "bg-slate-700 text-gray-400 cursor-wait",
                saveStatus === "saved"  && "bg-green-500/20 text-green-400 border border-green-500/30",
                saveStatus === "error"  && "bg-red-500/20 text-red-400 border border-red-500/30",
                saveStatus === "idle"   && "bg-purple-600 hover:bg-purple-500 text-white",
              )}
            >
              {saveStatus === "saving" && <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</>}
              {saveStatus === "saved"  && <><CheckCircle2 className="w-3.5 h-3.5" />Saved</>}
              {saveStatus === "error"  && <><AlertCircle className="w-3.5 h-3.5" />Failed</>}
              {saveStatus === "idle"   && <><Save className="w-3.5 h-3.5" />Save</>}
            </button>

            {/* Comments toggle */}
            <button
              onClick={() => setShowComments((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm transition-colors ml-1",
                showComments
                  ? "bg-slate-700 text-white"
                  : "text-gray-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comments</span>
              {comments.length > 0 && (
                <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {comments.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Editor content wrapper — needed for bubble positioning */}
        <div className="flex-1 overflow-y-auto relative" ref={editorWrapperRef}>

          {/* ── Custom Floating Bubble Menu ── */}
          {bubble.visible && editor && (
            <div
              className="absolute z-50 flex items-center gap-0.5 p-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl pointer-events-auto"
              style={{ top: bubble.top, left: Math.max(8, bubble.left) }}
              onMouseDown={(e) => e.stopPropagation()} // prevent hide on click inside
            >
              <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
                <Bold className="w-3.5 h-3.5" />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
                <Italic className="w-3.5 h-3.5" />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
                <Underline className="w-3.5 h-3.5" />
              </ToolbarBtn>
              <div className="w-px h-4 bg-slate-600 mx-0.5" />
              <ToolbarBtn onClick={() => { setShowLinkPopover(true); setBubble((b) => ({ ...b, visible: false })); }} active={editor.isActive("link")} title="Link">
                <Link className="w-3.5 h-3.5" />
              </ToolbarBtn>
            </div>
          )}

          <div className="max-w-3xl mx-auto px-8 py-10">
            {/* Editable title */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Document"
              className="w-full text-4xl font-bold text-white bg-transparent border-none outline-none placeholder:text-gray-600 mb-6"
            />
            {/* Tiptap editor */}
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* ── Comments panel ── */}
      {showComments && (
        <div className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm">Comments</h3>
            <button onClick={() => setShowComments(false)} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {commentsLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              </div>
            )}
            {!commentsLoading && comments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <MessageSquare className="w-8 h-8 text-gray-600" />
                <p className="text-xs text-gray-500">No comments yet</p>
              </div>
            )}
            {comments.map((comment) => (
              <div key={comment.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-linear-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {comment.user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white">{comment.user.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{timeAgo(comment.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-300 pl-8 leading-relaxed">{comment.text}</p>
              </div>
            ))}
          </div>

          {/* Comment input */}
          <div className="p-4 border-t border-slate-800">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePostComment();
              }}
              placeholder="Add a comment... (⌘+Enter to post)"
              className="w-full h-20 p-3 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder:text-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={handlePostComment}
              disabled={!commentText.trim() || postingComment}
              className="w-full mt-2 h-9 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {postingComment
                ? <><Loader2 className="w-4 h-4 animate-spin" />Posting...</>
                : <><Send className="w-4 h-4" />Post Comment</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
};