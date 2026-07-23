import express from 'express';
const router = express.Router();
import { triggerSOS, acceptSOS, resolveSOS, flagFalseAlarm, getActiveCases, getHistory } from './sos.controller.js';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';

router.post('/trigger', protect, triggerSOS);
router.get('/active', protect, getActiveCases);
router.get('/history', protect, getHistory);

// Specific responder operations
router.post('/:id/accept', protect, restrictTo('hospital_admin', 'police', 'rescue_person', 'system_admin'), acceptSOS);
router.post('/:id/resolve', protect, resolveSOS);
router.post('/:id/false-alarm', protect, restrictTo('hospital_admin', 'police', 'rescue_person', 'system_admin'), flagFalseAlarm);

// Target API Route Mappings (as requested by user client specifications)
router.post('/accept/:id', protect, restrictTo('hospital_admin', 'police', 'rescue_person', 'system_admin'), acceptSOS);
router.post('/resolve/:id', protect, resolveSOS);
router.post('/abuse/:id', protect, restrictTo('hospital_admin', 'police', 'rescue_person', 'system_admin'), flagFalseAlarm);

export default router;
