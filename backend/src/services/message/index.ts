// services/message/index.ts
import { db } from "../../db/index.js";
import { messagesTable, usersTable } from "../../db/schema.js";
import { and, eq, lt, desc, isNull } from "drizzle-orm";
import { alias as aliasedTable } from "drizzle-orm/pg-core";

// ========================================
// saveMessage
// ========================================

type SaveMessageInput = {
  userId: string;
  channelId: string;
  channelName: string;   // ✅ ADD THIS
  content: string;
  parentMessageId?: string | null;
  attachments?: unknown[];
};

export async function saveMessage(data: SaveMessageInput) {
  try {
    const [res] = await db
      .insert(messagesTable)
      .values({
        userId: data.userId,
        channelId: data.channelId,
        channelName : data.channelName,
        content: data.content,
        parentMessageId: data.parentMessageId ?? null,
        attachments: data.attachments ?? [],
      })
      .returning();

    return res;
  } catch (err) {
    console.error("❌ Error saving message:", err);
    return null;
  }
}

// ========================================
// getMessages
// ========================================

export type GetMessagesInput = {
  channelId: string;
  cursor?: string; // optional — omitted entirely when not paginating
  limit?: number;
  name?: string;
};

type MessageWithUser = {
  id: string;
  content: string | null;
  channelId: string;
  userId: string;
  parentMessageId: string | null;
  name : string | null ;
  attachments: unknown;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
  // ✅ Snapshot of the parent message — so reply badge always works regardless of pagination
  parentMessage: {
    id: string;
    content: string | null;
    userId: string;
    userName: string;
  } | null;
};

export async function getMessages(data: GetMessagesInput): Promise<{
  messages: MessageWithUser[];
  nextCursor: string | null;
}> {
  const limit = data.limit ?? 30;

  // Aliases for the self-join on parent message + parent message author
  const parentMessages = aliasedTable(messagesTable, "parent_messages");
  const parentUsers = aliasedTable(usersTable, "parent_users");

  const rows = await db
    .select({
      id: messagesTable.id,
      content: messagesTable.content,
      channelId: messagesTable.channelId,
      userId: messagesTable.userId,
      parentMessageId: messagesTable.parentMessageId,
      name : messagesTable.channelName,
      attachments: messagesTable.attachments,
      createdAt: messagesTable.createdAt,
      user: {
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
      },
      // ✅ Pull parent message snapshot so reply badge always has data
      parentMessage: {
        id: parentMessages.id,
        content: parentMessages.content,
        userId: parentMessages.userId,
        userName: parentUsers.name,
      },
    })
    .from(messagesTable)
    .innerJoin(usersTable, eq(messagesTable.userId, usersTable.id))
    // LEFT JOIN so regular messages (no parent) still come through
    .leftJoin(parentMessages, eq(messagesTable.parentMessageId, parentMessages.id))
    .leftJoin(parentUsers, eq(parentMessages.userId, parentUsers.id))
    .where(
      and(
        eq(messagesTable.channelId, data.channelId),
        isNull(messagesTable.deletedAt),
        data.name ? eq(messagesTable.channelName, data.name) : undefined,
        data.cursor
          ? lt(messagesTable.createdAt, new Date(data.cursor))
          : undefined,
      ),
    )
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const rawRows = (hasMore ? rows.slice(0, limit) : rows).reverse();

  // ✅ Normalize parentMessage: Drizzle LEFT JOIN returns an object with all-null fields
  // when there is no parent. We collapse that into a clean null so the badge logic is simple.
  const pageRows = rawRows.map((row) => ({
    ...row,
    parentMessage:
      row.parentMessage?.id != null
        ? {
            id: row.parentMessage.id,
            content: row.parentMessage.content,
            userId: row.parentMessage.userId,
            userName: row.parentMessage.userName,
          }
        : null,
  }));

  // ✅ Guard against empty array before index access — fixes "Object is possibly undefined"
  const firstRow = pageRows[0];
  const nextCursor =
    hasMore && firstRow ? firstRow.createdAt.toISOString() : null;

  return {
    messages: pageRows as MessageWithUser[],
    nextCursor,
  };
}

//Edit Message function
export async function editMessage(
  messageId: string,
  channelId: string,
  content: string
) {
  try {
    const res = await db
      .update(messagesTable)
      .set({
        content: content,
        updatedAt: new Date(), // recommended
      })
      .where(
        and(
          eq(messagesTable.id, messageId),
          eq(messagesTable.channelId, channelId)
        )
      )
      .returning();

    return res;
  } catch (err) {
    console.log(err);
    return null;
  }
}


//Delete Message function
export async function deleteMessage(
  messageId: string,
  channelId: string
) {
  try {
    const res = await db
      .delete(messagesTable)
      .where(
        and(
          eq(messagesTable.id, messageId),
          eq(messagesTable.channelId, channelId)
        )
      )
      .returning();

    return res[0] ?? null; // return deleted message
  } catch (err) {
    console.log(err);
    return null;
  }
}


// ========================================
// getParentMessageSnapshot
// Used by the WS server to attach parent message data to the broadcast
// so the reply badge renders correctly for all recipients immediately.
// ========================================
export async function getParentMessageSnapshot(parentMessageId: string): Promise<{
  id: string;
  content: string | null;
  userId: string;
  userName: string;
} | null> {
  try {
    const rows = await db
      .select({
        id: messagesTable.id,
        content: messagesTable.content,
        userId: messagesTable.userId,
        userName: usersTable.name,
      })
      .from(messagesTable)
      .innerJoin(usersTable, eq(messagesTable.userId, usersTable.id))
      .where(eq(messagesTable.id, parentMessageId))
      .limit(1);

    return rows[0] ?? null;
  } catch (err) {
    console.error("❌ getParentMessageSnapshot error:", err);
    return null;
  }
}
//Reply Message function
export async function replyMessage({
  channelId,
  channelName,
  content,
  userId,
  parentMessageId,
  attachments,
}: {
  channelId: string;
  channelName: string;  // ✅ required — schema has channelName notNull
  content: string;
  userId: string;
  parentMessageId?: string;
  attachments?: unknown[];
}) {
  try {
    // Optional validation: ensure parent exists
    if (parentMessageId) {
      const parent = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.id, parentMessageId))
        .limit(1);

      if (!parent.length) {
        throw new Error("Parent message not found");
      }
    }

    const res = await db
      .insert(messagesTable)
      .values({
        channelId,
        channelName,  // ✅ required by schema
        content,
        userId,
        parentMessageId: parentMessageId ?? null,
        attachments: attachments ?? [],
        createdAt: new Date(),
      })
      .returning();

    return res[0];
  } catch (err) {
    console.log(err);
    return null;
  }
}