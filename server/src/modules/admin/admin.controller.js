import User from '../users/user.model.js';
import SOSCase from '../sos/sos-case.model.js';
import AuditLog from './audit-log.model.js';
import Entity from '../hospitals/entity.model.js';

export const getUsers = async (req, res) => {
  try {
    const users = await User.find().populate('entityId').select('-password').exec();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role, entityId } = req.body;

  const allowedRoles = ['user', 'hospital_admin', 'police', 'rescue_person', 'system_admin'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  try {
    const userToUpdate = await User.findById(id).exec();
    if (!userToUpdate) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const previousRole = userToUpdate.role;
    userToUpdate.role = role;
    if (entityId !== undefined) {
      userToUpdate.entityId = entityId;
    }

    await userToUpdate.save();

    await AuditLog.create({
      action: 'ROLE_PROMOTION',
      performedBy: req.user._id,
      targetUser: userToUpdate._id,
      details: `Promoted user ${userToUpdate.name} (${userToUpdate.email}) from ${previousRole} to ${role}.`
    });

    res.json({
      success: true,
      message: `User role updated successfully to ${role}`,
      user: {
        id: userToUpdate._id,
        name: userToUpdate.name,
        role: userToUpdate.role,
        entityId: userToUpdate.entityId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status, suspensionDurationHours } = req.body;

  if (!['active', 'suspended', 'blocked'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  try {
    const userToUpdate = await User.findById(id).exec();
    if (!userToUpdate) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const previousStatus = userToUpdate.status;
    userToUpdate.status = status;

    let logAction = 'USER_STATUS_CHANGE';
    let detailMsg = `Changed user ${userToUpdate.name} status from ${previousStatus} to ${status}.`;

    if (status === 'suspended') {
      const hours = parseInt(suspensionDurationHours) || 24;
      userToUpdate.suspensionUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
      logAction = 'USER_SUSPENSION';
      detailMsg = `Suspended user ${userToUpdate.name} for ${hours} hours until ${userToUpdate.suspensionUntil.toISOString()}.`;
    } else if (status === 'active') {
      userToUpdate.suspensionUntil = null;
      userToUpdate.falseAlarmsCount = 0;
      logAction = 'USER_REACTIVATION';
      detailMsg = `Manually reactivated/unblocked user ${userToUpdate.name}.`;
    } else if (status === 'blocked') {
      userToUpdate.suspensionUntil = null;
      logAction = 'USER_BLOCK';
      detailMsg = `Permanently blocked user ${userToUpdate.name}.`;
    }

    await userToUpdate.save();

    await AuditLog.create({
      action: logAction,
      performedBy: req.user._id,
      targetUser: userToUpdate._id,
      details: detailMsg
    });

    res.json({
      success: true,
      message: `User status successfully updated to ${status}`,
      user: {
        id: userToUpdate._id,
        name: userToUpdate.name,
        status: userToUpdate.status,
        suspensionUntil: userToUpdate.suspensionUntil
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('performedBy', 'name email role')
      .populate('targetUser', 'name email role')
      .sort({ createdAt: -1 })
      .exec();
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const cases = await SOSCase.find().populate('assignedResponder').exec();
    
    let pending = 0;
    let accepted = 0;
    let resolved = 0;
    let falseAlarm = 0;

    cases.forEach(c => {
      if (c.status === 'pending') pending++;
      else if (c.status === 'accepted') accepted++;
      else if (c.status === 'resolved') resolved++;
      else if (c.status === 'false_alarm') falseAlarm++;
    });

    let hospitalCases = 0;
    let policeCases = 0;
    let rescueCases = 0;

    cases.forEach(c => {
      if (c.assignedResponder) {
        if (c.assignedResponder.type === 'hospital') hospitalCases++;
        if (c.assignedResponder.type === 'police') policeCases++;
        if (c.assignedResponder.type === 'rescue') rescueCases++;
      }
    });

    let totalResponseTimeMs = 0;
    let acceptedCount = 0;

    cases.forEach(c => {
      const acceptEvent = c.timeline.find(t => t.event === 'CASE_ACCEPTED');
      if (acceptEvent) {
        const diff = new Date(acceptEvent.timestamp) - new Date(c.createdAt);
        totalResponseTimeMs += diff;
        acceptedCount++;
      }
    });

    const averageResponseTimeMins = acceptedCount > 0 
      ? Math.round((totalResponseTimeMs / acceptedCount) / (1000 * 60)) 
      : 0;

    const usersCount = await User.countDocuments({ role: 'user' }).exec();
    const hospitalAdminsCount = await User.countDocuments({ role: 'hospital_admin' }).exec();
    const policeCount = await User.countDocuments({ role: 'police' }).exec();
    const rescueCount = await User.countDocuments({ role: 'rescue_person' }).exec();

    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      return d;
    }).reverse();

    const historicalData = await Promise.all(last7Days.map(async (day) => {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const count = await SOSCase.countDocuments({
        createdAt: { $gte: day, $lt: nextDay }
      }).exec();
      const resolvedCount = await SOSCase.countDocuments({
        status: 'resolved',
        updatedAt: { $gte: day, $lt: nextDay }
      }).exec();

      return {
        date: day.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
        cases: count,
        resolved: resolvedCount
      };
    }));

    res.json({
      success: true,
      summary: {
        totalCases: cases.length,
        pending,
        accepted,
        resolved,
        falseAlarm,
        averageResponseTimeMins
      },
      types: [
        { name: 'Medical / Hospital', value: hospitalCases },
        { name: 'Police Dispatch', value: policeCases },
        { name: 'Rescue / Fire', value: rescueCases }
      ],
      roles: {
        user: usersCount,
        hospital_admin: hospitalAdminsCount,
        police: policeCount,
        rescue_person: rescueCount
      },
      history: historicalData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
