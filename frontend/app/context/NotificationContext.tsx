// app/context/NotificationContext.tsx
'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useRouter } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

type Invite = {
  id: string;
  workspaceId: string;
  WorkspaceName : string;
  invitedById: string;
  invitedByEmail: string;
  role : "admin" | "member"
  status: string;
};

type NotificationContextType = {
  // Invites
  invites: Invite[];
  inviteCount: number;
  fetchInvites: () => Promise<void>;
  removeInvite: (id: string) => void;
  acceptInvite : (id : string,workspaceId : string, role : "admin" | "member") =>void;
  // Loading state
  loading: boolean;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();

  // ✅ Fetch invites
  const fetchInvites = useCallback(async () => {
    if (!user?.email) return;
    
    setLoading(true);
    try {
      const token = sessionStorage.getItem("CollabAIToken");
      if (!token) return;

      const res = await fetch(`${BASE_URL}/invite/getInvites`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ email: user.email })
      });

      const data = await res.json();
      setInvites(data.invites ?? []);
    } catch (err) {
      console.error('Failed to fetch invites:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  // ✅ Remove invite locally (for optimistic updates)
  const removeInvite = useCallback(async(id: string) => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("CollabAIToken");
      if (!token){ 
        setLoading(false);
        return;
      }
      const res = await fetch(`${BASE_URL}/invite/deleteInvite?id=${id}`, {
        method: "DELETE",
        headers: { 
          Authorization: `Bearer ${token}`
        },
      });

      const data = await res.json();
      if(!data.ok)
      {
        toast.warning("Deletion Failed!");
        return;
      }
      setInvites((prev) => prev.filter((invite) => invite.id !== id));
    } catch (err) {
      console.error('Failed to delete invites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Accept invite locally (for optimistic updates)
  const acceptInvite = useCallback(async(id:string , workspaceId : string, role : "admin" | "member")=>{
    setLoading(true);
    try{
      const token = sessionStorage.getItem("CollabAIToken");
      if (!token){ 
        setLoading(false);
        return;
      }
      const res = await fetch(`${BASE_URL}/invite/accept`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type" : "application/json"
        },
        body : JSON.stringify({
          id : id,
          workspaceId : workspaceId,
          role : role
        })
      });
      const data = await res.json();
      if(data.message !== "success")
      {
        toast.warning("Not able to accept");
        return;
      }
      setInvites((prev) => prev.filter((invite) => invite.id !== id));
      router.push('/pages/dashboard');
      // Small delay to ensure navigation completes before refresh
      setTimeout(() => router.refresh(), 100);
    }
    catch(err)
    {
      console.error('Failed to accept invites:', err);
    }
    finally{
      setLoading(false);
    }
  },[]);

  // ✅ Auto-fetch on user login
  useEffect(() => {
    if (user?.email) {
      fetchInvites();
    }
  }, [user?.email, fetchInvites]);

  const value = {
    invites,
    inviteCount: invites.length,
    fetchInvites,
    removeInvite,
    acceptInvite,
    loading,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ✅ Custom hook
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}