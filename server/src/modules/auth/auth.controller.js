import User from '../users/user.model.js';
import Entity from '../hospitals/entity.model.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.js';
import jwt from 'jsonwebtoken';

export const register = async (req, res) => {
  const { name, email, password, role, phone, emergencyContacts } = req.body;

  try {
    // 1. Check if user already exists
    const userExists = await User.findOne({ email }).exec();
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // 2. Prevent self-registration as system_admin
    if (role === 'system_admin') {
      return res.status(400).json({ success: false, message: 'Cannot self-register as a System Administrator' });
    }

    // 3. Register user
    const newUser = new User({
      name,
      email,
      password,
      role: role || 'user',
      phone,
      emergencyContacts: emergencyContacts || []
    });

    // 4. For hospital_admin, police, rescue_person: associate with a mock entity of corresponding type if any exist
    if (['hospital_admin', 'police', 'rescue_person'].includes(role)) {
      const typeMap = {
        hospital_admin: 'hospital',
        police: 'police',
        rescue_person: 'rescue'
      };
      // Find the first entity of this type to auto-link for demo purposes
      const entity = await Entity.findOne({ type: typeMap[role] }).exec();
      if (entity) {
        newUser.entityId = entity._id;
      }
    }

    await newUser.save();

    // 5. Generate tokens
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      success: true,
      accessToken,
      user: {
        id:             newUser._id,
        name:           newUser.name,
        email:          newUser.email,
        role:           newUser.role,
        phone:          newUser.phone,
        status:         newUser.status,
        profileImage:   newUser.profileImage,
        idVerification: newUser.idVerification,
        entityId:       newUser.entityId,
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  if(!email || !password)
    return res.status(404).json("Invalid request")

  try {
    // 1. Find user
    const user = await User.findOne({ email }).populate('entityId').exec();
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 2. Validate block status
    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Your account is permanently blocked' });
    }

    // Check suspension
    if (user.status === 'suspended') {
      if (user.suspensionUntil && new Date() > user.suspensionUntil) {
        user.status = 'active';
        user.suspensionUntil = null;
        await user.save();
      } else {
        const remainingTime = Math.ceil((new Date(user.suspensionUntil) - new Date()) / (1000 * 60));
        return res.status(403).json({
          success: false,
          message: `Your account is temporarily suspended. Try again in ${remainingTime} minutes.`
        });
      }
    }

    // 3. Match password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 4. Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      accessToken,
      user: {
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
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const refreshToken = async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No refresh token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'rapidaid_jwt_refresh_secret_key_67890');
    const user = await User.findById(decoded.id).exec();

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Account is blocked' });
    }

    const accessToken = generateAccessToken(user);
    res.json({ success: true, accessToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

export const logout = async (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('entityId').exec();
    res.json({
      success: true,
      user: {
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
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
