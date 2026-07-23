import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { getNotifications, getUnreadCount, markOneRead, markAllRead } from './notification.controller.js';

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markOneRead);

export default router;
