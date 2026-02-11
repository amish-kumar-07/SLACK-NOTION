import { Router } from "express";
import { AppError } from "../../utils/AppError.js";
import { WorkspaceSchema } from "../../types/zodSchema.js";
import { createWorkspace , getWorkspace , addMember } from "../../services/workspace/index.js";
import { authMiddleware , adminMiddleware } from "../../middlewares/authHandler.js";
import { createChannel } from "../../services/channel/index.js";

const workspace = Router();

workspace.post("/create", authMiddleware , adminMiddleware ,  async (req, res, next) => {
  try {
    const { success, data } = WorkspaceSchema.safeParse(req.body);
    if (!success) {
      return next(AppError.validation("Invalid input schema"));
    }

    if (!req.user?.id) {
      return next(AppError.unauthorized());
    }

    const workspace = await createWorkspace(
      req.user.id,
      data.workspaceName,
      data.description
    );

    if (!workspace) {
      return next(AppError.badRequest("Unable to create workspace"));
    }
    
    const newMember = await addMember(workspace.id,workspace.userId,'owner');

    if(!newMember)
    { 
      return next(
          AppError.badRequest("Unable to add you to your workspace")
        );
    }  
  
    const newChannel = await createChannel(workspace.id,"general",req.user?.email);

    if(!newChannel)
    {
      return next(AppError.badRequest("Unable to create a channel"));
    }

    return res.status(201).json({
      success: true,
      workspace,
      newChannel
    });
  } catch (err) {
    return next(err instanceof AppError ? err : AppError.internal());
  }
});

workspace.get("/allWorkspace", authMiddleware, async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return next(AppError.unauthorized());
    }

    const allWorkspace = await getWorkspace(req.user.id);

    return res.status(200).json({
      success: true,
      allWorkspace,
    });
  } catch (err) {
    console.error(err);
    return next(err instanceof AppError ? err : AppError.internal());
  }
});

export default workspace;