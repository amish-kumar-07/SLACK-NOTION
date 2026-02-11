import { useState, useCallback} from "react";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

type InvitePayload = {
  email: string;
  invitedById: string;
  invitedByEmail: string;
  workspaceId: string;
  role : "admin" | "member"
};

//logic for sending invite
export const useInvite = () => {
  const toast = useToast();

  const invite = async (payload: InvitePayload) => {
    try {
      // Validate payload before sending
      if (!payload.email || !payload.invitedByEmail || !payload.workspaceId) {
        toast.error("Missing required fields");
        console.error("Invalid payload:", payload);
        return false;
      }
      console.log(payload);
      const token = sessionStorage.getItem("CollabAIToken");

      if (!token) {
        toast.error("Please login again");
        return false;
      }

      // Log payload for debugging (remove in production)
      console.log("Sending invite with payload:", payload);

      const res = await fetch(`${BASE_URL}/invite/inviteUser`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: payload.email,
          invitedById: payload.invitedById,
          invitedByEmail: payload.invitedByEmail,
          workspaceId: payload.workspaceId,
          role : payload.role
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.message || "Failed to send invite");
        console.error("Server error:", data);
        return false;
      }

      toast.success("Invite sent successfully");
      return true;
    } catch (err: any) {
      console.error("Network error:", err);
      toast.error(err?.message || "Network error");
      return false;
    }
  };

  return { invite };
};
