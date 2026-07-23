import express from 'express';
const router = express.Router();
import { getUsers, updateUserRole, updateUserStatus, getAuditLogs, getAnalytics } from './admin.controller.js';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';

router.use(protect);
router.use(restrictTo('system_admin'));

router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', updateUserStatus);
router.get('/audit-logs', getAuditLogs);
router.get('/analytics', getAnalytics);

export default router;
