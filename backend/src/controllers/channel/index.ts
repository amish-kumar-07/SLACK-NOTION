import { Router } from "express";
import { AppError } from "../../utils/AppError.js";
import { getChannel } from "../../services/channel/index.js";
import { authMiddleware } from "../../middlewares/authHandler.js";

const channel = Router();


channel.get("/getChannel/:id", authMiddleware, async (req, res, next) => {
  try {
    const workspace_id_param = req.params.id;

    if (!workspace_id_param || Array.isArray(workspace_id_param)) {
      return next(AppError.validation("Workspace ID is invalid"));
    }

    if (!req.user?.email) {
      return next(AppError.unauthorized());
    }

    const channelData = await getChannel(
      workspace_id_param,
      "general",
    );

    if (!channelData) {
      return next(AppError.notFound("Channel not found"));
    }

    return res.status(200).json({
      success: true,
      channel: channelData,
    });

  } catch (err) {
    console.error(err);
    return next(err instanceof AppError ? err : AppError.internal());
  }
});

export default channel;