import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
  },
  role: {
    type: String,
    enum: ['user', 'hospital_admin', 'police', 'rescue_person', 'system_admin'],
    default: 'user',
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },
  profileImage: {
    url:      { type: String, default: null },
    publicId: { type: String, default: null },
  },
  emergencyContacts: [
    {
      name:     { type: String, required: true },
      phone:    { type: String, required: true },
      relation: { type: String, required: true },
    }
  ],
  status: {
    type: String,
    enum: ['active', 'suspended', 'blocked'],
    default: 'active',
  },
  suspensionUntil: { type: Date, default: null },
  falseAlarmsCount: { type: Number, default: 0 },
  idVerification: {
    status: {
      type: String,
      enum: ['unsubmitted', 'pending', 'verified', 'rejected'],
      default: 'unsubmitted',
    },
    idImage:      { type: String, default: null },
    idImagePublicId: { type: String, default: null },
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    default: null,
  },
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

UserSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', UserSchema);
