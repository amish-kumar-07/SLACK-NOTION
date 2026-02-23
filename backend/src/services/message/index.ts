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
