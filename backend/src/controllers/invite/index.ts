import { Router } from "express";
import { AppError } from "../../utils/AppError.js";
import {
  InviteUser,
  GetAllInvite,
  AcceptInvite,
} from "../../types/zodSchema.js";
import {
  deleteInvite,
  getAllInvite,
  inviteUser,
  findWorkspace,
  acceptInvite,
} from "../../services/invite/index.js";
import { findOne } from "../../services/auth/index.js";
import {
  addMember,
  isWorkspaceMember,
} from "../../services/workspace/index.js";
import {
  adminMiddleware,
  authMiddleware,
} from "../../middlewares/authHandler.js";

const invite = Router();

invite.post(
  "/inviteUser",
  authMiddleware,
  adminMiddleware,
  async (req, res, next) => {
    try {
      const { success, data } = InviteUser.safeParse(req.body);

      if (!success) {
        throw AppError.validation();
      }

      if (data.email === req.user?.email) {
        return res.status(400).json({ message: "You can't invite Yourself" });
      }

      const user = await findOne(data.email);

      if (!user) {
        throw AppError.notFound("User Not Found");
      }

      const workspace = await findWorkspace(data.workspaceId);

      if (!workspace) {
        return res.status(404).json({ message: "Workspace Not Found" });
      }

      // 0. Check if user already exists
      const isExists = await isWorkspaceMember(data.workspaceId, user.id);

      if (isExists) {
        return res.status(400).json({
          message: "User is already a member of this workspace",
        });
      }

      const inviteSend = await inviteUser(
        data.invitedById,
        data.invitedByEmail,
        data.email,
        data.workspaceId,
        workspace.WorkspaceName,
        data.role,
      );

      if (!inviteSend) {
        throw AppError.internal(
          `Not Able to create a invite for this user ${data.email}`,
        );
      }

      return res.status(201).json({
        message: "success",
        inviteSend,
      });
    } catch (err) {
      console.log(err);
      next(err instanceof AppError ? err : AppError.internal()); // important
    }
  },
);

invite.post("/getInvites", authMiddleware, async (req, res) => {
  try {
    const { success, data } = GetAllInvite.safeParse(req.body);
    if (!success) {
      return res.status(400).json({ message: "Invalid Input" });
    }
    const invites = await getAllInvite(data.email);

    return res.status(200).json({ message: "success", invites });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

invite.delete(
  "/deleteInvite",
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.query as { id?: string };

      if (!id) {
        return res.status(400).json({
          ok: false,
          message: "Invite id is required",
        });
      }

      const valid = await deleteInvite(id);

      if (valid === false) {
        return res.status(404).json({
          ok: false,
          message: "Row not found",
        });
      }

      if (valid === null) {
        return res.status(500).json({
          ok: false,
          message: "Delete failed",
        });
      }

      return res.status(200).json({
        ok: true,
        message: "success",
        id,
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        ok: false,
        message: "Internal Server Error",
      });
    }
  },
);

invite.post("/accept", authMiddleware, async (req, res) => {
  try {
    const { success, data } = AcceptInvite.safeParse(req.body);

    if (!success) {
      return res.status(400).json({ message: "Invalid Input" });
    }
    const userId = req.user?.id;
    if (!userId) {
      return res.status(404).json({ message: "User Id is missing" });
    }

    // 1. Add user as workspace member
    const addmember = await addMember(data.workspaceId, userId, data.role);

    if (!addmember) {
      return res.status(400).json({
        message: "Unable to add as WorkspaceMember",
      });
    }

    // 2. Mark invite accepted
    const accepted = await acceptInvite(data.id);

    if (!accepted) {
      return res.status(400).json({
        message: "Invite not accepted",
      });
    }

    return res.status(200).json({
      message: "success",
      accepted,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

export default invite;
