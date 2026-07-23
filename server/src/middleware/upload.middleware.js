import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import env from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Shared file filter ──
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif|mp4|mov|avi|webm/;
  if (allowed.test(file.mimetype)) return cb(null, true);
  cb(new Error('File type not allowed'));
};

let uploadImage, uploadVideo, uploadAny;

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  // ── Cloudinary storage ──
  const cloudinaryModule        = await import('cloudinary');
  const cloudinary              = cloudinaryModule.v2;
  const { CloudinaryStorage }   = await import('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name:  env.CLOUDINARY_CLOUD_NAME,
    api_key:     env.CLOUDINARY_API_KEY,
    api_secret:  env.CLOUDINARY_API_SECRET,
  });

  const imageStorage = new CloudinaryStorage({
    cloudinary,
    params: { folder: 'lifesave/images', allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
  });

  const videoStorage = new CloudinaryStorage({
    cloudinary,
    params: { folder: 'lifesave/videos', resource_type: 'video', allowed_formats: ['mp4', 'mov', 'avi', 'webm'] },
  });

  uploadImage = multer({ storage: imageStorage, limits: { fileSize: 10  * 1024 * 1024 } });
  uploadVideo = multer({ storage: videoStorage, limits: { fileSize: 100 * 1024 * 1024 } });
  uploadAny   = multer({ storage: imageStorage, limits: { fileSize: 100 * 1024 * 1024 } });

} else {
  // ── Fallback: local disk storage ──
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });

  const diskUpload = multer({ storage: diskStorage, limits: { fileSize: 100 * 1024 * 1024 }, fileFilter });
  uploadImage = diskUpload;
  uploadVideo = diskUpload;
  uploadAny   = diskUpload;
}

export { uploadImage, uploadVideo, uploadAny };
export default uploadAny;
