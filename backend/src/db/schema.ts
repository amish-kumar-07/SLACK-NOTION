import {
  text,
  jsonb,
  pgEnum,
  pgTable,
  varchar,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 1. Define enum type in Postgres
export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "declined",
]);

// 2. Users table
export const usersTable = pgTable("users", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),

  role: userRoleEnum("role").default("user").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Workspace table
export const wrokspaceTable = pgTable("wrokspace", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  userId: uuid("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  WorkspaceName: varchar("WorkspaceName", { length: 255 }).notNull(),

  Description: varchar("Description", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. Workspace Member
export const WorkspaceMembers = pgTable("WorkspaceMembers", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  workspaceId: uuid("workspaceId")
    .notNull()
    .references(() => wrokspaceTable.id, { onDelete: "cascade" }),

  userId: uuid("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  role: workspaceRoleEnum("role").default("member").notNull(),

  joined_at: timestamp("joined_at").defaultNow().notNull(),
});

// 5. Channels

export const Channels = pgTable("Channels", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  workspace_id: uuid("workspace_id")
    .notNull()
    .references(() => wrokspaceTable.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 255 }).default("general").notNull(),

  created_by: varchar("created_by", { length: 255 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Messages

export const messagesTable = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),

  channelId: uuid("channelId")
    .notNull()
    .references(() => Channels.id, { onDelete: "cascade" }),

  channelName: varchar("channelName", { length: 255 }).notNull().default("general"),

  userId: uuid("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  content: text("content"),

  parentMessageId: uuid("parent_message_id"),

  attachments: jsonb("attachments").default([]),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// 7. Invite
export const invitesTable = pgTable("invites", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  workspaceId: uuid("workspaceId")
    .notNull()
    .references(() => wrokspaceTable.id, { onDelete: "cascade" }),

  WorkspaceName : varchar("workspaceName",{length : 255})
      .notNull(),

  invitedById: uuid("invitedById") // UUID type for user.id
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  invitedByEmail: varchar("invitedByEmail", { length: 255 }) // VARCHAR for email
    .notNull()
    .references(() => usersTable.email, { onDelete: "cascade" }),

  email: varchar("email", { length: 255 }).notNull(),

  role: workspaceRoleEnum("role").default("member").notNull(),

  status: inviteStatusEnum("status").default("pending").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 8. Document table

export const documentsTable = pgTable("documents", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => wrokspaceTable.id, { onDelete: "cascade" }),

  channelId: uuid("channel_id")
    .notNull()
    .references(() => Channels.id, { onDelete: "cascade" }),

  title: varchar("title", { length: 255 }).notNull().default("Untitled"),

  // { blocks: [{ type: "paragraph"|"heading"|"list", text: string }] }
  content: jsonb("content")
    .notNull()
    .default({ blocks: [] }),

  createdBy: uuid("created_by")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Document Comments
// ─────────────────────────────────────────────────────────────────────────────
export const documentCommentsTable = pgTable("comments", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  documentId: uuid("document_id")
    .notNull()
    .references(() => documentsTable.id, { onDelete: "cascade" }),

  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  text: text("text").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Inferred TypeScript types
// ─────────────────────────────────────────────────────────────────────────────
export type Document           = typeof documentsTable.$inferSelect;
export type NewDocument        = typeof documentsTable.$inferInsert;
export type DocumentComment    = typeof documentCommentsTable.$inferSelect;
export type NewDocumentComment = typeof documentCommentsTable.$inferInsert;

