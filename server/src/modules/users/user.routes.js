import express from 'express';
import {
  updateProfile,
  uploadProfileImage,
  uploadIdImage,
  getPendingVerifications,
  updateVerificationStatus,
} from './user.controller.js';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';
import { uploadImage } from '../../middleware/upload.middleware.js';

const router = express.Router();

router.use(protect);

router.put('/profile',              updateProfile);
router.post('/upload-profile-image', uploadImage.single('profileImage'), uploadProfileImage);
router.post('/verify-id',           uploadImage.single('idImage'), uploadIdImage);

router.get('/pending-verifications', restrictTo('system_admin', 'hospital_admin'), getPendingVerifications);
router.put('/verifications/:userId',  restrictTo('system_admin', 'hospital_admin'), updateVerificationStatus);

export default router;
