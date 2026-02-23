// routes/message/index.ts
import { Router } from "express";
import { AppError } from "../../utils/AppError.js";
import { getMessages } from "../../services/message/index.js";
import type { GetMessagesInput } from "../../services/message/index.js";
import { authMiddleware } from "../../middlewares/authHandler.js";

const mssg = Router();

// GET /message/getMessages?channelId=xxx&cursor=yyy&limit=30
mssg.get("/getMessages", authMiddleware, async (req, res, next) => {
  try {
    const { channelId, cursor, limit, name } = req.query;

    if (!channelId || typeof channelId !== "string") {
      throw new AppError("channelId is required", 400);
    }

    // ✅ FIX: With exactOptionalPropertyTypes:true, you cannot pass `cursor: undefined`
    // explicitly — the key must be fully OMITTED from the object when there's no cursor.
    // Build the input object conditionally so the key is never present when undefined.
    const input: GetMessagesInput = {
      channelId,
      limit: typeof limit === "string" ? parseInt(limit, 10) : 30,
      ...(typeof cursor === "string" ? { cursor } : {}),
      ...(typeof name === "string" ? { name } : {}),
    };
    const result = await getMessages(input);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

export default mssg;
