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

// Matches the shape returned by POST /upload
export interface Attachment {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

export interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  parentMessageId: string | null;
  parentMessage: ParentMessage | null;
  name: string;
  attachments: Attachment[];
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
  /** Updates the content of an existing message in place */
  updateMessage: (channelId: string, messageId: string, newContent: string) => void;
  /** Removes a message from the store */
  deleteMessage: (channelId: string, messageId: string) => void;
  /** Looks up a single message by id */
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

      // Deduplicate by id — prevents double-render on fast sends
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

  reconcileMessage: (channelId, tempId, confirmedMessage) => {
    set((state) => {
      const existing = state.channels[channelId];
      if (!existing) return state;

      const idx = existing.messages.findIndex((m) => m.id === tempId);
      if (idx === -1) {
        // Optimistic message not found — just append (edge case: very fast server response)
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

      // Replace the optimistic message at its exact position (preserves order)
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

  getMessageById: (channelId, messageId) => {
    return get().channels[channelId]?.messages.find((m) => m.id === messageId);
  },
}));