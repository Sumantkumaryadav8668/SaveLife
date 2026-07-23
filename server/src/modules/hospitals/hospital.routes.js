import express from 'express';
const router = express.Router();
import { getHospitalResources, updateHospitalResources, getHospitalList, bookBed } from './hospital.controller.js';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';

router.get('/list', protect, getHospitalList);
router.get('/nearby', protect, getHospitalList); // Target mapping as requested
router.get('/:id/resources', protect, getHospitalResources);
router.put('/:id/resources', protect, restrictTo('hospital_admin', 'system_admin'), updateHospitalResources);
router.post('/:id/book-bed', protect, bookBed);

export default router;
