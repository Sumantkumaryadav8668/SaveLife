import Entity from './entity.model.js';
import Booking from './booking.model.js';
import { createNotification } from '../../services/notification.service.js';

export const getHospitalResources = async (req, res) => {
  const { id } = req.params;
  try {
    const hospital = await Entity.findOne({ _id: id, type: 'hospital' }).exec();
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    res.json({ success: true, resources: hospital.hospitalResources, name: hospital.name });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateHospitalResources = async (req, res) => {
  const { id } = req.params;
  const { roomsTotal, roomsOccupied, bedsGeneralTotal, bedsGeneralOccupied, bedsIcuTotal, bedsIcuOccupied, bloodBank, ambulances, doctors } = req.body;

  try {
    const hospital = await Entity.findOne({ _id: id, type: 'hospital' }).exec();
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    if (req.user.role !== 'system_admin' && req.user.entityId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this hospital resource' });
    }

    if (roomsTotal !== undefined) hospital.hospitalResources.roomsTotal = roomsTotal;
    if (roomsOccupied !== undefined) hospital.hospitalResources.roomsOccupied = roomsOccupied;
    if (bedsGeneralTotal !== undefined) hospital.hospitalResources.bedsGeneralTotal = bedsGeneralTotal;
    if (bedsGeneralOccupied !== undefined) hospital.hospitalResources.bedsGeneralOccupied = bedsGeneralOccupied;
    if (bedsIcuTotal !== undefined) hospital.hospitalResources.bedsIcuTotal = bedsIcuTotal;
    if (bedsIcuOccupied !== undefined) hospital.hospitalResources.bedsIcuOccupied = bedsIcuOccupied;
    if (bloodBank !== undefined) hospital.hospitalResources.bloodBank = bloodBank;
    if (ambulances !== undefined) hospital.hospitalResources.ambulances = ambulances;
    if (doctors !== undefined) hospital.hospitalResources.doctors = doctors;

    await hospital.save();
    res.json({ success: true, message: 'Resources updated successfully', resources: hospital.hospitalResources });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalList = async (req, res) => {
  const { lat, lng, radius } = req.query;

  try {
    const query = { type: 'hospital' };

    if (lat && lng) {
      const maxDistance = parseFloat(radius) || 10000; // default 10km radius (in meters)
      query.location = {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: maxDistance
        }
      };
    }

    const hospitals = await Entity.find(query).exec();
    res.json({ success: true, hospitals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bookBed = async (req, res) => {
  const { id } = req.params;
  const { patientName, bedType, sosCaseId } = req.body;

  const type = bedType || 'general';
  if (!['general', 'icu'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid bed type' });
  }

  try {
    const incField = type === 'icu' 
      ? 'hospitalResources.bedsIcuOccupied' 
      : 'hospitalResources.bedsGeneralOccupied';

    const occupiedField = type === 'icu' ? 'hospitalResources.bedsIcuOccupied' : 'hospitalResources.bedsGeneralOccupied';
    const totalField = type === 'icu' ? 'hospitalResources.bedsIcuTotal' : 'hospitalResources.bedsGeneralTotal';

    // Find and update atomically, only if occupied < total
    const hospital = await Entity.findOneAndUpdate(
      {
        _id: id,
        type: 'hospital',
        $expr: {
          $lt: [`$${occupiedField}`, `$${totalField}`]
        }
      },
      {
        $inc: { [incField]: 1 }
      },
      { new: true }
    ).exec();

    if (!hospital) {
      return res.status(400).json({ 
        success: false, 
        message: `No ${type.toUpperCase()} beds available at this hospital or hospital not found.` 
      });
    }

    // Save booking transaction record
    const booking = new Booking({
      citizenId: req.user._id,
      hospitalId: id,
      sosCaseId: sosCaseId || null,
      bedType: type,
      status: 'confirmed',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // expires in 24 hours
    });
    
    await booking.save();

    const io = req.app.get('io');
    await createNotification(io, {
      userId: req.user._id,
      type: 'hospital',
      title: 'Hospital Bed Reserved',
      message: `A ${type.toUpperCase()} bed has been successfully booked at ${hospital.name} for ${patientName || req.user.name}.`
    });

    res.status(201).json({
      success: true,
      message: `Bed successfully booked for ${patientName || req.user.name}`,
      booking,
      resources: hospital.hospitalResources
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ citizenId: req.user._id })
      .populate('hospitalId', 'name address contactNumber address')
      .sort({ createdAt: -1 })
      .exec();
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalBookings = async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.role !== 'system_admin' && req.user.entityId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view bookings for this hospital' });
    }
    const bookings = await Booking.find({ hospitalId: id })
      .populate('citizenId', 'name email phone')
      .sort({ createdAt: -1 })
      .exec();
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  const { bookingId } = req.params;
  try {
    const booking = await Booking.findById(bookingId).exec();
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (
      booking.citizenId.toString() !== req.user._id.toString() && 
      req.user.role !== 'system_admin' && 
      req.user.entityId?.toString() !== booking.hospitalId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'Booking is already complete, expired, or cancelled' });
    }

    // Atomic increment release of beds
    const incField = booking.bedType === 'icu' 
      ? 'hospitalResources.bedsIcuOccupied' 
      : 'hospitalResources.bedsGeneralOccupied';
      
    await Entity.findByIdAndUpdate(booking.hospitalId, { $inc: { [incField]: -1 } });

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();

    const io = req.app.get('io');
    await createNotification(io, {
      userId: booking.citizenId,
      type: 'hospital',
      title: 'Hospital Bed Cancelled',
      message: `Your booking for a ${booking.bedType.toUpperCase()} bed has been cancelled.`
    });

    res.json({ success: true, message: 'Booking cancelled successfully', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const completeBooking = async (req, res) => {
  const { bookingId } = req.params;
  try {
    const booking = await Booking.findById(bookingId).exec();
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (req.user.role !== 'system_admin' && req.user.entityId?.toString() !== booking.hospitalId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to complete this booking' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'Booking is not active' });
    }

    booking.status = 'completed';
    await booking.save();

    res.json({ success: true, message: 'Booking completed successfully', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
