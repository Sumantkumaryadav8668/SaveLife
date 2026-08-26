import Notification from '../modules/notifications/notification.model.js';

/**
 * Create a notification and optionally broadcast via socket
 * @param {object} io - Socket.IO server instance
 * @param {object} data - { userId, type, title, message, metadata }
 */
export const createNotification = async (io, { userId, type, title, message, metadata = {} }) => {
  const notification = await Notification.create({ userId, type, title, message, metadata });

  // Emit real-time event to the specific user's room
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', {
      _id: notification._id,
      type,
      title,
      message,
      metadata,
      read: false,
      createdAt: notification.createdAt,
    });
  }

  return notification;
};

/**
 * Get all notifications for a user
 */
export const getUserNotifications = async (userId, limit = 50) => {
  return Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get unread count for a user
 */
export const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ userId, read: false });
};

/**
 * Mark a notification as read
 */
export const markAsRead = async (notificationId, userId) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
    { new: true }
  );
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId) => {
  return Notification.updateMany({ userId, read: false }, { read: true });
};
