import express from 'express';
import { register, login, refreshToken, logout, getMe } from './auth.controller.js';
import { updateProfile, uploadProfileImage, uploadIdImage } from '../users/user.controller.js';
import { protect } from '../../middleware/auth.middleware.js';
import { uploadImage } from '../../middleware/upload.middleware.js';

const router = express.Router();

// Public
router.post('/register', register);
router.post('/login',    login);
router.post('/refresh',  refreshToken);
router.post('/logout',   logout);

// Protected
router.get('/me',      protect, getMe);
router.get('/profile', protect, getMe);
router.put('/profile', protect, updateProfile);

// File uploads
router.post('/upload-profile-image', protect, uploadImage.single('profileImage'), uploadProfileImage);
router.post('/upload-id',            protect, uploadImage.single('idImage'),      uploadIdImage);

export default router;
