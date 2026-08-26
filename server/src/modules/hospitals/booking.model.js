import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  citizenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    required: true,
    index: true
  },
  sosCaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SOSCase',
    default: null,
    index: true
  },
  bedType: {
    type: String,
    enum: ['general', 'icu'],
    required: true
  },
  status: {
    type: String,
    enum: ['reserved', 'confirmed', 'cancelled', 'completed', 'expired'],
    default: 'reserved',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  bookedAt: {
    type: Date,
    default: Date.now
  },
  cancelledAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

export default mongoose.model('Booking', BookingSchema);
