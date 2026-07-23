import express from 'express';

// Modular core routes
import authRoutes         from '../modules/auth/auth.routes.js';
import sosRoutes          from '../modules/sos/sos.routes.js';
import hospitalRoutes     from '../modules/hospitals/hospital.routes.js';
import chatbotRoutes      from '../modules/chatbot/chatbot.routes.js';
import adminRoutes        from '../modules/admin/admin.routes.js';
import userRoutes         from '../modules/users/user.routes.js';
import notificationRoutes from '../modules/notifications/notification.routes.js';

const router = express.Router();

router.use('/auth',          authRoutes);
router.use('/sos',           sosRoutes);
router.use('/hospital',      hospitalRoutes);
router.use('/hospitals',     hospitalRoutes);
router.use('/chatbot',       chatbotRoutes);
router.use('/admin',         adminRoutes);
router.use('/user',          userRoutes);
router.use('/notifications', notificationRoutes);

export default router;
