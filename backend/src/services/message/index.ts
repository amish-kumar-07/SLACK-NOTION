// services/message/index.ts
import { db } from "../../db/index.js";
import { messagesTable, usersTable } from "../../db/schema.js";
import { and, eq, lt, desc, isNull } from "drizzle-orm";

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
};

export async function getMessages(data: GetMessagesInput): Promise<{
  messages: MessageWithUser[];
  nextCursor: string | null;
}> {
  const limit = data.limit ?? 30;

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
    })
    .from(messagesTable)
    .innerJoin(usersTable, eq(messagesTable.userId, usersTable.id))
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
  const pageRows = (hasMore ? rows.slice(0, limit) : rows).reverse();

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

//Reply Message function
export async function replyMessage({
  channelId,
  content,
  userId,
  parentMessageId,
}: {
  channelId: string;
  content: string;
  userId: string;
  parentMessageId?: string;
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
        content,
        userId,
        parentMessageId: parentMessageId ?? null,
        createdAt: new Date(),
      })
      .returning();

    return res[0];
  } catch (err) {
    console.log(err);
    return null;
  }
}