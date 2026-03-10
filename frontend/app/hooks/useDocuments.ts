// hooks/useDocuments.ts
import { useEffect, useRef } from "react";
import { useDocumentStore } from "@/app/store/useDocumentStore";

export const useDocuments = (workspaceId: string, channelId: string) => {
  const { setDocuments, setLoading, setError, documents, isLoading, error } =
    useDocumentStore();

  const hasFetched = useRef(false);

  useEffect(() => {
    // If already have docs for this workspace+channel, skip refetch
    if (hasFetched.current && documents.length > 0) return;
    if (!workspaceId || !channelId) return;

    const fetchDocs = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = sessionStorage.getItem("CollabAIToken");
        const res = await fetch(
          `http://localhost:4000/doc/getDoc/${workspaceId}/${channelId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error("Failed to fetch documents");
        const data = await res.json();
        setDocuments(Array.isArray(data) ? data : []);
        hasFetched.current = true;
      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchDocs();
  }, [workspaceId, channelId]);

  return { documents, isLoading, error };
};