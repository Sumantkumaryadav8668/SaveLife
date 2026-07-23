import jwt from 'jsonwebtoken';
import User from '../modules/users/user.model.js';
import env from '../config/env.js';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id).exec();

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Your account is permanently blocked due to policy violations' });
    }

    if (user.status === 'suspended') {
      if (user.suspensionUntil && new Date() > user.suspensionUntil) {
        user.status = 'active';
        user.suspensionUntil = null;
        await user.save();
      } else {
        const remainingTime = Math.ceil((new Date(user.suspensionUntil) - new Date()) / (1000 * 60));
        return res.status(403).json({ success: false, message: `Your account is temporarily suspended. Try again in ${remainingTime} minutes.` });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Role (${req.user.role}) is not authorized to access this resource` });
    }
    next();
  };
};
