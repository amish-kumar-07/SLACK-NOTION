import { Router } from "express";
import { authMiddleware } from "../../middlewares/authHandler.js";
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid'; // npm i uuid @types/uuid
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY!;
const BUCKET_NAME = 'uploads'; // ✅ Change to your actual public bucket name

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Optional: restrict file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images, PDFs, and docs allowed'));
  }
});

const uploadRoute = Router();

uploadRoute.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // ✅ Get userId from auth middleware (preferred over body)
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    // ✅ Unique path structure
    const fileId = uuidv4();
    const path = `messages/${userId}/${fileId}-${file.originalname}`;

    // ✅ Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, Buffer.from(file.buffer), { 
        contentType: file.mimetype, 
        upsert: false // Prevent overwrites
      });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    // ✅ Generate public URL
    const publicUrl = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path).data.publicUrl;

    // ✅ Return structured Attachment for saveMessage()
    const attachment = {
      id: fileId,
      url: publicUrl,
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString()
    };

    res.json({ 
      success: true, 
      attachment // ✅ Matches SaveMessageInput['attachments']
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default uploadRoute;
