import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { invitesTable, wrokspaceTable } from "../../db/schema.js";

export async function findWorkspace(workspaceId: string) {
  try {
    const [workspace] = await db
      .select()
      .from(wrokspaceTable)
      .where(eq(wrokspaceTable.id, workspaceId));

    if (!workspace) {
      return null;
    }

    return workspace;
  } catch (err) {
    return null;
  }
}

export async function inviteUser(
  userId: string,
  invitedByEmail: string,
  email: string,
  workspaceId: string,
  workspaceName : string,
  role : "admin" | "member"
) {
  try {
    // ✅ CORRECT - Column names match schema
    const [inviteUser] = await db
      .insert(invitesTable)
      .values({
        WorkspaceName : workspaceName,
        invitedById: userId, // Now correctly typed as UUID
        invitedByEmail: invitedByEmail, // Now correctly typed as VARCHAR
        email: email,
        workspaceId: workspaceId,
        role : role
      })
      .returning();

    if (!inviteUser) {
      return null;
    }

    return inviteUser;
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function getAllInvite(email: string) {
  try {
    const Invites = await db
      .select()
      .from(invitesTable)
      .where(
        and(eq(invitesTable.email, email), eq(invitesTable.status, "pending")),
      );

    return Invites;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function deleteInvite(id: string) {
  try {
    const [deleted] = await db
      .delete(invitesTable)
      .where(eq(invitesTable.id, id))
      .returning();

    return deleted !== undefined; // true = deleted, false = not found
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function acceptInvite(id: string) {
  try {
    const [updated] = await db
      .update(invitesTable)
      .set({ status: "accepted" })
      .where(eq(invitesTable.id, id))
      .returning();

    return updated ?? null;
  } catch (err) {
    console.log(err);
    return null;
  }
}
