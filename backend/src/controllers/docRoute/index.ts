// src/controllers/docRoute/index.ts
import { Router } from "express";
import type { Request } from "express";
import { authMiddleware } from "../../middlewares/authHandler.js";
import { DocCreateSchema } from "../../types/zodSchema.js";
import {
  createDocument,
  getDocument,
  getDocumentById,
  updateDocument,
  getComments,
  createComment,
} from "../../services/docService/index.js";

const doc = Router();

// ── Existing ──────────────────────────────────────────────────────────────────

// POST /doc/create
doc.post("/create", authMiddleware, async (req, res) => {
  try {
    const { success, data } = DocCreateSchema.safeParse(req.body);
    if (!success) {
      return res.status(404).json({ message: "Invalid Input" });
    }
    if (!req.user?.id) {
      return res.status(400).json({ message: "Invalid Input" });
    }
    const newDoc = await createDocument(
      data.workspaceId,
      data.channelId,
      data.title ?? "Untitled",
      req.user.id
    );
    if (!newDoc) {
      return res.status(500).json({ message: "Document creation failed" });
    }
    return res.status(200).json({ success: true, data: newDoc });
  } catch (err) {
    return res.status(500).json({ message: "Internal Server!" });
  }
});

// GET /doc/getDoc/:workspaceId/:channelId
doc.get(
  "/getDoc/:workspaceId/:channelId",
  authMiddleware,
  async (req: Request<{ workspaceId: string; channelId: string }>, res) => {
    try {
      const { workspaceId, channelId } = req.params;
      const document = await getDocument(workspaceId, channelId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      return res.status(200).json(document);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal Server!" });
    }
  }
);

// ── New ───────────────────────────────────────────────────────────────────────

// GET /doc/:docId — fetch single document by ID
doc.get(
  "/:docId",
  async (req: Request<{ docId: string }>, res) => {
    try {
      const { docId } = req.params;
      const document = await getDocumentById(docId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      return res.status(200).json({ success: true, data: document });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal Server!" });
    }
  }
);

// PUT /doc/:docId — update title + content
doc.put(
  "/:docId",
  authMiddleware,
  async (req: Request<{ docId: string }>, res) => {
    try {
      const { docId } = req.params;
      const { title, content } = req.body;

      if (!title || !content) {
        return res.status(400).json({ message: "title and content are required" });
      }

      const updated = await updateDocument(docId, title, content);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update document" });
      }
      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal Server!" });
    }
  }
);

// GET /doc/comments/:docId — fetch all comments for a document
doc.get(
  "/comments/:docId",
  authMiddleware,
  async (req: Request<{ docId: string }>, res) => {
    try {
      const { docId } = req.params;
      const comments = await getComments(docId);
      if (!comments) {
        return res.status(500).json({ message: "Failed to fetch comments" });
      }
      return res.status(200).json(comments);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal Server!" });
    }
  }
);

// POST /doc/comments/:docId — post a new comment
doc.post(
  "/comments/:docId",
  authMiddleware,
  async (req: Request<{ docId: string }>, res) => {
    try {
      const { docId } = req.params;
      const { text } = req.body;

      if (!text?.trim()) {
        return res.status(400).json({ message: "Comment text is required" });
      }
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const comment = await createComment(docId, req.user.id, text.trim());
      if (!comment) {
        return res.status(500).json({ message: "Failed to post comment" });
      }
      return res.status(200).json({ success: true, data: comment });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal Server!" });
    }
  }
);

export default doc;