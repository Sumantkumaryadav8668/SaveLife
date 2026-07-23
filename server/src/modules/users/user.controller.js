import User from './user.model.js';
import { deleteFromCloudinary } from '../../services/cloudinary.service.js';

const userPayload = (user) => ({
  id:                user._id,
  name:              user.name,
  email:             user.email,
  role:              user.role,
  phone:             user.phone,
  status:            user.status,
  profileImage:      user.profileImage,
  emergencyContacts: user.emergencyContacts,
  idVerification:    user.idVerification,
  entityId:          user.entityId,
});

export const updateProfile = async (req, res) => {
  const { name, phone, emergencyContacts } = req.body;
  try {
    const user = await User.findById(req.user._id).exec();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name)              user.name              = name;
    if (phone)             user.phone             = phone;
    if (emergencyContacts) user.emergencyContacts = emergencyContacts;

    await user.save();
    res.json({ success: true, message: 'Profile updated successfully', user: userPayload(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const user = await User.findById(req.user._id).exec();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.profileImage?.publicId) {
      await deleteFromCloudinary(user.profileImage.publicId, 'image').catch(() => null);
    }

    const imageUrl      = req.file.path     || `/uploads/${req.file.filename}`;
    const imagePublicId = req.file.filename || null;

    user.profileImage = { url: imageUrl, publicId: imagePublicId };
    await user.save();

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      profileImage: user.profileImage,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadIdImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No ID image file uploaded' });
    }

    const user = await User.findById(req.user._id).exec();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.idVerification?.idImagePublicId) {
      await deleteFromCloudinary(user.idVerification.idImagePublicId, 'image').catch(() => null);
    }

    const imageUrl      = req.file.path     || `/uploads/${req.file.filename}`;
    const imagePublicId = req.file.filename || null;

    user.idVerification.status          = 'pending';
    user.idVerification.idImage         = imageUrl;
    user.idVerification.idImagePublicId = imagePublicId;
    await user.save();

    res.json({
      success: true,
      message: 'ID document uploaded successfully — pending administrator review',
      idVerification: user.idVerification,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPendingVerifications = async (req, res) => {
  try {
    let query = { 'idVerification.status': 'pending' };

    if (req.user.role === 'hospital_admin') {
      if (!req.user.entityId)
        return res.status(400).json({ success: false, message: 'Admin not associated with a hospital' });
      query.entityId = req.user.entityId;
    }

    const users = await User.find(query)
      .select('name email role phone profileImage idVerification entityId')
      .exec();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateVerificationStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  if (!['verified', 'rejected'].includes(status))
    return res.status(400).json({ success: false, message: 'Status must be "verified" or "rejected"' });

  try {
    const target = await User.findById(userId).exec();
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    if (req.user.role === 'hospital_admin') {
      if (target.entityId?.toString() !== req.user.entityId?.toString())
        return res.status(403).json({ success: false, message: 'Not authorized to verify staff of another hospital' });
    }

    target.idVerification.status = status;
    await target.save();

    res.json({
      success: true,
      message: `ID verification updated to "${status}"`,
      user: { id: target._id, name: target.name, idVerification: target.idVerification },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
