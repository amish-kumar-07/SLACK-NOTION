// src/services/docService/index.ts
import { db } from "../../db/index.js";
import { documentsTable, documentCommentsTable, usersTable } from "../../db/schema.js";
import { and, eq, desc } from "drizzle-orm";

// ── Existing ──────────────────────────────────────────────────────────────────

export async function createDocument(
  workspaceId: string,
  channelId: string,
  title: string,
  userId: string
) {
  try {
    const [newdoc] = await db
      .insert(documentsTable)
      .values({ workspaceId, channelId, title, createdBy: userId })
      .returning();
    return newdoc;
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function getDocument(workspaceId: string, channelId: string) {
  try {
    const document = await db
      .select()
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.workspaceId, workspaceId),
          eq(documentsTable.channelId, channelId)
        )
      );
    return document ?? null;
  } catch (err) {
    console.log(err);
    return null;
  }
}

// ── New ───────────────────────────────────────────────────────────────────────

// GET single doc by ID
export async function getDocumentById(docId: string) {
  try {
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, docId));
    return doc ?? null;
  } catch (err) {
    console.log(err);
    return null;
  }
}

// PUT - update title + content
export async function updateDocument(
  docId: string,
  title: string,
  content: Record<string, any>
) {
  try {
    const [updated] = await db
      .update(documentsTable)
      .set({
        title,
        content,
        updatedAt: new Date(),
      })
      .where(eq(documentsTable.id, docId))
      .returning();
    return updated ?? null;
  } catch (err) {
    console.log(err);
    return null;
  }
}

// GET comments for a doc (joined with users for name)
export async function getComments(docId: string) {
  try {
    const rows = await db
      .select({
        id: documentCommentsTable.id,
        text: documentCommentsTable.text,
        createdAt: documentCommentsTable.createdAt,
        user: {
          id: usersTable.id,
          name: usersTable.name,
        },
      })
      .from(documentCommentsTable)
      .innerJoin(usersTable, eq(documentCommentsTable.userId, usersTable.id))
      .where(eq(documentCommentsTable.documentId, docId))
      .orderBy(desc(documentCommentsTable.createdAt));
    return rows;
  } catch (err) {
    console.log(err);
    return null;
  }
}

// POST a new comment
export async function createComment(
  docId: string,
  userId: string,
  text: string
) {
  try {
    const [comment] = await db
      .insert(documentCommentsTable)
      .values({ documentId: docId, userId, text })
      .returning();

    // Return with user info joined
    const [withUser] = await db
      .select({
        id: documentCommentsTable.id,
        text: documentCommentsTable.text,
        createdAt: documentCommentsTable.createdAt,
        user: {
          id: usersTable.id,
          name: usersTable.name,
        },
      })
      .from(documentCommentsTable)
      .innerJoin(usersTable, eq(documentCommentsTable.userId, usersTable.id))
      .where(eq(documentCommentsTable.id, comment!.id));

    return withUser ?? null;
  } catch (err) {
    console.log(err);
    return null;
  }
}

// DELETE a document by ID
export async function deleteDocument(docId: string) {
  try {
    await db
      .delete(documentCommentsTable)
      .where(eq(documentCommentsTable.documentId, docId));

    const [deleted] = await db
      .delete(documentsTable)
      .where(eq(documentsTable.id, docId))
      .returning();

    return deleted ?? null;
  } catch (err) {
    console.log(err);
    return null;
  }
}