import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Ensure app runs in test environment
process.env.NODE_ENV = 'test';

// Import schemas
import User from '../modules/users/user.model.js';
import Entity from '../modules/hospitals/entity.model.js';
import SOSCase from '../modules/sos/sos-case.model.js';
import Booking from '../modules/hospitals/booking.model.js';
import Notification from '../modules/notifications/notification.model.js';

// Import services and helpers
import connectDB from '../config/db.js';
import { triggerSOS, acceptSOS, resolveSOS } from '../services/sos.service.js';
import { getHospitalList, bookBed, cancelBooking } from '../modules/hospitals/hospital.controller.js';
import { fallbackClassifySOS } from '../services/ai.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('=====================================================');
  console.log('   STARTING SAVE LIFE PRODUCTION READINESS SUITE     ');
  console.log('=====================================================');

  // 1. Connect to Database (auto-spawns memory server if standard uri is empty)
  console.log('[DB] Connecting to database...');
  await connectDB();
  console.log('[DB] Connected successfully.');

  // Clean test databases
  await User.deleteMany({});
  await Entity.deleteMany({});
  await SOSCase.deleteMany({});
  await Booking.deleteMany({});
  await Notification.deleteMany({});

  // 2. Setup Seed Data
  console.log('[SEED] Creating mock Citizen, Responder and Hospital...');
  
  const citizen = await User.create({
    name: 'John Citizen',
    email: 'john@citizen.com',
    password: 'password123',
    role: 'user',
    phone: '+919999999999',
    emergencyContacts: [{ name: 'Spouse', relation: 'spouse', phone: '+918888888888' }]
  });

  const responder = await User.create({
    name: 'Officer Bob',
    email: 'bob@police.com',
    password: 'password123',
    role: 'police',
    phone: '+917777777777'
  });

  // Create Hospital physical entity
  const hospital = await Entity.create({
    name: 'City Care Hospital',
    type: 'hospital',
    address: '123 Health Ave',
    contactNumber: '+916666666666',
    location: {
      type: 'Point',
      coordinates: [77.5946, 12.9716] // Bengaluru Latitude/Longitude coordinates
    },
    hospitalResources: {
      roomsTotal: 10,
      roomsOccupied: 2,
      bedsGeneralTotal: 2, // General beds limit
      bedsGeneralOccupied: 0,
      bedsIcuTotal: 1, // ICU beds limit
      bedsIcuOccupied: 0,
      ambulances: [
        {
          ambulanceId: 'AMB-01',
          plateNumber: 'KA-01-EM-1234',
          status: 'available',
          location: { lat: 12.9716, lng: 77.5946 }
        }
      ]
    }
  });
  console.log('[SEED] Mock data created successfully.');

  // 3. Verify Geospatial Coordinates Calculation
  console.log('[TEST] Verifying Geospatial Nearby Hospital Query...');
  // Coordinates close to Bengaluru city center (77.5946, 12.9716)
  const nearbyReq = {
    query: {
      lat: '12.9720',
      lng: '77.5950',
      radius: '1000' // 1km limit
    }
  };
  
  let resJson = {};
  const mockRes = {
    statusCode: 200,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      resJson = data;
      return this;
    }
  };

  await getHospitalList(nearbyReq, mockRes);
  if (resJson.success && resJson.hospitals?.length > 0) {
    console.log(` -> SUCCESS: Found ${resJson.hospitals.length} hospital(s) within 1km.`);
  } else {
    throw new Error('Geospatial hospital nearby search failed.');
  }

  // 4. Verify Atomic Bed Booking Transaction & Overbooking Prevention
  console.log('[TEST] Verifying Atomic Bed Booking & Overbooking rules...');
  
  // Book Bed 1 (General)
  const bookReq1 = {
    app: { get: () => null },
    params: { id: hospital._id.toString() },
    user: citizen,
    body: { patientName: 'Jane Doe', bedType: 'general' }
  };
  await bookBed(bookReq1, mockRes);
  if (!resJson.success || !resJson.booking || resJson.booking.status !== 'confirmed') {
    console.error('[DEBUG] Booking failed. Response payload:', resJson);
    throw new Error('Failed to book first general bed.');
  }
  console.log(' -> General Bed 1 booked successfully.');

  // Book Bed 2 (General)
  const bookReq2 = {
    app: { get: () => null },
    params: { id: hospital._id.toString() },
    user: citizen,
    body: { patientName: 'John Doe', bedType: 'general' }
  };
  await bookBed(bookReq2, mockRes);
  if (!resJson.success || resJson.booking.status !== 'confirmed') {
    throw new Error('Failed to book second general bed.');
  }
  console.log(' -> General Bed 2 booked successfully.');

  // Try Book Bed 3 (Should Fail because total capacity is 2)
  const bookReq3 = {
    app: { get: () => null },
    params: { id: hospital._id.toString() },
    user: citizen,
    body: { patientName: 'Spam Patient', bedType: 'general' }
  };
  let failed = false;
  const mockFailRes = {
    status: (code) => ({
      json: (data) => {
        if (code === 400 && !data.success) {
          failed = true;
        }
      }
    })
  };
  await bookBed(bookReq3, mockFailRes);
  if (!failed) {
    throw new Error('Overbooking check failed: Was able to book more beds than available!');
  }
  console.log(' -> SUCCESS: Prevented overbooking when capacity was reached.');

  // Cancel Booking and verify release
  const bookingToCancel = resJson.booking;
  const cancelReq = {
    app: { get: () => null },
    params: { bookingId: bookingToCancel._id.toString() },
    user: citizen
  };
  await cancelBooking(cancelReq, mockRes);
  
  const updatedHospital = await Entity.findById(hospital._id).exec();
  if (updatedHospital.hospitalResources.bedsGeneralOccupied !== 1) {
    throw new Error('Cancelling booking did not correctly release bed occupied counter.');
  }
  console.log(' -> SUCCESS: Cancelled booking released bed counter.');

  // 5. Verify AI Triage Fallback Severity Logic
  console.log('[TEST] Verifying AI Triage Fallback severity classifier...');
  const description1 = 'I think I am having a heart attack chest pain cannot breathe';
  const result1 = fallbackClassifySOS(description1);
  if (result1.severity !== 'critical' || result1.priority !== 'P0' || result1.category !== 'medical') {
    throw new Error('Critical medical fallback classification failed.');
  }

  const description2 = 'There is a major crash on the highway with injuries';
  const result2 = fallbackClassifySOS(description2);
  if (result2.severity !== 'critical' || result2.category !== 'accident') {
    throw new Error('Accident fallback classification failed.');
  }
  console.log(' -> SUCCESS: Fallback rules classified severity, priority, and category correctly.');

  // 6. Verify end-to-end SOS triggering & ambulance association
  console.log('[TEST] Verifying End-to-End SOS triggers & ambulance dispatch...');
  const clientReqId = 'unique_req_id_123';
  const testCase = await triggerSOS(
    citizen._id,
    77.5946,
    12.9716,
    false,
    'Urgent medical dispatch chest pain cannot breathe',
    clientReqId
  );

  if (testCase.category !== 'medical' || testCase.priority !== 'P0') {
    throw new Error('E2E SOS creation classification mismatch.');
  }
  console.log(' -> SOS Case created successfully with correct AI metrics.');

  // Test Deduplication
  const duplicateCase = await triggerSOS(
    citizen._id,
    77.5946,
    12.9716,
    false,
    'Urgent medical dispatch chest pain',
    clientReqId
  );
  if (duplicateCase._id.toString() !== testCase._id.toString()) {
    throw new Error('Deduplication check failed. Allowed duplicate case creation.');
  }
  console.log(' -> SUCCESS: Deduplicated duplicate requests.');

  // Accept SOS and verify ambulance dispatching
  const acceptedCase = await acceptSOS(testCase._id, responder._id, hospital._id, 8);
  if (acceptedCase.status !== 'accepted' || !acceptedCase.assignedAmbulance) {
    throw new Error('Accept SOS failed to assign responder or dispatch ambulance.');
  }
  
  const dispatchedHospital = await Entity.findById(hospital._id).exec();
  const dispatchedAmbulance = dispatchedHospital.hospitalResources.ambulances[0];
  if (dispatchedAmbulance.status !== 'dispatched' || dispatchedAmbulance.activeSOS.toString() !== testCase._id.toString()) {
    throw new Error('Ambulance was not correctly dispatched or linked.');
  }
  console.log(` -> Responder accepted SOS. Dispatched ambulance ${dispatchedAmbulance.ambulanceId}.`);

  // Resolve SOS and verify ambulance release
  await resolveSOS(testCase._id);
  const finalHospital = await Entity.findById(hospital._id).exec();
  const finalAmbulance = finalHospital.hospitalResources.ambulances[0];
  if (finalAmbulance.status !== 'available' || finalAmbulance.activeSOS !== null) {
    throw new Error('Resolving SOS did not release ambulance back to fleet.');
  }
  console.log(' -> SOS resolved. Ambulance released back to fleet.');
  
  // Verify notifications got created
  const citizenNotifications = await Notification.find({ userId: citizen._id }).exec();
  if (citizenNotifications.length === 0) {
    throw new Error('Notifications were not persisted in MongoDB.');
  }
  console.log(` -> SUCCESS: Persisted ${citizenNotifications.length} notifications in database.`);
  console.log(' -> SUCCESS: Verified full SOS workflow E2E.');

  console.log('=====================================================');
  console.log('   ALL READINESS VERIFICATION CHECKS PASSED          ');
  console.log('=====================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('=====================================================');
  console.error('      VERIFICATION FAILED: ASSERTION ERROR           ');
  console.error('=====================================================');
  console.error(err);
  process.exit(1);
});
