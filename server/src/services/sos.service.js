import SOSCase from '../modules/sos/sos-case.model.js';
import User from '../modules/users/user.model.js';
import Entity from '../modules/hospitals/entity.model.js';
import AuditLog from '../modules/admin/audit-log.model.js';
import { findNearestEntities } from './geo.service.js';
import { classifySOS } from './ai.service.js';
import { sendSMS } from './sms.service.js';
import { createNotification } from './notification.service.js';

// Map to hold timers for running SOS cases
// Key: caseId, Value: { repeatTimer, escalationTimer }
const activeTimers = new Map();

// Helper to notify socket clients
let emitToSocket = null;
let ioInstance = null;
export const setSocketEmitter = (emitter, io) => {
  emitToSocket = emitter;
  ioInstance = io;
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

// Release active ambulance associated with an SOS Case
const releaseAssignedAmbulance = async (activeCase) => {
  try {
    if (activeCase.assignedAmbulance && activeCase.assignedResponder) {
      const entity = await Entity.findById(activeCase.assignedResponder).exec();
      if (entity && entity.type === 'hospital' && entity.hospitalResources?.ambulances) {
        const ambulance = entity.hospitalResources.ambulances.find(
          (amb) => amb.ambulanceId === activeCase.assignedAmbulance
        );
        if (ambulance) {
          ambulance.status = 'available';
          ambulance.activeSOS = null;
          await entity.save();
          console.log(`[AMBULANCE] Released ambulance ${activeCase.assignedAmbulance} back to available.`);
        }
      }
    }
  } catch (err) {
    console.error('[AMBULANCE RELEASE ERROR]', err.message);
  }
};

// Escalate Silent SOS (called if no responder accepts in 2 minutes)
const escalateSilentSOS = async (caseId) => {
  try {
    const activeCase = await SOSCase.findById(caseId).populate('user').exec();
    if (!activeCase || activeCase.status !== 'pending') return;

    console.log(`[ESCALATION] Auto-escalating Silent SOS Case ${caseId}`);
    
    // Find next nearest responders
    const [lng, lat] = activeCase.location.coordinates;
    const allResponders = await findNearestEntities(lng, lat, null, 5);
    
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

    // Link ambulance if hospital
    if (defaultDispatch.type === 'hospital' && defaultDispatch.hospitalResources?.ambulances) {
      const ambulance = defaultDispatch.hospitalResources.ambulances.find(amb => amb.status === 'available');
      if (ambulance) {
        ambulance.status = 'dispatched';
        ambulance.activeSOS = activeCase._id;
        await defaultDispatch.save();
        activeCase.assignedAmbulance = ambulance.ambulanceId;
        activeCase.timeline.push({
          event: 'AMBULANCE_DISPATCHED',
          details: `Ambulance ${ambulance.ambulanceId} (${ambulance.plateNumber}) dispatched automatically.`,
          timestamp: new Date()
        });
      }
    }

    await activeCase.save();

    // Persist real-time notifications in MongoDB & emit
    await createNotification(ioInstance, {
      userId: activeCase.user._id,
      type: 'sos_update',
      title: 'Silent SOS Auto-Accepted',
      message: `Silent SOS auto-dispatched to nearest unit: ${defaultDispatch.name}. ETA: 5 mins.`
    });

    if (activeCase.assignedAmbulance) {
      await createNotification(ioInstance, {
        userId: activeCase.user._id,
        type: 'sos_update',
        title: 'Ambulance Assigned',
        message: `Ambulance unit ${activeCase.assignedAmbulance} has been auto-dispatched.`
      });
    }

    // Clear timers
    clearCaseTimers(caseId);

    if (emitToSocket) {
      // Alert the dispatch entity room
      emitToSocket(`entity:${defaultDispatch._id}`, 'sos:created', {
        case: activeCase,
        userName: activeCase.user.name,
        userPhone: activeCase.user.phone
      });

      // Alert the next nearest entities
      nextNearest.forEach(entity => {
        emitToSocket(`entity:${entity._id}`, 'sos:created', {
          case: activeCase,
          userName: activeCase.user.name,
          userPhone: activeCase.user.phone
        });
      });

      // Notify the active case room
      emitToSocket(`sos:${activeCase._id}`, 'sos:accepted', {
        case: activeCase,
        responderName: defaultDispatch.name,
        eta: 5
      });
      emitToSocket(`sos:${activeCase._id}`, 'sos:status_updated', {
        case: activeCase
      });

      // Update admin maps
      emitToSocket('admin', 'sos:status_updated', { case: activeCase });
    }
  } catch (error) {
    console.error('Error escalating Silent SOS:', error);
  }
};

// Trigger SOS
export const triggerSOS = async (userId, longitude, latitude, silent = false, description = '', clientRequestId = '') => {
  try {
    const user = await User.findById(userId).exec();
    if (!user) throw new Error('User not found');

    // 1. De-duplication check using clientRequestId
    if (clientRequestId) {
      const existingCase = await SOSCase.findOne({ clientRequestId }).exec();
      if (existingCase) {
        console.log(`[DEDUPLICATION] SOS Case with clientRequestId ${clientRequestId} already exists. Returning existing case.`);
        return existingCase;
      }
    }

    // 2. Classify Emergency with Gemini AI triage
    console.log(`[AI TRIAGE] Classifying SOS description: "${description}"...`);
    const aiTriage = await classifySOS(description, { longitude, latitude });
    const { category, severity, priority, reason, confidence } = aiTriage;

    // 3. Selection of appropriate responders based on category & proximity
    let allNotified = [];
    if (category === 'medical') {
      const hospitals = await findNearestEntities(longitude, latitude, 'hospital', 2);
      const rescue = await findNearestEntities(longitude, latitude, 'rescue', 1);
      allNotified = [...hospitals, ...rescue];
    } else if (category === 'fire') {
      const rescue = await findNearestEntities(longitude, latitude, 'rescue', 2);
      const police = await findNearestEntities(longitude, latitude, 'police', 1);
      allNotified = [...rescue, ...police];
    } else if (category === 'police') {
      const police = await findNearestEntities(longitude, latitude, 'police', 2);
      allNotified = [...police];
    } else {
      // accident, flood, earthquake, disaster, other
      const hospitals = await findNearestEntities(longitude, latitude, 'hospital', 2);
      const police = await findNearestEntities(longitude, latitude, 'police', 1);
      const rescue = await findNearestEntities(longitude, latitude, 'rescue', 1);
      allNotified = [...hospitals, ...police, ...rescue];
    }

    const notifiedEntities = allNotified.map(entity => ({
      entity: entity._id,
      notifiedAt: new Date()
    }));

    // 4. Create SOS Case
    const newCase = new SOSCase({
      user: userId,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      silent,
      clientRequestId,
      description,
      category,
      severity,
      priority,
      aiAnalysis: reason,
      aiConfidence: confidence,
      aiProcessedAt: new Date(),
      notifiedEntities,
      status: 'pending',
      timeline: [
        {
          event: 'SOS_TRIGGERED',
          details: `SOS triggered by ${user.name}. Category: ${category}, Severity: ${severity}, Priority: ${priority}.`,
          timestamp: new Date()
        }
      ]
    });

    await newCase.save();

    // Persist real-time notifications in MongoDB & emit
    await createNotification(ioInstance, {
      userId: userId,
      type: 'sos_alert',
      title: 'SOS Registered',
      message: `Your SOS emergency distress signal has been registered (AI Category: ${category.toUpperCase()}, Priority: ${priority}). Nearest emergency units are being matched.`
    });

    // 5. Notify emergency contacts via real SMS abstraction
    const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    user.emergencyContacts.forEach(contact => {
      const msg = `EMERGENCY ALERT: ${user.name} has triggered an SOS! Live location: ${gmapsLink}. Severity: ${severity.toUpperCase()}.`;
      sendSMS(contact.phone, msg).catch(err => console.error('Failed to send SMS to emergency contact:', err.message));
    });

    // Setup active timers structure for this case
    activeTimers.set(newCase._id.toString(), {});

    // 6. Broadcast to Sockets via Rooms
    if (emitToSocket) {
      // Alert appropriate nearest responders
      allNotified.forEach(entity => {
        emitToSocket(`entity:${entity._id}`, 'sos:created', {
          case: newCase,
          userName: user.name,
          userPhone: user.phone
        });
      });

      // Update active maps in admin dashboard
      emitToSocket('admin', 'sos:created', { case: newCase });
    }

    if (silent) {
      // Silent SOS Route auto-escalation check
      const primaryResponder = allNotified[0];
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
      // Standard SOS: Repeat alert every 5 minutes until accepted
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
              emitToSocket(`entity:${entity._id}`, 'sos:created', {
                case: freshCase,
                userName: user.name,
                userPhone: user.phone
              });
            });
          }
        } else {
          clearCaseTimers(newCase._id.toString());
        }
      }, 5 * 60 * 1000);

      activeTimers.get(newCase._id.toString()).repeatTimer = repeatTimerId;
    }

    return newCase;
  } catch (error) {
    console.error('Error triggering SOS:', error);
    throw error;
  }
};

// Accept SOS Case
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

    // Find and assign available ambulance if entity is hospital
    if (entity.type === 'hospital' && entity.hospitalResources?.ambulances) {
      const ambulance = entity.hospitalResources.ambulances.find(amb => amb.status === 'available');
      if (ambulance) {
        ambulance.status = 'dispatched';
        ambulance.activeSOS = activeCase._id;
        await entity.save();
        
        activeCase.assignedAmbulance = ambulance.ambulanceId;
        activeCase.timeline.push({
          event: 'AMBULANCE_DISPATCHED',
          details: `Ambulance ${ambulance.ambulanceId} (${ambulance.plateNumber}) dispatched from ${entity.name}.`,
          timestamp: new Date()
        });
      }
    }

    await activeCase.save();

    // Persist real-time notifications in MongoDB & emit
    await createNotification(ioInstance, {
      userId: activeCase.user._id,
      type: 'sos_update',
      title: 'SOS Emergency Accepted',
      message: `Your SOS has been accepted by ${entity.name}. Responder ${responder.name} is en route (ETA: ${activeCase.eta} minutes).`
    });

    if (activeCase.assignedAmbulance) {
      await createNotification(ioInstance, {
        userId: activeCase.user._id,
        type: 'sos_update',
        title: 'Ambulance Dispatched',
        message: `Ambulance unit ${activeCase.assignedAmbulance} has been assigned and dispatched from ${entity.name}.`
      });
    }

    // Clear timers
    clearCaseTimers(caseId);

    // Notify rooms via socket
    if (emitToSocket) {
      emitToSocket(`sos:${activeCase._id}`, 'sos:accepted', {
        case: activeCase,
        responderName: entity.name,
        responderPhone: entity.contactNumber,
        eta: activeCase.eta
      });
      emitToSocket(`sos:${activeCase._id}`, 'sos:status_updated', {
        case: activeCase
      });
      emitToSocket('admin', 'sos:status_updated', { case: activeCase });
    }

    return activeCase;
  } catch (error) {
    console.error('Error accepting SOS:', error);
    throw error;
  }
};

// Resolve SOS Case
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

    // Release assigned ambulance back to fleet
    await releaseAssignedAmbulance(activeCase);

    await activeCase.save();

    // Persist real-time notifications in MongoDB & emit
    await createNotification(ioInstance, {
      userId: activeCase.user._id,
      type: 'sos_resolved',
      title: 'Emergency Resolved',
      message: 'Your active emergency SOS case has been successfully closed and resolved.'
    });

    if (emitToSocket) {
      emitToSocket(`sos:${activeCase._id}`, 'sos:resolved', {
        case: activeCase
      });
      emitToSocket('admin', 'sos:status_updated', { case: activeCase });
    }

    return activeCase;
  } catch (error) {
    console.error('Error resolving SOS:', error);
    throw error;
  }
};

// Flag False Alarm & Handle Abuse Rules
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

    // Release ambulance
    await releaseAssignedAmbulance(activeCase);

    await activeCase.save();

    // Clear timers
    clearCaseTimers(caseId);

    // Increment user false alarm count
    const distressUser = await User.findById(activeCase.user._id).exec();
    distressUser.falseAlarmsCount += 1;

    let systemAction = 'none';
    let durationHours = 0;

    if (distressUser.falseAlarmsCount >= 5) {
      distressUser.status = 'blocked';
      systemAction = 'PERMANENT_BLOCK';
      
      await AuditLog.create({
        action: 'USER_BLOCK',
        performedBy: flaggerUserId,
        targetUser: distressUser._id,
        details: `Permanently blocked user ${distressUser.name} after reaching ${distressUser.falseAlarmsCount} false alarms.`
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
        details: `Suspended user ${distressUser.name} for 24 hours after reaching ${distressUser.falseAlarmsCount} false alarms.`
      });
    }

    await distressUser.save();

    // Persist real-time notifications in MongoDB & emit
    await createNotification(ioInstance, {
      userId: activeCase.user._id,
      type: 'sos_update',
      title: 'SOS Marked False Alarm',
      message: `Your SOS case has been flagged as a false alarm. System Action: ${systemAction}. False Alarm Count: ${distressUser.falseAlarmsCount}`
    });

    if (emitToSocket) {
      emitToSocket(`sos:${activeCase._id}`, 'sos:status_updated', {
        case: activeCase,
        systemAction,
        suspensionUntil: distressUser.suspensionUntil
      });
      emitToSocket('admin', 'sos:status_updated', { case: activeCase });
    }

    return { activeCase, userStatus: distressUser.status, falseAlarmsCount: distressUser.falseAlarmsCount };
  } catch (error) {
    console.error('Error flagging false alarm:', error);
    throw error;
  }
};
