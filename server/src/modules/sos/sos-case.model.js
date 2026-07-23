import mongoose from 'mongoose';

const SOSCaseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'resolved', 'false_alarm'],
    default: 'pending'
  },
  silent: {
    type: Boolean,
    default: false
  },
  // Responders matches and notifications
  notifiedEntities: [
    {
      entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
      notifiedAt: { type: Date, default: Date.now }
    }
  ],
  assignedResponder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    default: null
  },
  assignedResponderUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  eta: {
    type: Number, // Estimated time of arrival in minutes
    default: null
  },
  // User Feedback after resolution
  userFeedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String }
  },
  // Responder feedback after resolution
  responderFeedback: {
    isFalseAlarm: { type: Boolean, default: false },
    comment: { type: String }
  },
  // Timeline audit log
  timeline: [
    {
      event: { type: String, required: true },
      details: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ]
}, {
  timestamps: true
});

SOSCaseSchema.index({ location: '2dsphere' });

export default mongoose.model('SOSCase', SOSCaseSchema);
