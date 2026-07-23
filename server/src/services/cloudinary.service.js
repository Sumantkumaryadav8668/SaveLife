import { v2 as cloudinary } from 'cloudinary';
import env from '../config/env.js';

const isConfigured =
  !!env.CLOUDINARY_CLOUD_NAME &&
  !!env.CLOUDINARY_API_KEY &&
  !!env.CLOUDINARY_API_SECRET;

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key:    env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
} else {
  console.warn('[Cloudinary] Credentials not set — Cloudinary uploads will be skipped, local disk storage will be used.');
}

/**
 * Upload a raw buffer directly to Cloudinary (stream-based).
 * Use this when you have a buffer (e.g. from multer memory storage).
 */
export const uploadToCloudinary = (buffer, folder = 'lifesave', resourceType = 'auto') => {
  if (!isConfigured) throw new Error('Cloudinary is not configured');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, quality: 'auto', fetch_format: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

/**
 * Delete a Cloudinary asset by its public_id.
 * Safe to call even when Cloudinary is not configured.
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!isConfigured || !publicId) return null;
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result;
  } catch (err) {
    console.error('[Cloudinary] Delete error:', err.message);
    return null; // non-fatal
  }
};

export { cloudinary, isConfigured as cloudinaryConfigured };
export default cloudinary;
