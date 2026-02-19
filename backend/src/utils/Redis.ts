import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("error", (err: any) => {
  console.error("❌ Redis error", err);
});

// ========================================
// CONSTANTS
// ========================================
const TTL_24_HOURS = 86400;
const NAMESPACE = "collabai";

// Sentinel value stored in Redis hash for "no room"
// We NEVER store null/undefined in Redis hashes — ioredis silently drops them.
const NO_ROOM = "__none__";

// ========================================
// HELPER: Build Redis Keys
// ========================================
const Keys = {
  userSockets: (userId: string) => `${NAMESPACE}:user:${userId}:sockets`,
  roomSockets: (roomId: string) => `${NAMESPACE}:room:${roomId}:sockets`,
  socketMeta: (socketId: string) => `${NAMESPACE}:socket:${socketId}:meta`,
  socketUser: (socketId: string) => `${NAMESPACE}:socket:${socketId}:user`,
};

// ========================================
// TYPE DEFINITIONS
// ========================================
export interface SocketMetadata {
  userId: string;
  userEmail: string;
  userRole: string;
  currentRoom: string | null; // null means not in any room
  connectedAt: string;
}

// Internal shape stored in Redis (all string values, no nulls)
interface RawSocketMeta {
  userId: string;
  userEmail: string;
  userRole: string;
  currentRoom: string; // NO_ROOM sentinel or actual roomId
  connectedAt: string;
}

// ========================================
// INTERNAL HELPERS
// ========================================

/**
 * Convert public SocketMetadata → raw Redis hash (no nulls)
 */
function toRaw(meta: SocketMetadata): RawSocketMeta {
  return {
    userId: meta.userId,
    userEmail: meta.userEmail,
    userRole: meta.userRole,
    currentRoom: meta.currentRoom ?? NO_ROOM,
    connectedAt: meta.connectedAt,
  };
}

/**
 * Convert raw Redis hash → public SocketMetadata (nulls restored)
 */
function fromRaw(raw: Record<string, string>): SocketMetadata {
  return {
    userId: raw.userId ?? "",
    userEmail: raw.userEmail ?? "",
    userRole: raw.userRole ?? "user",
    currentRoom: raw.currentRoom === NO_ROOM || !raw.currentRoom ? null : raw.currentRoom,
    connectedAt: raw.connectedAt ?? "",
  };
}

/**
 * Determine if a raw currentRoom value means "in a room"
 */
function isInRoom(rawCurrentRoom: string | null | undefined): boolean {
  if (!rawCurrentRoom) return false;
  if (rawCurrentRoom === NO_ROOM) return false;
  if (rawCurrentRoom === "null") return false; // legacy safety
  if (rawCurrentRoom === "") return false;
  return true;
}

// ========================================
// CORE OPERATIONS
// ========================================

/**
 * Register a new socket connection.
 *
 * Stores metadata in a Redis hash, links socket to user (multi-device),
 * and sets 24-hour TTL on all keys.
 */
export async function registerSocket(
  socketId: string,
  metadata: SocketMetadata
): Promise<void> {
  try {
    const raw = toRaw(metadata);
    const pipeline = redis.pipeline();

    // Add socket to user's device set
    pipeline.sadd(Keys.userSockets(metadata.userId), socketId);
    pipeline.expire(Keys.userSockets(metadata.userId), TTL_24_HOURS);

    // Store socket metadata — use spread so ioredis gets flat key/value pairs
    pipeline.hset(Keys.socketMeta(socketId), { ...raw });
    pipeline.expire(Keys.socketMeta(socketId), TTL_24_HOURS);

    // Reverse lookup: socket → userId
    pipeline.set(Keys.socketUser(socketId), metadata.userId);
    pipeline.expire(Keys.socketUser(socketId), TTL_24_HOURS);

    await pipeline.exec();

    console.log(`✅ Socket ${socketId} registered for user ${metadata.userEmail}`);
  } catch (error) {
    console.error(`❌ Failed to register socket ${socketId}:`, error);
    throw error;
  }
}

/**
 * Join a room.
 *
 * Atomically leaves the previous room (if any), adds socket to the new room,
 * and updates the currentRoom field in metadata.
 */
export async function joinRoom(
  socketId: string,
  roomId: string
): Promise<void> {
  try {
    // Read current room before pipeline so we can conditionally leave it
    const rawCurrentRoom = await redis.hget(Keys.socketMeta(socketId), "currentRoom");

    const pipeline = redis.pipeline();

    // Leave previous room if the socket was in one
    if (isInRoom(rawCurrentRoom)) {
      pipeline.srem(Keys.roomSockets(rawCurrentRoom!), socketId);
      console.log(`🚪 Socket ${socketId} leaving room ${rawCurrentRoom}`);
    }

    // Join new room
    pipeline.sadd(Keys.roomSockets(roomId), socketId);
    pipeline.expire(Keys.roomSockets(roomId), TTL_24_HOURS);

    // Update metadata — refresh TTL too
    pipeline.hset(Keys.socketMeta(socketId), "currentRoom", roomId);
    pipeline.expire(Keys.socketMeta(socketId), TTL_24_HOURS);

    await pipeline.exec();

    console.log(`✅ Socket ${socketId} joined room ${roomId}`);
  } catch (error) {
    console.error(`❌ Failed to join room for socket ${socketId}:`, error);
    throw error;
  }
}

/**
 * Leave a room.
 *
 * Removes socket from the room set and resets currentRoom to the NO_ROOM sentinel.
 */
export async function leaveRoom(
  socketId: string,
  roomId: string
): Promise<void> {
  try {
    const pipeline = redis.pipeline();

    pipeline.srem(Keys.roomSockets(roomId), socketId);
    // Use the sentinel — never store empty string or null
    pipeline.hset(Keys.socketMeta(socketId), "currentRoom", NO_ROOM);

    await pipeline.exec();

    console.log(`👋 Socket ${socketId} left room ${roomId}`);
  } catch (error) {
    console.error(`❌ Failed to leave room for socket ${socketId}:`, error);
    // Don't throw — cleanup should always succeed
  }
}

/**
 * Get all socket IDs currently in a room.
 */
export async function getRoomSockets(roomId: string): Promise<string[]> {
  try {
    return await redis.smembers(Keys.roomSockets(roomId));
  } catch (error) {
    console.error(`❌ Failed to get room sockets for ${roomId}:`, error);
    return [];
  }
}

/**
 * Get metadata for a socket.
 * Returns null if the socket doesn't exist in Redis.
 */
export async function getSocketMetadata(
  socketId: string
): Promise<SocketMetadata | null> {
  try {
    const raw = await redis.hgetall(Keys.socketMeta(socketId));

    // hgetall returns {} (empty object) when key doesn't exist
    if (!raw || !raw.userId) {
      return null;
    }

    return fromRaw(raw);
  } catch (error) {
    console.error(`❌ Failed to get metadata for socket ${socketId}:`, error);
    return null;
  }
}

/**
 * Get all socket IDs for a user (multi-device support).
 */
export async function getUserSockets(userId: string): Promise<string[]> {
  try {
    return await redis.smembers(Keys.userSockets(userId));
  } catch (error) {
    console.error(`❌ Failed to get user sockets for ${userId}:`, error);
    return [];
  }
}

/**
 * Check if a user is online (has at least one active socket).
 */
export async function isUserOnline(userId: string): Promise<boolean> {
  try {
    const count = await redis.scard(Keys.userSockets(userId));
    return count > 0;
  } catch (error) {
    console.error(`❌ Failed to check if user ${userId} is online:`, error);
    return false;
  }
}

/**
 * Fully remove a socket on disconnect.
 *
 * 1. Reads metadata
 * 2. Removes from current room (if any)
 * 3. Removes from user's socket set
 * 4. Deletes all socket keys
 *
 * Always succeeds — never throws.
 */
export async function removeSocket(socketId: string): Promise<void> {
  try {
    const meta = await getSocketMetadata(socketId);

    if (!meta) {
      console.log(`⚠️ Socket ${socketId} metadata not found (already cleaned up?)`);
      return;
    }

    const pipeline = redis.pipeline();

    // Remove from current room if applicable
    if (meta.currentRoom) {
      pipeline.srem(Keys.roomSockets(meta.currentRoom), socketId);
    }

    // Remove from user's socket set
    pipeline.srem(Keys.userSockets(meta.userId), socketId);

    // Delete both socket keys
    pipeline.del(Keys.socketMeta(socketId));
    pipeline.del(Keys.socketUser(socketId));

    await pipeline.exec();

    console.log(`🗑️ Socket ${socketId} fully removed (user: ${meta.userEmail})`);
  } catch (error) {
    console.error(`❌ Failed to remove socket ${socketId}:`, error);
    // Don't throw — cleanup must always complete
  }
}

/**
 * Get room statistics (socket count + unique user count).
 * Uses a pipeline for efficiency.
 */
export async function getRoomStats(roomId: string): Promise<{
  socketCount: number;
  uniqueUsers: number;
}> {
  try {
    const socketIds = await getRoomSockets(roomId);

    if (socketIds.length === 0) {
      return { socketCount: 0, uniqueUsers: 0 };
    }

    // Batch-fetch all user IDs in one pipeline
    const pipeline = redis.pipeline();
    for (const socketId of socketIds) {
      pipeline.get(Keys.socketUser(socketId));
    }
    const results = await pipeline.exec();

    const userIds = new Set<string>();
    if (results) {
      for (const [err, userId] of results) {
        if (!err && userId) {
          userIds.add(userId as string);
        }
      }
    }

    return {
      socketCount: socketIds.length,
      uniqueUsers: userIds.size,
    };
  } catch (error) {
    console.error(`❌ Failed to get room stats for ${roomId}:`, error);
    return { socketCount: 0, uniqueUsers: 0 };
  }
}

/**
 * Get global statistics across all rooms and users.
 * Uses Redis SCAN — call sparingly (admin/debug only).
 */
export async function getGlobalStats(): Promise<{
  totalUsers: number;
  totalRooms: number;
  rooms: Array<{ roomId: string; socketCount: number; uniqueUsers: number }>;
}> {
  try {
    const scanAll = async (pattern: string): Promise<string[]> => {
      const keys: string[] = [];
      let cursor = "0";
      do {
        const [newCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = newCursor;
        keys.push(...batch);
      } while (cursor !== "0");
      return keys;
    };

    const [userKeys, roomKeys] = await Promise.all([
      scanAll(`${NAMESPACE}:user:*:sockets`),
      scanAll(`${NAMESPACE}:room:*:sockets`),
    ]);

    const rooms = await Promise.all(
      roomKeys.map(async (key) => {
        const roomId = key
          .replace(`${NAMESPACE}:room:`, "")
          .replace(":sockets", "");
        const stats = await getRoomStats(roomId);
        return { roomId, ...stats };
      })
    );

    return {
      totalUsers: userKeys.length,
      totalRooms: roomKeys.length,
      rooms,
    };
  } catch (error) {
    console.error("❌ Failed to get global stats:", error);
    return { totalUsers: 0, totalRooms: 0, rooms: [] };
  }
}

export default redis;