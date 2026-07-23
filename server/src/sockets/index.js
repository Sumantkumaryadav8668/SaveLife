import SOSCase from '../modules/sos/sos-case.model.js';
import Entity from '../modules/hospitals/entity.model.js';
import User from '../modules/users/user.model.js';
import { setSocketEmitter } from '../services/sos.service.js';

const handleSockets = (io) => {
  // Bind emitter to SOS service
  setSocketEmitter((event, data) => {
    io.emit(event, data);
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join room based on user/entity details
    socket.on('join', (data) => {
      const { role, userId, entityId } = data;

      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined room user:${userId}`);
      }

      if (entityId) {
        socket.join(`entity:${entityId}`);
        console.log(`Socket ${socket.id} joined room entity:${entityId}`);
      }

      if (role === 'system_admin') {
        socket.join('admin');
        console.log(`Socket ${socket.id} joined room admin`);
      }
    });

    // Handle user live location update (only during active SOS case)
    socket.on('update_location', async (data) => {
      const { userId, longitude, latitude } = data;
      if (!userId || !longitude || !latitude) return;

      try {
        // Privacy-first: Check if user has an active SOS case
        const activeCase = await SOSCase.findOne({
          user: userId,
          status: { $in: ['pending', 'accepted'] }
        }).exec();

        if (activeCase) {
          // Update location of the case in db
          activeCase.location.coordinates = [parseFloat(longitude), parseFloat(latitude)];
          await activeCase.save();

          // Broadcast location to assigned responder entity room and admins
          const updatePayload = {
            caseId: activeCase._id,
            userId,
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
            timestamp: new Date()
          };

          if (activeCase.assignedResponder) {
            io.to(`entity:${activeCase.assignedResponder}`).emit('tracking_update', updatePayload);
          }
          io.to('admin').emit('tracking_update', updatePayload);
        }
      } catch (error) {
        console.error('Error handling location update socket:', error);
      }
    });

    // Handle ambulance live location update (from ambulance tracking app)
    socket.on('update_ambulance_location', async (data) => {
      const { entityId, ambulanceId, latitude, longitude } = data;
      if (!entityId || !ambulanceId || !latitude || !longitude) return;

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

            // Broadcast to hospital admin room
            io.to(`entity:${entityId}`).emit('ambulance_location_update', {
              entityId,
              ambulanceId,
              location: { lat: latitude, lng: longitude }
            });
          }
        }
      } catch (error) {
        console.error('Error handling ambulance location update socket:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

export default handleSockets;
