import express from 'express';
const router = express.Router();
import { queryBot, escalateTicket, getTickets, resolveTicket } from './chatbot.controller.js';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';

router.post('/query', protect, queryBot);
router.post('/message', protect, queryBot); // Target mapping as requested
router.post('/escalate', protect, escalateTicket);
router.get('/tickets', protect, restrictTo('system_admin'), getTickets);
router.put('/tickets/:id/resolve', protect, restrictTo('system_admin'), resolveTicket);

export default router;
