// store/useDocumentStore.ts
import { create } from "zustand";

export interface Document {
  id: string;
  workspaceId: string;
  channelId: string;
  title: string;
  content: { blocks: [] };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentStore {
  documents: Document[];
  isLoading: boolean;
  error: string | null;
  setDocuments: (docs: Document[]) => void;
  prependDocument: (doc: Document) => void;
  removeDocument: (docId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  documents: [],
  isLoading: false,
  error: null,

  setDocuments: (docs) =>
    set({
      documents: [...docs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    }),

  prependDocument: (doc) =>
    set((state) => ({ documents: [doc, ...state.documents] })),

  // ── NEW: remove a doc by id (optimistic delete) ──
  removeDocument: (docId) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== docId),
    })),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set({ documents: [], isLoading: false, error: null }),
}));