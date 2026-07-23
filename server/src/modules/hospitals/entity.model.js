import mongoose from 'mongoose';

const EntitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Entity name is required'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['hospital', 'police', 'rescue'],
    required: [true, 'Entity type is required'],
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude] - MongoDB stores [lng, lat]
      required: true
    }
  },
  address: {
    type: String,
    required: true
  },
  contactNumber: {
    type: String,
    required: true
  },
  // Hospital resources (only used if type is 'hospital')
  hospitalResources: {
    roomsTotal: { type: Number, default: 20 },
    roomsOccupied: { type: Number, default: 5 },
    bedsGeneralTotal: { type: Number, default: 50 },
    bedsGeneralOccupied: { type: Number, default: 10 },
    bedsIcuTotal: { type: Number, default: 10 },
    bedsIcuOccupied: { type: Number, default: 2 },
    bloodBank: [
      {
        bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
        units: { type: Number, default: 10 }
      }
    ],
    ambulances: [
      {
        ambulanceId: { type: String, required: true },
        plateNumber: { type: String, required: true },
        status: { type: String, enum: ['available', 'dispatched'], default: 'available' },
        location: {
          lat: { type: Number, default: 0 },
          lng: { type: Number, default: 0 }
        }
      }
    ],
    doctors: [
      {
        name: { type: String, required: true },
        department: { type: String, required: true },
        available: { type: Boolean, default: true }
      }
    ]
  }
}, {
  timestamps: true
});

// Set geospatial index for $near or $nearSphere spatial query matching
EntitySchema.index({ location: '2dsphere' });

export default mongoose.model('Entity', EntitySchema);
