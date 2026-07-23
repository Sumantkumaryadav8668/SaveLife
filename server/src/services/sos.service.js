import SOSCase from '../modules/sos/sos-case.model.js';
import User from '../modules/users/user.model.js';
import Entity from '../modules/hospitals/entity.model.js';
import AuditLog from '../modules/admin/audit-log.model.js';
import { findNearestEntities, calculateDistance } from './geo.service.js';

// Map to hold timers for running SOS cases
// Key: caseId, Value: { repeatTimer, escalationTimer }
const activeTimers = new Map();

// Helper to notify socket clients (will be set from socket config)
let emitToSocket = null;
export const setSocketEmitter = (emitter) => {
  emitToSocket = emitter;
};

// Simulated notification helper (FCM / SMS)
const sendSimulatedSMS = (phone, message) => {
  console.log(`\n================ SIMULATED SMS ================\nTO: ${phone}\nMESSAGE: ${message}\n================================================\n`);
};

// Helper: Clear case timers
export const clearCaseTimers = (caseId) => {
  const timers = activeTimers.get(caseId);
  if (timers) {
    if (timers.repeatTimer) {
      clearInterval(timers.repeatTimer);
    }
    if (timers.escalationTimer) {
      clearTimeout(timers.escalationTimer);
    }
    activeTimers.delete(caseId);
    console.log(`[TIMERS] Cleared all timers for case ${caseId}`);
  }
};

// 2. Escalate Silent SOS (called if no responder accepts in 2 minutes)
const escalateSilentSOS = async (caseId) => {
  try {
    const activeCase = await SOSCase.findById(caseId).populate('user').exec();
    if (!activeCase || activeCase.status !== 'pending') return;

    console.log(`[ESCALATION] Auto-escalating Silent SOS Case ${caseId}`);
    
    // Find next nearest responders
    const [lng, lat] = activeCase.location.coordinates;
    const allResponders = await findNearestEntities(lng, lat, null, 5);
    
    // Get the nearest responder that wasn't the first choice, or let's notify the next-nearest + dispatch default nearest automatically
    const defaultDispatch = allResponders[0]; // nearest team
    const nextNearest = allResponders.slice(1, 3); // next top 2 teams

    activeCase.timeline.push({
      event: 'SILENT_SOS_ESCALATED',
      details: `No confirmation within 2 minutes. Auto-dispatching nearest responder ${defaultDispatch.name} and alerting next-nearest: ${nextNearest.map(n => n.name).join(', ')}.`,
      timestamp: new Date()
    });

    // Auto dispatch nearest responder
    activeCase.status = 'accepted';
    activeCase.assignedResponder = defaultDispatch._id;
    activeCase.eta = 5; // Default 5 mins ETA on auto-dispatch
    await activeCase.save();

    // Clear timers
    clearCaseTimers(caseId);

    if (emitToSocket) {
      // Notify the dispatcher
      emitToSocket(`entity:${defaultDispatch._id}:alert`, {
        event: 'AUTO_DISPATCHED',
        caseId: activeCase._id,
        userName: activeCase.user.name,
        userPhone: activeCase.user.phone,
        location: [lng, lat],
        silent: true
      });

      // Alert the next nearest entities
      nextNearest.forEach(entity => {
        emitToSocket(`entity:${entity._id}:alert`, {
          event: 'ESCALATION_ALERT',
          caseId: activeCase._id,
          userName: activeCase.user.name,
          userPhone: activeCase.user.phone,
          location: [lng, lat]
        });
      });

      // Notify the user "Help is on the way"
      emitToSocket(`user:${activeCase.user._id}:sos_update`, {
        event: 'HELP_ON_THE_WAY',
        caseId: activeCase._id,
        responderName: defaultDispatch.name,
        eta: 5
      });

      // Update admin maps
      emitToSocket('admin:sos_update', { event: 'SOS_ESCALATED', case: activeCase });
    }
  } catch (error) {
    console.error('Error escalating Silent SOS:', error);
  }
};

// 1. Trigger SOS
export const triggerSOS = async (userId, longitude, latitude, silent = false) => {
  try {
    const user = await User.findById(userId).exec();
    if (!user) throw new Error('User not found');

    // Find nearest entities: 2 of each type to prevent alert fatigue
    const nearestHospitals = await findNearestEntities(longitude, latitude, 'hospital', 2);
    const nearestPolice = await findNearestEntities(longitude, latitude, 'police', 2);
    const nearestRescue = await findNearestEntities(longitude, latitude, 'rescue', 2);

    const allNotified = [...nearestHospitals, ...nearestPolice, ...nearestRescue];
    const notifiedEntities = allNotified.map(entity => ({
      entity: entity._id,
      notifiedAt: new Date()
    }));

    // Create SOS Case
    const newCase = new SOSCase({
      user: userId,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      silent,
      notifiedEntities,
      status: 'pending',
      timeline: [
        {
          event: 'SOS_TRIGGERED',
          details: `SOS triggered by ${user.name}. Type: ${silent ? 'Silent' : 'Standard'}.`,
          timestamp: new Date()
        }
      ]
    });

    await newCase.save();

    // Notify emergency contacts
    const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    user.emergencyContacts.forEach(contact => {
      const msg = `EMERGENCY ALERT: ${user.name} has triggered an SOS! Live location: ${gmapsLink}. Help is being dispatched.`;
      sendSimulatedSMS(contact.phone, msg);
    });

    // Setup active timers structure for this case
    activeTimers.set(newCase._id.toString(), {});

    // Broadcast to Sockets
    if (emitToSocket) {
      // Alert nearest responders immediately
      allNotified.forEach(entity => {
        emitToSocket(`entity:${entity._id}:alert`, {
          event: 'NEW_SOS_ALERT',
          caseId: newCase._id,
          userName: user.name,
          userPhone: user.phone,
          location: [longitude, latitude],
          silent
        });
      });

      // Update active maps
      emitToSocket('admin:sos_update', { event: 'SOS_TRIGGERED', case: newCase });
    }

    if (silent) {
      // For Silent SOS: Team has 2 minutes to confirm
      // Pick the single closest entity to assign initially
      const primaryResponder = allNotified[0]; // Nearest entity
      if (primaryResponder) {
        newCase.timeline.push({
          event: 'SILENT_ASSIGNMENT',
          details: `Silent SOS route assigned primary responder: ${primaryResponder.name} (${primaryResponder.type}). Awaiting response.`,
          timestamp: new Date()
        });
        await newCase.save();

        const timerId = setTimeout(async () => {
          await escalateSilentSOS(newCase._id.toString());
        }, 2 * 60 * 1000); // 2 minutes
        
        activeTimers.get(newCase._id.toString()).escalationTimer = timerId;
      }
    } else {
      // Standard SOS: Repeat alert every 5 minutes until dispatch acceptance
      const repeatTimerId = setInterval(async () => {
        const freshCase = await SOSCase.findById(newCase._id).exec();
        if (freshCase && freshCase.status === 'pending') {
          console.log(`[ALERT REPEAT] Repeating SOS alert for case ${newCase._id}`);
          freshCase.timeline.push({
            event: 'ALERT_REPEATED',
            details: 'SOS alert repeated to nearest responders (no acceptance yet).',
            timestamp: new Date()
          });
          await freshCase.save();

          if (emitToSocket) {
            allNotified.forEach(entity => {
              emitToSocket(`entity:${entity._id}:alert`, {
                event: 'REPEATED_SOS_ALERT',
                caseId: newCase._id,
                userName: user.name,
                userPhone: user.phone,
                location: [longitude, latitude],
                silent: false
              });
            });
          }
        } else {
          // Case resolved or accepted, clear timer
          clearCaseTimers(newCase._id.toString());
        }
      }, 5 * 60 * 1000); // 5 minutes

      activeTimers.get(newCase._id.toString()).repeatTimer = repeatTimerId;
    }

    return newCase;
  } catch (error) {
    console.error('Error triggering SOS:', error);
    throw error;
  }
};

// 3. Accept SOS Case
export const acceptSOS = async (caseId, responderUserId, entityId, eta) => {
  try {
    const activeCase = await SOSCase.findById(caseId).populate('user').exec();
    if (!activeCase) throw new Error('SOS Case not found');
    if (activeCase.status !== 'pending') throw new Error('Case is already accepted or resolved');

    const entity = await Entity.findById(entityId).exec();
    const responder = await User.findById(responderUserId).exec();

    activeCase.status = 'accepted';
    activeCase.assignedResponder = entityId;
    activeCase.assignedResponderUser = responderUserId;
    activeCase.eta = eta || 10;
    activeCase.timeline.push({
      event: 'CASE_ACCEPTED',
      details: `Case accepted by ${responder.name} from ${entity.name}. ETA: ${eta || 10} minutes.`,
      timestamp: new Date()
    });

    await activeCase.save();

    // Clear any timers
    clearCaseTimers(caseId);

    // Notify User and update Socket clients
    if (emitToSocket) {
      emitToSocket(`user:${activeCase.user._id}:sos_update`, {
        event: 'HELP_ON_THE_WAY',
        caseId: activeCase._id,
        responderName: entity.name,
        responderPhone: entity.contactNumber,
        eta: activeCase.eta
      });

      emitToSocket('admin:sos_update', { event: 'SOS_ACCEPTED', case: activeCase });
    }

    return activeCase;
  } catch (error) {
    console.error('Error accepting SOS:', error);
    throw error;
  }
};

// 4. Resolve SOS Case
export const resolveSOS = async (caseId, feedbackRating = 5, feedbackComment = '') => {
  try {
    const activeCase = await SOSCase.findById(caseId).populate('user').exec();
    if (!activeCase) throw new Error('SOS Case not found');
    if (!['pending', 'accepted'].includes(activeCase.status)) throw new Error('Only active or accepted cases can be resolved');

    activeCase.status = 'resolved';
    activeCase.timeline.push({
      event: 'CASE_RESOLVED',
      details: 'Case successfully resolved by responder.',
      timestamp: new Date()
    });

    if (feedbackRating) {
      activeCase.userFeedback = {
        rating: feedbackRating,
        comment: feedbackComment
      };
    }

    await activeCase.save();

    if (emitToSocket) {
      emitToSocket(`user:${activeCase.user._id}:sos_update`, {
        event: 'CASE_RESOLVED',
        caseId: activeCase._id
      });
      emitToSocket('admin:sos_update', { event: 'SOS_RESOLVED', case: activeCase });
    }

    return activeCase;
  } catch (error) {
    console.error('Error resolving SOS:', error);
    throw error;
  }
};

// 5. Flag False Alarm & Handle Abuse Rules
export const flagFalseAlarm = async (caseId, flaggerUserId, comment = '') => {
  try {
    const activeCase = await SOSCase.findById(caseId).populate('user').exec();
    if (!activeCase) throw new Error('SOS Case not found');
    
    // Mark status
    activeCase.status = 'false_alarm';
    activeCase.responderFeedback = {
      isFalseAlarm: true,
      comment
    };
    activeCase.timeline.push({
      event: 'CASE_MARKED_FALSE_ALARM',
      details: `Case flagged as False Alarm. Comment: ${comment}`,
      timestamp: new Date()
    });

    await activeCase.save();

    // Clear timers
    clearCaseTimers(caseId);

    // Increment user false alarm count
    const distressUser = await User.findById(activeCase.user._id).exec();
    distressUser.falseAlarmsCount += 1;

    let systemAction = 'none';
    let durationHours = 0;
    const systemAdmin = await User.findOne({ role: 'system_admin' }).exec() || { _id: flaggerUserId }; // fallback

    // Abuse Prevention Logic:
    // 3 False alarms -> Suspend for 24 hours
    // 5 False alarms -> Permanently blocked
    if (distressUser.falseAlarmsCount >= 5) {
      distressUser.status = 'blocked';
      systemAction = 'PERMANENT_BLOCK';
      
      await AuditLog.create({
        action: 'USER_BLOCK',
        performedBy: flaggerUserId,
        targetUser: distressUser._id,
        details: `Permanently blocked user ${distressUser.name} (${distressUser.email}) after reaching ${distressUser.falseAlarmsCount} false alarms.`
      });
    } else if (distressUser.falseAlarmsCount >= 3) {
      distressUser.status = 'suspended';
      durationHours = 24;
      distressUser.suspensionUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);
      systemAction = 'SUSPENSION';

      await AuditLog.create({
        action: 'USER_SUSPENSION',
        performedBy: flaggerUserId,
        targetUser: distressUser._id,
        details: `Suspended user ${distressUser.name} (${distressUser.email}) for 24 hours after reaching ${distressUser.falseAlarmsCount} false alarms.`
      });
    }

    await distressUser.save();

    if (emitToSocket) {
      emitToSocket(`user:${activeCase.user._id}:sos_update`, {
        event: 'CASE_MARKED_FALSE_ALARM',
        caseId: activeCase._id,
        systemAction,
        suspensionUntil: distressUser.suspensionUntil
      });
      emitToSocket('admin:sos_update', { event: 'SOS_FALSE_ALARM', case: activeCase });
    }

    return { activeCase, userStatus: distressUser.status, falseAlarmsCount: distressUser.falseAlarmsCount };
  } catch (error) {
    console.error('Error flagging false alarm:', error);
    throw error;
  }
};
