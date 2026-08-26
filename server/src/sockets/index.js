import SOSCase from '../modules/sos/sos-case.model.js';
import Entity from '../modules/hospitals/entity.model.js';
import { setSocketEmitter } from '../services/sos.service.js';

const handleSockets = (io) => {
  // Bind emitter to SOS service using standardized room/event structure
  setSocketEmitter((room, event, data) => {
    if (room) {
      io.to(room).emit(event, data);
      console.log(`[SOCKET EMIT] Emitted "${event}" to room "${room}"`);
    } else {
      io.emit(event, data);
      console.log(`[SOCKET BROADCAST] Broadcasted "${event}" globally`);
    }
  }, io);

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join room based on user/entity details
    socket.on('join', (data) => {
      const { role, userId, entityId, sosId } = data;

      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined room user:${userId}`);
      }

      if (entityId) {
        socket.join(`entity:${entityId}`);
        console.log(`Socket ${socket.id} joined room entity:${entityId}`);
      }

      if (sosId) {
        socket.join(`sos:${sosId}`);
        console.log(`Socket ${socket.id} joined room sos:${sosId}`);
      }

      if (role === 'system_admin' || role === 'admin') {
        socket.join('admin');
        console.log(`Socket ${socket.id} joined room admin`);
      }
    });

    // Join case room explicitly
    socket.on('join_case', (data) => {
      const { sosId } = data;
      if (sosId) {
        socket.join(`sos:${sosId}`);
        console.log(`Socket ${socket.id} explicitly joined case room sos:${sosId}`);
      }
    });

    // Leave case room explicitly
    socket.on('leave_case', (data) => {
      const { sosId } = data;
      if (sosId) {
        socket.leave(`sos:${sosId}`);
        console.log(`Socket ${socket.id} left case room sos:${sosId}`);
      }
    });

    // Handle user/responder live location update (only during active SOS case)
    socket.on('update_location', async (data) => {
      const { userId, role, longitude, latitude, sosId } = data;
      if (!userId || !longitude || !latitude || !sosId) return;

      try {
        const activeCase = await SOSCase.findById(sosId).exec();
        if (activeCase && ['pending', 'accepted'].includes(activeCase.status)) {
          // Update location of the case in db
          activeCase.location.coordinates = [parseFloat(longitude), parseFloat(latitude)];
          await activeCase.save();

          const eventName = role === 'user' ? 'citizen:location_updated' : 'responder:location_updated';

          const updatePayload = {
            caseId: activeCase._id,
            userId,
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
            timestamp: new Date()
          };

          // Broadcast location to active case room and admin room
          io.to(`sos:${sosId}`).emit(eventName, updatePayload);
          io.to('admin').emit(eventName, updatePayload);
        }
      } catch (error) {
        console.error('Error handling location update socket:', error.message);
      }
    });

    // Handle ambulance live location update (from ambulance tracking app)
    socket.on('update_ambulance_location', async (data) => {
      const { entityId, ambulanceId, latitude, longitude, sosId } = data;
      if (!entityId || !ambulanceId || !latitude || !longitude || !sosId) return;

      try {
        // Update database
        const entity = await Entity.findById(entityId).exec();
        if (entity && entity.type === 'hospital') {
          const ambulance = entity.hospitalResources.ambulances.find(
            (amb) => amb.ambulanceId === ambulanceId
          );
          if (ambulance) {
            ambulance.location.lat = parseFloat(latitude);
            ambulance.location.lng = parseFloat(longitude);
            await entity.save();

            const payload = {
              entityId,
              ambulanceId,
              caseId: sosId,
              location: { lat: parseFloat(latitude), lng: parseFloat(longitude) }
            };

            // Broadcast to the relevant SOS case room and admin room
            io.to(`sos:${sosId}`).emit('ambulance:location_updated', payload);
            io.to('admin').emit('ambulance:location_updated', payload);
          }
        }
      } catch (error) {
        console.error('Error handling ambulance location update socket:', error.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

export default handleSockets;
