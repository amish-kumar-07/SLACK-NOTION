import { create } from "zustand";

export interface MessageUser {
  id: string;
  name: string;
  email: string;
}

export interface ParentMessage {
  id: string;
  content: string | null;
  userId: string;
  userName: string;
}

export interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  parentMessageId: string | null;
  parentMessage: ParentMessage | null; // ✅ snapshot from DB — reply badge never shows "Unknown"
  name: string;
  attachments: string[];
  createdAt: string;
  user: MessageUser;
}

interface ChannelMessageState {
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
  isFetched: boolean;
}

interface MessageStore {
  channels: Record<string, ChannelMessageState>;

  setInitialMessages: (channelId: string, messages: Message[], nextCursor: string | null) => void;
  prependMessages: (channelId: string, messages: Message[], nextCursor: string | null) => void;
  appendMessage: (channelId: string, message: Message) => void;
  /** Replaces the optimistic message (matched by tempId) with the server-confirmed version */
  reconcileMessage: (channelId: string, tempId: string, confirmedMessage: Message) => void;
  /** ✅ NEW: Updates the content of an existing message in place */
  updateMessage: (channelId: string, messageId: string, newContent: string) => void;
  /** ✅ NEW: Removes a message from the store */
  deleteMessage: (channelId: string, messageId: string) => void;
  /** ✅ NEW: Looks up a single message by id — used by reply badge to show quoted content */
  getMessageById: (channelId: string, messageId: string) => Message | undefined;
  isChannelFetched: (channelId: string) => boolean;
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  channels: {},

  setInitialMessages: (channelId, messages, nextCursor) => {
    set((state) => ({
      channels: {
        ...state.channels,
        [channelId]: {
          messages,
          nextCursor,
          hasMore: nextCursor !== null,
          isFetched: true,
        },
      },
    }));
  },

  prependMessages: (channelId, messages, nextCursor) => {
    set((state) => {
      const existing = state.channels[channelId];
      if (!existing) return state;

      const existingIds = new Set(existing.messages.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));

      return {
        channels: {
          ...state.channels,
          [channelId]: {
            ...existing,
            messages: [...newMessages, ...existing.messages],
            nextCursor,
            hasMore: nextCursor !== null,
          },
        },
      };
    });
  },

  appendMessage: (channelId, message) => {
    set((state) => {
      const existing = state.channels[channelId];
      if (!existing) return state;

      // Deduplicate by id
      const alreadyExists = existing.messages.some((m) => m.id === message.id);
      if (alreadyExists) return state;

      return {
        channels: {
          ...state.channels,
          [channelId]: {
            ...existing,
            messages: [...existing.messages, message],
          },
        },
      };
    });
  },

  // ✅ Replaces the temp optimistic message with the server-confirmed one
  // This prevents duplicate messages for the sender
  reconcileMessage: (channelId, tempId, confirmedMessage) => {
    set((state) => {
      const existing = state.channels[channelId];
      if (!existing) return state;

      const idx = existing.messages.findIndex((m) => m.id === tempId);
      if (idx === -1) {
        // Optimistic message not found — just append (edge case)
        return {
          channels: {
            ...state.channels,
            [channelId]: {
              ...existing,
              messages: [...existing.messages, confirmedMessage],
            },
          },
        };
      }

      // Replace the optimistic message at its position
      const updated = [...existing.messages];
      updated[idx] = confirmedMessage;

      return {
        channels: {
          ...state.channels,
          [channelId]: {
            ...existing,
            messages: updated,
          },
        },
      };
    });
  },

  // ✅ NEW: Updates content of a message in place — used when edit is confirmed
  updateMessage: (channelId, messageId, newContent) => {
    set((state) => {
      const existing = state.channels[channelId];
      if (!existing) return state;

      return {
        channels: {
          ...state.channels,
          [channelId]: {
            ...existing,
            messages: existing.messages.map((m) =>
              m.id === messageId ? { ...m, content: newContent } : m
            ),
          },
        },
      };
    });
  },

  // ✅ NEW: Removes a message from the list — used when delete is confirmed
  deleteMessage: (channelId, messageId) => {
    set((state) => {
      const existing = state.channels[channelId];
      if (!existing) return state;

      return {
        channels: {
          ...state.channels,
          [channelId]: {
            ...existing,
            messages: existing.messages.filter((m) => m.id !== messageId),
          },
        },
      };
    });
  },

  isChannelFetched: (channelId) => {
    return get().channels[channelId]?.isFetched ?? false;
  },

  // ✅ NEW: Looks up a single message by id — used by the reply badge
  getMessageById: (channelId, messageId) => {
    return get().channels[channelId]?.messages.find((m) => m.id === messageId);
  },
}));