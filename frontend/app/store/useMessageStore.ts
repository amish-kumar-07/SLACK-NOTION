import { create } from "zustand";

export interface MessageUser {
  id: string;
  name: string;
  email: string;
}

export interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  parentMessageId: string | null;
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

  isChannelFetched: (channelId) => {
    return get().channels[channelId]?.isFetched ?? false;
  },
}));