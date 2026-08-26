import express from 'express';
const router = express.Router();
import { 
  getHospitalResources, 
  updateHospitalResources, 
  getHospitalList, 
  bookBed,
  getMyBookings,
  getHospitalBookings,
  cancelBooking,
  completeBooking
} from './hospital.controller.js';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';

// Base endpoints
router.get('/list', protect, getHospitalList);
router.get('/nearby', protect, getHospitalList);
router.get('/:id/resources', protect, getHospitalResources);
router.put('/:id/resources', protect, restrictTo('hospital_admin', 'system_admin'), updateHospitalResources);
router.post('/:id/book-bed', protect, bookBed);

// Bed Booking Transactions Management
router.get('/bookings/my', protect, getMyBookings);
router.get('/:id/bookings', protect, getHospitalBookings);
router.put('/bookings/:bookingId/cancel', protect, cancelBooking);
router.put('/bookings/:bookingId/complete', protect, restrictTo('hospital_admin', 'system_admin'), completeBooking);

export default router;
